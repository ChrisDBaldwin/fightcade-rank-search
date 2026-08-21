#!/usr/bin/env ts-node

/**
 * Earn a fresh Cloudflare clearance.
 *
 * Needs a real display: on a headless Debian box run it under Xvfb —
 *   xvfb-run -a npm run refresh-clearance
 * The container's updater service already does this for you; this script is
 * for the first run and for manually recovering if Cloudflare tightens up.
 */

import { CloudflareSession } from '../services/cloudflareSession';
import { FightcadeApiDirect } from '../services/fightcadeApiDirect';

async function main() {
  const clearance = await CloudflareSession.refresh();
  console.log(`   User-Agent: ${clearance.userAgent}`);
  console.log(`   Minted at:  ${clearance.mintedAt}`);

  // Prove the stored clearance actually works from plain Node, which is how
  // every other request in this app is made.
  console.log('\n🧪 Verifying with a real API call...');
  const { players } = await FightcadeApiDirect.getRankingsWithPagination('sfiii3nr1', { limit: 3, offset: 0 });
  console.log(`✅ API reachable — sample player: ${players[0]?.name ?? '(none)'}`);
}

main().catch((error) => {
  console.error('❌ Could not earn a clearance:', error instanceof Error ? error.message : error);
  process.exit(1);
});
