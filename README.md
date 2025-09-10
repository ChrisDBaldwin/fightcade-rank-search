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
- Guilty Gear XX Accent Core Plus R (`ggxxacpr`)
- Vampire Savior (`vsav`)
- JoJo's Bizarre Adventure: Heritage for the Future (`jojoba`)

## 🚀 Quick Start

### Prerequisites

- **Windows with WSL** (Windows Subsystem for Linux) or Linux/macOS
- Node.js 16+ and npm
- Internet connection for fetching data

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd fc-rank-search
npm install
```

2. **Fetch game data** (e.g., Street Fighter III: 3rd Strike):
```bash
# On Windows, use WSL:
wsl npm run fetch-data sfiii3nr1

# On Linux/macOS:
npm run fetch-data sfiii3nr1
```

3. **Start the server**:
```bash
# On Windows, use WSL:
wsl npm run dev

# On Linux/macOS:
npm run dev
```

4. **Open your browser** and go to `http://localhost:3000`

That's it! 🎉 You can now search through **thousands** of player rankings instantly.

### 🔥 What You Get

- **6,700+ players** per game (vs. the original 15!) - that's **447x more data!**
- **Complete ranking database** access with pagination breakthrough
- **Instant search** through massive datasets
- **Advanced filtering** by rank, matches played, country, etc.
- **Beautiful, responsive UI** that works on all devices

> **🚀 Breakthrough Achievement**: We cracked Fightcade's pagination system to access **35,396 total players** (limited by API rate limits to ~6,700 per session)

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

### 🚀 Getting More Players

Due to Fightcade's API rate limits, you can fetch ~6,700 players per session. To get more:

1. **Wait and re-fetch**: Run the fetch command again after a few minutes
2. **Multiple sessions**: The tool automatically saves progress and continues where it left off
3. **Total available**: Up to 35,396 players are available for Street Fighter III: 3rd Strike!

```bash
# Run multiple times to get more players
wsl npm run fetch-data sfiii3nr1  # Gets ~6,700 players
# Wait 5-10 minutes...
wsl npm run fetch-data sfiii3nr1  # Gets more players, continuing from where it left off
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
│   │   ├── dataFetcher.ts   # Fightcade API integration
│   │   └── searchService.ts # Search and filtering logic
│   ├── scripts/         # Utility scripts
│   │   └── fetchRankings.ts # CLI data fetcher
│   └── server.ts        # Express.js server
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
npm run start        # Start production server
npm run fetch-data   # Fetch rankings data
npm run type-check   # Check TypeScript types
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
```

### Data Storage

- Player data is stored as JSON files in the `data/` directory
- Each game has its own file: `data/{gameId}-rankings.json`
- Data includes: rank, name, ELO, wins, losses, win rate
- Files are automatically created when fetching data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test them
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Fightcade Community** for the amazing platform
- **fightcade-api** library for easy API access
- All the players who make these games competitive and fun!

## ⚠️ Disclaimer

This tool is for educational and community purposes. Please be respectful of Fightcade's servers and don't fetch data too frequently. The tool includes reasonable delays between requests.

---

**Happy ranking! 🏆** Find your rank, track your progress, and discover new opponents in the Fightcade community.