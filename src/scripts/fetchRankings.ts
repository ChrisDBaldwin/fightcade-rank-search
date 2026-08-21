#!/usr/bin/env ts-node

import { DataFetcher } from '../services/dataFetcher';
import { GAMES as POPULAR_GAMES } from '../config/games';

async function main() {
  const args = process.argv.slice(2);
  const dataFetcher = new DataFetcher();

  if (args.length === 0) {
    console.log('🎮 Available games to fetch:');
    Object.entries(POPULAR_GAMES).forEach(([id, name]) => {
      console.log(`  ${id} - ${name}`);
    });
    console.log('\nUsage:');
    console.log('  npm run fetch-data <gameId> [gameName]');
    console.log('  npm run fetch-data all  # Fetch all popular games');
    console.log('\nExamples:');
    console.log('  npm run fetch-data sfiii3nr1');
    console.log('  npm run fetch-data sf2ce "Street Fighter II CE"');
    return;
  }

  const gameId = args[0];
  
  if (gameId === 'all') {
    console.log('🚀 Fetching data for all popular games...\n');
    
    for (const [id, name] of Object.entries(POPULAR_GAMES)) {
      try {
        console.log(`\n📥 Fetching ${name} (${id})...`);
        await dataFetcher.fetchRankings(id, name);
        console.log(`✅ Successfully fetched ${name}`);
        
        // Add a small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to fetch ${name}:`, error);
      }
    }
    
    console.log('\n🎉 Finished fetching all games!');
    return;
  }

  // Fetch single game
  const gameName = args[1] || POPULAR_GAMES[gameId as keyof typeof POPULAR_GAMES] || gameId;
  
  try {
    console.log(`📥 Fetching rankings for ${gameName} (${gameId})...`);
    const gameData = await dataFetcher.fetchRankings(gameId, gameName);
    
    console.log('\n📊 Summary:');
    console.log(`  Game: ${gameData.gameName}`);
    console.log(`  Total Players: ${gameData.totalPlayers}`);
    console.log(`  Last Updated: ${gameData.lastUpdated}`);
    
    if (gameData.players.length > 0) {
      const topPlayer = gameData.players[0];
      console.log(`  Top Player: ${topPlayer.name} (${topPlayer.elo} ELO)`);
    }
    
    console.log(`\n✅ Data saved! You can now start the server and search for players.`);
    console.log(`🌐 Run: npm run dev`);
    
  } catch (error) {
    console.error(`❌ Error fetching data for ${gameId}:`, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Fetch interrupted by user');
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}
