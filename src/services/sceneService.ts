import fs from 'fs';
import path from 'path';
import { FightcadeApiDirect } from './fightcadeApiDirect';
import { DataFetcher } from './dataFetcher';
import { SearchService } from './searchService';
import { PlayerCache } from './playerCache';

export interface Scene {
  id: string;
  name: string;
  description: string;
  gameId: string;
  gameName: string;
  players: string[];
  createdAt: string;
  submittedBy: string;
}

export interface SceneConfig {
  scenes: Scene[];
  metadata: {
    lastUpdated: string;
    version: string;
    totalScenes: number;
  };
}

export class SceneService {
  private scenesPath: string;
  private scenesCache: SceneConfig | null = null;
  private cacheTimestamp: number = 0;
  private playerCache: PlayerCache;
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private dataFetcher: DataFetcher;
  private searchService: SearchService;

  constructor(playerCache?: PlayerCache) {
    this.scenesPath = path.join(process.cwd(), 'data', 'scenes.json');
    this.dataFetcher = new DataFetcher();
    this.searchService = new SearchService();
    this.playerCache = playerCache || new PlayerCache();
  }

  private loadScenes(): SceneConfig {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.scenesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.scenesCache;
    }

    try {
      if (!fs.existsSync(this.scenesPath)) {
        // Create default scenes file if it doesn't exist
        const defaultConfig: SceneConfig = {
          scenes: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            totalScenes: 0
          }
        };
        
        // Ensure data directory exists
        const dataDir = path.dirname(this.scenesPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(this.scenesPath, JSON.stringify(defaultConfig, null, 2));
        this.scenesCache = defaultConfig;
        this.cacheTimestamp = now;
        return defaultConfig;
      }

      const data = fs.readFileSync(this.scenesPath, 'utf8');
      const config = JSON.parse(data) as SceneConfig;
      
      // Validate the structure
      if (!config.scenes || !Array.isArray(config.scenes)) {
        throw new Error('Invalid scenes.json structure: missing scenes array');
      }
      
      // Update cache
      this.scenesCache = config;
      this.cacheTimestamp = now;
      
      return config;
    } catch (error) {
      console.error('Error loading scenes:', error);
      // Return empty config on error
      const emptyConfig: SceneConfig = {
        scenes: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          totalScenes: 0
        }
      };
      return emptyConfig;
    }
  }

  // Get all scenes
  getAllScenes(): Scene[] {
    const config = this.loadScenes();
    return config.scenes;
  }

  // Get scenes by game ID
  getScenesByGame(gameId: string): Scene[] {
    const config = this.loadScenes();
    return config.scenes.filter(scene => scene.gameId === gameId);
  }

  // Get a specific scene by ID
  getScene(id: string): Scene | null {
    const config = this.loadScenes();
    return config.scenes.find(scene => scene.id === id) || null;
  }

  // Get available games from scenes
  getAvailableGames(): { gameId: string; gameName: string; sceneCount: number }[] {
    const config = this.loadScenes();
    const gameMap = new Map<string, { gameName: string; count: number }>();
    
    config.scenes.forEach(scene => {
      const existing = gameMap.get(scene.gameId);
      if (existing) {
        existing.count++;
      } else {
        gameMap.set(scene.gameId, { gameName: scene.gameName, count: 1 });
      }
    });
    
    return Array.from(gameMap.entries()).map(([gameId, data]) => ({
      gameId,
      gameName: data.gameName,
      sceneCount: data.count
    }));
  }

  // Get scene statistics
  getSceneStats(): {
    totalScenes: number;
    totalPlayers: number;
    gamesWithScenes: number;
    averagePlayersPerScene: number;
    lastUpdated: string;
  } {
    const config = this.loadScenes();
    const totalPlayers = config.scenes.reduce((sum, scene) => sum + scene.players.length, 0);
    const uniqueGames = new Set(config.scenes.map(scene => scene.gameId)).size;
    
    return {
      totalScenes: config.scenes.length,
      totalPlayers,
      gamesWithScenes: uniqueGames,
      averagePlayersPerScene: config.scenes.length > 0 ? Math.round(totalPlayers / config.scenes.length) : 0,
      lastUpdated: config.metadata.lastUpdated
    };
  }

  // Clear cache (useful for development/testing)
  clearCache(): void {
    this.scenesCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * HYBRID APPROACH: Use cached rankings + selective live updates! 🧠⚡
   * Much smarter than pure live data - avoids rate limits while staying current!
   */
  async getSceneWithHybridData(sceneId: string): Promise<{
    scene: Scene;
    playerData: Array<{
      username: string;
      rank: number;
      elo: number;
      totalMatches: number;
      country: string;
      dataSource: 'cached' | 'live' | 'not-found';
      lastUpdated?: string;
    }>;
    stats: {
      totalPlayers: number;
      playersFound: number;
      cachedData: number;
      liveData: number;
      notFound: number;
    };
  } | null> {
    const scene = this.getScene(sceneId);
    if (!scene) {
      return null;
    }

    console.log(`🧠 Using HYBRID approach for scene "${scene.name}" - cached rankings + selective live updates...`);

    try {
      // Step 1: Load our comprehensive cached ranking data
      const gameData = await this.dataFetcher.loadGameData(scene.gameId);
      const playerData: any[] = [];
      let cachedCount = 0;
      let liveCount = 0;
      let notFoundCount = 0;

      if (gameData) {
        console.log(`📊 Found ${gameData.totalPlayers} players in cached ${scene.gameName} rankings`);
        
        // Step 2: For each scene player, try to find them in our comprehensive data
        for (const username of scene.players) {
          const cachedPlayer = this.searchService.findPlayerByName(gameData.players, username);
          
          if (cachedPlayer) {
            // Found in cache - use cached data as base
            playerData.push({
              username,
              rank: cachedPlayer.rank,
              elo: cachedPlayer.elo,
              totalMatches: cachedPlayer.totalMatches,
              country: cachedPlayer.country,
              dataSource: 'cached',
              lastUpdated: gameData.lastUpdated
            });
            cachedCount++;
            console.log(`📊 ${username}: Found in cache (rank #${cachedPlayer.rank})`);
          } else {
            // Not in cache - this player might be new or have a different name
            console.log(`🔍 ${username}: Not in cache, checking live data...`);
            
            try {
              // Step 3: Only use live API for players not in our cache
              const liveData = await FightcadeApiDirect.getUser(username);
              
              // Debug: Log the actual API response structure
              console.log(`🔍 ${username} API response:`, {
                hasData: !!liveData,
                hasGameinfo: !!(liveData && liveData.gameinfo),
                availableGames: liveData && liveData.gameinfo ? Object.keys(liveData.gameinfo) : [],
                lookingForGame: scene.gameId,
                hasTargetGame: !!(liveData && liveData.gameinfo && liveData.gameinfo[scene.gameId])
              });
              
              if (liveData && liveData.gameinfo && liveData.gameinfo[scene.gameId]) {
                const gameInfo = liveData.gameinfo[scene.gameId];
                const estimatedElo = 1000 + ((gameInfo.rank || 1) - 1) * 200;
                
                // IMPORTANT: gameInfo.rank is the Fightcade tier (1-6), NOT global position!
                // We should set rank to 0 for live data since we don't have their actual global position
                playerData.push({
                  username,
                  rank: 0, // Set to 0 since live API doesn't give us global ranking position
                  elo: estimatedElo,
                  totalMatches: gameInfo.num_matches || 0,
                  country: liveData.country || 'Unknown',
                  dataSource: 'live',
                  lastUpdated: new Date().toISOString()
                });
                liveCount++;
                console.log(`⚡ ${username}: Live data fetched (tier ${gameInfo.rank}, no global rank available)`);
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
              } else {
                // Not found anywhere
                playerData.push({
                  username,
                  rank: 0,
                  elo: 0,
                  totalMatches: 0,
                  country: 'Unknown',
                  dataSource: 'not-found'
                });
                notFoundCount++;
                console.log(`❌ ${username}: Not found in live data either`);
              }
            } catch (error) {
              console.warn(`⚠️ Live API failed for ${username}, marking as not found:`, error);
              playerData.push({
                username,
                rank: 0,
                elo: 0,
                totalMatches: 0,
                country: 'Unknown',
                dataSource: 'not-found'
              });
              notFoundCount++;
            }
          }
        }
      } else {
        // No cached data available, fallback to pure live approach (with rate limiting)
        console.log(`⚠️ No cached data for ${scene.gameId}, falling back to live-only approach...`);
        const liveResult = await this.getSceneWithLivePlayerData(sceneId);
        if (!liveResult) return null;
        
        // Convert live result to hybrid format
        const convertedPlayerData = liveResult.playerData.map(p => {
          if (!p.found || !p.data) {
            return {
              username: p.username,
              rank: 0,
              elo: 0,
              totalMatches: 0,
              country: 'Unknown',
              dataSource: 'not-found' as const
            };
          }
          
          // Player found in live data
          const gameInfo = p.data.gameinfo && p.data.gameinfo[scene.gameId];
          if (gameInfo) {
            const estimatedElo = 1000 + ((gameInfo.rank || 1) - 1) * 200;
            return {
              username: p.username,
              rank: 0, // Live API doesn't give global ranking position
              elo: estimatedElo,
              totalMatches: gameInfo.num_matches || 0,
              country: p.data.country || 'Unknown',
              dataSource: 'live' as const
            };
          } else {
            return {
              username: p.username,
              rank: 0,
              elo: 0,
              totalMatches: 0,
              country: 'Unknown',
              dataSource: 'not-found' as const
            };
          }
        });
        
        const liveCount = convertedPlayerData.filter(p => p.dataSource === 'live').length;
        const notFoundCount = convertedPlayerData.filter(p => p.dataSource === 'not-found').length;
        
        return {
          scene: liveResult.scene,
          playerData: convertedPlayerData,
          stats: {
            totalPlayers: scene.players.length,
            playersFound: liveCount,
            cachedData: 0,
            liveData: liveCount,
            notFound: notFoundCount
          }
        };
      }

      // Sort players by rank (cached ranks are more reliable)
      playerData.sort((a, b) => {
        if (a.rank === 0 && b.rank === 0) return 0;
        if (a.rank === 0) return 1;
        if (b.rank === 0) return -1;
        return a.rank - b.rank;
      });

      const stats = {
        totalPlayers: scene.players.length,
        playersFound: cachedCount + liveCount,
        cachedData: cachedCount,
        liveData: liveCount,
        notFound: notFoundCount
      };

      console.log(`✅ Hybrid data complete: ${cachedCount} cached, ${liveCount} live, ${notFoundCount} not found`);

      return {
        scene,
        playerData,
        stats
      };

    } catch (error) {
      console.error(`❌ Hybrid approach failed for scene ${sceneId}:`, error);
      
      // Ultimate fallback to cached-only approach
      console.log(`🔄 Falling back to cached-only approach...`);
      const response = await fetch(`http://localhost:3000/api/scenes/${sceneId}`);
      if (response.ok) {
        const fallbackData = await response.json();
        const fallback = fallbackData as any;
        return {
          scene: fallback.scene,
          playerData: fallback.playerStats?.map((p: any) => ({
            username: p.originalName || p.name,
            rank: p.rank || 0,
            elo: p.elo || 0,
            totalMatches: p.totalMatches || 0,
            country: p.country || 'Unknown',
            dataSource: 'cached' as const
          })) || [],
          stats: {
            totalPlayers: scene.players.length,
            playersFound: fallback.playerStats?.length || 0,
            cachedData: fallback.playerStats?.length || 0,
            liveData: 0,
            notFound: scene.players.length - (fallback.playerStats?.length || 0)
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Get real-time player data for a scene using getuser API 🚀
   * This is much better than scraped rank data - always fresh! ✨
   * NOTE: Now mainly used as fallback when cached data is unavailable
   */
  async getSceneWithLivePlayerData(sceneId: string): Promise<{
    scene: Scene;
    playerData: Array<{
      username: string;
      data: any;
      found: boolean;
      error?: string;
    }>;
  } | null> {
    const scene = this.getScene(sceneId);
    if (!scene) {
      return null;
    }

    console.log(`🎮 Fetching live player data for scene "${scene.name}" with ${scene.players.length} players...`);

    try {
      const userDataMap = await FightcadeApiDirect.getUsers(scene.players);
      
      // Convert the map to an array with proper structure
      const playerData = scene.players.map(username => ({
        username,
        data: userDataMap[username]?.data || null,
        found: userDataMap[username]?.found || false,
        ...(userDataMap[username]?.error && { error: userDataMap[username].error })
      }));

      const foundCount = playerData.filter(p => p.found).length;
      console.log(`✅ Live data: ${foundCount}/${scene.players.length} players found`);

      return {
        scene,
        playerData
      };
    } catch (error) {
      console.error(`❌ Failed to fetch live player data for scene ${sceneId}:`, error);
      
      // Return scene with error info for each player
      return {
        scene,
        playerData: scene.players.map(username => ({
          username,
          data: null,
          found: false,
          error: 'Failed to fetch live data'
        }))
      };
    }
  }

  /**
   * Get live user data for a single player 👤
   */
  async getLivePlayerData(username: string): Promise<{
    username: string;
    data: any;
    found: boolean;
    error?: string;
    cached?: boolean;
  }> {
    try {
      // Check cache first
      const cachedData = this.playerCache.get(username);
      if (cachedData) {
        console.log(`📦 Using cached data for ${username}`);
        return {
          username,
          data: cachedData.data,
          found: true,
          cached: true
        };
      }

      // Fetch from API if not in cache
      console.log(`🌐 Fetching live data for ${username} from API...`);
      const userData = await FightcadeApiDirect.getUser(username);
      
      if (userData) {
        // Cache the successful result
        this.playerCache.set(username, userData);
      }
      
      return {
        username,
        data: userData,
        found: userData !== null,
        cached: false
      };
    } catch (error) {
      console.error(`❌ Failed to fetch live data for ${username}:`, error);
      return {
        username,
        data: null,
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false
      };
    }
  }

  // Get submission info for users
  getSubmissionInfo(): {
    email: string;
    format: string;
    example: string;
  } {
    return {
      email: "cdb@voidtalker.com",
      format: `Please include:
- Scene Name (e.g., "California FGC")
- Game (e.g., "Street Fighter III: 3rd Strike") 
- Player List (comma-separated Fightcade usernames)
- Brief Description (optional)
- Your Name/Community (for attribution)`,
      example: `Subject: New Scene Submission

Scene Name: California FGC
Game: Street Fighter III: 3rd Strike
Players: Player1, Player2, Player3, Player4
Description: West Coast warriors representing the Golden State!
Submitted by: YourName`
    };
  }
}
