import { GameData, Player } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

export interface RankDistribution {
  rank: number;
  tier: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CountryStats {
  country: string;
  playerCount: number;
  averageElo: number;
  topPlayer: {
    name: string;
    rank: number;
    elo: number;
  };
  elitePlayers: number; // S-tier players
  percentage: number;
}

export interface GameStatistics {
  totalPlayers: number;
  totalCountries: number;
  averageRank: string;
  totalMatches: number;
  totalHoursPlayed: number;
  rankDistribution: RankDistribution[];
  countryStats: CountryStats[];
  topPlayersByCountry: { [country: string]: Player[] };
  advancedStats: {
    activePlayersCount: number; // >1000 matches
    avgMatchesPerPlayer: number;
    elitePlayerCount: number; // S-tier
    eliteCountriesCount: number;
    topEliteCountry: string;
  };
}

export class StatisticsService {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
  }

  private getDataFilePath(gameId: string): string {
    return path.join(this.dataDir, `${gameId}-rankings.json`);
  }

  private getRankTier(fightcadeRank: number): string {
    const tiers = ['E', 'D', 'C', 'B', 'A', 'S'];
    return tiers[fightcadeRank - 1] || 'Unknown';
  }

  private getRankColor(fightcadeRank: number): string {
    const colors = [
      '#a55eea', // E - Purple to Green gradient
      '#eb4d4b', // D - Red to Purple gradient  
      '#f9ca24', // C - Yellow to Orange gradient
      '#45b7d1', // B - Blue to Green gradient
      '#4ecdc4', // A - Teal to Green gradient
      '#ff6b6b'  // S - Red to Orange gradient
    ];
    return colors[fightcadeRank - 1] || '#718096';
  }

  async generateStatistics(gameId: string): Promise<GameStatistics | null> {
    try {
      const filePath = this.getDataFilePath(gameId);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ No data file found for game: ${gameId}`);
        return null;
      }

      const gameData: GameData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const players = gameData.players;

      console.log(`📊 Generating statistics for ${gameData.gameName} with ${players.length} players...`);

      // Calculate rank distribution
      const rankCounts: { [key: number]: number } = {};
      players.forEach(player => {
        const rank = player.fightcadeRank || 1;
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
      });

      const rankDistribution: RankDistribution[] = [];
      for (let rank = 1; rank <= 6; rank++) {
        const count = rankCounts[rank] || 0;
        const percentage = (count / players.length) * 100;
        rankDistribution.push({
          rank,
          tier: this.getRankTier(rank),
          count,
          percentage: Math.round(percentage * 10) / 10,
          color: this.getRankColor(rank)
        });
      }

      // Calculate country statistics
      const countryData: { [country: string]: Player[] } = {};
      players.forEach(player => {
        const country = player.country || 'Unknown';
        if (!countryData[country]) {
          countryData[country] = [];
        }
        countryData[country].push(player);
      });

      const countryStats: CountryStats[] = [];
      const topPlayersByCountry: { [country: string]: Player[] } = {};

      Object.entries(countryData).forEach(([country, countryPlayers]) => {
        if (countryPlayers.length === 0) return;

        const sortedPlayers = countryPlayers.sort((a, b) => a.rank - b.rank);
        const averageElo = Math.round(
          countryPlayers.reduce((sum, p) => sum + p.elo, 0) / countryPlayers.length
        );
        const elitePlayers = countryPlayers.filter(p => (p.fightcadeRank || 1) === 6).length;
        const topPlayer = sortedPlayers[0];

        countryStats.push({
          country,
          playerCount: countryPlayers.length,
          averageElo,
          topPlayer: {
            name: topPlayer.name,
            rank: topPlayer.rank,
            elo: topPlayer.elo
          },
          elitePlayers,
          percentage: Math.round((countryPlayers.length / players.length) * 1000) / 10
        });

        // Get top 10 players for each country
        topPlayersByCountry[country] = sortedPlayers.slice(0, 10);
      });

      // Sort countries by player count
      countryStats.sort((a, b) => b.playerCount - a.playerCount);

      // Calculate advanced statistics
      const activePlayersCount = players.filter(p => p.totalMatches > 1000).length;
      const totalMatches = players.reduce((sum, p) => sum + p.totalMatches, 0);
      const avgMatchesPerPlayer = Math.round(totalMatches / players.length);
      const elitePlayerCount = players.filter(p => (p.fightcadeRank || 1) === 6).length;
      const eliteCountriesCount = countryStats.filter(c => c.elitePlayers > 0).length;
      
      // Find country with highest elite percentage
      const topEliteCountry = countryStats
        .filter(c => c.playerCount >= 10) // Only consider countries with at least 10 players
        .sort((a, b) => (b.elitePlayers / b.playerCount) - (a.elitePlayers / a.playerCount))[0]?.country || 'Unknown';

      // Calculate total hours played (convert seconds to hours)
      const totalHoursPlayed = Math.round(
        players.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / 3600
      );

      // Calculate average rank tier
      const avgRank = players.reduce((sum, p) => sum + (p.fightcadeRank || 1), 0) / players.length;
      const averageRankTier = this.getRankTier(Math.round(avgRank));

      const statistics: GameStatistics = {
        totalPlayers: players.length,
        totalCountries: Object.keys(countryData).length,
        averageRank: averageRankTier,
        totalMatches,
        totalHoursPlayed,
        rankDistribution,
        countryStats,
        topPlayersByCountry,
        advancedStats: {
          activePlayersCount,
          avgMatchesPerPlayer,
          elitePlayerCount,
          eliteCountriesCount,
          topEliteCountry
        }
      };

      console.log(`✅ Statistics generated successfully!`);
      console.log(`   📈 Rank Distribution: ${rankDistribution.map(r => `${r.tier}:${r.count}`).join(', ')}`);
      console.log(`   🌍 Top Countries: ${countryStats.slice(0, 5).map(c => `${c.country}:${c.playerCount}`).join(', ')}`);

      return statistics;

    } catch (error) {
      console.error(`❌ Error generating statistics for ${gameId}:`, error);
      return null;
    }
  }

  async getAvailableGames(): Promise<Array<{ gameId: string; gameName: string }>> {
    try {
      const files = fs.readdirSync(this.dataDir);
      const gameFiles = files.filter(file => file.endsWith('-rankings.json'));
      
      const games = [];
      for (const file of gameFiles) {
        try {
          const gameData: GameData = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), 'utf-8'));
          games.push({
            gameId: gameData.gameId,
            gameName: gameData.gameName
          });
        } catch (error) {
          console.warn(`⚠️ Could not parse game data from ${file}`);
        }
      }

      return games;
    } catch (error) {
      console.error('❌ Error getting available games:', error);
      return [];
    }
  }
}
