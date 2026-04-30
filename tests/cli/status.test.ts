import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MetricsCollector } from '../../src/metrics/metrics-collector';

describe('status output', () => {
  let tempRoot: string;
  let homeDir: string;
  let collector: MetricsCollector;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'toonify-status-'));
    homeDir = path.join(tempRoot, 'home');
    await fs.mkdir(path.join(homeDir, '.claude'), { recursive: true });
    collector = new MetricsCollector(homeDir);
  });

  test('shows optimized and skipped counts plus last decision', async () => {
    await collector.record({
      timestamp: '2026-04-30T00:00:00.000Z',
      toolName: 'Read',
      originalTokens: 200,
      optimizedTokens: 80,
      savings: 120,
      savingsPercentage: 60,
      wasOptimized: true,
      format: 'debug-output',
    });

    await collector.record({
      timestamp: '2026-04-30T00:01:00.000Z',
      toolName: 'Grep',
      originalTokens: 20,
      optimizedTokens: 20,
      savings: 0,
      savingsPercentage: 0,
      wasOptimized: false,
      reason: 'Savings too low: 4.0%',
      format: 'debug-output',
    });

    const output = await collector.formatStatus();

    expect(output).toContain('Requests: 2');
    expect(output).toContain('Optimized: 1');
    expect(output).toContain('Skipped: 1');
    expect(output).toContain('Last decision: skipped Grep Savings too low: 4.0%');
  });
});
