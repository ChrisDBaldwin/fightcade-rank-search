export interface Player {
  name: string;
  elo: number;
  rank: number;
  lastActive?: string;
  // Additional Fightcade-specific fields
  fightcadeRank?: number; // 1-6 (E, D, C, B, A, S)
  totalMatches: number;
  timePlayed?: number;
  country: string;
}

export interface GameData {
  gameId: string;
  gameName: string;
  players: Player[];
  lastUpdated: string;
  totalPlayers: number;
  totalAvailable?: number; // Total players available from API
}

export interface SearchFilters {
  name?: string;
  minElo?: number;
  maxElo?: number;
  minRank?: number;
  maxRank?: number;
  country?: string;
}

export interface SearchResult {
  players: Player[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
