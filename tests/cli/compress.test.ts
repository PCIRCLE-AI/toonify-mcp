/**
 * E2E tests for `toonify-mcp compress` — the stdin→stdout pipe filter.
 * Spawns the real built binary (dist/index.js), same as a shell pipe would:
 * CI builds before testing, and `prepare` builds on install, so dist exists.
 */

import { describe, test, expect } from '@jest/globals';
import { execFile } from 'child_process';
import path from 'path';

const binPath = path.resolve('dist/index.js');

function runCompress(input: string): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = execFile(
      'node',
      [binPath, 'compress'],
      { timeout: 15000, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        resolve({ stdout, code: error ? (error as { code?: number }).code ?? 1 : 0 });
      }
    );
    if (input.length > 0) proc.stdin!.write(input);
    proc.stdin!.end();
  });
}

describe('toonify-mcp compress', () => {
  test('compresses structured JSON to raw TOON without any [SYSTEM] framing', async () => {
    const input = JSON.stringify(
      Array.from({ length: 100 }, (_, i) => ({ id: i, name: `user${i}`, active: i % 2 === 0 }))
    );
    const { stdout, code } = await runCompress(input);

    expect(code).toBe(0);
    expect(stdout.length).toBeLessThan(input.length);
    // Raw pipeline output — tabular TOON header, no MCP caching preamble.
    expect(stdout).toContain('[100]{id,name,active}');
    expect(stdout).not.toContain('[SYSTEM]');
  });

  test('collapses a repetitive test-failure log', async () => {
    const frames: string[] = [];
    for (let i = 0; i < 50; i++) {
      frames.push(`    at Object.<anonymous> (/app/m.js:${100 + i}:5)`);
      frames.push('    at processTicksAndRejections (node:internal/process/task_queues:95:5)');
    }
    const block = ['FAIL x.test.js', '  ● t', '', '    AssertionError: expected 1 to equal 2', ...frames, ''].join('\n');
    const input = Array.from({ length: 6 }, () => block).join('\n');

    const { stdout, code } = await runCompress(input);
    expect(code).toBe(0);
    expect(stdout.length).toBeLessThan(input.length / 2);
    expect(stdout).toContain('AssertionError: expected 1 to equal 2');
  });

  // The numeric-fidelity guard must hold on this path too: lossy numbers mean
  // the input is returned byte-for-byte, never a corrupted TOON view.
  test('precision-losing 64-bit ids pass through byte-for-byte', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `1300000000000000${String(i).padStart(3, '0')}`);
    const input = `[${ids.map((id) => `{"id": ${id}}`).join(',')}]`;

    const { stdout, code } = await runCompress(input);
    expect(code).toBe(0);
    expect(stdout).toBe(input);
  });

  test('prose passes through byte-for-byte', async () => {
    const input = Array.from({ length: 30 }, (_, i) => `Plain paragraph ${i} about nothing structured at all.`).join('\n\n');
    const { stdout, code } = await runCompress(input);
    expect(code).toBe(0);
    expect(stdout).toBe(input);
  });

  test('empty stdin produces empty stdout and exit 0', async () => {
    const { stdout, code } = await runCompress('');
    expect(code).toBe(0);
    expect(stdout).toBe('');
  });
});
