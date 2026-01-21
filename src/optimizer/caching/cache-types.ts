/**
 * Type definitions for prompt caching integration
 */

export interface CacheConfig {
  enabled: boolean;
  provider: 'anthropic' | 'openai' | 'auto';
  ttl?: '5min' | '1hour'; // Anthropic cache TTLs
  cacheStaticPrompts: boolean;
  minCacheableTokens?: number; // Minimum tokens to enable caching (default: 1024)
}

export interface CachedContent {
  staticPrefix: string;  // Cacheable system instructions
  dynamicContent: string; // Non-cacheable user data
  cacheBreakpoint: boolean;
  cacheMetadata?: CacheMetadata;
}

export interface CacheMetadata {
  provider: 'anthropic' | 'openai';
  estimatedCacheSize: number; // tokens
  cacheKey?: string;
  ttl?: string;
}

export interface CacheMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  estimatedCacheSavings: number; // tokens
  totalCacheableTokens: number;
  averageCacheReuseCount: number;
}

/**
 * Anthropic message content block format
 */
export interface AnthropicContentBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * OpenAI structured message format
 */
export interface OpenAIMessageFormat {
  system: string;
  user: string;
}

/**
 * Union type for provider-specific cache structures
 */
export type CacheStructure = AnthropicContentBlock[] | OpenAIMessageFormat;

export interface CacheStrategy {
  name: string;
  shouldCache: (content: string, tokens: number) => boolean;
  formatCacheStructure: (content: CachedContent) => CacheStructure;
}

/**
 * LRU Cache Configuration
 */
export interface LRUCacheConfig {
  enabled: boolean;
  maxSize: number;           // Maximum number of cache entries
  ttl: number;               // Time-to-live in milliseconds
  persistent: boolean;       // Enable disk persistence
  persistPath?: string;      // Path to persist cache file
}

/**
 * LRU Cache Entry
 */
export interface LRUCacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;         // Creation time
  lastAccessed: number;      // Last access time
  accessCount: number;       // Number of accesses
  expiresAt: number;         // Expiration timestamp
}

/**
 * LRU Cache Statistics
 */
export interface LRUCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
  averageAccessCount: number;
}
