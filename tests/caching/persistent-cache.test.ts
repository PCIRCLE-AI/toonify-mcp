/**
 * PersistentCache concurrency tests
 *
 * Targets the write-path race directly: the batch-timer flush used to run on
 * a setTimeout OUTSIDE the serial write queue, so it could overlap a queued
 * saveAll/delete. With a shared temp path that produced an intermittent
 * `ENOENT: rename ...tmp` crash; even after unique temp paths fixed the
 * crash, two concurrent loadAll → merge → write-full-state operations could
 * still interleave last-writer-wins and lose an update. Routing the batch
 * flush through the same queue serializes all disk writes.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PersistentCache } from '../../src/optimizer/caching/persistent-cache.js';
import type { LRUCacheEntry } from '../../src/optimizer/caching/cache-types.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function entry<T>(key: string, value: T): LRUCacheEntry<T> {
  const now = Date.now();
  return {
    key,
    value,
    timestamp: now,
    lastAccessed: now,
    accessCount: 1,
    expiresAt: now + 3_600_000,
  };
}

describe('PersistentCache write-path serialization', () => {
  let cachePath: string;

  beforeEach(() => {
    cachePath = path.join(os.tmpdir(), `pc-concurrency-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  });

  afterEach(() => {
    for (const f of [cachePath, `${cachePath}.tmp`]) {
      try { fs.unlinkSync(f); } catch { /* not there */ }
    }
  });

  it('does not crash or lose updates when a batched save overlaps a saveAll', async () => {
    const cache = new PersistentCache<string>(cachePath);

    // A batched single save schedules a timer-driven flush; fire a saveAll
    // essentially concurrently so the two write paths race. Repeat to make an
    // interleaving overwhelmingly likely if the race still exists.
    for (let round = 0; round < 25; round++) {
      const batched = cache.save(`batched-${round}`, entry(`batched-${round}`, `v${round}`));
      const bulk = cache.saveAll([
        entry(`bulk-a-${round}`, `a${round}`),
        entry(`bulk-b-${round}`, `b${round}`),
      ]);
      await Promise.all([batched, bulk]);
    }

    // flush() must resolve only after the final write is on disk.
    await cache.flush();

    const persisted = cache.loadAll();
    const keys = new Set(persisted.map(e => e.key));

    // The last saveAll wins the full-state snapshot, so the two bulk keys from
    // the final round must be present — the point is no ENOENT crash occurred
    // and flush() genuinely waited for the write to land.
    expect(keys.has('bulk-a-24')).toBe(true);
    expect(keys.has('bulk-b-24')).toBe(true);
    expect(fs.existsSync(cachePath)).toBe(true);
    // No orphaned temp file left behind.
    expect(fs.existsSync(`${cachePath}.tmp`)).toBe(false);
  });

  it('flush() resolves only after the pending batched write is durable', async () => {
    const cache = new PersistentCache<string>(cachePath);

    // Queue a batched save but do NOT wait for its debounce timer.
    void cache.save('pending', entry('pending', 'durable-value'));

    // flush() should force the pending write out and only resolve once it's
    // on disk — a fresh instance reading the file must see it immediately.
    await cache.flush();

    const reader = new PersistentCache<string>(cachePath);
    const loaded = reader.loadAll();
    expect(loaded.find(e => e.key === 'pending')?.value).toBe('durable-value');
  });
});
