/**
 * Cache Optimizer: Structures content for prompt caching
 */

import type { CacheConfig, CachedContent, CacheMetadata, CacheMetrics } from './cache-types.js';
import { getStrategy } from './cache-strategies.js';

/** Approximate characters per token for cache size estimation */
const CHARS_PER_TOKEN_ESTIMATE = 4;

export class CacheOptimizer {
  private config: CacheConfig;
  private metrics: CacheMetrics;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: true,
      provider: 'auto',
      ttl: '1hour',
      cacheStaticPrompts: true,
      minCacheableTokens: 1024,
      ...config
    };

    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      estimatedCacheSavings: 0,
      totalCacheableTokens: 0,
      averageCacheReuseCount: 0
    };
  }

  /**
   * Wrap optimized TOON content with cache-friendly structure
   */
  wrapWithCaching(
    toonContent: string,
    toolName: string,
    format: 'json' | 'csv' | 'yaml',
    originalTokens: number,
    optimizedTokens: number
  ): CachedContent {
    if (!this.config.enabled || !this.config.cacheStaticPrompts) {
      // Return non-cached structure
      return {
        staticPrefix: '',
        dynamicContent: this.formatTOONOutput(toonContent, toolName, format),
        cacheBreakpoint: false
      };
    }

    // Check if content is large enough for caching
    const strategy = getStrategy(this.config.provider);
    if (!strategy.shouldCache(toonContent, optimizedTokens)) {
      return {
        staticPrefix: '',
        dynamicContent: this.formatTOONOutput(toonContent, toolName, format),
        cacheBreakpoint: false
      };
    }

    // Create cacheable static prefix
    const staticPrefix = this.createStaticPrefix(toolName, format);

    // Dynamic content (cache breakpoint here)
    const dynamicContent = `\n[DATA]\n${toonContent}`;

    // Estimate cache size (tokens ≈ characters / 4)
    const estimatedCacheSize = staticPrefix.length / CHARS_PER_TOKEN_ESTIMATE;

    const metadata: CacheMetadata = {
      provider: this.config.provider === 'auto' ?
        (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai') :
        this.config.provider,
      estimatedCacheSize,
      ttl: this.config.ttl
    };

    // Update metrics
    this.metrics.totalCacheableTokens += estimatedCacheSize;

    return {
      staticPrefix,
      dynamicContent,
      cacheBreakpoint: true,
      cacheMetadata: metadata
    };
  }

  /**
   * Create cacheable static prefix with TOON format instructions
   */
  private createStaticPrefix(toolName: string, format: string): string {
    return `[SYSTEM] Token-Optimized Data from ${toolName}

The following data has been converted to TOON format for token efficiency.

TOON Format Specification:
- Arrays: name[size]{fields}: value1,value2
  Example: users[2]{id,name}: 1,Alice 2,Bob

- Objects: key: value
  Example: config.port: 8080

- Nested structures: parent.child: value
  Example: server.config.timeout: 30

- Mixed types supported: strings, numbers, booleans, null

Source Format: ${format.toUpperCase()}
Optimization: ~60-95% token reduction

Instructions:
1. Parse the TOON-formatted data below
2. Interpret field names from the schema
3. Reconstruct the original data structure if needed
4. Use the data to answer the user's request

---`;
  }

  /**
   * Format TOON output with metadata
   */
  private formatTOONOutput(toonContent: string, toolName: string, format: string): string {
    return `[TOON-${format.toUpperCase()}]\n${toonContent}`;
  }

  /**
   * Format for Anthropic cache_control API
   */
  formatForAnthropic(cached: CachedContent): any[] {
    if (!cached.cacheBreakpoint) {
      return [{ type: 'text', text: cached.dynamicContent }];
    }

    return [
      {
        type: 'text',
        text: cached.staticPrefix,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: cached.dynamicContent
      }
    ];
  }

  /**
   * Format for OpenAI (structured but no explicit cache control)
   */
  formatForOpenAI(cached: CachedContent): { system: string; user: string } {
    return {
      system: cached.staticPrefix || 'Process the following TOON-formatted data:',
      user: cached.dynamicContent
    };
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Record a cache hit (when static prefix is reused)
   */
  recordCacheHit(savedTokens: number): void {
    this.metrics.cacheHits++;
    this.metrics.estimatedCacheSavings += savedTokens;
    this.updateHitRate();
  }

  /**
   * Record a cache miss (when static prefix is not cached)
   */
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
    this.updateHitRate();
  }

  /**
   * Update cache hit rate
   */
  private updateHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      estimatedCacheSavings: 0,
      totalCacheableTokens: 0,
      averageCacheReuseCount: 0
    };
  }
}
