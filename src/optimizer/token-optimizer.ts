/**
 * TokenOptimizer: Core optimization logic using Toonify
 */

import { encode as toonEncode, decode as toonDecode } from '@toon-format/toon';
import yaml from 'yaml';
import type {
  OptimizationResult,
  ToolMetadata,
  StructuredData,
  OptimizationConfig
} from './types.js';
import { CacheOptimizer, LRUCache } from './caching/index.js';
import { MultilingualTokenizer } from './multilingual/index.js';

export class TokenOptimizer {
  private config: OptimizationConfig;
  private tokenEncoder: MultilingualTokenizer;
  private cacheOptimizer: CacheOptimizer;
  private resultCache: LRUCache<OptimizationResult>;

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

    // v0.3.0: Use multilingual tokenizer
    this.tokenEncoder = new MultilingualTokenizer('gpt-4', true);

    // Initialize cache optimizer
    this.cacheOptimizer = new CacheOptimizer(this.config.caching);

    // v0.4.0: Initialize LRU cache for optimization results
    this.resultCache = new LRUCache<OptimizationResult>(this.config.resultCache);
  }

  /**
   * Main optimization method
   */
  async optimize(
    content: string,
    metadata?: ToolMetadata
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    // v0.4.0: Check LRU cache first
    const cacheKey = LRUCache.generateKey(content);
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Quick path: skip if disabled or content too small
    if (!this.config.enabled || content.length < 200) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: 'Content too small'
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

    // Detect structured data
    const structuredData = this.detectStructuredData(content);
    if (!structuredData) {
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: 'Not structured data'
      };
    }

    try {
      // Convert to TOON format
      const toonContent = toonEncode(structuredData.data);

      // Count tokens
      const originalTokens = this.countTokens(content);
      const optimizedTokens = this.countTokens(toonContent);

      // Calculate savings
      const tokenSavings = originalTokens - optimizedTokens;
      const savingsPercentage = (tokenSavings / originalTokens) * 100;

      // Check if worth using
      if (savingsPercentage < this.config.minSavingsThreshold) {
        return {
          optimized: false,
          originalContent: content,
          originalTokens,
          reason: `Savings too low: ${savingsPercentage.toFixed(1)}%`
        };
      }

      // Check processing time
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.maxProcessingTime) {
        return {
          optimized: false,
          originalContent: content,
          originalTokens,
          reason: `Processing timeout: ${elapsed}ms`
        };
      }

      // v0.3.0: Wrap with caching structure
      const cachedContent = this.cacheOptimizer.wrapWithCaching(
        toonContent,
        metadata?.toolName || 'unknown',
        structuredData.type,
        originalTokens,
        optimizedTokens
      );

      // Calculate additional savings from caching
      // Assume 90% cache hit rate after first request
      const cacheSavings = cachedContent.cacheBreakpoint ?
        Math.floor(tokenSavings * 0.9) : 0;

      const result: OptimizationResult = {
        optimized: true,
        originalContent: content,
        optimizedContent: cachedContent.cacheBreakpoint ?
          cachedContent.staticPrefix + cachedContent.dynamicContent :
          cachedContent.dynamicContent,
        originalTokens,
        optimizedTokens,
        savings: {
          tokens: tokenSavings,
          percentage: savingsPercentage,
          withCaching: cacheSavings
        },
        format: structuredData.type,
        cachedContent,
        cacheMetrics: this.cacheOptimizer.getMetrics()
      };

      // v0.4.0: Store result in LRU cache
      this.resultCache.set(cacheKey, result);

      return result;

    } catch (error) {
      // Silent fallback on error
      return {
        optimized: false,
        originalContent: content,
        originalTokens: this.countTokens(content),
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  /**
   * Detect if content is structured data (JSON/CSV/YAML)
   */
  private detectStructuredData(content: string): StructuredData | null {
    // Try JSON first
    try {
      const data = JSON.parse(content);
      if (typeof data === 'object' && data !== null) {
        return { type: 'json', data, confidence: 1.0 };
      }
    } catch {}

    // Try YAML
    try {
      const data = yaml.parse(content);
      if (typeof data === 'object' && data !== null) {
        return { type: 'yaml', data, confidence: 0.9 };
      }
    } catch {}

    // Try CSV (simple heuristic)
    if (this.looksLikeCSV(content)) {
      try {
        const data = this.parseSimpleCSV(content);
        return { type: 'csv', data, confidence: 0.8 };
      } catch {}
    }

    return null;
  }

  /**
   * Simple CSV detection heuristic
   */
  private looksLikeCSV(content: string): boolean {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return false;

    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    if (firstLineCommas === 0) return false;

    // Check if most lines have similar comma count
    let matchingLines = 0;
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const commas = (lines[i].match(/,/g) || []).length;
      if (commas === firstLineCommas) matchingLines++;
    }

    return matchingLines >= Math.min(lines.length - 1, 7);
  }

  /**
   * Parse simple CSV to array of objects
   */
  private parseSimpleCSV(content: string): any[] {
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  /**
   * Count tokens in text with language awareness
   */
  private countTokens(text: string): number {
    if (!this.config.multilingual?.enabled) {
      return this.tokenEncoder.countBase(text);
    }
    return this.tokenEncoder.count(text);
  }

  /**
   * Get detailed token estimate with language info
   */
  private getTokenEstimate(text: string) {
    return this.tokenEncoder.encode(text);
  }

  /**
   * Check if tool should be skipped
   */
  private shouldSkipTool(toolName: string): boolean {
    return this.config.skipToolPatterns?.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(toolName);
    }) ?? false;
  }

  /**
   * Get cache optimizer instance for external access
   */
  getCacheOptimizer(): CacheOptimizer {
    return this.cacheOptimizer;
  }

  /**
   * v0.4.0: Get LRU cache instance for external access
   */
  getResultCache(): LRUCache<OptimizationResult> {
    return this.resultCache;
  }

  /**
   * v0.4.0: Clear optimization result cache
   */
  clearResultCache(): void {
    this.resultCache.clear();
  }

  /**
   * v0.4.0: Clean up expired cache entries
   */
  cleanupExpiredCache(): number {
    return this.resultCache.cleanup();
  }

  /**
   * v0.4.0: Get combined cache statistics
   */
  getCacheStats() {
    return {
      resultCache: this.resultCache.getStats(),
      promptCache: this.cacheOptimizer.getMetrics()
    };
  }
}
