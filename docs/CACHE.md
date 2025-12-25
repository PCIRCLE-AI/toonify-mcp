# Enhanced Cache System

Toonify MCP includes a sophisticated caching system with LRU eviction, TTL expiration, and optional disk persistence.

## Overview

The cache system has **two layers**:

1. **Result Cache** (LRU Cache) - Caches optimization results to avoid re-processing identical content
2. **Prompt Cache** - Optimizes LLM API calls using provider-specific prompt caching (Anthropic/OpenAI)

## Result Cache (LRU)

### Features

- **LRU Eviction**: Automatically evicts least recently used entries when cache is full
- **TTL Expiration**: Entries expire after a configurable time-to-live
- **Persistent Storage**: Optionally save cache to disk for cross-session reuse
- **SHA-256 Keys**: Content-based keys ensure cache hits for identical inputs

### Configuration

```typescript
{
  resultCache: {
    enabled: true,              // Enable/disable result caching
    maxSize: 500,               // Maximum cache entries
    ttl: 3600000,               // Time-to-live in milliseconds (1 hour)
    persistent: false,          // Enable disk persistence
    persistPath: '~/.toonify-mcp/cache/optimization-cache.json'
  }
}
```

### How It Works

1. **Content is hashed** using SHA-256 to generate a cache key
2. **Cache is checked** before optimization
3. **If cache hit**: Return cached result immediately
4. **If cache miss**: Perform optimization and store result
5. **LRU eviction** removes oldest entry when `maxSize` is reached
6. **TTL expiration** removes entries after they expire

### Cache Statistics

```typescript
{
  hits: 120,                    // Number of cache hits
  misses: 30,                   // Number of cache misses
  evictions: 10,                // Number of LRU evictions
  expirations: 5,               // Number of TTL expirations
  currentSize: 485,             // Current cache entries
  maxSize: 500,                 // Maximum cache entries
  hitRate: 0.8,                 // Hit rate (80%)
  averageAccessCount: 2.5       // Average accesses per entry
}
```

## MCP Tools for Cache Management

### `clear_cache`

Clear all cached optimization results.

```bash
# Example usage via Claude Code
Use the clear_cache tool
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

### `get_cache_stats`

Get detailed statistics for both result cache and prompt cache.

```bash
Use the get_cache_stats tool
```

**Response:**
```json
{
  "resultCache": {
    "hits": 120,
    "misses": 30,
    "hitRate": 0.8,
    ...
  },
  "promptCache": {
    "cacheHits": 50,
    "cacheMisses": 10,
    "estimatedCacheSavings": 125000
  }
}
```

### `cleanup_expired_cache`

Remove all expired entries from the cache.

```bash
Use the cleanup_expired_cache tool
```

**Response:**
```json
{
  "success": true,
  "removedEntries": 15,
  "message": "Cleaned up 15 expired cache entries"
}
```

## Performance Impact

### Memory Usage

- **Per Entry**: ~2-5 KB (varies with content size)
- **500 Entries**: ~1-2.5 MB
- **Metadata Overhead**: Minimal (<100 bytes per entry)

### Speed Improvement

- **Cache Hit**: ~0.1 ms (instant return)
- **Cache Miss**: ~5-50 ms (optimization + cache store)
- **Speedup**: **50-500x faster** on cache hits

### Example Savings

```
Scenario: Processing 1000 identical JSON objects

Without Cache:
- 1000 optimizations × 20ms = 20,000ms (20 seconds)

With Cache:
- First optimization: 20ms
- Next 999 cache hits: 999 × 0.1ms = 99.9ms
- Total: ~120ms (167x faster!)
```

## Persistent Cache

### Enabling Persistence

```typescript
const optimizer = new TokenOptimizer({
  resultCache: {
    enabled: true,
    persistent: true,
    persistPath: '~/.toonify-mcp/cache/optimization-cache.json'
  }
});
```

### Benefits

- **Cross-session reuse**: Cache survives server restarts
- **Shared cache**: Multiple processes can share the same cache file
- **Backup**: Cache is preserved even after crashes

### Limitations

- **Disk I/O overhead**: Slower than memory-only cache
- **File locking**: Not designed for high-concurrency scenarios
- **Storage space**: Disk usage grows with cache size

### Best Practices

**Enable persistence when:**
- Running long-lived services
- Processing frequently repeated content
- Memory is limited

**Disable persistence when:**
- Processing unique, non-repeating content
- Running short-lived scripts
- Disk I/O is a bottleneck

## TTL (Time-to-Live)

### Recommended TTL Values

| Use Case | TTL | Rationale |
|----------|-----|-----------|
| Development | 5-10 minutes | Frequent code changes |
| Production (stable data) | 1-24 hours | Data changes infrequently |
| Production (dynamic data) | 5-30 minutes | Data changes often |
| CI/CD pipelines | 0 (disabled) | One-time processing |

### Auto-cleanup

The cache automatically removes expired entries:
- On `get()` calls (lazy cleanup)
- Via `cleanup_expired_cache` tool (manual cleanup)

## Advanced Usage

### Programmatic Access

```typescript
import { TokenOptimizer } from 'toonify-mcp';

const optimizer = new TokenOptimizer({
  resultCache: {
    enabled: true,
    maxSize: 1000,
    ttl: 3600000
  }
});

// Get cache instance
const cache = optimizer.getResultCache();

// Manual operations
cache.clear();
cache.cleanup();
const stats = cache.getStats();
```

### Custom Cache Keys

```typescript
import { LRUCache } from 'toonify-mcp';

// Generate custom key
const content = JSON.stringify({ data: 'example' });
const cacheKey = LRUCache.generateKey(content);

// Manually set/get
cache.set(cacheKey, result);
const cached = cache.get(cacheKey);
```

## Troubleshooting

### Cache Not Working

**Symptoms**: `hitRate` is always 0

**Solutions**:
1. Check `enabled: true` in config
2. Verify content is identical (same whitespace, order)
3. Check TTL hasn't expired

### High Memory Usage

**Symptoms**: Process uses excessive RAM

**Solutions**:
1. Reduce `maxSize` (default: 500)
2. Lower TTL to expire entries sooner
3. Call `cleanup_expired_cache` periodically

### Persistent Cache Not Loading

**Symptoms**: Cache resets after restart

**Solutions**:
1. Check `persistent: true` in config
2. Verify write permissions to `persistPath`
3. Check disk space availability

## Architecture

```
┌─────────────────────────────────────┐
│   TokenOptimizer.optimize()         │
│   (Check cache, avoid re-work)      │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        LRUCache (Memory Layer)      │
│  - Fast access (0.1ms)              │
│  - LRU eviction strategy            │
│  - TTL expiration checks            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│   PersistentCache (Disk Layer)      │
│  - Optional persistence             │
│  - Cross-session sharing            │
│  - Atomic file writes               │
└─────────────────────────────────────┘
```

## Migration Guide

### From v0.3.0 to v0.4.0

**No breaking changes** - Result cache is enabled by default with sensible defaults.

If you want to disable it:

```typescript
const optimizer = new TokenOptimizer({
  resultCache: {
    enabled: false
  }
});
```

### Updating Cache Configuration

```typescript
// Old (v0.3.0) - Only prompt caching
const optimizer = new TokenOptimizer({
  caching: {
    enabled: true,
    provider: 'anthropic'
  }
});

// New (v0.4.0) - Both prompt and result caching
const optimizer = new TokenOptimizer({
  caching: {
    enabled: true,
    provider: 'anthropic'
  },
  resultCache: {
    enabled: true,
    maxSize: 500,
    ttl: 3600000
  }
});
```

## See Also

- [README.md](../README.md) - Main documentation
- [API Documentation](./API.md) - API reference
- [Performance Guide](./PERFORMANCE.md) - Optimization tips
