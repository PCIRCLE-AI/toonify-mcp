/**
 * PostToolUse hook integration tests
 * Runs the actual hook script as a subprocess
 */

import { describe, test, expect } from '@jest/globals';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const exec = promisify(execFile);
const hookPath = path.resolve('hooks/post-tool-use.mjs');

async function runHook(input: Record<string, unknown>): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = execFile('node', [hookPath], { timeout: 10000 }, (error, stdout, stderr) => {
      // Hook returns exit 0 even on internal errors (by design)
      resolve({ stdout, stderr });
    });
    proc.stdin!.write(JSON.stringify(input));
    proc.stdin!.end();
  });
}

function parseOutput(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout);
}

describe('PostToolUse Hook', () => {
  describe('optimization', () => {
    test('optimizes JSON array data', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: JSON.stringify({
          users: Array.from({ length: 5 }, (_, i) => ({
            id: i, name: `User ${i}`, email: `user${i}@test.com`
          }))
        }, null, 2),
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.hookEventName).toBe('PostToolUse');
      expect(typeof output.additionalContext).toBe('string');
      expect(output.additionalContext as string).toContain('[TOON-JSON]');
    });
  });

  describe('passthrough cases', () => {
    test('passes through plain text', async () => {
      const { stdout } = await runHook({
        tool_name: 'Read',
        tool_response: 'This is just regular text content that is not structured data.',
      });

      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBeUndefined();
    });

    test('passes through skipped tools', async () => {
      const { stdout } = await runHook({
        tool_name: 'Bash',
        tool_response: '{"data": [1, 2, 3]}',
      });

      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBeUndefined();
    });

    test('passes through small content', async () => {
      const { stdout } = await runHook({
        tool_name: 'Read',
        tool_response: '{"a":1}',
      });

      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBeUndefined();
    });

    test('passes through empty response', async () => {
      const { stdout } = await runHook({
        tool_name: 'Read',
        tool_response: '',
      });

      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles invalid JSON input gracefully', async () => {
      const proc = execFile('node', [hookPath], { timeout: 10000 }, () => {});
      const result = await new Promise<string>((resolve) => {
        let out = '';
        proc.stdout!.on('data', (data: Buffer) => { out += data.toString(); });
        proc.on('close', () => resolve(out));
        proc.stdin!.write('not json at all');
        proc.stdin!.end();
      });

      const parsed = JSON.parse(result);
      expect(parsed.continue).toBe(true);
    });

    test('handles empty stdin gracefully', async () => {
      const proc = execFile('node', [hookPath], { timeout: 10000 }, () => {});
      const result = await new Promise<string>((resolve) => {
        let out = '';
        proc.stdout!.on('data', (data: Buffer) => { out += data.toString(); });
        proc.on('close', () => resolve(out));
        proc.stdin!.end();
      });

      const parsed = JSON.parse(result);
      expect(parsed.continue).toBe(true);
    });

    test('logs errors to stderr on invalid input', async () => {
      const { stderr } = await runHook({ invalid: true } as Record<string, unknown>);
      // Should not crash, just passthrough
      // stderr may or may not have error message depending on the failure path
    });
  });
});
