import * as fs from 'fs';
import * as path from 'path';

export interface CachedPlayerData {
  username: string;
  data: any; // Raw Fightcade API data
  country: string;
  gameinfo: { [gameId: string]: any };
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
  lastAccessed: string;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  cacheSize: string;
  oldestEntry: string;
  newestEntry: string;
}

export class PlayerCache {
  private cache: Map<string, CachedPlayerData> = new Map();
  private cacheFilePath: string;
  private maxCacheSize: number;
  private cacheExpiryHours: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(
    maxCacheSize: number = 10000, // Max 10k players
    cacheExpiryHours: number = 24 // Cache expires after 24 hours
  ) {
    this.maxCacheSize = maxCacheSize;
    this.cacheExpiryHours = cacheExpiryHours;
    this.cacheFilePath = path.join(process.cwd(), 'data', 'player-cache.json');
    
    // Ensure data directory exists
    const dataDir = path.dirname(this.cacheFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.loadCacheFromDisk();
    console.log(`🗄️ PlayerCache initialized: ${this.cache.size} entries loaded`);
  }

  /**
   * Get player data from cache
   */
  get(username: string): CachedPlayerData | null {
    const normalizedUsername = username.toLowerCase();
    const cached = this.cache.get(normalizedUsername);
    
    if (!cached) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (new Date() > new Date(cached.expiresAt)) {
      console.log(`⏰ Cache expired for ${username}, removing...`);
      this.cache.delete(normalizedUsername);
      this.missCount++;
      return null;
    }

    // Update access stats
    cached.hitCount++;
    cached.lastAccessed = new Date().toISOString();
    this.hitCount++;
    
    console.log(`✅ Cache HIT for ${username} (${cached.hitCount} total hits)`);
    return cached;
  }

  /**
   * Store player data in cache
   */
  set(username: string, playerData: any): void {
    const normalizedUsername = username.toLowerCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.cacheExpiryHours * 60 * 60 * 1000));

    const cachedData: CachedPlayerData = {
      username: playerData.name || username,
      data: playerData,
      country: playerData.country?.full_name || playerData.country || 'Unknown',
      gameinfo: playerData.gameinfo || {},
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0,
      lastAccessed: now.toISOString()
    };

    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntries(Math.floor(this.maxCacheSize * 0.1)); // Remove 10% of cache
    }

    this.cache.set(normalizedUsername, cachedData);
    console.log(`💾 Cached player data for ${username} (expires: ${expiresAt.toLocaleString()})`);
  }

  /**
   * Check if player exists in cache and is not expired
   */
  has(username: string): boolean {
    const cached = this.get(username);
    return cached !== null;
  }

  /**
   * Remove expired entries from cache
   */
  cleanup(): number {
    const now = new Date();
    let removedCount = 0;

    for (const [username, data] of this.cache.entries()) {
      if (now > new Date(data.expiresAt)) {
        this.cache.delete(username);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`);
    }

    return removedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.hitCount + this.missCount;
    
    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: totalRequests > 0 ? Math.round((this.hitCount / totalRequests) * 100) : 0,
      cacheSize: this.getCacheSizeFormatted(),
      oldestEntry: entries.length > 0 ? 
        entries.reduce((oldest, current) => 
          new Date(current.cachedAt) < new Date(oldest.cachedAt) ? current : oldest
        ).cachedAt : 'N/A',
      newestEntry: entries.length > 0 ? 
        entries.reduce((newest, current) => 
          new Date(current.cachedAt) > new Date(newest.cachedAt) ? current : newest
        ).cachedAt : 'N/A'
    };
  }

  /**
   * Get all cached players for a specific game
   */
  getPlayersForGame(gameId: string): CachedPlayerData[] {
    const players: CachedPlayerData[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.gameinfo && cached.gameinfo[gameId]) {
        players.push(cached);
      }
    }

    return players.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
  }

  /**
   * Bulk get multiple players
   */
  getBulk(usernames: string[]): { [username: string]: CachedPlayerData | null } {
    const result: { [username: string]: CachedPlayerData | null } = {};
    
    for (const username of usernames) {
      result[username] = this.get(username);
    }
    
    return result;
  }

  /**
   * Clear all cache data
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log('🗑️ Cache cleared');
  }

  /**
   * Save cache to disk for persistence
   */
  saveCacheToDisk(): void {
    try {
      const cacheData = {
        cache: Array.from(this.cache.entries()),
        stats: {
          hitCount: this.hitCount,
          missCount: this.missCount,
          savedAt: new Date().toISOString()
        }
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cache saved to disk: ${this.cache.size} entries`);
    } catch (error) {
      console.error('❌ Error saving cache to disk:', error);
    }
  }

  /**
   * Load cache from disk
   */
  private loadCacheFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        console.log('📂 No existing cache file found, starting fresh');
        return;
      }

      const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf-8'));
      
      if (cacheData.cache && Array.isArray(cacheData.cache)) {
        this.cache = new Map(cacheData.cache);
        
        // Load stats
        if (cacheData.stats) {
          this.hitCount = cacheData.stats.hitCount || 0;
          this.missCount = cacheData.stats.missCount || 0;
        }

        // Clean up expired entries on load
        this.cleanup();
        
        console.log(`📂 Cache loaded from disk: ${this.cache.size} entries`);
      }
    } catch (error) {
      console.error('❌ Error loading cache from disk:', error);
      console.log('🔄 Starting with empty cache');
    }
  }

  /**
   * Remove oldest entries to make space
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());

    for (let i = 0; i < count && i < entries.length; i++) {
      const [username] = entries[i];
      this.cache.delete(username);
    }

    console.log(`🗑️ Evicted ${count} oldest cache entries`);
  }

  /**
   * Get formatted cache size
   */
  private getCacheSizeFormatted(): string {
    const sizeInBytes = JSON.stringify(Array.from(this.cache.entries())).length;
    const sizeInKB = Math.round(sizeInBytes / 1024);
    const sizeInMB = Math.round(sizeInKB / 1024);
    
    if (sizeInMB > 1) {
      return `${sizeInMB} MB`;
    } else if (sizeInKB > 1) {
      return `${sizeInKB} KB`;
    } else {
      return `${sizeInBytes} bytes`;
    }
  }

  /**
   * Auto-save cache periodically
   */
  startAutoSave(intervalMinutes: number = 30): void {
    setInterval(() => {
      this.cleanup(); // Clean expired entries
      this.saveCacheToDisk(); // Save to disk
    }, intervalMinutes * 60 * 1000);
    
    console.log(`🔄 Auto-save enabled: every ${intervalMinutes} minutes`);
  }
}
