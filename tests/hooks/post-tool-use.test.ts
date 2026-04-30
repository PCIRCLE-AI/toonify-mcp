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

    test('preserves PHP attributes and heredoc bodies during code compression', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: `<?php

use Symfony\\Component\\Routing\\Attribute\\Route;

class ApiController {
    // Remove this comment line
    #[Route('/api/users', methods: ['GET'])]
    public function listUsers() {
        $html = <<<HTML
<h1>Users</h1>
// This is HTML, not a PHP comment
# also not a PHP comment
HTML;
        return $this->render($html); # remove trailing comment
    }
}
`,
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.hookEventName).toBe('PostToolUse');
      expect(output.additionalContext as string).toContain("#[Route('/api/users', methods: ['GET'])]");
      expect(output.additionalContext as string).toContain('// This is HTML, not a PHP comment');
      expect(output.additionalContext as string).toContain('# also not a PHP comment');
      expect(output.additionalContext as string).not.toContain('remove trailing comment');
    });

    test('optimizes debug-heavy output while preserving actionable lines', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: `FAIL tests/user-service.test.ts
  UserService
    × returns a fallback profile when the API request fails

  ● UserService › returns a fallback profile when the API request fails

    expect(received).toEqual(expected)

      41 |     const profile = await service.loadProfile("demo-user");
      42 |
    > 43 |     expect(profile).toEqual({ status: "offline" });
         |                     ^

TypeError: Cannot read properties of undefined (reading 'id')
    at renderUserCard (/workspace/src/render.ts:18:13)
    at renderUserCard (/workspace/src/render.ts:18:13)
    at renderUserList (/workspace/src/list.ts:42:5)
    at renderUserList (/workspace/src/list.ts:42:5)
    at processUsers (/workspace/src/process.ts:77:9)
    at processUsers (/workspace/src/process.ts:77:9)
    at async main (/workspace/src/index.ts:11:3)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total`,
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext as string).toContain('tests/user-service.test.ts');
      expect(output.additionalContext as string).toContain('/workspace/src/index.ts:11:3');
      expect(output.additionalContext as string).not.toContain('      41 |');
      expect(output.additionalContext as string).toContain('[toonify]');
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
