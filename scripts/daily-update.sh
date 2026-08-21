#!/usr/bin/env bash
#
# Daily job: fetch fresh rankings locally, then ship them to the server.
#
# Runs on a desktop machine with real Google Chrome, because that's the only
# way past Fightcade's Cloudflare challenge (see DEPLOYMENT.md). Install it via
# scripts/com.voidtalker.fcrank.plist on macOS.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# launchd hands us a minimal PATH, so make sure node/npm are findable.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

LOG_DIR="$REPO_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/daily-$(date -u +%F).log"

{
  echo "=== Run started $(date -u +'%F %T UTC') ==="

  # A full crawl is ~1000 requests and takes the better part of an hour. If it
  # gets rate-limited, individual games fail and keep their previous snapshot
  # rather than saving partial data, so it's safe to press on to the upload.
  npm run update-all || echo "⚠️  Some games failed; uploading whatever succeeded."

  # The upload refuses any snapshot under 90% of what's currently deployed, so
  # a bad crawl can't clobber good production data.
  ./scripts/upload-to-server.sh

  echo "=== Run finished $(date -u +'%F %T UTC') ==="
} >> "$LOG" 2>&1

# Keep the local logs from growing forever.
find "$LOG_DIR" -name 'daily-*.log' -type f -mtime +14 -delete
