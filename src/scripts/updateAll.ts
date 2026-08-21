#!/usr/bin/env ts-node

/**
 * Refresh every tracked game's rankings. This is what the daily job runs.
 *
 * A game that fails keeps its previous snapshot (saves only happen on success),
 * so a partial outage degrades freshness rather than breaking the site.
 */

import { DataFetcher } from '../services/dataFetcher';
import { GAMES } from '../config/games';

const DELAY_BETWEEN_GAMES_MS = 5000;

export interface UpdateSummary {
  updated: string[];
  failed: Array<{ gameId: string; error: string }>;
}

export async function updateAllGames(): Promise<UpdateSummary> {
  const dataFetcher = new DataFetcher();
  const summary: UpdateSummary = { updated: [], failed: [] };

  console.log(`🚀 Updating ${Object.keys(GAMES).length} games — started ${new Date().toISOString()}`);

  for (const [gameId, name] of Object.entries(GAMES)) {
    try {
      const data = await dataFetcher.fetchRankings(gameId, name);
      summary.updated.push(gameId);
      console.log(`✅ ${name}: ${data.totalPlayers} players`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed.push({ gameId, error: message });
      console.error(`❌ ${name} failed (keeping previous snapshot): ${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_GAMES_MS));
  }

  console.log(`\n📊 Done: ${summary.updated.length} updated, ${summary.failed.length} failed.`);
  return summary;
}

if (require.main === module) {
  updateAllGames()
    .then((summary) => process.exit(summary.failed.length > 0 ? 1 : 0))
    .catch((error) => {
      console.error('❌ Update run crashed:', error);
      process.exit(1);
    });
}
