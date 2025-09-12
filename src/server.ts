import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { DataFetcher } from './services/dataFetcher';
import { SearchService } from './services/searchService';
import { SceneService } from './services/sceneService';
import { StatisticsService } from './services/statisticsService';
import { PlayerCache } from './services/playerCache';
import { FightcadeApiDirect } from './services/fightcadeApiDirect';
import { SearchFilters } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const playerCache = new PlayerCache(10000, 24); // 10k players, 24h expiry
const dataFetcher = new DataFetcher();
const searchService = new SearchService();
const sceneService = new SceneService(playerCache);
const statisticsService = new StatisticsService();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

// Get available games
app.get('/api/games', async (req, res) => {
  try {
    const games = await dataFetcher.getAvailableGames();
    res.json({ games });
  } catch (error) {
    console.error('Error fetching available games:', error);
    res.status(500).json({ error: 'Failed to fetch available games' });
  }
});


// Get game data and stats
app.get('/api/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  
  try {
    const gameData = await dataFetcher.loadGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    const stats = searchService.getPlayerStats(gameData.players);
    
    res.json({
      gameId: gameData.gameId,
      gameName: gameData.gameName,
      totalPlayers: gameData.totalPlayers,
      lastUpdated: gameData.lastUpdated,
      isStale: dataFetcher.isDataStale(gameData),
      stats
    });
  } catch (error) {
    console.error(`Error loading game data for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to load game data for ${gameId}` });
  }
});

// Search players
app.get('/api/games/:gameId/search', async (req, res) => {
  const { gameId } = req.params;
  const { 
    name, 
    minElo, 
    maxElo, 
    minRank, 
    maxRank, 
    country,
    page = '1',
    pageSize = '50'
  } = req.query;

  try {
    const gameData = await dataFetcher.loadGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    const filters: SearchFilters = {
      name: name as string,
      minElo: minElo ? parseInt(minElo as string) : undefined,
      maxElo: maxElo ? parseInt(maxElo as string) : undefined,
      minRank: minRank ? parseInt(minRank as string) : undefined,
      maxRank: maxRank ? parseInt(maxRank as string) : undefined,
      country: country as string,
    };

    const result = searchService.searchPlayers(
      gameData.players,
      filters,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error) {
    console.error(`Error searching players for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to search players for ${gameId}` });
  }
});

// Find specific player
app.get('/api/games/:gameId/player/:playerName', async (req, res) => {
  const { gameId, playerName } = req.params;

  try {
    const gameData = await dataFetcher.loadGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    const player = searchService.findPlayerByName(gameData.players, playerName);
    
    if (!player) {
      // Try partial search for suggestions
      const suggestions = searchService.findPlayersByPartialName(gameData.players, playerName, 5);
      return res.status(404).json({ 
        error: 'Player not found',
        suggestions: suggestions.map(p => p.name)
      });
    }

    res.json({ player });
  } catch (error) {
    console.error(`Error finding player ${playerName} in ${gameId}:`, error);
    res.status(500).json({ error: `Failed to find player ${playerName}` });
  }
});

// Get available countries for a game
app.get('/api/games/:gameId/countries', async (req, res) => {
  const { gameId } = req.params;

  try {
    const gameData = await dataFetcher.loadGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    const countries = searchService.getUniqueCountries(gameData.players);
    
    res.json({ countries });
  } catch (error) {
    console.error(`Error getting countries for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to get countries for ${gameId}` });
  }
});

// Get top players
app.get('/api/games/:gameId/top', async (req, res) => {
  const { gameId } = req.params;
  const { count = '10' } = req.query;

  try {
    const gameData = await dataFetcher.loadGameData(gameId);
    
    if (!gameData) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    const topPlayers = searchService.getTopPlayers(gameData.players, parseInt(count as string));
    
    res.json({ topPlayers });
  } catch (error) {
    console.error(`Error getting top players for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to get top players for ${gameId}` });
  }
});

// Scene Management API Routes

// Get all scenes
app.get('/api/scenes', async (req, res) => {
  try {
    const scenes = sceneService.getAllScenes();
    const stats = sceneService.getSceneStats();
    res.json({ scenes, stats });
  } catch (error) {
    console.error('Error fetching scenes:', error);
    res.status(500).json({ error: 'Failed to fetch scenes' });
  }
});

// Get scenes for a specific game
app.get('/api/scenes/game/:gameId', async (req, res) => {
  const { gameId } = req.params;
  
  try {
    const scenes = sceneService.getScenesByGame(gameId);
    res.json({ scenes, gameId });
  } catch (error) {
    console.error(`Error fetching scenes for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to fetch scenes for ${gameId}` });
  }
});

// Get a specific scene with player data
app.get('/api/scenes/:sceneId', async (req, res) => {
  const { sceneId } = req.params;
  
  try {
    const scene = sceneService.getScene(sceneId);
    
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    // If we have game data, get player stats for the scene
    let playerStats = null;
    try {
      const gameData = await dataFetcher.loadGameData(scene.gameId);
      if (gameData) {
        // Search for each player and get their stats
        const playerPromises = scene.players.map(async (playerName) => {
          const player = searchService.findPlayerByName(gameData.players, playerName);
          return player ? { ...player, originalName: playerName } : { originalName: playerName, notFound: true };
        });
        
        playerStats = await Promise.all(playerPromises);
      }
    } catch (error) {
      console.log(`No game data available for ${scene.gameId}, returning scene without stats`);
    }

    res.json({ 
      scene, 
      playerStats: playerStats || scene.players.map(name => ({ originalName: name, noGameData: true }))
    });
  } catch (error) {
    console.error(`Error fetching scene ${sceneId}:`, error);
    res.status(500).json({ error: `Failed to fetch scene ${sceneId}` });
  }
});

// Get a scene with HYBRID data (cached + selective live updates) 🧠⚡
app.get('/api/scenes/:sceneId/hybrid', async (req, res) => {
  const { sceneId } = req.params;
  
  try {
    console.log(`🧠 Fetching hybrid data for scene: ${sceneId}`);
    const result = await sceneService.getSceneWithHybridData(sceneId);
    
    if (!result) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const { scene, playerData, stats } = result;
    
    console.log(`✅ Hybrid scene data: ${stats.cachedData} cached + ${stats.liveData} live + ${stats.notFound} not found`);
    
    res.json({ 
      scene, 
      playerData,
      stats: {
        ...stats,
        dataSource: 'hybrid'
      }
    });
  } catch (error) {
    console.error(`❌ Error fetching hybrid scene data for ${sceneId}:`, error);
    res.status(500).json({ error: `Failed to fetch hybrid scene data for ${sceneId}` });
  }
});

// Get a scene with LIVE player data using getuser API 🚀
app.get('/api/scenes/:sceneId/live', async (req, res) => {
  const { sceneId } = req.params;
  
  try {
    console.log(`🎮 Fetching live data for scene: ${sceneId}`);
    const result = await sceneService.getSceneWithLivePlayerData(sceneId);
    
    if (!result) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const { scene, playerData } = result;
    const foundCount = playerData.filter(p => p.found).length;
    
    console.log(`✅ Live scene data: ${foundCount}/${playerData.length} players found`);
    
    res.json({ 
      scene, 
      playerData,
      stats: {
        totalPlayers: playerData.length,
        playersFound: foundCount,
        playersNotFound: playerData.length - foundCount,
        dataSource: 'live-api'
      }
    });
  } catch (error) {
    console.error(`❌ Error fetching live scene data for ${sceneId}:`, error);
    res.status(500).json({ error: `Failed to fetch live scene data for ${sceneId}` });
  }
});

// Get live user data for a single player 👤
app.get('/api/user/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    console.log(`👤 Fetching live data for user: ${username}`);
    const result = await sceneService.getLivePlayerData(username);
    
    if (!result.found) {
      return res.status(404).json({ 
        error: 'User not found', 
        username,
        details: result.error || 'User does not exist on Fightcade'
      });
    }

    console.log(`✅ Live user data fetched for: ${username}`);
    res.json({
      username,
      data: result.data,
      found: true,
      dataSource: 'live-api'
    });
  } catch (error) {
    console.error(`❌ Error fetching live user data for ${username}:`, error);
    res.status(500).json({ error: `Failed to fetch live user data for ${username}` });
  }
});

// Get live data for multiple users (for bulk requests) ⚡
app.post('/api/users/batch', async (req, res) => {
  const { usernames } = req.body;
  
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ error: 'usernames array is required' });
  }

  if (usernames.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 usernames allowed per batch request' });
  }

  try {
    console.log(`👥 Fetching live data for ${usernames.length} users in batch...`);
    const userDataMap = await FightcadeApiDirect.getUsers(usernames);
    
    const results = usernames.map(username => ({
      username,
      data: userDataMap[username]?.data || null,
      found: userDataMap[username]?.found || false,
      ...(userDataMap[username]?.error && { error: userDataMap[username].error })
    }));

    const foundCount = results.filter(r => r.found).length;
    console.log(`✅ Batch user data: ${foundCount}/${usernames.length} users found`);
    
    res.json({
      results,
      stats: {
        totalRequested: usernames.length,
        usersFound: foundCount,
        usersNotFound: usernames.length - foundCount,
        dataSource: 'live-api'
      }
    });
  } catch (error) {
    console.error(`❌ Error in batch user fetch:`, error);
    res.status(500).json({ error: 'Failed to fetch batch user data' });
  }
});

// Get scene submission info
app.get('/api/scenes/submission-info', async (req, res) => {
  try {
    const submissionInfo = sceneService.getSubmissionInfo();
    res.json(submissionInfo);
  } catch (error) {
    console.error('Error fetching submission info:', error);
    res.status(500).json({ error: 'Failed to fetch submission info' });
  }
});

// Get available games from scenes
app.get('/api/scenes/games', async (req, res) => {
  try {
    const games = sceneService.getAvailableGames();
    res.json({ games });
  } catch (error) {
    console.error('Error fetching scene games:', error);
    res.status(500).json({ error: 'Failed to fetch scene games' });
  }
});

// Statistics API Routes

// Get available games for statistics
app.get('/api/statistics/games', async (req, res) => {
  try {
    const games = await statisticsService.getAvailableGames();
    res.json({ games });
  } catch (error) {
    console.error('Error fetching games for statistics:', error);
    res.status(500).json({ error: 'Failed to fetch games for statistics' });
  }
});

// Generate comprehensive statistics for a game
app.get('/api/statistics/:gameId', async (req, res) => {
  const { gameId } = req.params;
  
  try {
    console.log(`📊 Generating comprehensive statistics for ${gameId}...`);
    const statistics = await statisticsService.generateStatistics(gameId);
    
    if (!statistics) {
      return res.status(404).json({ error: 'Game data not found. Try fetching it first.' });
    }

    console.log(`✅ Statistics generated successfully for ${gameId}`);
    res.json({
      gameId,
      statistics,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error generating statistics for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to generate statistics for ${gameId}` });
  }
});

// Player Cache Management API Routes

// Get cache statistics
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = playerCache.getStats();
    res.json({
      cache: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// Get cached players for a specific game
app.get('/api/cache/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  try {
    const players = playerCache.getPlayersForGame(gameId);
    res.json({
      gameId,
      cachedPlayers: players.length,
      players: players.map(p => ({
        username: p.username,
        country: p.country,
        cachedAt: p.cachedAt,
        hitCount: p.hitCount,
        lastAccessed: p.lastAccessed
      }))
    });
  } catch (error) {
    console.error(`Error getting cached players for ${gameId}:`, error);
    res.status(500).json({ error: `Failed to get cached players for ${gameId}` });
  }
});

// Clear cache
app.post('/api/cache/clear', (req, res) => {
  try {
    playerCache.clear();
    res.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Cleanup expired cache entries
app.post('/api/cache/cleanup', (req, res) => {
  try {
    const removedCount = playerCache.cleanup();
    res.json({
      message: `Removed ${removedCount} expired cache entries`,
      removedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FC Rank Search server running on http://localhost:${PORT}`);
  console.log(`📊 API documentation available at http://localhost:${PORT}/api`);
  
  // Start auto-save for player cache (every 30 minutes)
  playerCache.startAutoSave(30);
  console.log(`🗄️ Player cache auto-save enabled`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  // Save cache before exit
  console.log('💾 Saving player cache...');
  playerCache.saveCacheToDisk();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  // Save cache before exit
  console.log('💾 Saving player cache...');
  playerCache.saveCacheToDisk();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
});

export default app;
