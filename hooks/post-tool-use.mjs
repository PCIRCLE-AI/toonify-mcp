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
  showStats: false,
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
  if (process.env.TOONIFY_SHOW_STATS !== undefined) {
    envConfig.showStats = process.env.TOONIFY_SHOW_STATS === 'true';
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

// --- Source Code Guard ---
//
// Used ONLY to gate debug-output detection, never to route to a compressor.
// Real source code can score >= 3 on detectDebugOutput's heuristics — e.g. a
// file with several near-identical `throw new Error("FAIL: ...")` lines
// legitimately contains "FAIL" and repeated near-duplicate lines. Without
// this guard, compressDebugOutput() would run collapseDuplicateLines() /
// collapseSourceExcerptNoise() on that source and hand back something like
// `[toonify] repeated 4 more times` spliced into an array literal — a
// misleading, corrupted view of a real file appended alongside the
// original via additionalContext. Mirrors the ordering in
// src/optimizer/pipeline/detector.ts, where code is detected before debug
// output for exactly this reason.
function looksLikeSourceCode(content) {
  const lines = content.split('\n');
  if (lines.length < 3) return false;
  const sample = lines.slice(0, 50).join('\n');

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

  return false;
}

function detectDebugOutput(content) {
  if (looksLikeSourceCode(content)) return false;

  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 4) return false;

  let score = 0;

  if (/\b(FAIL|FAILURES?|AssertionError|Traceback|Caused by:|UnhandledPromiseRejection)\b/m.test(content)) score += 2;
  if (/\berror TS\d+:/m.test(content) || /^\s*error(\[[^\]]+\])?:/im.test(content)) score += 2;
  if (/^\s*File\s+"[^"]+",\s+line\s+\d+/m.test(content) || /^\w+(Error|Exception):\s+/m.test(content)) score += 2;
  if (/^\s*at\s+.+:\d+:\d+/m.test(content) || /^\s*at\s+.+\(.+:\d+:\d+\)/m.test(content)) score += 2;
  if (/^\s*\d+:\d+\s+error\s{2,}.+/m.test(content) || /^\s*\d+:\d+\s+warning\s{2,}.+/m.test(content)) score += 2;
  if (/^\s*(Test Suites:|Tests:|Snapshots:|Time:|Ran all test suites)/m.test(content)) score += 1;
  if (/^\s*[×✕]\s+/m.test(content) || /^\s*>\s+.+$/m.test(content)) score += 1;
  if (/^\s*npm ERR!/m.test(content) || /^\s*error Command failed/m.test(content)) score += 1;
  if (hasRepeatedDiagnosticLines(lines)) score += 1;
  if (hasMultipleFileLocationDiagnostics(content)) score += 1;

  return score >= 3;
}

function compressDebugOutput(content) {
  let result = content;

  result = result.replace(/\n{3,}/g, '\n\n');
  result = collapseSourceExcerptNoise(result);
  result = result
    .split('\n')
    .filter(line => !/^\s*[|]?\s*(\^+|~+)\s*$/.test(line))
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
    if (/^\d+\s{2,}\S/.test(trimmed) && /^\s*[|]?\s*(\^+|~+)\s*$/.test(nextTrimmed)) { omitted++; continue; }

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

// --- Main ---

async function main() {
  let inputData = '';

  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  try {
    const hookInput = JSON.parse(inputData);
    const { tool_name, tool_response } = hookInput;

    // Skip if no response or empty
    if (!tool_response || typeof tool_response !== 'string' || tool_response.length < 50) {
      return passthrough();
    }

    // Size ceiling before JSON.parse/yamlParse/detection — see MAX_CONTENT_SIZE.
    if (tool_response.length > MAX_CONTENT_SIZE) {
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
    const estimatedTokens = estimateTokens(tool_response);
    if (estimatedTokens < config.minTokensThreshold) {
      return passthrough();
    }

    // Detect structured data
    const structured = detectStructuredData(tool_response);

    let output;
    let formatLabel;
    let savingsPercent;

    if (structured) {
      // Structured data → TOON format
      const toonContent = toonEncode(structured.data);
      const originalLen = tool_response.length;
      const optimizedLen = toonContent.length;
      savingsPercent = ((originalLen - optimizedLen) / originalLen) * 100;

      if (savingsPercent < config.minSavingsThreshold) {
        return passthrough();
      }

      formatLabel = structured.type.toUpperCase();
      output = `[TOON-${formatLabel}]\n${toonContent}`;
    } else {
      // Source code is intentionally not compressed — anything that is not
      // structured data or debug output passes through untouched.
      if (!detectDebugOutput(tool_response)) {
        return passthrough();
      }

      const compressed = compressDebugOutput(tool_response);
      const originalLen = tool_response.length;
      const compressedLen = compressed.length;
      savingsPercent = ((originalLen - compressedLen) / originalLen) * 100;

      if (savingsPercent < 10) {
        return passthrough();
      }

      formatLabel = 'DEBUG';
      output = compressed;
    }

    if (config.showStats) {
      output += `\n\n--- Toonify: ${formatLabel} optimized, ~${savingsPercent.toFixed(0)}% smaller ---`;
    }

    // Return optimized content via additionalContext, not updatedToolOutput.
    //
    // updatedToolOutput REPLACES the tool result Claude sees and is the
    // right field in principle (Claude Code v2.1.121+), but it requires the
    // value to match the tool's own structured output shape — a plain
    // string is schema-invalid. Verified live against Claude Code v2.1.226:
    // Read's tool_response is an object ({type, file:{filePath, content,
    // ...}}), not a string, so this hook's own entry gate
    // (`typeof tool_response !== 'string'`, see main()) has always
    // short-circuited to passthrough for Read/Grep/Glob/WebFetch before
    // this code path is ever reached. Bypassing that gate to test
    // updatedToolOutput directly, Claude Code's Zod validation rejected a
    // bare string for Read with `invalid_type: expected object, received
    // string` and fell back to the original content. Switching to
    // updatedToolOutput needs per-tool response reconstruction (replace
    // just the text field, keep the rest of the object) against currently
    // undocumented internal schemas — real follow-up work, not a one-line
    // field rename. additionalContext appends after the original result
    // (so context grows, not shrinks) but is schema-valid and actually
    // reaches Claude today.
    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: output,
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
