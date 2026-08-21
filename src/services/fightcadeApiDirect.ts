import { CloudflareSession } from './cloudflareSession';

/**
 * Direct Fightcade API interface with pagination support
 * This bypasses the fightcade-api library limitations to access more players
 */

interface FightcadeAPIResponse {
  res: string;
  results?: {
    count: number;
    results: any[];
  } | any; // For ranking responses
  user?: any; // For getUser responses - actual user data is here
  name?: string; // For getUser responses
  gameinfo?: any; // For getUser responses
}

export class FightcadeApiDirect {
  private static readonly API_URL = 'https://www.fightcade.com/api/';
  private static readonly SEARCH_RANKINGS = 'searchrankings';
  private static readonly GET_USER = 'getuser';
  /** Parallel user lookups to allow — bursts are what get a clearance re-scored. */
  private static readonly USER_CONCURRENCY = 4;
  /** Attempts per request before giving up, covering transient 5xx and network errors. */
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly RETRY_BASE_MS = 2000;
  /** Pause between ranking pages. Tunable because politeness is a judgement call. */
  private static readonly BATCH_DELAY_MS = Number(process.env.FC_BATCH_DELAY_MS ?? 1000);

  /**
   * POST to the Fightcade API carrying our Cloudflare clearance.
   *
   * Two failure modes get handled here. A 403 means the clearance went stale
   * (Cloudflare rotates it on IP changes and re-scoring), so we earn a new one
   * and retry. A 5xx or 429 is Fightcade having a moment — during a full
   * ranking crawl that's a near-certainty, so we back off and try again rather
   * than throwing away a run that's most of the way done.
   */
  private static async post(request: Record<string, unknown>): Promise<FightcadeAPIResponse> {
    let refreshedClearance = false;
    let lastError = 'unknown error';

    for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        // 2s, 4s, 8s, 16s — long enough for a blip to clear, short enough that
        // a full crawl still finishes in one sitting.
        const backoff = this.RETRY_BASE_MS * 2 ** (attempt - 2);
        console.warn(`⏳ ${lastError} — retrying in ${backoff / 1000}s (attempt ${attempt}/${this.MAX_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }

      let response: Response;
      try {
        response = await fetch(this.API_URL, {
          method: 'POST',
          headers: await CloudflareSession.headers(),
          body: JSON.stringify(request),
        });
      } catch (error) {
        // DNS hiccup, connection reset, socket timeout — all worth retrying.
        lastError = `Network error: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      if (response.status === 403) {
        if (!refreshedClearance) {
          console.warn('🔄 Cloudflare challenged us — earning a fresh clearance...');
          refreshedClearance = true;
          await CloudflareSession.refresh();
          continue;
        }
        throw new Error(
          'Blocked by Cloudflare even after refreshing clearance. ' +
          'Run `npm run refresh-clearance` on a machine with a real display.'
        );
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        continue;
      }

      if (!response.ok) {
        // 4xx that isn't a challenge means we asked for something wrong;
        // retrying would just repeat the mistake.
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as FightcadeAPIResponse;
    }

    throw new Error(`Gave up after ${this.MAX_ATTEMPTS} attempts. Last failure: ${lastError}`);
  }

  /**
   * Fetch rankings with pagination support
   * @param gameId - The game ID (e.g., 'sfiii3nr1')
   * @param options - Options for the request
   */
  static async getRankingsWithPagination(
    gameId: string,
    options: {
      byElo?: boolean;
      recent?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ players: any[]; totalCount: number }> {
    const {
      byElo = false,
      recent = false,
      limit = 100, // Try higher limit
      offset = 0
    } = options;

    const request = {
      req: this.SEARCH_RANKINGS,
      gameid: gameId,
      byElo,
      recent,
      ...(limit && { limit }),
      ...(offset && { offset })
    };

    console.log(`🔍 Trying direct API call with params:`, request);

    try {
      const data = await this.post(request);

      if (data.res !== 'OK') {
        throw new Error(`API Error: ${data.res}`);
      }

      console.log(`✅ API returned ${data.results.results.length} players (offset ${offset})`);

      return {
        players: data.results.results,
        totalCount: data.results.count
      };
    } catch (error) {
      console.error('❌ Direct API call failed:', error);
      throw error;
    }
  }

  /**
   * Get user data by username - perfect for local scenes! 🎮
   * @param username - The Fightcade username to lookup
   */
  static async getUser(username: string): Promise<any> {
    const request = {
      req: this.GET_USER,
      username
    };

    console.log(`👤 Fetching user data for: ${username}`);

    try {
      const data = await this.post(request);

      if (data.res !== 'OK') {
        if (data.res === 'ERROR_USER_NOT_FOUND') {
          return null; // User doesn't exist
        }
        throw new Error(`API Error: ${data.res}`);
      }

      console.log(`✅ Successfully fetched user data for ${username}`);

      // Return the actual user data - it seems to be in data.user, not data.results
      return data.user || data.results;
    } catch (error) {
      console.error(`❌ Failed to fetch user ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple users in parallel - efficient for local scenes! ⚡
   * @param usernames - Array of Fightcade usernames to lookup
   */
  static async getUsers(usernames: string[]): Promise<{ [username: string]: any }> {
    console.log(`👥 Fetching data for ${usernames.length} users (${this.USER_CONCURRENCY} at a time)...`);

    const fetchOne = async (username: string) => {
      try {
        const userData = await this.getUser(username);
        return { username, data: userData, found: userData !== null };
      } catch (error) {
        console.warn(`⚠️ Failed to fetch user ${username}:`, error);
        return { username, data: null, found: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    const results: Array<{ username: string; data: any; found: boolean; error?: string }> = [];
    for (let i = 0; i < usernames.length; i += this.USER_CONCURRENCY) {
      const batch = usernames.slice(i, i + this.USER_CONCURRENCY);
      results.push(...(await Promise.all(batch.map(fetchOne))));
    }
    
    const userMap: { [username: string]: any } = {};
    results.forEach(({ username, data, found, error }) => {
      userMap[username] = {
        data,
        found,
        ...(error && { error })
      };
    });

    const foundCount = results.filter(r => r.found).length;
    console.log(`✅ Successfully fetched ${foundCount}/${usernames.length} users`);

    return userMap;
  }

  /**
   * Fetch ALL rankings by making multiple paginated requests
   * @param gameId - The game ID
   * @param maxPlayers - Maximum number of players to fetch (safety limit)
   */
  static async getAllRankings(
    gameId: string,
    maxPlayers: number = 100000  // Much higher limit to get ALL tiers including B, C, D, E players
  ): Promise<{ players: any[]; totalCount: number; complete: boolean }> {
    const allPlayers: any[] = [];
    let offset = 0;
    const batchSize = 100;
    let totalCount = 0;

    console.log(`🚀 Fetching ALL rankings for ${gameId} (max ${maxPlayers})...`);
    console.log(`📊 This will include players from ALL skill tiers (S, A, B, C, D, E)`);

    try {
      while (allPlayers.length < maxPlayers) {
        const result = await this.getRankingsWithPagination(gameId, {
          byElo: false,  // Keep false to get by rank order, but fetch much more
          recent: false, // Keep false to get all-time rankings
          limit: batchSize,
          offset
        });

        if (result.players.length === 0) {
          console.log('📄 No more players available');
          break;
        }

        allPlayers.push(...result.players);
        totalCount = result.totalCount;
        
        // Track rank distribution as we fetch
        const rankCounts: { [key: number]: number } = {};
        result.players.forEach(player => {
          const gameInfo = player.gameinfo && player.gameinfo[gameId];
          const rank = gameInfo?.rank || 1;
          rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });
        
        const rankSummary = Object.entries(rankCounts)
          .map(([rank, count]) => `Rank ${rank}: ${count}`)
          .join(', ');
        
        console.log(`📊 Fetched ${allPlayers.length} of ${totalCount} players... Current batch: ${rankSummary}`);

        // If we got fewer players than requested, we've reached the end
        if (result.players.length < batchSize) {
          console.log('📄 Reached end of available data');
          break;
        }

        // If we've reached the total count, stop
        if (allPlayers.length >= totalCount) {
          console.log('📄 Fetched all available players');
          break;
        }

        offset += batchSize;
        
        // Stay polite between pages.
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
      }

      // Final rank distribution summary
      const finalRankCounts: { [key: number]: number } = {};
      allPlayers.forEach(player => {
        const gameInfo = player.gameinfo && player.gameinfo[gameId];
        const rank = gameInfo?.rank || 1;
        finalRankCounts[rank] = (finalRankCounts[rank] || 0) + 1;
      });
      
      console.log(`🎉 Successfully fetched ${allPlayers.length} total players!`);
      console.log(`📈 Final rank distribution:`);
      Object.entries(finalRankCounts)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
        .forEach(([rank, count]) => {
          const tier = ['E', 'D', 'C', 'B', 'A', 'S'][parseInt(rank) - 1] || 'Unknown';
          console.log(`   Rank ${rank} (${tier} tier): ${count} players`);
        });
      
      return {
        players: allPlayers.slice(0, maxPlayers), // Ensure we don't exceed our limit
        totalCount: Math.min(totalCount, allPlayers.length),
        complete: true
      };

    } catch (error) {
      console.error('❌ Failed to fetch all rankings:', error);
      
      // Hand back what we managed to fetch, flagged as incomplete so the
      // caller can decide whether it's safe to overwrite good data with it.
      if (allPlayers.length > 0) {
        console.log(`⚠️ Partial crawl: ${allPlayers.length} players before the error`);
        return {
          players: allPlayers,
          totalCount: Math.max(allPlayers.length, totalCount),
          complete: false
        };
      }
      
      throw error;
    }
  }
}
