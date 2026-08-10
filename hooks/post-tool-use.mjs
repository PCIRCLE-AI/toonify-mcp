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

function detectDebugOutput(content) {
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

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const nextTrimmed = lines[i + 1]?.trimStart() || '';

    if (/^\s*\d+\s+\|/.test(trimmed)) continue;
    if (/^\d+\s{2,}\S/.test(trimmed) && /^\s*[|]?\s*(\^+|~+)\s*$/.test(nextTrimmed)) continue;

    result.push(lines[i]);
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
        separatorCount = 0;
        j++;
        continue;
      }

      break;
    }

    result.push(lines[i]);
    if (repeatCount > 1) {
      result.push(`[toonify] similar diagnostic repeated ${repeatCount - 1} more time${repeatCount > 2 ? 's' : ''}`);
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

  const tscMatch = trimmed.match(/^[\w./-]+\.[A-Za-z0-9]+:\d+:\d+\s+-\s+(error|warning)\s+([A-Z]+\d+):\s+(.+)$/);
  if (tscMatch) {
    return `tsc:${tscMatch[1]}:${tscMatch[2]}:${tscMatch[3].replace(/\s+/g, ' ')}`;
  }

  const eslintMatch = trimmed.match(/^\d+:\d+\s+(error|warning)\s+(.+?)\s{2,}(@[^\s]+\/[^\s]+|[^\s]+)$/);
  if (eslintMatch) {
    return `lint:${eslintMatch[1]}:${eslintMatch[2].replace(/\s+/g, ' ')}:${eslintMatch[3]}`;
  }

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

    // Return optimized content. `updatedToolOutput` REPLACES the tool result
    // Claude sees (Claude Code v2.1.121+, all built-in tools). Do not switch
    // this to an append-only hookSpecificOutput field — appending after the
    // original tool result means the model receives both the full original
    // content AND the compressed copy, growing context instead of shrinking
    // it (this is what the hook did before this fix).
    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: output,
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
