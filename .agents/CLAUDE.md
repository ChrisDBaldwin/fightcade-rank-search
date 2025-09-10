# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FC Rank Search is a TypeScript/Node.js web application that fetches, indexes, and searches Fightcade player rankings. It uses the official Fightcade API to extract complete player databases and provides a modern web interface for instant player search and community scene management.

## Common Development Commands

### Building & Running
```bash
npm run build        # Compile TypeScript to JavaScript (outputs to dist/)
npm run start        # Start production server (requires build first)
npm run dev          # Start development server with hot reload
npm run type-check   # Check TypeScript types without building
```

### Data Management
```bash
npm run fetch-data sfiii3nr1    # Fetch Street Fighter III: 3rd Strike rankings
npm run fetch-data kof98        # Fetch King of Fighters 98 rankings  
npm run fetch-data all          # Fetch all popular games (takes time)
npm run fetch-data              # Show available games
```

Note: On Windows, prefix commands with `wsl` (e.g., `wsl npm run dev`)

## Architecture Overview

### Core Services (`src/services/`)
- **DataFetcher** (`dataFetcher.ts`): Fightcade API integration, handles player data fetching and caching
- **SearchService** (`searchService.ts`): Player search, filtering, and ranking logic
- **SceneService** (`sceneService.ts`): Community scene management with hybrid data sources
- **StatisticsService** (`statisticsService.ts`): Game statistics and analytics
- **PlayerCache** (`playerCache.ts`): LRU cache for live player data with disk persistence
- **FightcadeApiDirect** (`fightcadeApiDirect.ts`): Direct API calls for live player lookups

### Data Flow Architecture
1. **Batch Data**: `DataFetcher` extracts complete rankings → stored in `data/{gameId}-rankings.json`
2. **Live Data**: `FightcadeApiDirect` fetches individual players → cached by `PlayerCache`
3. **Hybrid Approach**: `SceneService` combines cached JSON + selective live API calls for optimal performance

### Key Data Structures
- **Player**: Core player interface with ELO, rank, matches, country
- **GameData**: Complete game dataset with metadata
- **SearchFilters**: Flexible filtering system for player queries
- **SearchResult**: Paginated search results

### API Architecture
The Express server (`src/server.ts`) provides comprehensive REST endpoints:

#### Game Data APIs
- `GET /api/games` - Available games
- `POST /api/games/:gameId/fetch` - Fetch fresh rankings
- `GET /api/games/:gameId/search` - Search players with filters

#### Scene Management APIs  
- `GET /api/scenes` - All community scenes
- `GET /api/scenes/:sceneId` - Scene with cached player data
- `GET /api/scenes/:sceneId/hybrid` - Scene with hybrid cached+live data
- `GET /api/scenes/:sceneId/live` - Scene with fresh live data

#### Live Player APIs
- `GET /api/user/:username` - Single player live lookup
- `POST /api/users/batch` - Bulk player lookups (max 50)

### Frontend (`public/`)
Single-page application with vanilla JavaScript:
- **index.html**: Main interface with game selection and scene management
- **app.js**: Frontend logic for search, filtering, and API communication
- **styles.css**: Modern responsive CSS

### Data Storage
- **JSON Files**: `data/{gameId}-rankings.json` for bulk player data
- **Scene Configuration**: `data/scenes.json` for curated community scenes
- **Player Cache**: Auto-saved to `data/player-cache.json` every 30 minutes

## Development Patterns

### Error Handling
- All API endpoints use try-catch with proper HTTP status codes
- Services return structured results with error details
- Frontend shows user-friendly error messages

### Security
- Helmet.js for security headers with CSP configuration
- CORS enabled for cross-origin requests
- Input validation on all API endpoints
- No user-generated content (admin-curated scenes only)

### Performance Optimizations
- LRU cache for live player data (10k entries, 24h expiry)
- 1-minute caching for scene data
- Compression middleware for responses
- Efficient pagination for large datasets

### TypeScript Configuration
- Strict mode enabled with comprehensive type checking
- Source maps and declarations generated for debugging
- CommonJS modules targeting ES2020

## Scene Management System

Curated community scenes are managed through `data/scenes.json`:
- Admin-controlled content (no user submissions via web)
- Email-based submission process to `scenes@voidtalker.com`
- Hot-reloading with 1-minute cache refresh
- Hybrid data strategy: cached rankings + selective live updates

## Supported Games

Popular fighting games with active communities:
- Street Fighter III: 3rd Strike (`sfiii3nr1`)
- King of Fighters 98 (`kof98`) 
- Street Fighter Alpha 3 (`sfa3`)
- And many more (see README.md for full list)

## Important Notes

- **Rate Limiting**: Fightcade API limits ~6,700 players per session
- **Data Freshness**: Cached data expires after 24 hours
- **WSL Required**: Windows users must use WSL for fetch commands
- **No Database**: File-based storage for simplicity and security
- **Graceful Shutdown**: Auto-saves cache on SIGINT/SIGTERM