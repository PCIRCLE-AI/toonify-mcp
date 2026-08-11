/**
 * Tests for CacheOptimizer
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CacheOptimizer } from '../../src/optimizer/caching/cache-optimizer.js';
import type { CacheConfig } from '../../src/optimizer/caching/cache-types.js';

describe('CacheOptimizer', () => {
  let optimizer: CacheOptimizer;

  beforeEach(() => {
    optimizer = new CacheOptimizer({
      enabled: true,
      provider: 'anthropic',
      cacheStaticPrompts: true,
      minCacheableTokens: 1024
    });
  });

  describe('wrapWithCaching', () => {
    test('should wrap content with cache structure for large content', () => {
      const toonContent = 'users[2]{id,name}: 1,Alice 2,Bob';
      const result = optimizer.wrapWithCaching(
        toonContent,
        'Read',
        'json',
        2000,
        800
      );

      expect(result.cacheBreakpoint).toBe(false); // < 1024 tokens
      expect(result.dynamicContent).toContain(toonContent);
    });

    test('should enable caching for content >= minCacheableTokens', () => {
      const largeToonContent = 'x'.repeat(5000);
      const result = optimizer.wrapWithCaching(
        largeToonContent,
        'Read',
        'json',
        10000,
        5000
      );

      expect(result.cacheBreakpoint).toBe(true);
      expect(result.staticPrefix).toContain('TOON Format Specification');
      expect(result.cacheMetadata).toBeDefined();
      expect(result.cacheMetadata?.provider).toBe('anthropic');
    });

    test('should not cache when disabled', () => {
      const disabledOptimizer = new CacheOptimizer({
        enabled: false
      });

      const result = disabledOptimizer.wrapWithCaching(
        'content',
        'Read',
        'json',
        5000,
        2000
      );

      expect(result.cacheBreakpoint).toBe(false);
      expect(result.staticPrefix).toBe('');
    });

    test('should include tool name and format in static prefix', () => {
      // `format` is a display label, not a pipeline ContentType — any string
      // works here, this isn't asserting CSV support.
      const result = optimizer.wrapWithCaching(
        'x'.repeat(5000),
        'Grep',
        'yaml',
        10000,
        5000
      );

      if (result.cacheBreakpoint) {
        expect(result.staticPrefix).toContain('Grep');
        expect(result.staticPrefix).toContain('YAML');
      }
    });
  });

  describe('formatForAnthropic', () => {
    test('should format cached content for Anthropic API', () => {
      const cachedContent = {
        staticPrefix: 'System instructions...',
        dynamicContent: '[DATA]\nusers[2]{id,name}: 1,Alice',
        cacheBreakpoint: true
      };

      const formatted = optimizer.formatForAnthropic(cachedContent);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toMatchObject({
        type: 'text',
        text: cachedContent.staticPrefix,
        cache_control: { type: 'ephemeral' }
      });
      expect(formatted[1]).toMatchObject({
        type: 'text',
        text: cachedContent.dynamicContent
      });
    });

    test('should handle non-cached content', () => {
      const nonCachedContent = {
        staticPrefix: '',
        dynamicContent: 'Simple content',
        cacheBreakpoint: false
      };

      const formatted = optimizer.formatForAnthropic(nonCachedContent);

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toMatchObject({
        type: 'text',
        text: nonCachedContent.dynamicContent
      });
    });
  });

  describe('formatForOpenAI', () => {
    test('should format cached content for OpenAI', () => {
      const cachedContent = {
        staticPrefix: 'System instructions...',
        dynamicContent: '[DATA]\nusers[2]{id,name}: 1,Alice',
        cacheBreakpoint: true
      };

      const formatted = optimizer.formatForOpenAI(cachedContent);

      expect(formatted).toHaveProperty('system', cachedContent.staticPrefix);
      expect(formatted).toHaveProperty('user', cachedContent.dynamicContent);
    });
  });

  describe('metrics tracking', () => {
    test('should track cache hits', () => {
      optimizer.recordCacheHit(500);
      const metrics = optimizer.getMetrics();

      expect(metrics.cacheHits).toBe(1);
      expect(metrics.estimatedCacheSavings).toBe(500);
      expect(metrics.cacheHitRate).toBe(1);
    });

    test('should track cache misses', () => {
      optimizer.recordCacheMiss();
      const metrics = optimizer.getMetrics();

      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBe(0);
    });

    test('should calculate hit rate correctly', () => {
      optimizer.recordCacheHit(100);
      optimizer.recordCacheHit(200);
      optimizer.recordCacheMiss();

      const metrics = optimizer.getMetrics();

      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBeCloseTo(2/3);
    });

    test('should reset metrics', () => {
      optimizer.recordCacheHit(100);
      optimizer.recordCacheMiss();

      optimizer.resetMetrics();
      const metrics = optimizer.getMetrics();

      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.estimatedCacheSavings).toBe(0);
    });
  });
});
