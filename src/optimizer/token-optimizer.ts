/**
 * TokenOptimizer: Facade over the Pipeline engine.
 * External API unchanged from v0.5.0 — internal logic delegated to Pipeline.
 */

import type {
  OptimizationResult,
  ToolMetadata,
  OptimizationConfig
} from './types.js';
import { CacheOptimizer, LRUCache, type LRUCacheConfig } from './caching/index.js';
import { MultilingualTokenizer } from './multilingual/index.js';
import { Pipeline } from './pipeline/index.js';
import { ToonCompressor, CodeCompressor } from './compressors/index.js';

/** Maximum content size to process (10 MB) — prevents DoS via unbounded JSON.parse */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

export class TokenOptimizer {
  private config: OptimizationConfig;
  private tokenEncoder: MultilingualTokenizer;
  private cacheOptimizer: CacheOptimizer;
  private resultCache: LRUCache<OptimizationResult>;
  private skipPatternCache: Map<string, RegExp | null> = new Map();
  private pipeline: Pipeline;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      enabled: true,
      minTokensThreshold: 50,
      minSavingsThreshold: 30,
      maxProcessingTime: 50,
      skipToolPatterns: [],
      caching: {
        enabled: true,
        provider: 'auto',
        ttl: '1hour',
        cacheStaticPrompts: true,
        minCacheableTokens: 1024
      },
      multilingual: {
        enabled: true,
        defaultLanguage: 'en'
      },
      resultCache: {
        enabled: true,
        maxSize: 500,
        ttl: 3600000, // 1 hour
        persistent: false,
        persistPath: '~/.toonify-mcp/cache/optimization-cache.json'
      },
      ...config
    };

    // Validate resultCache configuration
    this.validateResultCacheConfig(this.config.resultCache);

    // Initialize tokenizer with fallback on WASM load failure
    try {
      this.tokenEncoder = new MultilingualTokenizer('gpt-4', true);
    } catch (error) {
      console.error('[TokenOptimizer] tiktoken init failed, using fallback:', error);
      this.tokenEncoder = new MultilingualTokenizer('gpt-4', false);
    }

    // Initialize pipeline with compressors
    this.pipeline = new Pipeline(this.tokenEncoder);
    this.pipeline.register(new ToonCompressor());
    this.pipeline.register(new CodeCompressor());

    // Initialize cache optimizer
    this.cacheOptimizer = new CacheOptimizer(this.config.caching);

    // Initialize LRU cache for optimization results
    this.resultCache = new LRUCache<OptimizationResult>(this.config.resultCache);

    // Pre-compile skip patterns for safety and performance
    this.compileSkipPatterns();
  }

  /**
   * Main optimization method — API unchanged, delegates to Pipeline internally.
   */
  async optimize(
    content: string,
    metadata?: ToolMetadata
  ): Promise<OptimizationResult> {
    // Input validation
    if (typeof content !== 'string') {
      return {
        optimized: false,
        originalContent: String(content),
        originalTokens: 0,
        reason: 'Invalid input: content must be a string'
      };
    }

    // Size limit to prevent DoS via unbounded parsing
    if (content.length > MAX_CONTENT_SIZE) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: 0,
        reason: `Content too large: ${(content.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_CONTENT_SIZE / 1024 / 1024}MB limit`
      };
    }

    const startTime = Date.now();

    // Check LRU cache first
    const cacheKey = this.generateCacheKey(content, metadata);
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Quick path: skip if disabled
    if (!this.config.enabled) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: 'Optimizer disabled'
      };
    }

    // Skip if tool matches skip patterns
    if (metadata?.toolName && this.shouldSkipTool(metadata.toolName)) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: `Tool ${metadata.toolName} in skip list`
      };
    }

    try {
      // Delegate to pipeline: detect → route → compress → evaluate
      const pipelineResult = this.pipeline.run(content, this.config.minSavingsThreshold);

      if (!pipelineResult.optimized) {
        return {
          optimized: false,
          originalContent: content,
          originalTokens: pipelineResult.originalTokens,
          reason: pipelineResult.reason,
        };
      }

      // Check processing time
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.maxProcessingTime) {
        return {
          optimized: false,
          originalContent: content,
          originalTokens: pipelineResult.originalTokens,
          reason: `Processing timeout: ${elapsed}ms`
        };
      }

      // Wrap with caching structure (for structured data formats)
      const format = pipelineResult.format;
      const isStructured = format === 'json' || format === 'csv' || format === 'yaml';

      let optimizedContent = pipelineResult.content;
      let cachedContent;

      if (isStructured) {
        cachedContent = this.cacheOptimizer.wrapWithCaching(
          pipelineResult.content,
          metadata?.toolName || 'unknown',
          format as 'json' | 'csv' | 'yaml',
          pipelineResult.originalTokens,
          pipelineResult.optimizedTokens!
        );
        optimizedContent = cachedContent.cacheBreakpoint
          ? cachedContent.staticPrefix + cachedContent.dynamicContent
          : cachedContent.dynamicContent;
      }

      const tokenSavings = pipelineResult.savings!.tokens;
      const cacheSavings = cachedContent?.cacheBreakpoint
        ? Math.floor(tokenSavings * 0.9)
        : 0;

      const result: OptimizationResult = {
        optimized: true,
        originalContent: content,
        optimizedContent,
        originalTokens: pipelineResult.originalTokens,
        optimizedTokens: pipelineResult.optimizedTokens,
        savings: {
          tokens: tokenSavings,
          percentage: pipelineResult.savings!.percentage,
          withCaching: cacheSavings
        },
        format: pipelineResult.format,
        cachedContent,
        cacheMetrics: this.cacheOptimizer.getMetrics()
      };

      // Store result in LRU cache
      this.resultCache.set(cacheKey, result);

      return result;

    } catch (error) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  /**
   * Count tokens using tiktoken BPE tokenizer.
   */
  private countTokens(text: string): number {
    return this.tokenEncoder.countBase(text);
  }

  /**
   * Pre-compile skip patterns at construction time.
   */
  private compileSkipPatterns(): void {
    for (const pattern of this.config.skipToolPatterns ?? []) {
      try {
        this.skipPatternCache.set(pattern, new RegExp(pattern));
      } catch (error) {
        console.warn(`[TokenOptimizer] Invalid skip pattern "${pattern}":`, error);
        this.skipPatternCache.set(pattern, null);
      }
    }
  }

  /**
   * Check if tool should be skipped using pre-compiled patterns
   */
  private shouldSkipTool(toolName: string): boolean {
    for (const [, regex] of this.skipPatternCache) {
      if (regex && regex.test(toolName)) return true;
    }
    return false;
  }

  /**
   * Generate cache key from content and metadata
   */
  private generateCacheKey(content: string, metadata?: ToolMetadata): string {
    const metadataKey = metadata?.toolName || 'unknown';
    const combinedContent = `${metadataKey}:${content}`;
    return LRUCache.generateKey(combinedContent);
  }

  /**
   * Validate resultCache configuration
   */
  private validateResultCacheConfig(config: Partial<LRUCacheConfig> | undefined): void {
    if (!config) {
      throw new Error('resultCache configuration is required');
    }

    if (typeof config.enabled !== 'boolean') {
      throw new Error('resultCache.enabled must be a boolean');
    }

    if (config.maxSize !== undefined) {
      if (typeof config.maxSize !== 'number' || config.maxSize <= 0) {
        throw new Error('resultCache.maxSize must be a positive number');
      }
      if (config.maxSize > 10000) {
        console.warn('[TokenOptimizer] resultCache.maxSize > 10000 may cause high memory usage');
      }
    }

    if (config.ttl !== undefined) {
      if (typeof config.ttl !== 'number' || config.ttl <= 0) {
        throw new Error('resultCache.ttl must be a positive number (milliseconds)');
      }
      if (config.ttl < 1000) {
        console.warn('[TokenOptimizer] resultCache.ttl < 1s may cause excessive cache churn');
      }
    }

    if (config.persistent !== undefined && typeof config.persistent !== 'boolean') {
      throw new Error('resultCache.persistent must be a boolean');
    }

    if (config.persistent && !config.persistPath) {
      throw new Error('resultCache.persistPath is required when persistent=true');
    }

    if (config.persistPath !== undefined && typeof config.persistPath !== 'string') {
      throw new Error('resultCache.persistPath must be a string');
    }
  }

  // --- Public API (unchanged from v0.5.0) ---

  getCacheOptimizer(): CacheOptimizer {
    return this.cacheOptimizer;
  }

  getResultCache(): LRUCache<OptimizationResult> {
    return this.resultCache;
  }

  clearResultCache(): void {
    this.resultCache.clear();
  }

  cleanupExpiredCache(): number {
    return this.resultCache.cleanup();
  }

  getCacheStats(): { resultCache: import('./caching/cache-types.js').LRUCacheStats; promptCache: import('./caching/cache-types.js').CacheMetrics } {
    return {
      resultCache: this.resultCache.getStats(),
      promptCache: this.cacheOptimizer.getMetrics()
    };
  }

  /**
   * Get the pipeline instance for direct access
   */
  getPipeline(): Pipeline {
    return this.pipeline;
  }

  /**
   * Release resources (tiktoken WASM memory, caches).
   */
  destroy(): void {
    this.tokenEncoder.free();
    this.resultCache.clear();
    this.skipPatternCache.clear();
  }
}
