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
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FC-Rank-Search/1.0.0'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as FightcadeAPIResponse;
      
      if (data.res !== 'OK') {
        throw new Error(`API Error: ${data.res}`);
      }

      console.log(`✅ API returned ${data.results.results.length} of ${data.results.count} total players`);

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
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FC-Rank-Search/1.0.0'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as FightcadeAPIResponse;
      
      if (data.res !== 'OK') {
        if (data.res === 'ERROR_USER_NOT_FOUND') {
          return null; // User doesn't exist
        }
        throw new Error(`API Error: ${data.res}`);
      }

      console.log(`✅ Successfully fetched user data for ${username}`);
      console.log(`🔍 Raw API response for ${username}:`, JSON.stringify(data, null, 2));
      console.log(`🔍 API response structure for ${username}:`, {
        topLevelKeys: Object.keys(data),
        hasUser: !!data.user,
        hasResults: !!data.results,
        hasName: !!data.name,
        hasGameinfo: !!data.gameinfo,
        userKeys: data.user ? Object.keys(data.user) : null,
        resultsKeys: data.results ? Object.keys(data.results) : null
      });
      
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
    console.log(`👥 Fetching data for ${usernames.length} users in parallel...`);

    const userPromises = usernames.map(async (username) => {
      try {
        const userData = await this.getUser(username);
        return { username, data: userData, found: userData !== null };
      } catch (error) {
        console.warn(`⚠️ Failed to fetch user ${username}:`, error);
        return { username, data: null, found: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.all(userPromises);
    
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
  ): Promise<{ players: any[]; totalCount: number }> {
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
        
        // Add a longer delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        totalCount: Math.min(totalCount, allPlayers.length)
      };

    } catch (error) {
      console.error('❌ Failed to fetch all rankings:', error);
      
      // Return what we managed to fetch
      if (allPlayers.length > 0) {
        console.log(`⚠️ Returning partial data: ${allPlayers.length} players`);
        console.log(`💡 To get more players, try running the fetch again later to avoid rate limits`);
        return {
          players: allPlayers,
          totalCount: Math.max(allPlayers.length, totalCount)
        };
      }
      
      throw error;
    }
  }
}
