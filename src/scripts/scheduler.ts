#!/usr/bin/env node

/**
 * Long-running daily scheduler for the updater container.
 *
 * Deliberately not a cron daemon: this keeps the job in one Node process that
 * Docker can restart and log like any other service, and it means the Xvfb
 * wrapper only has to be set up once in the container command.
 */

import { updateAllGames } from './updateAll';
import { DataFetcher } from '../services/dataFetcher';
import { GAMES } from '../config/games';

/** Hour (UTC) to run the daily update. 4am UTC is a quiet slot for Fightcade. */
const UPDATE_HOUR = Number(process.env.FC_UPDATE_HOUR ?? 4);
/** Refresh on boot if the newest snapshot is older than this. */
const STALE_AFTER_HOURS = Number(process.env.FC_STALE_HOURS ?? 36);

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(UPDATE_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function dataIsStale(): Promise<boolean> {
  const dataFetcher = new DataFetcher();

  for (const gameId of Object.keys(GAMES)) {
    const data = await dataFetcher.loadGameData(gameId);
    // A game we've never fetched counts as stale.
    if (!data || dataFetcher.isDataStale(data, STALE_AFTER_HOURS)) return true;
  }
  return false;
}

async function runUpdate(reason: string): Promise<void> {
  console.log(`\n⏰ Running update (${reason}) at ${new Date().toISOString()}`);
  try {
    await updateAllGames();
  } catch (error) {
    // Never let one bad run kill the scheduler — tomorrow's attempt is free.
    console.error('❌ Update run failed, will try again on schedule:', error);
  }
}

async function main() {
  console.log(`📅 Scheduler up. Daily update at ${UPDATE_HOUR}:00 UTC.`);

  if (await dataIsStale()) {
    await runUpdate(`data older than ${STALE_AFTER_HOURS}h`);
  } else {
    console.log('✅ Existing data is fresh — waiting for the next scheduled run.');
  }

  const loop = async () => {
    const wait = msUntilNextRun();
    console.log(`💤 Next update in ${(wait / 3_600_000).toFixed(1)}h.`);
    setTimeout(async () => {
      await runUpdate('daily schedule');
      loop();
    }, wait);
  };

  loop();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n👋 Scheduler stopping (${signal}).`);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Scheduler failed to start:', error);
  process.exit(1);
});
