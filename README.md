# FC Rank Search 🎮

A powerful tool for extracting, indexing, and searching Fightcade player rankings with a modern web interface. No more scrolling through endless pages of players - find rankings instantly!

## ✨ Features

- 🚀 **Fast Data Extraction**: Uses the official Fightcade API to fetch complete player rankings
- 🔍 **Powerful Search**: Search by player name with instant results
- 🎯 **Advanced Filtering**: Filter by ELO range, rank, win rate, and more
- 📊 **Statistics Dashboard**: View game statistics and top players
- 💾 **Local Caching**: Stores data locally as JSON for offline access
- 🎨 **Modern UI**: Beautiful, responsive web interface
- 📱 **Mobile Friendly**: Works perfectly on desktop and mobile devices

## 🎯 Supported Games

- Street Fighter III: 3rd Strike (`sfiii3nr1`)
- Street Fighter Alpha 3 (`sfa3`)
- Street Fighter II Champion Edition (`sf2ce`)
- King of Fighters 98 (`kof98`)
- King of Fighters 2002 (`kof2002`)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- **Google Chrome** installed locally (see "Cloudflare access" below — it's how we
  get past the challenge; on Linux you also need Xvfb)
- Internet connection for fetching data

### Cloudflare access (read this first)

Fightcade's API sits behind a Cloudflare managed challenge. A plain HTTP request
gets a `403` with a "Just a moment..." page. Two things get you through:

1. A `cf_clearance` cookie, and
2. the **exact** User-Agent of the browser that earned it.

That's all — no TLS impersonation or proxy service required. Once you hold both,
ordinary `fetch()` from Node works fine, and the cookie is nominally good for a
year.

Earning the cookie is the fiddly part. It needs a **headed** browser: headless
Chrome gets detected and re-challenged even when a valid cookie is already in
its profile. So `npm run refresh-clearance` drives a real Chrome window, waits
out the challenge, verifies it with a live API call, and stores the result in
`data/.clearance.json`.

```bash
npm run refresh-clearance
```

Treat `data/.clearance.json` as a credential — it's gitignored, keep it that way.

Everything after that is automatic: if the API ever answers `403`, the client
earns a new clearance and retries the request once.

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd fc-rank-search
npm install
```

2. **Earn a Cloudflare clearance** (opens a Chrome window briefly):
```bash
npm run refresh-clearance
```

3. **Fetch game data**:
```bash
npm run fetch-data sfiii3nr1   # one game
npm run update-all             # every game in src/config/games.ts
```

4. **Start the server**:
```bash
npm run dev
```

5. **Open your browser** and go to `http://localhost:3000`

### 🐳 Docker Installation (Alternative)

For easier deployment, you can use Docker:

**Quick start with Docker Compose**:
```bash
git clone <repository-url>
cd fc-rank-search
docker compose up -d
```

This starts the web server, which serves cached JSON and nothing else.

**Rankings are fetched on a desktop machine, not the server.** Clearing
Cloudflare's challenge needs a headed Chrome, which doesn't work on a headless
Debian host (tested — see DEPLOYMENT.md). A desktop machine runs the crawl daily
and uploads the JSON with `scripts/upload-to-server.sh`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full setup on both ends.

**Or build and run manually**:
```bash
# Build the image
docker build -t fc-rank-search .

# Run the container
docker run -d \
  --name fc-rank-search \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  fc-rank-search
```

The application will be available at `http://localhost:3000` with data persisted in the local `data/` directory.

### 🔥 What You Get

- **Thousands of players** per game
- **Complete ranking database** access allowing for pulling data from the Fightcade API
- **Instant search** through all players of a game
- **Advanced filtering** by rank, matches played, country, etc.
- **Beautiful, responsive UI** that works on all devices

> **🚀 Breakthrough Achievement**: We cracked Fightcade's pagination system to access **35,396 total players** (note the API rate limits)

## 📖 Usage Guide

### Fetching Data

**Fetch a specific game**:
```bash
npm run fetch-data sfiii3nr1  # Street Fighter III: 3rd Strike
npm run fetch-data kof98      # King of Fighters 98
```

**Fetch all popular games** (takes a while):
```bash
npm run fetch-data all
```

**View available games**:
```bash
npm run fetch-data
```

### Keeping data fresh

`npm run update-all` refreshes every game listed in `src/config/games.ts`. In
Docker this runs on a daily schedule by itself (see Deployment).

A full crawl is ~1000 requests across all games and takes roughly an hour, paced
at one page per 3 seconds. Going faster earns a sustained `503` storm from
Fightcade and gets the clearance revoked.

Two rails protect the data, both added after the failures actually happened:

- **A partial crawl is never saved.** If the API falters mid-crawl, the previous
  snapshot survives untouched rather than being replaced by truncated results.
- **The upload won't shrink production.** `scripts/upload-to-server.sh` rejects
  any local file with under 90% of the deployed player count.

Check freshness at any time:

```bash
curl http://localhost:3000/api/status
```

### Using the Web Interface

1. **Select a game** from the dropdown menu
2. **Fetch fresh data** if needed (data is cached for 24 hours)
3. **Search players** by name or use advanced filters:
   - ELO range (e.g., 1500-2000)
   - Rank range (e.g., top 100)
   - Win rate percentage
4. **Browse results** with pagination
5. **View statistics** and top players

### API Endpoints

The tool also provides a REST API:

- `GET /health` - Health check endpoint
- `GET /api/games` - List available games
- `POST /api/games/:gameId/fetch` - Fetch fresh data
- `GET /api/games/:gameId` - Get game info and stats
- `GET /api/games/:gameId/search` - Search players with filters
- `GET /api/games/:gameId/player/:name` - Find specific player
- `GET /api/games/:gameId/top` - Get top players

Example API usage:
```bash
# Search for players with "daigo" in their name
curl "http://localhost:3000/api/games/sfiii3nr1/search?name=daigo"

# Get top 10 players
curl "http://localhost:3000/api/games/sfiii3nr1/top?count=10"

# Find specific player
curl "http://localhost:3000/api/games/sfiii3nr1/player/YourPlayerName"
```

## 🛠️ Development

### Project Structure

```
fc-rank-search/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── services/        # Core business logic
│   │   ├── dataFetcher.ts       # Fightcade API integration
│   │   ├── searchService.ts     # Search and filtering logic
│   │   ├── sceneService.ts      # Scene analysis and submission tracking
│   │   ├── playerCache.ts       # Player data caching system
│   │   ├── statisticsService.ts # Game statistics and analytics
│   │   └── fightcadeApiDirect.ts # Direct Fightcade API access
│   ├── scripts/         # Utility scripts
│   │   └── fetchRankings.ts # CLI data fetcher
│   └── server.ts        # Express.js server with security middleware
├── public/              # Web interface
│   ├── index.html       # Main HTML page
│   ├── styles.css       # Modern CSS styling
│   └── app.js          # Frontend JavaScript
├── data/               # Cached JSON data files
└── dist/              # Compiled TypeScript output
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start              # Start production server
npm run fetch-data <game>  # Fetch one game's rankings
npm run update-all         # Refresh every game in src/config/games.ts
npm run refresh-clearance  # Earn a new Cloudflare clearance (opens Chrome)
npm run type-check         # Check TypeScript types
```

### Adding New Games

To add support for a new game:

1. Find the game ID from Fightcade
2. Add it to `POPULAR_GAMES` in `src/scripts/fetchRankings.ts`
3. Fetch data: `npm run fetch-data <gameId>`

## 🔧 Configuration

### Environment Variables

Create a `.env` file for custom configuration:

```env
PORT=3000                    # Server port
MAX_DATA_AGE_HOURS=24       # How long to cache data
NODE_ENV=production         # Enable production optimizations
```

### Production Features

The application includes several production-ready features:

- **Security**: Helmet.js for security headers and CORS protection
- **Performance**: Compression middleware for smaller response sizes
- **Health Checks**: `/health` endpoint for monitoring and load balancers
- **Caching**: Intelligent player data caching with configurable TTL
- **Docker**: Full containerization support with security best practices

### Data Storage

- Player data is stored as JSON files in the `data/` directory
- Each game has its own file: `data/{gameId}-rankings.json`
- Data includes: rank, name, ELO, total matches, time played, country, Fightcade tier rank
- Files are automatically created when fetching data
- For community scene management, see [documentation](SCENE_MANAGEMENT.md) for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-amazing-feature`
3. Make your changes and test them locally. Ensure others can do the same.
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request
7. We discuss
8. Merge, reject, or ignore the PR

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Fightcade Devs & Community** for the amazing platform
- **Claude Code** is pretty great at making websites fast
- All the players who still play these old games!

## ⚠️ Disclaimer

This tool is for educational and community purposes. Please be respectful of Fightcade's servers and don't fetch data too frequently. The tool includes reasonable delays between requests.

---

**Happy ranking! 🏆** Find your rank, track your progress, and discover new opponents in the Fightcade community.