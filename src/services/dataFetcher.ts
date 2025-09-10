import { GetRankings } from 'fightcade-api';
import { FightcadeApiDirect } from './fightcadeApiDirect';
import { Player, GameData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DataFetcher {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getDataFilePath(gameId: string): string {
    return path.join(this.dataDir, `${gameId}-rankings.json`);
  }

  async fetchRankings(gameId: string, gameName: string, useExtendedFetch: boolean = true): Promise<GameData> {
    console.log(`🎮 Fetching rankings for ${gameName} (${gameId})...`);
    
    try {
      let rankings: any[];
      let totalCount: number;

      if (useExtendedFetch) {
        console.log('🚀 Using extended fetch to get ALL players from ALL tiers...');
        const result = await FightcadeApiDirect.getAllRankings(gameId, 100000);
        rankings = result.players;
        totalCount = result.totalCount;
      } else {
        console.log('📦 Using standard API (limited to ~15 players)...');
        rankings = await GetRankings(gameId);
        totalCount = rankings.length;
      }

      console.log(`✅ Successfully fetched ${rankings.length} players`);

      // Transform the data and add rank numbers
      // The Fightcade API returns Player objects with gameinfo containing stats
      const players: Player[] = rankings.map((player: any, index: number) => {
        // Extract game-specific info if available
        const gameInfo = player.gameinfo && player.gameinfo[gameId];
        
        // Convert Fightcade rank (1-6) to a more meaningful ELO-like score
        // Rank 6 = S rank (highest), Rank 1 = E rank (lowest)
        const fightcadeRank = gameInfo?.rank || 1;
        const estimatedElo = 1000 + (fightcadeRank - 1) * 200; // E=1000, D=1200, C=1400, B=1600, A=1800, S=2000
        
        const numMatches = gameInfo?.num_matches || 0;
        
        return {
          name: player.name || 'Unknown',
          elo: estimatedElo,
          rank: index + 1, // Position in rankings
          lastActive: undefined, // Not available in current API
          // Add additional fields for reference
          fightcadeRank: fightcadeRank,
          totalMatches: numMatches,
          timePlayed: gameInfo?.time_played || 0,
          country: player.country?.full_name || player.country || 'Unknown'
        };
      });

      const gameData: GameData = {
        gameId,
        gameName,
        players,
        lastUpdated: new Date().toISOString(),
        totalPlayers: players.length,
        totalAvailable: totalCount
      };

      // Save to JSON file
      await this.saveGameData(gameData);
      console.log(`💾 Saved data to ${this.getDataFilePath(gameId)}`);

      return gameData;
    } catch (error) {
      console.error(`❌ Error fetching rankings for ${gameId}:`, error);
      throw error;
    }
  }

  async saveGameData(gameData: GameData): Promise<void> {
    const filePath = this.getDataFilePath(gameData.gameId);
    await fs.promises.writeFile(filePath, JSON.stringify(gameData, null, 2));
  }

  async loadGameData(gameId: string): Promise<GameData | null> {
    const filePath = this.getDataFilePath(gameId);
    
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data) as GameData;
    } catch (error) {
      console.error(`Error loading game data for ${gameId}:`, error);
      return null;
    }
  }

  async getAvailableGames(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.dataDir);
      return files
        .filter(file => file.endsWith('-rankings.json'))
        .map(file => file.replace('-rankings.json', ''));
    } catch (error) {
      return [];
    }
  }

  isDataStale(gameData: GameData, maxAgeHours: number = 24): boolean {
    const lastUpdate = new Date(gameData.lastUpdated);
    const now = new Date();
    const ageHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }
}
