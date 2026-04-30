import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DebugOutputCompressor } from '../../src/optimizer/compressors/debug-output';
import type { DetectResult } from '../../src/optimizer/pipeline/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name: string): string {
  return readFileSync(path.join(__dirname, '..', 'fixtures', 'debug-output', name), 'utf-8');
}

const detection: DetectResult = {
  type: 'debug-output',
  confidence: 0.8,
};

describe('DebugOutputCompressor', () => {
  let compressor: DebugOutputCompressor;

  beforeEach(() => {
    compressor = new DebugOutputCompressor();
  });

  test('compresses Jest failure output while preserving actionable lines', () => {
    const input = loadFixture('jest-failure.txt');
    const result = compressor.compress(input, detection);

    expect(result.compressed.length).toBeLessThan(input.length);
    expect(result.compressed).toContain('UserService');
    expect(result.compressed).toContain('returns a fallback profile when the API request fails');
    expect(result.compressed).toContain('tests/user-service.test.ts:43:21');
    expect(result.compressed).toContain('> 43 |     expect(profile).toEqual({ status: "offline" });');
    expect(result.compressed).not.toContain('      41 |');
    expect(result.compressed).not.toContain('         |                     ^');
  });

  test('collapses repeated lint diagnostics', () => {
    const input = loadFixture('eslint-output.txt');
    const result = compressor.compress(input, detection);

    expect(result.compressed.length).toBeLessThan(input.length);
    expect(result.compressed).toContain("@typescript-eslint/no-unused-vars");
    expect(result.compressed).toContain('[toonify] repeated 1 more time');
  });

  test('collapses duplicate stack frames while preserving headline and final frame', () => {
    const input = loadFixture('node-stack-trace.txt');
    const result = compressor.compress(input, detection);

    expect(result.compressed.length).toBeLessThan(input.length);
    expect(result.compressed).toContain("TypeError: Cannot read properties of undefined");
    expect(result.compressed).toContain('/workspace/src/render.ts:18:13');
    expect(result.compressed).toContain('/workspace/src/index.ts:11:3');
    expect(result.compressed).toContain('[toonify]');
  });

  test('preserves Python traceback file and exception lines', () => {
    const input = loadFixture('python-traceback.txt');
    const result = compressor.compress(input, detection);

    expect(result.compressed).toContain('Traceback (most recent call last):');
    expect(result.compressed).toContain('File "/workspace/reporting.py", line 112, in render_report');
    expect(result.compressed).toContain('RuntimeError: report template missing');
  });
});
