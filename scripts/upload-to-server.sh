#!/usr/bin/env bash
#
# Ship locally-fetched rankings to the server.
#
# Fightcade's Cloudflare challenge can only be cleared by a headed browser with
# real Google Chrome, which the Debian host can't do — so the fetch runs on a
# desktop machine and the resulting JSON is copied up. See DEPLOYMENT.md.
#
# Every upload is atomic: the file lands under a temp name and is renamed into
# place, so the web service never reads a half-written snapshot.
#
# Usage:
#   scripts/upload-to-server.sh              # upload every game
#   scripts/upload-to-server.sh sfiii3nr1    # upload one game
#
set -euo pipefail

REMOTE_HOST="${FC_REMOTE_HOST:-chris@lakeside}"
REMOTE_DIR="${FC_REMOTE_DIR:-/home/chris/git/fightcade-rank-search/data}"
SSH_KEY="${FC_SSH_KEY:-$HOME/.ssh/lakeside}"
ARCHIVE_DAYS="${FC_ARCHIVE_DAYS:-7}"

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"
SSH_OPTS=(-o BatchMode=yes)
[ -f "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

# Refuse to ship a snapshot that's drastically smaller than the one already
# deployed. A truncated crawl replacing 34,100 players with 100 is the single
# most damaging thing this script could do.
MIN_FRACTION="${FC_MIN_FRACTION:-0.9}"

if [ $# -gt 0 ]; then
  files=()
  for game in "$@"; do files+=("$LOCAL_DIR/$game-rankings.json"); done
else
  files=("$LOCAL_DIR"/*-rankings.json)
fi

today="$(date -u +%F)"
uploaded=0
skipped=0

for file in "${files[@]}"; do
  [ -e "$file" ] || { echo "⚠️  $file does not exist — skipping"; skipped=$((skipped + 1)); continue; }

  name="$(basename "$file")"
  game="${name%-rankings.json}"

  local_count="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['totalPlayers'])" "$file")"
  remote_count="$(ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" \
    "python3 -c \"import json,sys,os; p='$REMOTE_DIR/$name'; print(json.load(open(p))['totalPlayers'] if os.path.exists(p) else 0)\"" 2>/dev/null || echo 0)"

  if [ "$remote_count" -gt 0 ]; then
    threshold="$(python3 -c "print(int($remote_count * $MIN_FRACTION))")"
    if [ "$local_count" -lt "$threshold" ]; then
      echo "🛑 $game: local $local_count players vs deployed $remote_count — refusing to upload."
      echo "   Re-run the fetch; this looks like a truncated crawl."
      skipped=$((skipped + 1))
      continue
    fi
  fi

  echo "⬆️  $game: $local_count players (deployed: $remote_count)"

  scp "${SSH_OPTS[@]}" -q "$file" "$REMOTE_HOST:$REMOTE_DIR/.$name.tmp"

  # Rename into place, keep a dated copy, and prune old archives. Done in one
  # remote call so the window where files disagree is as small as possible.
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
mv ".$name.tmp" "$name"
cp "$name" "$game-rankings-$today.json"
find . -maxdepth 1 -name "$game-rankings-20*.json" -type f -mtime +$ARCHIVE_DAYS -delete
REMOTE

  uploaded=$((uploaded + 1))
done

echo
echo "✅ Uploaded $uploaded, skipped $skipped. Archives kept for $ARCHIVE_DAYS days."
echo "   Verify: curl -s https://fightcade.voidtalker.com/api/status"
