/**
 * Type definitions for token optimization
 */

import type { CacheConfig, CachedContent, CacheMetrics, LRUCacheConfig } from './caching/cache-types.js';

export interface OptimizationResult {
  optimized: boolean;
  originalContent: string;
  optimizedContent?: string;
  originalTokens: number;
  optimizedTokens?: number;
  savings?: {
    tokens: number;
    percentage: number;
    withCaching?: number; // Additional savings from caching
  };
  format?: 'json' | 'csv' | 'yaml' | 'unknown';
  reason?: string; // Why optimization was skipped
  // v0.3.0: Cache-related fields
  cachedContent?: CachedContent;
  cacheMetrics?: CacheMetrics;
}

export interface ToolMetadata {
  toolName: string;
  contentType?: string;
  size: number;
  modelId?: string; // v0.3.0: For model-specific optimization
}

export interface StructuredData {
  type: 'json' | 'csv' | 'yaml';
  data: Record<string, unknown> | unknown[];
  confidence: number;
}

export interface OptimizationConfig {
  enabled: boolean;
  minTokensThreshold: number; // Only optimize if content > N tokens
  minSavingsThreshold: number; // Only use if savings > N%
  maxProcessingTime: number; // Max ms to spend optimizing
  skipToolPatterns?: string[]; // Tool names to skip
  // v0.3.0: Enhanced configuration
  caching?: CacheConfig;
  multilingual?: {
    enabled: boolean;
    defaultLanguage: string;
  };
  // v0.4.0: LRU cache for optimization results
  resultCache?: LRUCacheConfig;
}

export interface TokenStats {
  totalRequests: number;
  optimizedRequests: number;
  tokensBeforeOptimization: number;
  tokensAfterOptimization: number;
  totalSavings: number;
  averageSavingsPercentage: number;
  // v0.3.0: Cache stats
  cacheHits?: number;
  cacheMisses?: number;
  cacheHitRate?: number;
  estimatedCacheSavings?: number;
}

// Re-export cache types for convenience
export type { CacheConfig, CachedContent, CacheMetrics, LRUCacheConfig, LRUCacheStats } from './caching/cache-types.js';
