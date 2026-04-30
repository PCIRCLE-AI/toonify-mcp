# Cache System

Toonify MCP includes two cache layers:

1. `resultCache`
   Reuses previous optimization results for identical content plus tool metadata.
2. `caching`
   Structures large optimized output for provider-specific prompt caching.

This page is for advanced configuration. Most users do not need to change cache settings.

## What exists today

- LRU result cache with TTL expiration
- Optional persistent disk storage
- SHA-256 cache keys
- Cache statistics through the MCP server
- Prompt-cache metadata for supported providers

## Result cache configuration

```typescript
{
  resultCache: {
    enabled: true,
    maxSize: 500,
    ttl: 3600000,
    persistent: false,
    persistPath: '~/.toonify-mcp/cache/optimization-cache.json'
  }
}
```

## Prompt-cache configuration

```typescript
{
  caching: {
    enabled: true,
    provider: 'auto',
    ttl: '1hour',
    cacheStaticPrompts: true,
    minCacheableTokens: 1024
  }
}
```

## MCP cache tools

The MCP server exposes:

- `clear_cache`
- `get_cache_stats`
- `cleanup_expired_cache`

These are useful when you want to inspect cache behavior or clear old entries during testing.

## When to care

Tune cache settings when:

- you process repeated large payloads
- you want disk persistence across sessions
- you are debugging cache hit rate or memory usage

Leave defaults alone when:

- you are just using plugin mode normally
- you mostly process one-off content
- you do not need cache persistence

## Notes

- Cache behavior is an implementation detail, not the primary user workflow.
- Public install and verification guidance lives in:
  - [README.md](../README.md)
  - [README.zh-TW.md](../README.zh-TW.md)
  - [landing page](./index.html)
- Release history and version changes live in:
  - [CHANGELOG.md](../CHANGELOG.md)
