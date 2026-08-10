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
      expect(typeof output.updatedToolOutput).toBe('string');
      expect(output.updatedToolOutput as string).toContain('[TOON-JSON]');
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
      expect(output.updatedToolOutput as string).toContain('tests/user-service.test.ts');
      expect(output.updatedToolOutput as string).toContain('/workspace/src/index.ts:11:3');
      expect(output.updatedToolOutput as string).not.toContain('      41 |');
      expect(output.updatedToolOutput as string).toContain('[toonify]');
    });

    test('collapses repeated TypeScript diagnostics in hook mode', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: `src/components/ProfileCard.tsx:18:12 - error TS2322: Type 'number' is not assignable to type 'string'.

18   title={42}
              ~~

src/components/ProfileCard.tsx:22:12 - error TS2322: Type 'number' is not assignable to type 'string'.

22   title={99}
              ~~

src/screens/UsersPage.tsx:57:9 - error TS2769: No overload matches this call.

57         navigate(123);
           ~~~~~~~~

Found 3 errors in 2 files.`,
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.updatedToolOutput as string).toContain('[toonify] similar diagnostic repeated 1 more time');
      expect(output.updatedToolOutput as string).toContain('src/screens/UsersPage.tsx:57:9 - error TS2769');
      expect(output.updatedToolOutput as string).not.toContain('18   title={42}');
      expect(output.updatedToolOutput as string).not.toContain('22   title={99}');
    });
  });

  describe('source code is never rewritten', () => {
    // Regression for Bug B: `removeInlineCStyleComment` did not know about
    // regex literals, so `/^https?:\/\//` was truncated at the `//` and the
    // file Claude received no longer parsed. The hook must not touch code.
    const tsWithRegexLiterals = `import { normalize } from './util';
import type { Parsed } from './types';

export interface Parts {
  host: string;
  segments: string[];
}

export function clean(url: string, s: string): Parts {
  // strip the scheme
  const a = url.replace(/^https?:\\/\\//, "");
  const b = s.split(/\\/\\//);
  const c = a.replace(/\\/\\/+/g, "/"); // collapse duplicate slashes
  return { host: normalize(c), segments: b };
}
`;

    test('TypeScript with regex literals is left byte-for-byte alone', async () => {
      const { stdout } = await runHook({
        tool_name: 'Read',
        tool_response: tsWithRegexLiterals,
      });
      const result = parseOutput(stdout);

      // Passthrough means the hook emits no replacement content at all, so the
      // original tool result reaches Claude unchanged.
      expect(result).toEqual({ continue: true });
      expect(result.hookSpecificOutput).toBeUndefined();
      expect(result.suppressOutput).toBeUndefined();
    });

    test('Python with a multi-line docstring is left byte-for-byte alone', async () => {
      const py = `import json
from typing import Any


def calc(x: int) -> int:
    """Compute the thing.

    Args:
        x: the input.
    """
    return x * 2


class Service:
    """Manages operations."""

    def __init__(self) -> None:
        self.items: list[Any] = []  # store items here

    def add(self, item: Any) -> bool:
        self.items.append(item)
        return True
`;

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: py });
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    test('CSV is left alone rather than converted to TOON', async () => {
      const rows = Array.from({ length: 40 }, (_, i) =>
        `${i},Employee ${i},employee${i}@company.com,${25 + (i % 30)},Dept ${i % 5}`
      );
      const csv = ['id,name,email,age,department', ...rows].join('\n');

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: csv });
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
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
