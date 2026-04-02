/**
 * Persistent Cache: Disk-based cache storage
 * Features:
 * - Save/load cache entries to/from disk
 * - Atomic writes to prevent corruption
 * - Auto-create cache directory
 * - Operation serialization to prevent race conditions
 * - Batched writes to reduce disk I/O
 */

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import type { LRUCacheEntry } from './cache-types.js';

/**
 * Write operation for the queue
 */
interface WriteOperation<T> {
  type: 'save' | 'delete' | 'clear' | 'saveAll';
  key?: string;
  entry?: LRUCacheEntry<T>;
  entries?: LRUCacheEntry<T>[];
  resolve: () => void;
  reject: (error: Error) => void;
}

/** Allowed base directories for cache files */
const ALLOWED_CACHE_BASES = [
  path.join(os.homedir(), '.toonify-mcp'),
  path.join(os.homedir(), '.claude'),
  os.tmpdir(),
];

export class PersistentCache<T = unknown> {
  private filePath: string;
  private writeQueue: WriteOperation<T>[] = [];
  private isProcessing = false;
  private pendingWrites: Map<string, LRUCacheEntry<T>> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY_MS = 100; // Debounce writes by 100ms

  constructor(filePath: string) {
    // Expand ~ to home directory
    const expanded = filePath.startsWith('~')
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;

    // Resolve to absolute path and validate against path traversal
    this.filePath = path.resolve(expanded);
    this.validatePath(this.filePath);

    // Ensure directory exists
    this.ensureDirectory();
  }

  /**
   * Validate cache file path stays within allowed directories.
   * Prevents path traversal attacks via malicious persistPath config.
   */
  private validatePath(resolvedPath: string): void {
    const isAllowed = ALLOWED_CACHE_BASES.some(base =>
      resolvedPath.startsWith(path.resolve(base))
    );
    if (!isAllowed) {
      throw new Error(
        `Cache path "${resolvedPath}" is outside allowed directories. ` +
        `Allowed: ${ALLOWED_CACHE_BASES.join(', ')}`
      );
    }
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
   * Save all cache entries to disk (atomic write via temp file + rename)
   * Internal use only — async to avoid blocking event loop
   */
  private async saveAllAsync(entries: LRUCacheEntry<T>[]): Promise<void> {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const content = JSON.stringify(entries, null, 2);

      // Write to temp file first, then atomic rename
      await fsp.writeFile(tempPath, content, 'utf-8');
      await fsp.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('[PersistentCache] Failed to save cache:', error);
      throw error;
    }
  }

  /**
   * Save all cache entries to disk (queued)
   */
  async saveAll(entries: LRUCacheEntry<T>[]): Promise<void> {
    return this.queueWrite({ type: 'saveAll', entries });
  }

  /**
   * Flush all pending writes immediately
   * Call this before process exit to ensure all writes are persisted
   */
  async flush(): Promise<void> {
    // Cancel batch timer and flush immediately
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.flushPendingWrites();

    // Wait for queue to empty
    while (this.writeQueue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Queue a write operation
   */
  private queueWrite(operation: Omit<WriteOperation<T>, 'resolve' | 'reject'>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ ...operation, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the write queue serially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.writeQueue.length > 0) {
      const operation = this.writeQueue.shift()!;

      try {
        await this.executeOperation(operation);
        operation.resolve();
      } catch (error) {
        operation.reject(error as Error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single write operation
   */
  private async executeOperation(operation: WriteOperation<T>): Promise<void> {
    switch (operation.type) {
      case 'save':
        if (operation.key && operation.entry) {
          this.pendingWrites.set(operation.key, operation.entry);
          this.scheduleBatchWrite();
        }
        break;

      case 'delete':
        if (operation.key) {
          this.pendingWrites.delete(operation.key);
          const entries = this.loadAll();
          const filtered = entries.filter(e => e.key !== operation.key);
          if (filtered.length !== entries.length) {
            await this.saveAllAsync(filtered);
          }
        }
        break;

      case 'clear':
        this.pendingWrites.clear();
        if (this.batchTimer) {
          clearTimeout(this.batchTimer);
          this.batchTimer = null;
        }
        try {
          await fsp.unlink(this.filePath);
        } catch {
          // File doesn't exist — nothing to delete
        }
        break;

      case 'saveAll':
        if (operation.entries) {
          this.pendingWrites.clear();
          if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
          }
          await this.saveAllAsync(operation.entries);
        }
        break;
    }
  }

  /**
   * Schedule a batched write operation
   */
  private scheduleBatchWrite(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushPendingWrites();
    }, this.BATCH_DELAY_MS);
  }

  /**
   * Flush all pending writes to disk
   */
  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) {
      return;
    }

    const entries = this.loadAll();
    const entryMap = new Map(entries.map(e => [e.key, e]));

    // Merge pending writes
    for (const [key, entry] of this.pendingWrites.entries()) {
      entryMap.set(key, entry);
    }

    await this.saveAllAsync(Array.from(entryMap.values()));
    this.pendingWrites.clear();
    this.batchTimer = null;
  }

  /**
   * Save a single entry (batched and queued)
   */
  async save(key: string, entry: LRUCacheEntry<T>): Promise<void> {
    return this.queueWrite({ type: 'save', key, entry });
  }

  /**
   * Delete a single entry (queued)
   */
  async delete(key: string): Promise<void> {
    return this.queueWrite({ type: 'delete', key });
  }

  /**
   * Clear all cache entries (queued)
   */
  async clear(): Promise<void> {
    return this.queueWrite({ type: 'clear' });
  }

  /**
   * Get cache file size in bytes
   */
  getFileSize(): number {
    try {
      const stats = fs.statSync(this.filePath);
      return stats.size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[PersistentCache] Failed to get file size:', error);
      }
      return 0; // File doesn't exist = 0 bytes (expected on first use)
    }
  }

  /**
   * Check if cache file exists
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }
}
