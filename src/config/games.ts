/**
 * Games we track rankings for. Add an entry here and the daily update picks it
 * up automatically — no other wiring needed.
 */
export const GAMES: Record<string, string> = {
  sfiii3nr1: 'Street Fighter III: 3rd Strike',
  sfa3: 'Street Fighter Alpha 3',
  sf2ce: 'Street Fighter II Champion Edition',
  kof98: 'King of Fighters 98',
  kof2002: 'King of Fighters 2002',
};

export const gameName = (gameId: string): string => GAMES[gameId] || gameId;
