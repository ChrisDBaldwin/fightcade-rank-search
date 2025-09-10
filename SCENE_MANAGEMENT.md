# 🏆 Community Scene Management System

## ✨ What's New

Your FC Rank Search now supports **curated community scenes**! This secure, admin-managed system lets you showcase fighting game communities from around the world.

## 🎯 Key Features

### **Curated Content** 
- **You control everything** - no user-generated security risks
- **Quality assured** - all scenes manually reviewed
- **Community focused** - highlight the best local scenes

### **Simple Management**
- **JSON-based** - easy to edit and version control
- **No database complexity** - just edit `data/scenes.json`
- **Hot-reloading** - changes appear immediately (1-minute cache)

### **Email Submissions**
- **Community engagement** - users email you their scenes
- **Submission guidelines** - clear format and examples provided
- **Manual approval** - you decide what gets featured

## 📁 File Structure

```
data/
├── scenes.json              # Scene configuration file
├── sfiii3nr1-rankings.json  # Game data (existing)
└── ...

src/services/
├── sceneService.ts          # Scene management logic
├── dataFetcher.ts          # Game data (existing)
└── ...

public/
├── app.js                  # Updated frontend (scenes support)
├── index.html             # Updated UI (community scenes)
└── ...
```

## 🔧 Managing Scenes

### Adding a New Scene

Edit `data/scenes.json` and add to the `scenes` array:

```json
{
  "id": "your-scene-id",
  "name": "Your Scene Name",
  "description": "A cool description with emojis! 🎮",
  "gameId": "sfiii3nr1",
  "gameName": "Street Fighter III: 3rd Strike",
  "players": [
    "Player1",
    "Player2",
    "Player3"
  ],
  "createdAt": "2024-01-15T00:00:00.000Z",
  "submittedBy": "Community Name"
}
```

### Scene ID Guidelines
- Use lowercase with hyphens: `minnesota-fgc`, `japan-legends`
- Keep it short and descriptive
- Must be unique

### Player Names
- Use **exact** Fightcade usernames (case-sensitive)
- 5-20 players work best for display
- Players not found in rankings will show as "Not found"

## 📧 User Submission Process

Users can submit scenes via email to `scenes@voidtalker.com` (configurable in `sceneService.ts`).

### Email Template Provided
The system shows users exactly how to format their submissions:

```
Subject: New Scene Submission

Scene Name: California FGC
Game: Street Fighter III: 3rd Strike
Players: Player1, Player2, Player3, Player4
Description: West Coast warriors representing the Golden State!
Submitted by: YourName
```

## 🚀 API Endpoints

The system adds these new endpoints:

- `GET /api/scenes` - List all scenes with stats
- `GET /api/scenes/:sceneId` - Get scene with player rankings
- `GET /api/scenes/game/:gameId` - Get scenes for a specific game
- `GET /api/scenes/submission-info` - Get submission guidelines

## 🎨 Frontend Features

### Community Scenes Page
- **Scene selection dropdown** with player counts
- **Beautiful scene descriptions** with emojis
- **Real-time player rankings** when game data available
- **Submission info modal** with clear guidelines

### Smart Defaults
- Auto-selects Street Fighter III: 3rd Strike scenes first (as per user preference)
- Falls back to first available scene
- Shows helpful messages when no scenes exist

## 🛡️ Security Benefits

- **Zero user input** - no XSS/injection risks
- **No database** - no SQL injection possibilities  
- **Admin controlled** - you curate all content
- **File-based** - easy to backup and version control
- **Home server friendly** - minimal attack surface

## 🔄 Deployment Notes

### For Your Home Server
1. **Caddy integration** - works perfectly with your existing setup
2. **No additional dependencies** - removed SQLite/database requirements
3. **Static file serving** - scenes.json served like any other asset
4. **Email integration** - you handle submissions manually (secure!)

### Updating Scenes
1. Edit `data/scenes.json`
2. Save the file
3. Changes appear within 1 minute (cache refresh)
4. No server restart required!

## 🎯 Example Scenes You Could Feature

- **Minnesota FGC** (already included!)
- **EVO Champions** - top tournament players
- **Japanese Legends** - classic arcade masters  
- **Rising Stars** - up-and-coming players
- **Regional Scenes** - Texas, California, etc.
- **Character Specialists** - best Chun-Li players, etc.

## 🚀 Ready to Launch!

Your curated scene system is ready to go! Users can now:
1. Browse community scenes
2. See real player rankings
3. Submit their own scenes via email
4. Enjoy a secure, curated experience

**Perfect for your home server setup!** 🏠✨
