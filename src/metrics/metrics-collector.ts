/**
 * MetricsCollector: Local-only metrics tracking
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import type { TokenStats } from '../optimizer/types.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

export interface OptimizationMetric {
  timestamp: string;
  toolName: string;
  originalTokens: number;
  optimizedTokens: number;
  savings: number;
  savingsPercentage: number;
  wasOptimized: boolean;
  format?: string;
  reason?: string;
  // v0.3.0: Cache metrics
  wasCached?: boolean;
  cacheSavings?: number;
}

export class MetricsCollector {
  private statsPath: string;

  constructor(homeDir: string = os.homedir()) {
    // Store in user's home directory, not in project
    this.statsPath = path.join(
      homeDir,
      '.claude',
      'token_stats.json'
    );
  }

  getStatsPath(): string {
    return this.statsPath;
  }

  /**
   * Record an optimization attempt
   */
  async record(metric: OptimizationMetric): Promise<void> {
    try {
      const stats = await this.loadStats();

      // Update aggregated stats
      stats.totalRequests++;
      if (metric.wasOptimized) {
        stats.optimizedRequests++;
      } else {
        stats.skippedRequests = (stats.skippedRequests || 0) + 1;
      }

      stats.tokensBeforeOptimization += metric.originalTokens;
      stats.tokensAfterOptimization += metric.optimizedTokens;
      stats.totalSavings += metric.savings;
      stats.lastToolName = metric.toolName;
      stats.lastFormat = metric.format;
      stats.lastReason = metric.reason;
      stats.lastWasOptimized = metric.wasOptimized;
      stats.lastUpdatedAt = metric.timestamp;

      // v0.3.0: Track cache metrics
      if (metric.wasCached) {
        stats.cacheHits = (stats.cacheHits || 0) + 1;
        stats.estimatedCacheSavings = (stats.estimatedCacheSavings || 0) + (metric.cacheSavings || 0);
      } else if (metric.wasOptimized) {
        stats.cacheMisses = (stats.cacheMisses || 0) + 1;
      }

      // Calculate cache hit rate
      const totalCacheAttempts = (stats.cacheHits || 0) + (stats.cacheMisses || 0);
      stats.cacheHitRate = totalCacheAttempts > 0 ? (stats.cacheHits || 0) / totalCacheAttempts : 0;

      // Recalculate average
      stats.averageSavingsPercentage =
        stats.optimizedRequests > 0
          ? (stats.totalSavings / stats.tokensBeforeOptimization) * 100
          : 0;

      await this.saveStats(stats);
    } catch (error) {
      // Silent failure - metrics should never break functionality
      console.error('[MetricsCollector] Failed to record metrics:', error);
    }
  }

  /**
   * Get current statistics
   */
  async getStats(): Promise<TokenStats> {
    return await this.loadStats();
  }

  /**
   * Load stats from disk
   */
  private async loadStats(): Promise<TokenStats> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.statsPath), { recursive: true });

      const data = await fs.readFile(this.statsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return empty stats if file doesn't exist
      return {
        totalRequests: 0,
        optimizedRequests: 0,
        tokensBeforeOptimization: 0,
        tokensAfterOptimization: 0,
        totalSavings: 0,
        averageSavingsPercentage: 0,
        skippedRequests: 0,
        lastToolName: undefined,
        lastFormat: undefined,
        lastReason: undefined,
        lastWasOptimized: undefined,
        lastUpdatedAt: undefined,
        // v0.3.0: Cache stats
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
        estimatedCacheSavings: 0,
      };
    }
  }

  /**
   * Save stats to disk using atomic write (temp file + rename)
   * to prevent corruption from concurrent processes.
   */
  private async saveStats(stats: TokenStats): Promise<void> {
    const tempPath = `${this.statsPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(stats, null, 2), 'utf-8');
    await fs.rename(tempPath, this.statsPath);
  }

  /**
   * Format stats as dashboard
   */
  async formatDashboard(): Promise<string> {
    const stats = await this.getStats();

    const optimizationRate = stats.totalRequests > 0
      ? ((stats.optimizedRequests / stats.totalRequests) * 100).toFixed(1)
      : '0.0';

    // v0.3.0: Calculate total savings including cache
    const totalSavingsWithCache = stats.totalSavings + (stats.estimatedCacheSavings || 0);
    const costSavings = ((totalSavingsWithCache / 1_000_000) * 3).toFixed(2);

    let dashboard = `
📊 Token Optimization Stats (v${version})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests: ${stats.totalRequests}
Optimized: ${stats.optimizedRequests} (${optimizationRate}%)

Tokens Before: ${stats.tokensBeforeOptimization.toLocaleString()}
Tokens After: ${stats.tokensAfterOptimization.toLocaleString()}
Total Savings: ${stats.totalSavings.toLocaleString()} (${stats.averageSavingsPercentage.toFixed(1)}%)`;

    // Add cache stats if available
    if (stats.cacheHits || stats.cacheMisses) {
      const cacheHitRate = (stats.cacheHitRate! * 100).toFixed(1);
      dashboard += `

🚀 Prompt Caching Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cache Hits: ${stats.cacheHits}
Cache Misses: ${stats.cacheMisses}
Hit Rate: ${cacheHitRate}%
Additional Cache Savings: ${(stats.estimatedCacheSavings || 0).toLocaleString()} tokens`;
    }

    dashboard += `

💰 Total Cost Savings (at $3/1M input tokens):
   $${costSavings} saved`;

    return dashboard.trim();
  }

  async formatStatus(): Promise<string> {
    const stats = await this.getStats();
    const optimizedRate = stats.totalRequests > 0
      ? ((stats.optimizedRequests / stats.totalRequests) * 100).toFixed(1)
      : '0.0';

    const lines = [
      `Toonify MCP status (v${version})`,
      '',
      `Requests: ${stats.totalRequests}`,
      `Optimized: ${stats.optimizedRequests} (${optimizedRate}%)`,
      `Skipped: ${stats.skippedRequests || 0}`,
      `Tokens saved: ${stats.totalSavings.toLocaleString()}`,
    ];

    if (stats.lastUpdatedAt) {
      const outcome = stats.lastWasOptimized ? 'optimized' : 'skipped';
      const format = stats.lastFormat || 'unknown';
      const toolName = stats.lastToolName || 'unknown';
      const reason = stats.lastWasOptimized
        ? `as ${format}`
        : (stats.lastReason || 'no reason recorded');

      lines.push('');
      lines.push(`Last decision: ${outcome} ${toolName} ${reason}`);
      lines.push(`Last update: ${stats.lastUpdatedAt}`);
    }

    return lines.join('\n');
  }
}
