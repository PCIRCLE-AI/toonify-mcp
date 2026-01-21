/**
 * Tokenizer adapter with multilingual support
 */

import { encoding_for_model, type Tiktoken } from 'tiktoken';
import { LanguageDetector } from './language-detector.js';
import type { LanguageProfile } from './language-profiles.js';
import { LRUCache } from '../caching/lru-cache.js';

/** Default cache configuration for tokenizer */
const DEFAULT_TOKENIZER_CACHE_SIZE = 1000;
const DEFAULT_TOKENIZER_CACHE_TTL = 3600000; // 1 hour

export interface TokenEstimate {
  tokens: number;
  language: LanguageProfile;
  confidence: number;
  baseTokens: number;
  multiplier: number;
}

export class MultilingualTokenizer {
  private baseTokenizer: Tiktoken;
  private languageDetector: LanguageDetector;
  private cache: LRUCache<TokenEstimate>;

  constructor(
    model: string = 'gpt-4',
    cacheEnabled: boolean = true
  ) {
    this.baseTokenizer = encoding_for_model(model as Parameters<typeof encoding_for_model>[0]);
    this.languageDetector = new LanguageDetector();
    this.cache = new LRUCache<TokenEstimate>({
      enabled: cacheEnabled,
      maxSize: DEFAULT_TOKENIZER_CACHE_SIZE,
      ttl: DEFAULT_TOKENIZER_CACHE_TTL,
      persistent: false
    });
  }

  /**
   * Count tokens with language awareness
   */
  encode(text: string): TokenEstimate {
    // Generate cache key from text content
    const cacheKey = LRUCache.generateKey(text);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get base token count
    const baseTokens = this.baseTokenizer.encode(text).length;

    // Detect language
    const detection = this.languageDetector.detect(text);

    // Apply language multiplier
    const multiplier = detection.language.tokenMultiplier;
    const adjustedTokens = Math.ceil(baseTokens * multiplier);

    const estimate: TokenEstimate = {
      tokens: adjustedTokens,
      language: detection.language,
      confidence: detection.confidence,
      baseTokens,
      multiplier
    };

    // Cache result (LRUCache handles size limits and TTL automatically)
    this.cache.set(cacheKey, estimate);

    return estimate;
  }

  /**
   * Simple token count (just returns number for compatibility)
   */
  count(text: string): number {
    return this.encode(text).tokens;
  }

  /**
   * Get base tokens without language adjustment
   */
  countBase(text: string): number {
    return this.baseTokenizer.encode(text).length;
  }

  /**
   * Analyze language distribution in text
   */
  analyze(text: string): {
    estimate: TokenEstimate;
    allLanguages: LanguageProfile[];
    isMixed: boolean;
  } {
    const analysis = this.languageDetector.analyze(text);
    const baseTokens = this.baseTokenizer.encode(text).length;

    return {
      estimate: {
        tokens: Math.ceil(baseTokens * analysis.estimatedMultiplier),
        language: analysis.primary.language,
        confidence: analysis.primary.confidence,
        baseTokens,
        multiplier: analysis.estimatedMultiplier
      },
      allLanguages: analysis.all,
      isMixed: analysis.isMixed
    };
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): import('../caching/cache-types.js').LRUCacheStats {
    return this.cache.getStats();
  }

  /**
   * Free tokenizer resources
   */
  free(): void {
    this.baseTokenizer.free();
    this.cache.clear();
  }
}
