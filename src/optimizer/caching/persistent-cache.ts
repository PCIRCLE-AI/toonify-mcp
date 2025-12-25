/**
 * Persistent Cache: Disk-based cache storage
 * Features:
 * - Save/load cache entries to/from disk
 * - Atomic writes to prevent corruption
 * - Auto-create cache directory
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { LRUCacheEntry } from './cache-types.js';

export class PersistentCache<T = any> {
  private filePath: string;

  constructor(filePath: string) {
    // Expand ~ to home directory
    this.filePath = filePath.startsWith('~')
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;

    // Ensure directory exists
    this.ensureDirectory();
  }

  /**
   * Ensure cache directory exists
   */
  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load all cache entries from disk
   */
  loadAll(): LRUCacheEntry<T>[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        return [];
      }

      return data as LRUCacheEntry<T>[];
    } catch (error) {
      console.error('[PersistentCache] Failed to load cache:', error);
      return [];
    }
  }

  /**
   * Save all cache entries to disk (atomic write)
   */
  saveAll(entries: LRUCacheEntry<T>[]): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const content = JSON.stringify(entries, null, 2);

      // Write to temp file first
      fs.writeFileSync(tempPath, content, 'utf-8');

      // Atomic rename
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      console.error('[PersistentCache] Failed to save cache:', error);
    }
  }

  /**
   * Save a single entry (append or update)
   */
  save(key: string, entry: LRUCacheEntry<T>): void {
    try {
      const entries = this.loadAll();

      // Find and update existing entry, or add new one
      const index = entries.findIndex(e => e.key === key);
      if (index >= 0) {
        entries[index] = entry;
      } else {
        entries.push(entry);
      }

      this.saveAll(entries);
    } catch (error) {
      console.error('[PersistentCache] Failed to save entry:', error);
    }
  }

  /**
   * Delete a single entry
   */
  delete(key: string): void {
    try {
      const entries = this.loadAll();
      const filtered = entries.filter(e => e.key !== key);

      if (filtered.length !== entries.length) {
        this.saveAll(filtered);
      }
    } catch (error) {
      console.error('[PersistentCache] Failed to delete entry:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      console.error('[PersistentCache] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache file size in bytes
   */
  getFileSize(): number {
    try {
      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if cache file exists
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }
}
