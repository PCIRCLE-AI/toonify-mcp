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
    // maxBuffer above Node's 1MB default: compressed output for a
    // near-10MB-ceiling source can itself be several MB (TOON compression
    // is real, not free) — the default would silently truncate stdout
    // mid-write and produce invalid JSON, a test-harness artifact, not a
    // hook bug.
    const proc = execFile('node', [hookPath], { timeout: 10000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
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
      expect(output.additionalContext as string).toContain('[toonify] similar diagnostic repeated 1 more time');
      expect(output.additionalContext as string).toContain('src/screens/UsersPage.tsx:57:9 - error TS2769');
      expect(output.additionalContext as string).not.toContain('18   title={42}');
      expect(output.additionalContext as string).not.toContain('22   title={99}');
      // The hook and the library (src/optimizer/compressors/debug-output.ts)
      // independently implement the same location-preservation and
      // omission-marker fixes — assert the same specifics here that
      // tests/pipeline/debug-output-compressor.test.ts asserts for the
      // library, so a regression in the hook's own copy (wrong capture
      // group, off-by-one, wrong suffix formatting) can't slip past this
      // suite while the library's tests would still catch it.
      expect(output.additionalContext as string).toContain('(also at src/components/ProfileCard.tsx:22:12)');
      expect(output.additionalContext as string).toMatch(/\[toonify\] \d+ source excerpt lines? omitted throughout/);
    });
  });

  describe('object-shaped tool_response (real Claude Code shape)', () => {
    // tool_response is NOT a plain string for Read/WebFetch in real Claude
    // Code — verified live against a real session (Read:
    // {type, file:{filePath, content, numLines, startLine, totalLines}},
    // WebFetch: {bytes, code, codeText, result, durationMs, url}). Before
    // this adapter existed, the hook's `typeof tool_response !== 'string'`
    // gate made it a complete no-op for these shapes: compression never
    // even ran. Now extractText()/reconstruct() pull the text field out,
    // compress it, and rebuild the object so updatedToolOutput can replace
    // (not just append to) what Claude sees.
    test('Read: compresses file.content and returns updatedToolOutput, not additionalContext', async () => {
      const data = { rows: Array.from({ length: 300 }, (_, i) => ({ id: i, name: `E${i}` })) };
      const content = JSON.stringify(data, null, 2);
      const lines = content.split('\n').length;

      const input = {
        tool_name: 'Read',
        tool_response: {
          type: 'text',
          file: {
            filePath: '/tmp/data.json',
            content,
            numLines: lines,
            startLine: 1,
            totalLines: lines,
          },
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext).toBeUndefined();
      const updated = output.updatedToolOutput as { file: { content: string; numLines: number; totalLines: number; filePath: string } };
      expect(updated.file.content).toContain('[TOON-JSON]');
      expect(updated.file.content.length).toBeLessThan(content.length);
      expect(updated.file.filePath).toBe('/tmp/data.json');
      // Full-file-read invariant (numLines === totalLines in the original)
      // must survive compression, or Claude is misled into thinking there's
      // more of the file left to page in via offset/limit.
      expect(updated.file.numLines).toBe(updated.file.totalLines);
      expect(updated.file.numLines).toBeLessThan(lines);
    });

    test('Read: a genuinely partial read keeps totalLines as the true file size', async () => {
      const data = { rows: Array.from({ length: 300 }, (_, i) => ({ id: i, name: `E${i}` })) };
      const content = JSON.stringify(data, null, 2);
      const lines = content.split('\n').length;

      const input = {
        tool_name: 'Read',
        tool_response: {
          type: 'text',
          file: {
            filePath: '/tmp/data.json',
            content,
            numLines: lines,
            startLine: 1,
            totalLines: lines + 5000, // simulates a partial read of a bigger file
          },
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      const output = result.hookSpecificOutput as Record<string, unknown>;
      const updated = output.updatedToolOutput as { file: { numLines: number; totalLines: number } };
      expect(updated.file.totalLines).toBe(lines + 5000);
      expect(updated.file.numLines).toBeLessThan(updated.file.totalLines);
    });

    test('WebFetch: compresses result and returns updatedToolOutput, preserving other fields', async () => {
      const data = { items: Array.from({ length: 300 }, (_, i) => ({ id: i, label: `Item ${i}` })) };
      const result_ = JSON.stringify(data, null, 2);

      const input = {
        tool_name: 'WebFetch',
        tool_response: {
          bytes: result_.length,
          code: 200,
          codeText: 'OK',
          result: result_,
          durationMs: 1200,
          url: 'https://example.com/data.json',
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext).toBeUndefined();
      const updated = output.updatedToolOutput as { result: string; url: string; code: number; codeText: string; durationMs: number };
      expect(updated.result).toContain('[TOON-JSON]');
      expect(updated.result.length).toBeLessThan(result_.length);
      // Everything except `result` must survive untouched.
      expect(updated.url).toBe('https://example.com/data.json');
      expect(updated.code).toBe(200);
      expect(updated.codeText).toBe('OK');
      expect(updated.durationMs).toBe(1200);
    });

    test('unrecognized tool name with an object tool_response passes through safely', async () => {
      const input = {
        tool_name: 'SomeFutureTool',
        tool_response: { matches: ['some result'], count: 1 },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      // extractText() returns null for tool names it doesn't recognize —
      // must never crash or fabricate a shape, just pass through.
      expect(result).toEqual({ continue: true });
    });

    // Grep has NO adapter — extractText() never recognizes it, regardless
    // of shape. An earlier version of this file had a 'count'-mode adapter
    // sourced from an agent's unverifiable claim of having captured that
    // shape live; that claim could not be corroborated (see the comment
    // above extractText()) and the adapter was removed rather than kept on
    // unreliable evidence. Any Grep tool_response — including one shaped
    // like the retracted claim — must pass through untouched.
    test('Grep always passes through untouched (no adapter exists for it)', async () => {
      const input = {
        tool_name: 'Grep',
        tool_response: {
          mode: 'count',
          numFiles: 1,
          filenames: [],
          content: 'code.js:50',
          numMatches: 50,
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    // Glob deliberately has no adapter at all — its response has no
    // bulk-text field, only filenames/counts/booleans, so there's nothing
    // for this hook to compress. This is a scoping decision, not a gap.
    test('Glob (no compressible text field) passes through untouched', async () => {
      const input = {
        tool_name: 'Glob',
        tool_response: {
          filenames: Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`),
          durationMs: 12,
          numFiles: 50,
          truncated: false,
          totalMatches: 50,
          countIsComplete: true,
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    test('Read with a malformed object shape (missing file.content) passes through safely', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: { type: 'text', file: { filePath: '/tmp/x.json' } }, // no content field
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    test('string tool_response (legacy shape) still goes through additionalContext, not updatedToolOutput', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: JSON.stringify({
          rows: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `E${i}` })),
        }, null, 2),
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(typeof output.additionalContext).toBe('string');
      expect(output.updatedToolOutput).toBeUndefined();
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

    // Regression: source code can score >= 3 on detectDebugOutput's
    // heuristics (e.g. repeated near-identical lines + the literal word
    // "FAIL" both appearing legitimately in real code), which used to route
    // it into compressDebugOutput() and silently splice a
    // "[toonify] repeated N more times" note into what was a valid TS array
    // literal, corrupting real source. Guarded against here regardless of
    // which hookSpecificOutput field is used — an appended corrupted copy
    // is still misleading even when the original is also present.
    test('source code with repeated near-identical lines is not misclassified as debug output', async () => {
      const ts = `export const RETRY_MESSAGES: string[] = [
  "FAIL: unable to process",
  "FAIL: unable to process",
  "FAIL: unable to process",
  "FAIL: unable to process",
  "FAIL: unable to process",
];

export function nextMessage(index: number): string {
  return RETRY_MESSAGES[index % RETRY_MESSAGES.length];
}
`;

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: ts });
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    // Regression: looksLikeSourceCode() only recognized TS/Python/PHP/Go
    // indicators, so source in any other language (Java, C, C++, Rust,
    // Ruby, ...) with repeated near-identical lines fell through to
    // detectDebugOutput and got corrupted the same way the TS case above
    // used to. A generic-code fallback (mirroring looksLikeGenericCode in
    // src/optimizer/pipeline/detector.ts) closes this for any C-family-ish
    // syntax, not just the four explicitly named languages.
    test('source code in a language without a dedicated indicator set (Java) is not misclassified as debug output', async () => {
      const java = `package com.example.service;

public class RetryHandler {
    public void run(int attempt) {
        if (attempt == 1) { throw new RuntimeException("FAIL"); }
        if (attempt == 2) { throw new RuntimeException("FAIL"); }
        if (attempt == 3) { throw new RuntimeException("FAIL"); }
        if (attempt == 4) { throw new RuntimeException("FAIL"); }
        if (attempt == 5) { throw new RuntimeException("FAIL"); }
    }
}
`;

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: java });
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    // Regression: hasMultipleFileLocationDiagnostics()'s
    // /\b[\w./-]+\.(ts|...):\d+:\d+\b/g has an ambiguous overlap between the
    // `.` inside its character class and the literal `.` before the
    // extension, causing O(n^2) backtracking on content shaped like
    // "a.a.a.a...." with no valid :line:col suffix ever appearing (same
    // class of bug independently affects /^\s*at\s+.+\(.+:\d+:\d+\)/m).
    // Verified before the fix: a single ~120,000-char adversarial line took
    // several seconds; this test asserts it now completes well under the
    // hook's own child-process timeout.
    test('does not hang on a ReDoS-shaped adversarial payload', async () => {
      const adversarial = 'line one\nline two\nline three\n' + 'a.'.repeat(60000) + '\nline five';

      const start = Date.now();
      const { stdout } = await runHook({ tool_name: 'Read', tool_response: adversarial });
      const elapsedMs = Date.now() - start;

      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
      expect(elapsedMs).toBeLessThan(3000);
    }, 10000);
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

    // Regression: JSON.parse/yamlParse ran on arbitrarily large content with
    // no ceiling in the standalone hook, unlike the (already-guarded)
    // library path (see src/optimizer/token-optimizer.ts's MAX_CONTENT_SIZE).
    //
    // A prior version of this test used 'x'.repeat(10MB+1), which is
    // vacuous: that content has no newline, so it fails JSON.parse and the
    // YAML gate immediately regardless of whether the size guard exists —
    // the test passed identically with the guard deliberately disabled.
    // This version uses genuinely compressible JSON so the two sizes
    // produce OBSERVABLY DIFFERENT outcomes only if the guard is doing its
    // job: just under the ceiling must still compress (proving the guard
    // isn't just rejecting everything), just over it must passthrough.
    function buildCompressibleJson(targetBytes: number): string {
      const rows: string[] = [];
      let size = 2; // '[' + ']'
      let i = 0;
      while (size < targetBytes) {
        const row = JSON.stringify({ id: i, name: `Employee${i}`, active: true });
        size += row.length + 1; // +1 for the comma
        rows.push(row);
        i++;
      }
      return `[${rows.join(',')}]`;
    }

    test('compresses content just under the 10MB ceiling', async () => {
      const underCeiling = buildCompressibleJson(10 * 1024 * 1024 - 2000);
      expect(underCeiling.length).toBeLessThan(10 * 1024 * 1024);

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: underCeiling });
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown> | undefined;
      expect(output?.additionalContext).toContain('[TOON-JSON]');
    }, 15000);

    test('passes through content over the 10MB size ceiling without parsing it', async () => {
      const overCeiling = buildCompressibleJson(10 * 1024 * 1024 + 2000);
      expect(overCeiling.length).toBeGreaterThan(10 * 1024 * 1024);

      const { stdout } = await runHook({ tool_name: 'Read', tool_response: overCeiling });
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    }, 15000);
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
