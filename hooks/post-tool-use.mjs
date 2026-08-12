#!/usr/bin/env node

/**
 * Toonify PostToolUse Hook
 *
 * Intercepts tool results from Read, Grep, Glob, WebFetch and:
 * - Converts structured data (JSON/YAML) to TOON format
 * - Collapses repetitive debug output (test failures, stack traces, diagnostics)
 *
 * Source code is NOT compressed: the comment-stripping heuristics truncated
 * regex literals such as /^https?:\/\// at the `//`, producing code that no
 * longer parses. See src/optimizer/compressors/code.ts for the full rationale.
 *
 * CSV is not converted: TOON measured as a net loss on CSV at every size.
 *
 * tool_response is a structured object for the tools this hook matches, not
 * a plain string — see extractText() below for the shapes verified (Read,
 * WebFetch, Grep — both its 'content' and 'count' modes populate a
 * compressible `content` field, per the tool's own schema).
 *
 * Compressed content ALWAYS goes out via hookSpecificOutput.updatedToolOutput,
 * which REPLACES what Claude sees — that is what actually shrinks context.
 * The hook never uses additionalContext: it APPENDS (verified live that
 * `suppressOutput` doesn't hide the original), so it would grow total context
 * instead of shrinking it. For an object tool_response the replacement is the
 * object with its text field swapped; for a (compat-only) string
 * tool_response it's the compressed string itself. Where tool_response is an
 * OBJECT with no compressible field for that tool (Grep's default
 * 'files_with_matches' mode, Glob, an unmatched tool), the hook passes
 * through untouched — there is nothing to safely replace.
 *
 * Input:  JSON on stdin with { tool_name, tool_response, ... }
 * Output: JSON on stdout with { continue, hookSpecificOutput }
 */

import { encode as toonEncode } from '@toon-format/toon';
import { parse as yamlParse } from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// --- Configuration ---

/**
 * Maximum content size to attempt JSON.parse/yamlParse/detection on (10 MB).
 * Mirrors MAX_CONTENT_SIZE in src/optimizer/token-optimizer.ts — this hook
 * has its own detection pipeline (see detectStructuredData/detectDebugOutput
 * below) and needs the same DoS-prevention ceiling; without it, arbitrarily
 * large Read/WebFetch content gets parsed synchronously with no bound.
 */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

const DEFAULT_CONFIG = {
  enabled: true,
  minTokensThreshold: 50,
  minSavingsThreshold: 30,
  skipToolPatterns: ['Bash', 'Write', 'Edit'],
};

function loadConfig() {
  const configPath = join(homedir(), '.claude', 'toonify-config.json');
  let fileConfig = {};

  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Ignore invalid config
    }
  }

  // Environment variable overrides
  const envConfig = {};
  if (process.env.TOONIFY_ENABLED !== undefined) {
    envConfig.enabled = process.env.TOONIFY_ENABLED !== 'false';
  }
  if (process.env.TOONIFY_MIN_TOKENS) {
    envConfig.minTokensThreshold = parseInt(process.env.TOONIFY_MIN_TOKENS, 10);
  }
  if (process.env.TOONIFY_MIN_SAVINGS) {
    envConfig.minSavingsThreshold = parseInt(process.env.TOONIFY_MIN_SAVINGS, 10);
  }
  if (process.env.TOONIFY_SKIP_TOOLS) {
    envConfig.skipToolPatterns = process.env.TOONIFY_SKIP_TOOLS.split(',');
  }

  return { ...DEFAULT_CONFIG, ...fileConfig, ...envConfig };
}

// --- Structured Data Detection ---

function detectStructuredData(content) {
  // Try JSON
  try {
    const data = JSON.parse(content);
    if (typeof data === 'object' && data !== null) {
      return { type: 'json', data };
    }
  } catch {
    // Not JSON
  }

  // Try YAML (only if it looks like YAML - has key: value patterns)
  if (/^\s*[\w-]+\s*:/m.test(content) && content.includes('\n')) {
    try {
      const data = yamlParse(content);
      if (typeof data === 'object' && data !== null && Object.keys(data).length > 1) {
        return { type: 'yaml', data };
      }
    } catch {
      // Not YAML
    }
  }

  return null;
}

// --- ReDoS guard ---
//
// hasMultipleFileLocationDiagnostics()'s /\b[\w./-]+\.(ts|...):\\d+:\\d+\b/g
// has an ambiguous overlap between the `.` inside its character class and
// the literal `.` before the extension: on a run like "a.a.a.a...." with no
// valid `:line:col` suffix, the engine backtracks through the whole run at
// every position — O(n^2). The same class of blowup hits
// /^\s*at\s+.+\(.+:\d+:\d+\)/m in detectDebugOutput() (two greedy `.+` with
// no closing `:N:N)` ever appearing). Verified independently: doubling
// input length roughly quadrupled match time for both regexes (clean
// quadratic fit), and a crafted ~100KB single-line payload took the real
// hook process over 10 seconds wall-clock. MAX_CONTENT_SIZE does NOT protect
// against this — it bounds JSON.parse/yamlParse cost, not regex
// backtracking cost, which is orders of magnitude worse per byte.
//
// Fix is structural rather than per-regex: legitimate debug output (stack
// traces, compiler diagnostics, test failures) never has a single line more
// than a few hundred characters long, so capping line length before ANY of
// these heuristic regexes run bounds worst-case backtracking to a constant
// per line — regardless of whether some other regex in this file has a
// similar latent ambiguity that hasn't been found yet.
//
// Mirrors the identical fix in src/optimizer/pipeline/detector.ts — the
// hook can't import from src/ (standalone .mjs, no build step), so this is
// a deliberate, necessary duplication. Fix both together so they don't
// drift.
const MAX_LINE_LENGTH_FOR_SCAN = 2000;

// Single-line cap — use this inside per-line predicates. Real diagnostic
// lines (tsc/eslint/traceback) front-load their file:line:col, so capping
// the head preserves the location signal; only adversarial padding is lost.
function capLine(line) {
  return line.length > MAX_LINE_LENGTH_FOR_SCAN ? line.slice(0, MAX_LINE_LENGTH_FOR_SCAN) : line;
}

// Content-level cap — for multi-line content fed to a regex in one shot
// (detectDebugOutput's scoring regexes, detectCode's sample). Do NOT call
// this per-line: it splits/maps/joins the whole string each call, which is
// ~O(lines) per invocation. Use capLine() for that.
function capLineLengths(content) {
  const lines = content.split('\n');
  let capped = false;
  const result = lines.map(line => {
    if (line.length > MAX_LINE_LENGTH_FOR_SCAN) {
      capped = true;
      return line.slice(0, MAX_LINE_LENGTH_FOR_SCAN);
    }
    return line;
  });
  return capped ? result.join('\n') : content;
}

// --- Source Code Guard ---
//
// Used ONLY to gate debug-output detection, never to route to a compressor.
// Real source code can score >= 3 on detectDebugOutput's heuristics — e.g. a
// file with several near-identical `throw new Error("FAIL: ...")` lines
// legitimately contains "FAIL" and repeated near-duplicate lines. Without
// this guard, compressDebugOutput() would run collapseDuplicateLines() /
// collapseSourceExcerptNoise() on that source and hand back something like
// `[toonify] repeated 4 more times` spliced into an array literal — a
// misleading, corrupted view that REPLACES the real file via
// updatedToolOutput, with no original left for Claude to fall back on.
// Mirrors the ordering in src/optimizer/pipeline/detector.ts, where code is
// detected before debug output for exactly this reason.
function looksLikeSourceCode(content) {
  // split's limit stops after 50 lines instead of materializing an array of
  // every line in a (up to 10MB) document just to sample the first 50.
  const lines = content.split('\n', 50);
  if (lines.length < 3) return false;
  const sample = capLineLengths(lines.join('\n'));

  const tsIndicators = [
    /\bimport\s+.*\bfrom\s+['"]/,
    /\bexport\s+(default\s+)?(class|function|const|interface|type)\b/,
    /:\s*(string|number|boolean|void)\b/,
    /=>\s*[{(]/,
    /\binterface\s+\w+/,
    /\bconst\s+\w+\s*:\s*\w+/,
  ];
  if (tsIndicators.filter(p => p.test(sample)).length >= 2) return true;

  const pyIndicators = [
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+.*:/m,
    /^from\s+\w+\s+import\b/m,
    /^import\s+\w+/m,
    /^\s+self\./m,
    /:\s*$\n\s+/m,
  ];
  if (pyIndicators.filter(p => p.test(sample)).length >= 2) return true;

  const phpIndicators = [
    /^<\?php\b/m,
    /\bnamespace\s+[\w\\]+;/m,
    /\buse\s+[\w\\]+;/m,
    /\bfunction\s+\w+\s*\(/m,
    /\$this->/,
    /\bpublic\s+(static\s+)?(function|readonly)\b/m,
  ];
  if (phpIndicators.filter(p => p.test(sample)).length >= 2) return true;

  const goIndicators = [
    /^package\s+\w+/m,
    /^func\s+/m,
    /\bfmt\.\w+/,
    /\b:=\s/,
    /\berr\s*!=\s*nil\b/,
  ];
  if (goIndicators.filter(p => p.test(sample)).length >= 2) return true;

  // Generic fallback for languages not covered above (Java, C, C++, Rust,
  // Ruby, ...). Without this, e.g. Java source with several identical
  // `throw new RuntimeException("FAIL");` lines is NOT recognized as code
  // (0-1 of the TS/Python/PHP/Go indicators match) and falls through to
  // detectDebugOutput, which then scores it >= 3 ("FAIL" + repeated lines)
  // and corrupts real code — reproduced and verified. Mirrors
  // looksLikeGenericCode in src/optimizer/pipeline/detector.ts.
  const genericIndicators = [
    /[{}\[\]();]/,
    /\b(function|class|return|if|else|for|while)\b/,
    /\/\/.+$/m,
    /^\s{2,}\S/m,
  ];
  if (genericIndicators.filter(p => p.test(sample)).length >= 3) return true;

  return false;
}

function detectDebugOutput(content) {
  if (looksLikeSourceCode(content)) return false;

  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 4) return false;

  const scanContent = capLineLengths(content);
  let score = 0;

  if (/\b(FAIL|FAILURES?|AssertionError|Traceback|Caused by:|UnhandledPromiseRejection)\b/m.test(scanContent)) score += 2;
  if (/\berror TS\d+:/m.test(scanContent) || /^\s*error(\[[^\]]+\])?:/im.test(scanContent)) score += 2;
  if (/^\s*File\s+"[^"]+",\s+line\s+\d+/m.test(scanContent) || /^\w+(Error|Exception):\s+/m.test(scanContent)) score += 2;
  if (/^\s*at\s+.+:\d+:\d+/m.test(scanContent) || /^\s*at\s+.+\(.+:\d+:\d+\)/m.test(scanContent)) score += 2;
  if (/^\s*\d+:\d+\s+error\s{2,}.+/m.test(scanContent) || /^\s*\d+:\d+\s+warning\s{2,}.+/m.test(scanContent)) score += 2;
  if (/^\s*(Test Suites:|Tests:|Snapshots:|Time:|Ran all test suites)/m.test(scanContent)) score += 1;
  if (/^\s*[×✕]\s+/m.test(scanContent) || /^\s*>\s+.+$/m.test(scanContent)) score += 1;
  if (/^\s*npm ERR!/m.test(scanContent) || /^\s*error Command failed/m.test(scanContent)) score += 1;
  if (hasRepeatedDiagnosticLines(lines)) score += 1;
  if (hasMultipleFileLocationDiagnostics(scanContent)) score += 1;

  return score >= 3;
}

// This function and its helpers below (collapseSourceExcerptNoise,
// collapseSimilarDiagnosticLines, collapseDuplicateLines,
// collapseLongStackTraces, getNormalizedDiagnosticKey, getDiagnosticLocation,
// hasRepeatedDiagnosticLines, hasMultipleFileLocationDiagnostics) are
// intentionally kept in lockstep with DebugOutputCompressor in
// src/optimizer/compressors/debug-output.ts — same duplication-is-necessary
// reason as MAX_LINE_LENGTH_FOR_SCAN above (the hook can't import from
// src/). Edit both together; a fix applied to only one (e.g. the
// omitted-line marker or the location-preserving dedup key) will silently
// diverge otherwise.
function compressDebugOutput(content) {
  let result = content;

  result = result.replace(/\n{3,}/g, '\n\n');
  result = collapseSourceExcerptNoise(result);
  // Drop pointer-only lines (lines that are nothing but ^^^ / ~~~ carets
  // and whitespace). This is the one collapse step with NO omission marker,
  // and deliberately so: a caret line has zero semantic payload — it's a
  // visual underline of the line above, which is itself preserved — so
  // there is no information to signal was lost, unlike the content-bearing
  // drops (source excerpts, repeated diagnostics, stack frames) that all
  // emit a `[toonify] ...` marker.
  //
  // Regression: this pointer-line regex is the same
  // ambiguous-character-class ReDoS this file fixed in detection, but this
  // call runs on full, uncapped content. Verified live: a 4-line payload
  // scoring >= 3 plus one 150,000-space line took the real hook 15s here.
  // Test capLine(line) (no-ops for any real pointer line, which is
  // always short) rather than `line` — the FILTER decision still applies to
  // the real, uncapped line, so no content is truncated; only what the
  // vulnerable regex sees is bounded.
  result = result
    .split('\n')
    .filter(line => !/^\s*[|]?\s*(\^+|~+)\s*$/.test(capLine(line)))
    .join('\n');
  result = collapseSimilarDiagnosticLines(result);
  result = collapseDuplicateLines(result);
  result = collapseLongStackTraces(result);

  return result.split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function hasRepeatedDiagnosticLines(lines) {
  const counts = new Map();

  for (const line of lines) {
    const normalized = line.trim().replace(/\d+/g, '#').replace(/\s+/g, ' ');
    if (normalized.length < 12) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  for (const count of counts.values()) {
    if (count >= 2) return true;
  }

  return false;
}

function hasMultipleFileLocationDiagnostics(content) {
  const locationMatches = content.match(/\b[\w./-]+\.(ts|tsx|js|jsx|py|go|php):\d+:\d+\b/g) || [];
  const tracebackMatches = content.match(/^\s*File\s+"[^"]+",\s+line\s+\d+/gm) || [];
  return locationMatches.length >= 2 || tracebackMatches.length >= 2;
}

function collapseSourceExcerptNoise(content) {
  const lines = content.split('\n');
  const result = [];
  let omitted = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const nextTrimmed = lines[i + 1]?.trimStart() || '';

    if (/^\s*\d+\s+\|/.test(trimmed)) { omitted++; continue; }
    // Same ReDoS-vulnerable pointer-line regex as compressDebugOutput's
    // filter above — test the capped form for the same reason (a real
    // pointer line is always short, so this never changes behavior for
    // legitimate content, only defuses an unbounded nextTrimmed).
    if (/^\d+\s{2,}\S/.test(trimmed) && /^\s*[|]?\s*(\^+|~+)\s*$/.test(capLine(nextTrimmed))) { omitted++; continue; }

    result.push(lines[i]);
  }

  // One summary marker for the whole document rather than one per drop
  // cluster — these lines duplicate the file:line:col already stated in
  // the diagnostic header above them, so per-cluster markers would often
  // cost more text than the noise they replace. The point is to avoid a
  // *zero*-indication silent drop, not to preserve per-line detail here.
  if (omitted > 0) {
    result.push(`[toonify] ${omitted} source excerpt line${omitted > 1 ? 's' : ''} omitted throughout`);
  }

  return result.join('\n');
}

function collapseSimilarDiagnosticLines(content) {
  const lines = content.split('\n');
  const result = [];

  let i = 0;
  while (i < lines.length) {
    const key = getNormalizedDiagnosticKey(lines[i]);
    if (!key) {
      result.push(lines[i]);
      i++;
      continue;
    }

    let repeatCount = 1;
    const otherLocations = [];
    let j = i + 1;
    let separatorCount = 0;

    while (j < lines.length) {
      if (lines[j].trim() === '') {
        separatorCount++;
        j++;
        continue;
      }

      const nextKey = getNormalizedDiagnosticKey(lines[j]);
      if (nextKey === key && separatorCount <= 2) {
        repeatCount++;
        const loc = getDiagnosticLocation(lines[j]);
        if (loc) otherLocations.push(loc);
        separatorCount = 0;
        j++;
        continue;
      }

      break;
    }

    result.push(lines[i]);
    if (repeatCount > 1) {
      const suffix = otherLocations.length > 0 ? ` (also at ${otherLocations.join(', ')})` : '';
      result.push(`[toonify] similar diagnostic repeated ${repeatCount - 1} more time${repeatCount > 2 ? 's' : ''}${suffix}`);
    }

    if (j < lines.length && result[result.length - 1] !== '' && lines[j - 1]?.trim() === '') {
      result.push('');
    }

    i = j;
  }

  return result.join('\n');
}

function collapseDuplicateLines(content) {
  const lines = content.split('\n');
  const result = [];

  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    let count = 1;

    while (i + count < lines.length && lines[i + count] === current) {
      count++;
    }

    result.push(current);
    if (count > 1) {
      result.push(`[toonify] repeated ${count - 1} more time${count > 2 ? 's' : ''}`);
    }

    i += count;
  }

  return result.join('\n');
}

function collapseLongStackTraces(content) {
  const lines = content.split('\n');
  const result = [];

  let i = 0;
  while (i < lines.length) {
    if (!isStackFrame(lines[i])) {
      result.push(lines[i]);
      i++;
      continue;
    }

    const frames = [];
    while (i < lines.length && isStackFrame(lines[i])) {
      frames.push(lines[i]);
      i++;
    }

    if (frames.length <= 5) {
      result.push(...frames);
      continue;
    }

    result.push(...frames.slice(0, 4));
    result.push(`[toonify] ${frames.length - 5} more stack frame${frames.length - 5 > 1 ? 's' : ''} omitted`);
    result.push(frames[frames.length - 1]);
  }

  return result.join('\n');
}

function isStackFrame(line) {
  const trimmed = line.trimStart();
  return /^at\s+.+/.test(trimmed) || /^File\s+"[^"]+",\s+line\s+\d+/.test(trimmed);
}

function getNormalizedDiagnosticKey(line) {
  const trimmed = line.trim();

  const tscMatch = trimmed.match(/^([\w./-]+\.[A-Za-z0-9]+:\d+:\d+)\s+-\s+(error|warning)\s+([A-Z]+\d+):\s+(.+)$/);
  if (tscMatch) {
    return `tsc:${tscMatch[2]}:${tscMatch[3]}:${tscMatch[4].replace(/\s+/g, ' ')}`;
  }

  const eslintMatch = trimmed.match(/^(\d+:\d+)\s+(error|warning)\s+(.+?)\s{2,}(@[^\s]+\/[^\s]+|[^\s]+)$/);
  if (eslintMatch) {
    return `lint:${eslintMatch[2]}:${eslintMatch[3].replace(/\s+/g, ' ')}:${eslintMatch[4]}`;
  }

  return null;
}

// Location this diagnostic line refers to (file:line:col for tsc, line:col
// for eslint), used only to avoid silently dropping WHERE collapsed
// occurrences were, not for the dedup key itself — grouping by location
// would defeat collapsing genuinely repeated diagnostics.
function getDiagnosticLocation(line) {
  const trimmed = line.trim();

  const tscMatch = trimmed.match(/^([\w./-]+\.[A-Za-z0-9]+:\d+:\d+)\s+-\s+(error|warning)\s+[A-Z]+\d+:/);
  if (tscMatch) return tscMatch[1];

  const eslintMatch = trimmed.match(/^(\d+:\d+)\s+(error|warning)\s+/);
  if (eslintMatch) return eslintMatch[1];

  return null;
}

// --- Rough Token Estimation ---

function estimateTokens(text) {
  // ~4 characters per token for English, conservative estimate
  return Math.ceil(text.length / 4);
}

// --- Tool Response Shape Adapters ---
//
// tool_response is NOT a plain string for the tools this hook matches — it
// is a structured object whose shape is specific to the tool (Zod-validated
// by Claude Code, undocumented in any public API reference). Two
// independent verification methods were used, both reproducible by anyone
// with a local Claude Code install:
//
//   Read:     { type, file: { filePath, content, numLines, startLine, totalLines } }
//   WebFetch: { bytes, code, codeText, result, durationMs, url }
//     — verified by RUNTIME OBSERVATION: registered this hook via a real
//     Claude Code session's .claude/settings.json and read the literal
//     stdin bytes the hook actually received.
//
//   Grep: { mode?: 'content'|'files_with_matches'|'count' (default
//     'files_with_matches'), numFiles, filenames, content?, numLines?,
//     numMatches?, totalFiles?, totalLines?, appliedLimit?, appliedOffset? }
//   Glob: { durationMs, numFiles, filenames, truncated, totalMatches?,
//     countIsComplete? }
//     — verified by SOURCE INSPECTION: `strings -a <path to the installed
//     claude binary>` (e.g. ~/.local/share/claude/versions/<version> on
//     macOS) contains the literal Zod schema source for both tools'
//     outputSchema, plus the CLI's own result-rendering functions, which
//     confirm `content` is used for 'content' mode (paired with `numLines`,
//     labeled "lines") and 'count' mode (paired with `numMatches`/
//     `numFiles`, labeled "matches"/"files") but not for the default
//     'files_with_matches' mode, which renders `filenames` directly with no
//     `content` field populated. A prior version of this file's Grep
//     adapter was built on an unverifiable secondhand claim of live
//     capture and was retracted; this one is built on grep-able schema
//     source in the shipped binary, not a report of having looked at it.
//     Glob's schema confirms it has no adapter-worthy field: filenames is
//     an array of strings (TOON's advantage is collapsing REPEATED OBJECT
//     KEYS, which doesn't apply to an array of bare strings), and every
//     other field is a number/boolean.
//
// extractText() returns null for anything it cannot positively identify;
// the caller passes through unchanged rather than risk sending Claude Code
// a malformed updatedToolOutput.
//
// Each recognized shape returns { text, reconstruct(compressedText) }:
// `text` is what gets fed into detection/compression, and reconstruct()
// rebuilds a Zod-shape-compatible object with ONLY the text field replaced
// so updatedToolOutput can genuinely shrink context instead of only
// appending to it.
//
// The tools whose text output this hook is verified to compress safely. Both
// the object path (extractText below) and the string path (see main()) gate
// on this set — we only ever REPLACE a tool's result for a tool we've
// validated, never for an arbitrary/unmatched/MCP tool whose result shape or
// meaning we don't understand.
const TEXT_TOOLS = new Set(['Read', 'WebFetch', 'Grep']);

function extractText(toolName, toolResponse) {
  if (toolResponse === null || typeof toolResponse !== 'object') return null;
  if (!TEXT_TOOLS.has(toolName)) return null;

  if (toolName === 'Read') {
    const file = toolResponse.file;
    if (!file || typeof file.content !== 'string') return null;
    return {
      text: file.content,
      reconstruct(compressedText) {
        const newLineCount = compressedText.length === 0 ? 0 : compressedText.split('\n').length;
        // numLines always tracks what's actually in `content` — a stale
        // count would tell Claude something isn't there that is.
        // totalLines: a full-file read has numLines === totalLines in the
        // original response (verified live), signaling "this is everything,
        // nothing more to page in". That invariant must survive compression
        // or Claude may think there's more file left to read via
        // offset/limit when it already has all of it, just compressed. A
        // genuinely partial read (numLines < totalLines) keeps totalLines
        // as the true file size, since compression doesn't change how long
        // the underlying file is.
        const wasFullRead = file.numLines === file.totalLines;
        return {
          ...toolResponse,
          file: {
            ...file,
            content: compressedText,
            numLines: newLineCount,
            totalLines: wasFullRead ? newLineCount : file.totalLines,
          },
        };
      },
    };
  }

  if (toolName === 'WebFetch') {
    if (typeof toolResponse.result !== 'string') return null;
    return {
      text: toolResponse.result,
      reconstruct(compressedText) {
        return { ...toolResponse, result: compressedText };
      },
    };
  }

  if (toolName === 'Grep') {
    // `content` is absent for the default 'files_with_matches' mode
    // (schema-optional, and the CLI's own rendering logic never populates
    // it for that mode) — the type check is what actually gates this, mode
    // is not checked directly, since a future schema addition to
    // 'files_with_matches' would still be safe to compress if it ever gets
    // a content field, and there's no risk in being permissive here: the
    // check itself is the safety gate.
    //
    // Match-enumeration fidelity ('content' mode returns the lines Claude
    // searched for, where completeness matters): considered and verified as
    // safe. Compression only ever fires when content scores >= 3 on the
    // DEBUG heuristics, i.e. the grep results themselves look like build/
    // test output. collapseSimilarDiagnosticLines preserves every collapsed
    // location via its "(also at ...)" suffix. collapseDuplicateLines only
    // collapses BYTE-IDENTICAL lines — with grep's default `-n` (line
    // numbers on) or multi-file output, matched lines carry distinct
    // prefixes and never collapse (verified: they pass through untouched);
    // the only lines that do collapse are byte-identical ones, which by
    // definition hold no per-match distinguishing info to lose, and the
    // "repeated N more times" marker preserves their multiplicity. So no
    // enumeration is silently lost.
    if (typeof toolResponse.content !== 'string') return null;
    return {
      text: toolResponse.content,
      reconstruct(compressedText) {
        // numLines is only meaningfully tied to `content`'s line count in
        // 'content' mode (the CLI labels it "lines" there); only recompute
        // it if it was already present, never fabricate a field the
        // original response didn't have.
        const patch = { content: compressedText };
        if (typeof toolResponse.numLines === 'number') {
          patch.numLines = compressedText.length === 0 ? 0 : compressedText.split('\n').length;
        }
        return { ...toolResponse, ...patch };
      },
    };
  }

  // Glob: no adapter — see the comment above this function.
  return null;
}

// --- Main ---

async function main() {
  let inputData = '';

  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  try {
    const hookInput = JSON.parse(inputData);
    const { tool_name, tool_response } = hookInput;

    if (!tool_response) {
      return passthrough();
    }

    // Both paths yield a reconstruct(compressedText) that produces a
    // schema-valid REPLACEMENT for tool_response, so the compressed content
    // always goes out via updatedToolOutput (which replaces what Claude
    // sees, actually shrinking context) — never additionalContext (which
    // appends, growing it).
    //
    // - Object tool_response (Read/WebFetch/Grep in current Claude Code):
    //   extractText() pulls the text field out and its reconstruct() rebuilds
    //   the object with only that field replaced. An unrecognized object
    //   (Grep files_with_matches, Glob, an unmatched tool) has no safe text
    //   field, so extractText returns null and we pass through.
    //
    // - String tool_response (from a TEXT_TOOLS tool only): the compressed
    //   string is itself the replacement — reconstruct is the identity. This
    //   is the inverse of the earlier verified failure (a bare string was
    //   rejected for Read *because Read's schema is an object*; here the tool
    //   produced a string, so a string replacement matches). Claude Code
    //   accepts an updatedToolOutput through TWO gates (verified against the
    //   binary): the tool's output-schema `safeParse`, AND a result-mapper
    //   that must not throw/return undefined; when a tool has no output
    //   schema the mapper is the only gate, and MCP tools skip schema
    //   validation entirely. So the string branch is gated to TEXT_TOOLS —
    //   the exact tools whose result shape and text semantics we've verified
    //   — never an arbitrary/MCP/unmatched tool whose only copy of its output
    //   we'd otherwise replace with a lossy compressed view. Note: no current
    //   Claude Code tool sends a bare string for these tools (Read/Grep/
    //   WebFetch all send objects — probed live), so this is a
    //   forward/backward-compat path; it replaces rather than appends so that
    //   IF it ever fires, it saves tokens instead of growing context.
    let contentText;
    let reconstruct;
    if (typeof tool_response === 'string') {
      if (!TEXT_TOOLS.has(tool_name)) return passthrough();
      contentText = tool_response;
      reconstruct = (compressedText) => compressedText;
    } else {
      const extracted = extractText(tool_name, tool_response);
      if (!extracted) return passthrough();
      contentText = extracted.text;
      reconstruct = extracted.reconstruct;
    }

    if (!contentText || contentText.length < 50) {
      return passthrough();
    }

    // Size ceiling before JSON.parse/yamlParse/detection — see MAX_CONTENT_SIZE.
    if (contentText.length > MAX_CONTENT_SIZE) {
      return passthrough();
    }

    const config = loadConfig();

    // Skip if disabled
    if (!config.enabled) {
      return passthrough();
    }

    // Skip if tool matches skip patterns
    if (config.skipToolPatterns.some(pattern => {
      try {
        return new RegExp(pattern).test(tool_name);
      } catch {
        return tool_name === pattern;
      }
    })) {
      return passthrough();
    }

    // Check minimum size
    const estimatedTokens = estimateTokens(contentText);
    if (estimatedTokens < config.minTokensThreshold) {
      return passthrough();
    }

    // Detect structured data
    const structured = detectStructuredData(contentText);

    let output;

    if (structured) {
      // Structured data → TOON format
      const toonContent = toonEncode(structured.data);
      const savingsPercent = ((contentText.length - toonContent.length) / contentText.length) * 100;

      if (savingsPercent < config.minSavingsThreshold) {
        return passthrough();
      }

      output = `[TOON-${structured.type.toUpperCase()}]\n${toonContent}`;
    } else {
      // Source code is intentionally not compressed — anything that is not
      // structured data or debug output passes through untouched.
      if (!detectDebugOutput(contentText)) {
        return passthrough();
      }

      const compressed = compressDebugOutput(contentText);
      const savingsPercent = ((contentText.length - compressed.length) / contentText.length) * 100;

      if (savingsPercent < 10) {
        return passthrough();
      }

      output = compressed;
    }

    // Always emit via updatedToolOutput (REPLACE), never additionalContext
    // (APPEND). additionalContext is purely additive — verified live against
    // a real Claude Code session that `suppressOutput: true` does NOT hide
    // the original tool result, so Claude would see the full original PLUS
    // the appended copy, GROWING total context: the exact opposite of this
    // tool's purpose. reconstruct() (identity for a string tool_response,
    // field-swap for an object one) produces a schema-valid replacement, so
    // updatedToolOutput actually shrinks what Claude sees.
    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: reconstruct(output),
      },
    }));
  } catch (error) {
    // Silent failure - never break the workflow
    // Log to stderr for debugging (Claude Code shows stderr in verbose mode)
    console.error('[toonify-hook] Error:', error?.message || error);
    return passthrough();
  }
}

function passthrough() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

// Set encoding and run
process.stdin.setEncoding('utf8');
main().catch(() => passthrough());
