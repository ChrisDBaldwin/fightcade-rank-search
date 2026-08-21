# Deployment

Target: `fightcade.voidtalker.com`, Debian host, Traefik in front, deployed by
pulling this repo and rebuilding.

## What runs

Two containers built from one multi-stage `Dockerfile`:

| Service | Stage | Job |
| --- | --- | --- |
| `fc-rank-search` | `web` | Serves the site from cached JSON. Never talks to Fightcade. |
| `fc-rank-updater` | `updater` | Refreshes rankings daily. Ships Chrome + Xvfb. |

They share the `./data` volume: the updater writes snapshots, the web service
reads them. The split matters — if Cloudflare ever blocks the updater, the site
stays up serving the last good data instead of going down with it.

## First deploy

```bash
cd /path/to/fightcade-rank-search
git pull origin main

docker compose build
docker compose up -d
```

Then confirm both are healthy:

```bash
docker compose ps
curl -s localhost:3000/health
curl -s localhost:3000/api/status   # per-game data age
```

## ⚠️ Verify the updater can clear Cloudflare

**This is the one step that is not yet proven on Linux — check it explicitly
rather than assuming it worked.**

The updater has to earn a `cf_clearance` cookie using a headed Chrome on a
virtual display. It works with real Google Chrome on macOS. It does **not** work
with Debian's `chromium` package on arm64 — that was tested and failed every
attempt. On `x86_64` the image installs genuine `google-chrome-stable`, which is
far less likely to be flagged, but that combination has not been run yet.

Check your architecture first:

```bash
uname -m        # x86_64 → real Chrome (good); aarch64 → chromium (expect failure)
```

Then run the mint directly and watch it:

```bash
docker compose run --rm fc-rank-updater node dist/scripts/refreshClearance.js
```

Success looks like:

```
🖥️  Virtual display ready on :99
🔐 Earning a fresh Cloudflare clearance (launching Chrome)...
✅ Cloudflare clearance earned and stored.
🧪 Verifying with a real API call...
✅ API reachable — sample player: ...
```

Failure looks like four `⏳ Still challenged` lines followed by an error. If you
get that, don't keep retrying — go to the fallback below.

Once it succeeds, kick off a first full crawl (takes a while — thousands of
players per game, paged 100 at a time):

```bash
docker compose run --rm fc-rank-updater node dist/scripts/updateAll.js
```

After that the scheduler handles it: daily at `FC_UPDATE_HOUR` (default 04:00
UTC), plus a catch-up run on boot if data is older than `FC_STALE_HOURS`.

## Fallback: fetch on a machine with real Chrome

If the server cannot clear the challenge, run the fetch where a real headed
Chrome already works (e.g. a Mac) and ship the JSON over. The web service needs
nothing but the files.

```bash
# On the machine with Chrome:
npm run refresh-clearance
npm run update-all

# Upload atomically — land a temp file, then rename into place, so the web
# service never reads a half-written file:
REMOTE=user@server:/path/to/fightcade-rank-search/data
for f in data/*-rankings.json; do
  name=$(basename "$f")
  scp "$f" "$REMOTE/$name.tmp"
  ssh user@server "mv /path/to/fightcade-rank-search/data/$name.tmp /path/to/fightcade-rank-search/data/$name"
done
```

Then stop the updater so it isn't uselessly retrying:

```bash
docker compose stop fc-rank-updater
```

Schedule the local half with `launchd` (macOS) or `cron` (Linux) once a day.

## Routine updates

```bash
git pull origin main
docker compose build
docker compose up -d
```

Snapshots live in the `./data` bind mount, so they survive rebuilds.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `FC_UPDATE_HOUR` | `4` | Hour (UTC) of the daily refresh |
| `FC_STALE_HOURS` | `36` | Refresh on boot if data is older than this |
| `FC_BATCH_DELAY_MS` | `1000` | Pause between ranking pages |
| `FC_DATA_DIR` | `./data` | Where snapshots and the clearance live |
| `CHROME_PATH` | set in image | Browser binary the mint step drives |

## Credentials

`data/.clearance.json` holds the `cf_clearance` cookie and its matching
User-Agent. It's gitignored and written `0600`. It is bound to the IP and
browser fingerprint that earned it, so it cannot be minted on one machine and
used from another — each host earns its own.

## Troubleshooting

**Site up but data is stale.** Check `curl localhost:3000/api/status` for
`ageHours`, then `docker compose logs fc-rank-updater`.

**`Blocked by Cloudflare even after refreshing clearance`.** The automatic
re-mint failed. Run the mint command above by hand to see why.

**`No DISPLAY set`.** The entrypoint didn't start Xvfb — you're likely running
`node` directly instead of through the image's entrypoint.

**Updater logs are empty.** Should not happen now; the image starts Xvfb via its
own entrypoint and `exec`s node, rather than using `xvfb-run` (which pipes
stdout, making Node block-buffer its logs, and hung outright during testing).
