/**
 * LRU Cache with TTL (Time-to-Live) support
 * Features:
 * - Least Recently Used eviction strategy
 * - TTL-based expiration
 * - Optional disk persistence
 */

import crypto from 'crypto';
import type { LRUCacheConfig, LRUCacheEntry, LRUCacheStats } from './cache-types.js';
import { PersistentCache } from './persistent-cache.js';

export class LRUCache<T = unknown> {
  private cache: Map<string, LRUCacheEntry<T>>;
  private config: Required<LRUCacheConfig>;
  private stats: LRUCacheStats;
  private persistentCache?: PersistentCache<T>;
  private totalAccessCount: number = 0; // Running total for O(1) average calculation

  constructor(config: Partial<LRUCacheConfig> = {}) {
    this.config = {
      enabled: true,
      maxSize: 500,
      ttl: 3600000, // 1 hour in milliseconds
      persistent: false,
      persistPath: '~/.toonify-mcp/cache/optimization-cache.json',
      ...config
    } as Required<LRUCacheConfig>;

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      currentSize: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      averageAccessCount: 0
    };

    // Initialize persistent cache if enabled
    if (this.config.persistent && this.config.persistPath) {
      this.persistentCache = new PersistentCache<T>(this.config.persistPath);
      this.loadFromDisk();
    }
  }

  /**
   * Generate cache key from content using SHA-256
   */
  static generateKey(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.totalAccessCount -= entry.accessCount; // Update running total
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // Update access metadata (LRU)
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.totalAccessCount++; // Update running total

    // Delete and re-insert to move to end (most recently used in Map)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateStats();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();

    // Check if we need to evict (LRU)
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: LRUCacheEntry<T> = {
      key,
      value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 0,
      expiresAt: now + this.config.ttl
    };

    this.cache.set(key, entry);
    this.stats.currentSize = this.cache.size;

    // Persist to disk if enabled
    if (this.persistentCache) {
      this.persistentCache.save(key, entry);
    }
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: LRUCacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Evict least recently used entry
   * Since Map maintains insertion order, the first entry is the least recently used
   */
  private evictLRU(): void {
    // Get first entry (least recently used)
    const firstKey = this.cache.keys().next().value;

    if (firstKey) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        this.totalAccessCount -= entry.accessCount; // Update running total
      }

      this.cache.delete(firstKey);
      this.stats.evictions++;
      this.stats.currentSize = this.cache.size;

      // Remove from disk
      if (this.persistentCache) {
        this.persistentCache.delete(firstKey);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.currentSize = 0;
    this.totalAccessCount = 0; // Reset running total

    if (this.persistentCache) {
      this.persistentCache.clear();
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.totalAccessCount -= entry.accessCount; // Update running total
        this.cache.delete(key);
        this.stats.expirations++;
        removed++;

        if (this.persistentCache) {
          this.persistentCache.delete(key);
        }
      }
    }

    this.stats.currentSize = this.cache.size;
    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): LRUCacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate and average access count (O(1) complexity)
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

    // Calculate average access count using running total (O(1))
    this.stats.averageAccessCount = this.cache.size > 0 ? this.totalAccessCount / this.cache.size : 0;
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    if (!this.persistentCache) {
      return;
    }

    const entries = this.persistentCache.loadAll();
    const now = Date.now();

    for (const entry of entries) {
      // Skip expired entries
      if (now > entry.expiresAt) {
        this.stats.expirations++;
        continue;
      }

      this.cache.set(entry.key, entry);
      this.totalAccessCount += entry.accessCount; // Initialize running total from disk
    }

    this.stats.currentSize = this.cache.size;
  }

  /**
   * Force save all entries to disk and wait for completion
   */
  async saveToDisk(): Promise<void> {
    if (!this.persistentCache) {
      return;
    }

    // Flush all pending writes and save current state
    await this.persistentCache.flush();
    await this.persistentCache.saveAll(Array.from(this.cache.values()));
    await this.persistentCache.flush(); // Ensure final save completes
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists (without updating access time)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    return !this.isExpired(entry);
  }
}
