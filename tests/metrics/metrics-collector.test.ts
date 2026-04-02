/**
 * MetricsCollector tests
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { MetricsCollector } from '../../src/metrics/metrics-collector.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  const statsPath = path.join(os.homedir(), '.claude', 'token_stats.json');
  let originalStats: string | null = null;

  beforeEach(async () => {
    // Back up existing stats file
    try {
      originalStats = await fs.readFile(statsPath, 'utf-8');
    } catch {
      originalStats = null;
    }

    // Remove stats file for clean test
    try {
      await fs.unlink(statsPath);
    } catch {
      // File doesn't exist
    }

    collector = new MetricsCollector();
  });

  afterEach(async () => {
    // Restore original stats
    if (originalStats) {
      await fs.writeFile(statsPath, originalStats, 'utf-8');
    } else {
      try {
        await fs.unlink(statsPath);
      } catch {
        // Ignore
      }
    }
  });

  describe('record', () => {
    test('records an optimization metric', async () => {
      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Read',
        originalTokens: 100,
        optimizedTokens: 50,
        savings: 50,
        savingsPercentage: 50,
        wasOptimized: true,
        format: 'json',
      });

      const stats = await collector.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.optimizedRequests).toBe(1);
      expect(stats.totalSavings).toBe(50);
    });

    test('tracks non-optimized requests', async () => {
      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Read',
        originalTokens: 20,
        optimizedTokens: 20,
        savings: 0,
        savingsPercentage: 0,
        wasOptimized: false,
        reason: 'Not structured data',
      });

      const stats = await collector.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.optimizedRequests).toBe(0);
    });

    test('accumulates multiple records', async () => {
      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Read',
        originalTokens: 200,
        optimizedTokens: 100,
        savings: 100,
        savingsPercentage: 50,
        wasOptimized: true,
      });

      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Grep',
        originalTokens: 300,
        optimizedTokens: 150,
        savings: 150,
        savingsPercentage: 50,
        wasOptimized: true,
      });

      const stats = await collector.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.optimizedRequests).toBe(2);
      expect(stats.totalSavings).toBe(250);
      expect(stats.tokensBeforeOptimization).toBe(500);
      expect(stats.tokensAfterOptimization).toBe(250);
    });

    test('tracks cache metrics', async () => {
      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Read',
        originalTokens: 100,
        optimizedTokens: 50,
        savings: 50,
        savingsPercentage: 50,
        wasOptimized: true,
        wasCached: true,
        cacheSavings: 30,
      });

      const stats = await collector.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.estimatedCacheSavings).toBe(30);
    });
  });

  describe('getStats', () => {
    test('returns empty stats when no records exist', async () => {
      const stats = await collector.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.optimizedRequests).toBe(0);
      expect(stats.totalSavings).toBe(0);
      expect(stats.averageSavingsPercentage).toBe(0);
    });
  });

  describe('formatDashboard', () => {
    test('generates readable dashboard text', async () => {
      await collector.record({
        timestamp: new Date().toISOString(),
        toolName: 'Read',
        originalTokens: 1000,
        optimizedTokens: 500,
        savings: 500,
        savingsPercentage: 50,
        wasOptimized: true,
      });

      const dashboard = await collector.formatDashboard();

      expect(dashboard).toContain('Token Optimization Stats');
      expect(dashboard).toContain('Total Requests: 1');
      expect(dashboard).toContain('Total Savings');
    });
  });
});
