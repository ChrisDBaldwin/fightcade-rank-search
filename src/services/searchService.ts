import { Player, SearchFilters, SearchResult } from '../types';

export class SearchService {
  searchPlayers(
    players: Player[], 
    filters: SearchFilters, 
    page: number = 1, 
    pageSize: number = 50
  ): SearchResult {
    let filteredPlayers = [...players];

    // Apply name filter (case-insensitive)
    if (filters.name) {
      const searchName = filters.name.toLowerCase().trim();
      filteredPlayers = filteredPlayers.filter(player => 
        player.name.toLowerCase().includes(searchName)
      );
    }

    // Apply ELO filters
    if (filters.minElo !== undefined) {
      filteredPlayers = filteredPlayers.filter(player => player.elo >= filters.minElo!);
    }
    if (filters.maxElo !== undefined) {
      filteredPlayers = filteredPlayers.filter(player => player.elo <= filters.maxElo!);
    }

    // Apply rank filters
    if (filters.minRank !== undefined) {
      filteredPlayers = filteredPlayers.filter(player => player.rank >= filters.minRank!);
    }
    if (filters.maxRank !== undefined) {
      filteredPlayers = filteredPlayers.filter(player => player.rank <= filters.maxRank!);
    }


    // Apply country filter (case-insensitive)
    if (filters.country) {
      const searchCountry = filters.country.toLowerCase().trim();
      filteredPlayers = filteredPlayers.filter(player => {
        if (!player.country) return false;
        
        // Ensure country is a string
        const countryText = String(player.country);
        
        return countryText && countryText.toLowerCase().includes(searchCountry);
      });
    }

    // Calculate pagination
    const totalCount = filteredPlayers.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

    return {
      players: paginatedPlayers,
      totalCount,
      page,
      pageSize,
      totalPages
    };
  }

  findPlayerByName(players: Player[], name: string): Player | undefined {
    const searchName = name.toLowerCase().trim();
    return players.find(player => 
      player.name.toLowerCase() === searchName
    );
  }

  findPlayersByPartialName(players: Player[], partialName: string, limit: number = 10): Player[] {
    const searchName = partialName.toLowerCase().trim();
    return players
      .filter(player => player.name.toLowerCase().includes(searchName))
      .slice(0, limit);
  }

  getTopPlayers(players: Player[], count: number = 10): Player[] {
    return players
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count);
  }

  getUniqueCountries(players: Player[]): string[] {
    const countries = new Set<string>();
    
    players.forEach(player => {
      if (player.country && player.country !== 'Unknown') {
        // Ensure country is a string
        const countryText = String(player.country);
        
        if (countryText && countryText.length > 0 && countryText !== 'undefined') {
          countries.add(countryText);
        }
      }
    });
    
    return Array.from(countries).sort();
  }

  getPlayerStats(players: Player[]): {
    totalPlayers: number;
    averageElo: number;
    medianElo: number;
    topElo: number;
    bottomElo: number;
  } {
    if (players.length === 0) {
      return {
        totalPlayers: 0,
        averageElo: 0,
        medianElo: 0,
        topElo: 0,
        bottomElo: 0
      };
    }

    const sortedByElo = [...players].sort((a, b) => b.elo - a.elo);
    const totalElo = players.reduce((sum, player) => sum + player.elo, 0);

    return {
      totalPlayers: players.length,
      averageElo: Math.round(totalElo / players.length),
      medianElo: sortedByElo[Math.floor(players.length / 2)].elo,
      topElo: sortedByElo[0].elo,
      bottomElo: sortedByElo[sortedByElo.length - 1].elo
    };
  }
}
