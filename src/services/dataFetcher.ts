import { FightcadeApiDirect } from './fightcadeApiDirect';
import { Player, GameData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DataFetcher {
  /** How much of an existing snapshot an incomplete crawl must match to replace it. */
  private readonly MIN_RETAINED_FRACTION = 0.95;

  private dataDir: string;

  constructor() {
    this.dataDir = process.env.FC_DATA_DIR || path.join(process.cwd(), 'data');
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

  async fetchRankings(gameId: string, gameName: string): Promise<GameData> {
    console.log(`🎮 Fetching rankings for ${gameName} (${gameId})...`);

    try {
      const { players: rankings, totalCount, complete } = await FightcadeApiDirect.getAllRankings(gameId, 100000);

      console.log(`✅ Fetched ${rankings.length} players${complete ? '' : ' (crawl ended early)'}`);

      // A transient API error mid-crawl used to silently replace a full
      // snapshot with a truncated one. Only accept a short result if the crawl
      // actually finished, or if we have nothing better already on disk.
      if (!complete) {
        const existing = await this.loadGameData(gameId);
        if (existing && rankings.length < existing.totalPlayers * this.MIN_RETAINED_FRACTION) {
          throw new Error(
            `Incomplete crawl returned ${rankings.length} players vs ${existing.totalPlayers} already stored — ` +
            'keeping the existing snapshot.'
          );
        }
      }

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
    const tempPath = `${filePath}.tmp`;

    // Rename is atomic on the same filesystem, so readers see either the old
    // snapshot or the new one — never a half-written file.
    await fs.promises.writeFile(tempPath, JSON.stringify(gameData, null, 2));
    await fs.promises.rename(tempPath, filePath);
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

  isDataStale(gameData: GameData, maxAgeHours: number = 168): boolean {
    const lastUpdate = new Date(gameData.lastUpdated);
    const now = new Date();
    const ageHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }
}
