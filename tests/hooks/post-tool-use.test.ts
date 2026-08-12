/**
 * PostToolUse hook integration tests
 * Runs the actual hook script as a subprocess
 */

import { describe, test, expect } from '@jest/globals';
import { execFile } from 'child_process';
import path from 'path';

const hookPath = path.resolve('hooks/post-tool-use.mjs');

async function runHook(input: Record<string, unknown>, env?: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // maxBuffer above Node's 1MB default: compressed output for a
    // near-10MB-ceiling source can itself be several MB (TOON compression
    // is real, not free) — the default would silently truncate stdout
    // mid-write and produce invalid JSON, a test-harness artifact, not a
    // hook bug.
    const proc = execFile(
      'node',
      [hookPath],
      { timeout: 10000, maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : process.env },
      (_error, stdout, stderr) => {
        // Hook returns exit 0 even on internal errors (by design)
        resolve({ stdout, stderr });
      }
    );
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
      // A string tool_response is replaced via updatedToolOutput (the tool's
      // output schema is a string, so a compressed string is a valid
      // replacement), never appended via additionalContext.
      expect(output.additionalContext).toBeUndefined();
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
      expect(output.additionalContext).toBeUndefined();
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
      expect(output.additionalContext).toBeUndefined();
      expect(output.updatedToolOutput as string).toContain('[toonify] similar diagnostic repeated 1 more time');
      expect(output.updatedToolOutput as string).toContain('src/screens/UsersPage.tsx:57:9 - error TS2769');
      expect(output.updatedToolOutput as string).not.toContain('18   title={42}');
      expect(output.updatedToolOutput as string).not.toContain('22   title={99}');
      // The hook and the library (src/optimizer/compressors/debug-output.ts)
      // independently implement the same location-preservation and
      // omission-marker fixes — assert the same specifics here that
      // tests/pipeline/debug-output-compressor.test.ts asserts for the
      // library, so a regression in the hook's own copy (wrong capture
      // group, off-by-one, wrong suffix formatting) can't slip past this
      // suite while the library's tests would still catch it.
      expect(output.updatedToolOutput as string).toContain('(also at src/components/ProfileCard.tsx:22:12)');
      expect(output.updatedToolOutput as string).toMatch(/\[toonify\] \d+ source excerpt lines? omitted throughout/);
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

    // Bash tool_response is {stdout, stderr, interrupted, isImage,
    // noOutputExpected}. Verified live that `stdout` holds the COMBINED
    // output (stderr lands there too), so it's the one compressible field.
    test('Bash: compresses stdout and returns updatedToolOutput, preserving other fields', async () => {
      const data = { rows: Array.from({ length: 300 }, (_, i) => ({ id: i, name: `E${i}` })) };
      const stdout = JSON.stringify(data, null, 2);

      const input = {
        tool_name: 'Bash',
        tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };

      const { stdout: out } = await runHook(input);
      const result = parseOutput(out);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext).toBeUndefined();
      const updated = output.updatedToolOutput as { stdout: string; stderr: string; interrupted: boolean; isImage: boolean; noOutputExpected: boolean };
      expect(updated.stdout).toContain('[TOON-JSON]');
      expect(updated.stdout.length).toBeLessThan(stdout.length);
      // Everything except `stdout` must survive untouched.
      expect(updated.stderr).toBe('');
      expect(updated.interrupted).toBe(false);
      expect(updated.isImage).toBe(false);
      expect(updated.noOutputExpected).toBe(false);
    });

    // Never compress image output — the bytes aren't text and the heuristics
    // would mangle them.
    test('Bash: image output (isImage) passes through untouched', async () => {
      const input = {
        tool_name: 'Bash',
        tool_response: { stdout: 'x'.repeat(5000), stderr: '', interrupted: false, isImage: true, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      expect(parseOutput(out)).toEqual({ continue: true });
    });

    // Small / plain command output stays below the token threshold and is
    // left alone — only large structured/debug output crosses the bar.
    test('Bash: short plain output passes through untouched', async () => {
      const input = {
        tool_name: 'Bash',
        tool_response: { stdout: 'hello world', stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      expect(parseOutput(out)).toEqual({ continue: true });
    });

    // Malformed Bash shape (no stdout string) must pass through, not crash.
    test('Bash: missing/non-string stdout passes through untouched', async () => {
      const input = { tool_name: 'Bash', tool_response: { stderr: 'oops', interrupted: false, isImage: false } };
      const { stdout: out } = await runHook(input);
      expect(parseOutput(out)).toEqual({ continue: true });
    });

    // Non-JSON Bash output (a test-runner failure log) routes through the
    // debug-output collapser, not TOON. Repeated failing blocks + long
    // stack traces collapse hard while every distinct line/location is kept.
    test('Bash: repetitive test-failure log collapses via debug-output path', async () => {
      const frames: string[] = [];
      for (let i = 0; i < 60; i++) {
        frames.push(`    at Object.<anonymous> (/app/src/module.js:${100 + i}:${5 + (i % 20)})`);
        frames.push('    at processTicksAndRejections (node:internal/process/task_queues:95:5)');
      }
      const block = [
        'FAIL src/api/handler.test.js',
        '  ● handler › returns 200',
        '',
        '    AssertionError: expected 500 to equal 200',
        ...frames,
        '',
      ].join('\n');
      const stdout = Array.from({ length: 8 }, () => block).join('\n');

      const input = {
        tool_name: 'Bash',
        tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      const result = parseOutput(out);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      const updated = output.updatedToolOutput as { stdout: string };
      // Debug collapse, not TOON — no structured-data header.
      expect(updated.stdout).not.toContain('[TOON-');
      expect(updated.stdout.length).toBeLessThan(stdout.length / 2);
      // The failure header and assertion survive; only the noise collapses.
      expect(updated.stdout).toContain('FAIL src/api/handler.test.js');
      expect(updated.stdout).toContain('AssertionError: expected 500 to equal 200');
    });

    // Numeric-fidelity guard: TOON runs content through JSON.parse, which
    // silently mangles numbers JS can't represent exactly. When ANY numeric
    // token would not round-trip, the whole payload must pass through
    // untouched rather than reach Claude with a corrupted value it can't
    // detect (the compressed output REPLACES the original).
    test('Bash: 64-bit integer IDs that lose precision force a passthrough', async () => {
      // Most of these distinct 19-digit IDs collapse to the same Number(...)
      // value (> 2^53), merging rows that must stay distinct. The guard needs
      // only one non-round-tripping token to force the whole payload through.
      const ids = Array.from({ length: 200 }, (_, i) => `1300000000000000${String(i).padStart(3, '0')}`);
      const stdout = `[${ids.map((id) => `{"id": ${id}}`).join(',')}]`;

      const input = {
        tool_name: 'Bash',
        tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      // Passthrough — the original tool_response (with exact IDs) is kept.
      expect(parseOutput(out)).toEqual({ continue: true });
    });

    test('Bash: trailing-zero decimals that would be rewritten force a passthrough', async () => {
      // 10.10 -> 10.1, 1.20 -> 1.2: JSON.parse drops the trailing zero.
      const rows = Array.from({ length: 200 }, (_, i) => `{"i": ${i}, "price": 10.10, "ratio": 1.20}`);
      const stdout = `[${rows.join(',')}]`;

      const input = {
        tool_name: 'Bash',
        tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      expect(parseOutput(out)).toEqual({ continue: true });
    });

    // Discrimination control: the SAME structure with only safe integers must
    // still compress — proving the guard rejects lossy numbers specifically,
    // not all structured data.
    test('Bash: safe-integer structured output still compresses to TOON', async () => {
      const rows = Array.from({ length: 200 }, (_, i) => ({ id: i, name: `svc${i}`, active: i % 2 === 0 }));
      const stdout = JSON.stringify(rows);

      const input = {
        tool_name: 'Bash',
        tool_response: { stdout, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
      };
      const { stdout: out } = await runHook(input);
      const result = parseOutput(out);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      const updated = output.updatedToolOutput as { stdout: string };
      expect(updated.stdout).toContain('[TOON-JSON]');
      expect(updated.stdout.length).toBeLessThan(stdout.length);
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

    // Grep's schema — {mode?, numFiles, filenames, content?, numLines?,
    // numMatches?, ...} — was extracted directly from the installed Claude
    // Code binary's own Zod schema and result-rendering source (`strings`
    // on the compiled CLI), not a secondhand report. See the comment above
    // extractText() for the full method and why an earlier, unverifiable
    // version of this adapter was retracted before being re-added this way.
    test("Grep 'content' mode: compresses content and recomputes numLines", async () => {
      const lines = Array.from({ length: 50 }, (_, i) =>
        `src/components/File${i}.tsx:${10 + i}:12 - error TS2322: Type X is not assignable to type Y.`
      );
      const grepContent = lines.join('\n\n');

      const input = {
        tool_name: 'Grep',
        tool_response: {
          mode: 'content',
          numFiles: 50,
          filenames: [],
          content: grepContent,
          numLines: grepContent.split('\n').length,
          numMatches: 50,
        },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result.continue).toBe(true);
      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext).toBeUndefined();
      const updated = output.updatedToolOutput as { content: string; numLines: number; mode: string; numMatches: number };
      expect(updated.content.length).toBeLessThan(grepContent.length);
      expect(updated.mode).toBe('content');
      expect(updated.numMatches).toBe(50);
      // numLines must track the actually-returned (compressed) content,
      // not the stale original count. A hardcoded expectation, not
      // updated.content.split('\n').length re-applied — reusing the same
      // formula the implementation uses would make this assertion unable
      // to fail even if reconstruct() computed numLines wrong. The 50
      // near-identical diagnostics collapse to: 1 kept line + 1
      // "repeated... (also at ...)" marker line, and compressDebugOutput's
      // own trailing '\n' adds one more segment when split — matching the
      // same trailing-newline convention verified live for Read's shape
      // (a single-line file's numLines was 2, not 1).
      expect(updated.content).toBe(
        'src/components/File0.tsx:10:12 - error TS2322: Type X is not assignable to type Y.\n' +
        '[toonify] similar diagnostic repeated 49 more times (also at ' +
        Array.from({ length: 49 }, (_, i) => `src/components/File${i + 1}.tsx:${11 + i}:12`).join(', ') +
        ')\n'
      );
      expect(updated.numLines).toBe(3);
      expect(updated.numLines).toBeLessThan(grepContent.split('\n').length);
    });

    test("Grep 'count' mode: compresses content, does not fabricate a numLines field", async () => {
      const data = { byFile: Array.from({ length: 300 }, (_, i) => ({ file: `src/f${i}.ts`, count: i })) };
      const grepContent = JSON.stringify(data, null, 2);

      const input = {
        tool_name: 'Grep',
        tool_response: { mode: 'count', numFiles: 300, filenames: [], content: grepContent, numMatches: 5000 },
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      const output = result.hookSpecificOutput as Record<string, unknown>;
      const updated = output.updatedToolOutput as { content: string; numMatches: number; numLines?: number };
      expect(updated.content).toContain('[TOON-JSON]');
      expect(updated.numMatches).toBe(5000);
      // The original response had no numLines field — reconstruct() must
      // not add one that wasn't there.
      expect(updated.numLines).toBeUndefined();
    });

    // The default mode ('files_with_matches') never populates `content`
    // per the CLI's own rendering logic — extractText()'s type check on
    // `content` is what actually gates this (mode isn't checked directly),
    // so this also covers any Grep response with no content field.
    test("Grep 'files_with_matches' mode (no content field) passes through untouched", async () => {
      const input = {
        tool_name: 'Grep',
        tool_response: { numFiles: 5, filenames: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'] },
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

    // Mirrors the Read/Grep malformed-shape tests above — WebFetch had only
    // a happy-path test, no coverage for a missing/wrong-typed `result`.
    test('WebFetch with a malformed object shape (missing result) passes through safely', async () => {
      const input = {
        tool_name: 'WebFetch',
        tool_response: { bytes: 0, code: 200, codeText: 'OK', durationMs: 10, url: 'https://example.com' }, // no result field
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      expect(result).toEqual({ continue: true });
    });

    // A string tool_response is REPLACED via updatedToolOutput (the tool's
    // output schema is a string, so a compressed string is a schema-valid
    // replacement that shrinks context), never appended via additionalContext
    // (which would grow it). The hook must never emit additionalContext at
    // all — it's purely additive and can't reduce tokens.
    test('string tool_response is replaced via updatedToolOutput, never additionalContext', async () => {
      const input = {
        tool_name: 'Read',
        tool_response: JSON.stringify({
          rows: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `E${i}` })),
        }, null, 2),
      };

      const { stdout } = await runHook(input);
      const result = parseOutput(stdout);

      const output = result.hookSpecificOutput as Record<string, unknown>;
      expect(output.additionalContext).toBeUndefined();
      expect(typeof output.updatedToolOutput).toBe('string');
      expect(output.updatedToolOutput as string).toContain('[TOON-JSON]');
      // The replacement is genuinely smaller than the original string.
      expect((output.updatedToolOutput as string).length).toBeLessThan(input.tool_response.length);
    });

    // The hook only REPLACES a tool's result for tools whose result shape and
    // text semantics it has verified (Read/WebFetch/Grep). For any other tool
    // — an unmatched or MCP tool — even a compressible string/object result
    // must pass through untouched: replacing it would strip that tool's only
    // copy of its output and hand Claude a lossy compressed view instead.
    // (Since updatedToolOutput REPLACES, this gate matters; when the hook
    // merely appended, an unmatched tool's promiscuity was near-harmless.)
    const bigJson = JSON.stringify({ rows: Array.from({ length: 300 }, (_, i) => ({ id: i, name: `E${i}` })) }, null, 2);

    test('a compressible STRING result from an untrusted (MCP/unmatched) tool passes through untouched', async () => {
      const { stdout } = await runHook({ tool_name: 'mcp__server__query', tool_response: bigJson });
      expect(parseOutput(stdout)).toEqual({ continue: true });
    });

    test('a compressible OBJECT result from an untrusted tool passes through untouched', async () => {
      const { stdout } = await runHook({ tool_name: 'mcp__server__query', tool_response: { result: bigJson } });
      expect(parseOutput(stdout)).toEqual({ continue: true });
    });
  });

  describe('YAML detection', () => {
    const asRead = (content: string) => ({
      tool_name: 'Read',
      tool_response: { type: 'text', file: { filePath: '/x.yaml', content, numLines: content.split('\n').length, startLine: 1, totalLines: content.split('\n').length } },
    });
    const compressedContent = (result: Record<string, unknown>): string | undefined => {
      const u = (result.hookSpecificOutput as Record<string, unknown> | undefined)?.updatedToolOutput as { file?: { content?: string } } | undefined;
      return u?.file?.content;
    };

    // Regression: the old gate required `Object.keys(data).length > 1`, so a
    // single top-level key holding a large uniform list — the most common and
    // most compressible YAML shape (`kubectl get -o yaml` → `items:`) — was
    // silently skipped. It must now compress.
    test('single top-level key with a uniform list compresses to TOON', async () => {
      const yaml = 'apiVersion: v1\nkind: List\nitems:\n' + Array.from({ length: 25 }, (_, i) =>
        `  - name: pod-${i}\n    phase: Running\n    restarts: ${i % 3}\n    node: node-${i % 4}`).join('\n');

      const { stdout } = await runHook(asRead(yaml));
      const result = parseOutput(stdout);
      expect(result.continue).toBe(true);
      const content = compressedContent(result);
      expect(content).toContain('[TOON-YAML]');
      // Hyphen-digit item names (pod-0, node-0) must survive verbatim — they
      // must NOT be read as negative numbers by the numeric-fidelity guard.
      expect(content).toContain('pod-0');
      expect(content).toContain('node-0');
    });

    // Regression for the numeric-guard false positive: an unquoted `-<digit>`
    // (hyphenated identifiers, ISO dates) is not a number to the YAML parser,
    // so it must not block compression. `-0` in particular fails String(-0)
    // round-trip and used to force a needless passthrough.
    test('unquoted ISO dates and hyphen-digit ids do not block compression', async () => {
      const yaml = 'events:\n' + Array.from({ length: 20 }, (_, i) =>
        `  - id: e-${i}\n    date: 2024-01-${String((i % 28) + 1).padStart(2, '0')}\n    level: info`).join('\n');

      const { stdout } = await runHook(asRead(yaml));
      const result = parseOutput(stdout);
      const content = compressedContent(result);
      expect(content).toContain('[TOON-YAML]');
      // Dates are strings to the YAML parser — preserved byte-for-byte.
      expect(content).toContain('2024-01-01');
    });

    // The structural gate (looksLikeYAML) must keep ordinary prose out, even
    // though yaml.parse would happily coerce it into some object.
    test('prose is not misdetected as YAML', async () => {
      const prose = Array.from({ length: 12 }, (_, i) =>
        `This is paragraph ${i} of some ordinary prose that explains an idea in plain words.`).join('\n\n');
      const { stdout } = await runHook(asRead(prose));
      expect(parseOutput(stdout)).toEqual({ continue: true });
    });

    // A real numeric corruption inside otherwise-valid YAML must still force a
    // passthrough — the boundary fix must not weaken the guard.
    test('YAML carrying a precision-losing 64-bit id still passes through', async () => {
      const yaml = 'records:\n' + Array.from({ length: 20 }, (_, i) =>
        `  - name: rec-${i}\n    snowflake: 13000000000000000${String(i).padStart(2, '0')}`).join('\n');
      const { stdout } = await runHook(asRead(yaml));
      expect(parseOutput(stdout)).toEqual({ continue: true });
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

    // Regression: the payload above only exercises DETECTION regexes — it
    // scores < 3 so compressDebugOutput() never runs. compressDebugOutput's
    // own pointer-line filter and collapseSourceExcerptNoise have the SAME
    // ambiguous-character-class ReDoS but run on full, uncapped content, so
    // a payload that DOES score >= 3 (real FAIL + stack frames) plus one
    // long near-whitespace line reaches the compression path. Measured ~15s
    // before the fix.
    test('does not hang when the ReDoS-shaped line reaches the compression path', async () => {
      const adversarial =
        'FAIL: something broke\nat foo (bar.ts:1:1)\nat foo (bar.ts:2:2)\nat foo (bar.ts:3:3)\n' + ' '.repeat(150000);

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

    test('passes through tools not in the text-tool set', async () => {
      // Glob reaches the hook (it is in the PostToolUse matcher) but is NOT a
      // TEXT_TOOL, so its output is never parsed or compressed — even a large,
      // highly compressible structured payload must pass through untouched.
      // (Bash used to be the skipped tool asserted here; it is now processed,
      // so this test moved to a tool that is genuinely gated out.)
      const rows = Array.from({ length: 300 }, (_, i) => ({ id: i, path: `src/file${i}.ts` }));
      const { stdout } = await runHook({
        tool_name: 'Glob',
        tool_response: JSON.stringify(rows),
      });

      const result = parseOutput(stdout);
      expect(result).toEqual({ continue: true });
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
      expect(output?.updatedToolOutput).toContain('[TOON-JSON]');
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

    test('malformed input (no tool_name/tool_response) passes through without crashing', async () => {
      const { stdout } = await runHook({ invalid: true } as Record<string, unknown>);
      // Missing fields must never crash the hook — it degrades to passthrough.
      // (stderr may or may not carry a message depending on the failure path.)
      expect(parseOutput(stdout)).toEqual({ continue: true });
    });
  });
});
