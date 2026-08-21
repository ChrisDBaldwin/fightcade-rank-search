import { FightcadeApiDirect } from './fightcadeApiDirect';
import { Player, GameData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DataFetcher {
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

  async fetchRankings(gameId: string, gameName: string, allowPartial: boolean = false): Promise<GameData> {
    console.log(`🎮 Fetching rankings for ${gameName} (${gameId})...`);

    try {
      const { players: rankings, totalCount, complete } = await FightcadeApiDirect.getAllRankings(gameId, 100000);

      console.log(`✅ Fetched ${rankings.length} players${complete ? '' : ' (crawl ended early)'}`);

      // Never let a truncated crawl become the canonical snapshot. For a
      // rankings site, partial data is worse than stale data: a crawl that
      // died at offset 100 would otherwise be written as a 100-player game and
      // then replicated to production.
      //
      // Checking only against an existing local file wasn't enough — on a
      // machine with no prior snapshot there is nothing to compare against, so
      // a 100-player result looked perfectly valid. Completeness is the test.
      if (!complete && !allowPartial) {
        const existing = await this.loadGameData(gameId);
        const comparison = existing ? ` (${existing.totalPlayers} currently stored)` : ' (no previous snapshot)';
        throw new Error(
          `Crawl for ${gameId} ended early with ${rankings.length} players${comparison}. ` +
          'Refusing to save partial rankings — re-run when the API is healthy, ' +
          'or pass allowPartial to override.'
        );
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
