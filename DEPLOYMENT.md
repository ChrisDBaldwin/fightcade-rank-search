# Deployment

Target: `fightcade.voidtalker.com`, served from `lakeside`
(`/home/chris/git/fightcade-rank-search`), Traefik in front, deployed by pulling
this repo and rebuilding.

## How data gets in

**Rankings are fetched on a desktop machine and copied to the server.** The
server cannot fetch them itself.

Fightcade's API sits behind a Cloudflare managed challenge. Clearing it requires
a **headed** browser — headless Chrome is detected and re-challenged even with a
valid cookie already in its profile. On the server that's been tested and does
not work: Debian's `chromium` fails on arm64, and real Chrome under Xvfb fails
on x86_64 too. So the split is:

| Where | Does what |
| --- | --- |
| Desktop (macOS, real Chrome) | Clears the challenge, crawls the rankings, uploads JSON |
| `lakeside` | Serves the site from that JSON |

The `fc-rank-updater` container that would do this server-side still exists in
`docker-compose.yml` but is **disabled via a compose profile**, so it won't run
and fail on a loop. If Cloudflare ever loosens up, try it with
`docker compose --profile updater up -d`.

## Server setup

```bash
cd /home/chris/git/fightcade-rank-search
git pull origin main
docker compose build
docker compose up -d      # starts the web service only
```

Verify:

```bash
docker compose ps
curl -s localhost:3000/health
curl -s localhost:3000/api/status   # per-game player counts and data age
```

The server needs nothing else — no browser, no scheduler, no credentials.

## Desktop setup (the machine that fetches)

Requires Node 20+ and **Google Chrome** installed.

```bash
git clone <repo> && cd fightcade-rank-search
npm install
npm run refresh-clearance     # opens Chrome, clears the challenge, stores the cookie
```

Then a manual run to confirm the whole chain:

```bash
npm run update-all                 # ~55 min: roughly 1000 requests across 5 games
./scripts/upload-to-server.sh      # atomic upload + dated archive + prune
```

Schedule it daily with the bundled LaunchAgent:

```bash
cp scripts/com.voidtalker.fcrank.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.voidtalker.fcrank.plist
```

It must be a **LaunchAgent**, not a LaunchDaemon — the fetch drives a visible
Chrome window and needs a logged-in GUI session. If the Mac is asleep at 05:00,
launchd runs the job on wake rather than skipping the day.

## Safety rails

These exist because both failure modes actually happened during development:

- **Partial crawls are never saved.** A rate-limited crawl that dies at offset
  100 used to be written as a 100-player game. `fetchRankings` now refuses to
  save an incomplete crawl at all; the previous snapshot survives untouched.
- **The upload refuses to shrink production.** `upload-to-server.sh` reads the
  deployed player count and rejects any local file below 90% of it. A truncated
  snapshot can't replace 34,100 players with 100.

Neither is theoretical — both were caught by these checks after being caused by
crawling too aggressively.

## Rate limits

A full run is ~1000 requests. Crawling faster than roughly one page every 3
seconds earned a sustained `503` storm from Fightcade and got the clearance
revoked. Current pacing:

| Variable | Default | Meaning |
| --- | --- | --- |
| `FC_BATCH_DELAY_MS` | `3000` | Pause between ranking pages (jittered ±25%) |
| `FC_GAME_DELAY_MS` | `30000` | Pause between games |
| `FC_UPDATE_HOUR` | `4` | Daily hour (UTC), updater container only |
| `FC_STALE_HOURS` | `36` | Boot refresh threshold, updater container only |
| `FC_DATA_DIR` | `./data` | Snapshots and clearance location |

Requests retry six times with jittered backoff to ~80s. If a game still fails it
keeps yesterday's data and the run moves on.

## Upload script

```bash
./scripts/upload-to-server.sh              # all games
./scripts/upload-to-server.sh sfiii3nr1    # one game
```

| Variable | Default |
| --- | --- |
| `FC_REMOTE_HOST` | `chris@lakeside` |
| `FC_REMOTE_DIR` | `/home/chris/git/fightcade-rank-search/data` |
| `FC_SSH_KEY` | `~/.ssh/lakeside` |
| `FC_ARCHIVE_DAYS` | `7` |
| `FC_MIN_FRACTION` | `0.9` |

Each game is copied to a temp name and renamed into place, so the web service
never reads a half-written file. A dated copy (`<game>-rankings-YYYY-MM-DD.json`)
is kept for `FC_ARCHIVE_DAYS` days, then pruned.

## Credentials

`data/.clearance.json` holds the `cf_clearance` cookie and its matching
User-Agent. Gitignored, written `0600`, lives only on the desktop machine. It's
bound to the IP and browser fingerprint that earned it, so it cannot be minted
on one machine and used from another.

If the API starts returning 403, the client re-mints automatically. To force it:

```bash
npm run refresh-clearance
```

## Troubleshooting

**Data is stale.** `curl -s https://fightcade.voidtalker.com/api/status` shows
`ageHours` per game. Then check `logs/daily-*.log` on the desktop machine.

**Sustained `503`s.** Rate limited. Stop, wait, and re-run later — raise
`FC_BATCH_DELAY_MS` if it recurs. Don't hammer it; that's what revokes the
clearance.

**`Blocked by Cloudflare even after refreshing clearance`.** The automatic
re-mint failed. Run `npm run refresh-clearance` by hand and watch the window.

**`Crawl for <game> ended early ... Refusing to save partial rankings`.** Working
as intended — the API faltered mid-crawl and your good data was protected. Re-run.

**Upload says `refusing to upload`.** The local snapshot is materially smaller
than what's deployed. Re-run the fetch; don't override unless you know the game
genuinely lost players.
