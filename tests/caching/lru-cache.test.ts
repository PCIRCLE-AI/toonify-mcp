/**
 * LRU Cache Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LRUCache } from '../../src/optimizer/caching/lru-cache.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('LRUCache', () => {
  let cache: LRUCache<string>;
  const testCachePath = path.join(os.tmpdir(), 'test-cache.json');

  beforeEach(() => {
    // Clean up test cache file
    if (fs.existsSync(testCachePath)) {
      fs.unlinkSync(testCachePath);
    }

    cache = new LRUCache<string>({
      enabled: true,
      maxSize: 3,
      ttl: 1000, // 1 second for testing
      persistent: false
    });
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testCachePath)) {
      fs.unlinkSync(testCachePath);
    }
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when maxSize is reached', () => {
      // maxSize = 3
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // key1 should be evicted when adding key4
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
      expect(cache.size()).toBe(3);
    });

    it('should update access time when getting value', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1, making it most recently used
      cache.get('key1');

      // key2 should now be LRU, so it gets evicted
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTLCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 100, // 100ms
        persistent: false
      });

      shortTTLCache.set('key1', 'value1');
      expect(shortTTLCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortTTLCache.get('key1')).toBeUndefined();
    });

    it('should clean up expired entries', async () => {
      const shortTTLCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 100,
        persistent: false
      });

      shortTTLCache.set('key1', 'value1');
      shortTTLCache.set('key2', 'value2');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const removedCount = shortTTLCache.cleanup();
      expect(removedCount).toBe(2);
      expect(shortTTLCache.size()).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    it('should track evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Triggers eviction

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it('should track access count', () => {
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.averageAccessCount).toBe(3);
    });
  });

  describe('Cache Clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent SHA-256 keys', () => {
      const content = 'test content';
      const key1 = LRUCache.generateKey(content);
      const key2 = LRUCache.generateKey(content);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different keys for different content', () => {
      const key1 = LRUCache.generateKey('content1');
      const key2 = LRUCache.generateKey('content2');

      expect(key1).not.toBe(key2);
    });
  });

  describe('Persistence', () => {
    it('should save and load from disk', () => {
      const persistentCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 3600000,
        persistent: true,
        persistPath: testCachePath
      });

      persistentCache.set('key1', 'value1');
      persistentCache.set('key2', 'value2');
      persistentCache.saveToDisk();

      // Create new cache instance with same path
      const loadedCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 3600000,
        persistent: true,
        persistPath: testCachePath
      });

      expect(loadedCache.get('key1')).toBe('value1');
      expect(loadedCache.get('key2')).toBe('value2');
    });

    it('should not load expired entries from disk', async () => {
      const shortTTLCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 100,
        persistent: true,
        persistPath: testCachePath
      });

      shortTTLCache.set('key1', 'value1');
      shortTTLCache.saveToDisk();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Create new instance - should not load expired entry
      const loadedCache = new LRUCache<string>({
        enabled: true,
        maxSize: 10,
        ttl: 100,
        persistent: true,
        persistPath: testCachePath
      });

      expect(loadedCache.get('key1')).toBeUndefined();
    });
  });

  describe('Disabled Cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new LRUCache<string>({
        enabled: false,
        maxSize: 10,
        ttl: 3600000,
        persistent: false
      });

      disabledCache.set('key1', 'value1');
      expect(disabledCache.get('key1')).toBeUndefined();
    });
  });
});
