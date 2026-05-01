#!/usr/bin/env node

/**
 * Toonify PostToolUse Hook
 *
 * Intercepts tool results from Read, Grep, Glob, WebFetch and:
 * - Converts structured data (JSON/CSV/YAML) to TOON format (30-65% savings)
 * - Compresses source code (TS/Py/Go) by removing comments & blank lines (10-35% savings)
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

  // Try CSV (simple heuristic)
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length >= 3) {
    const firstCommas = (lines[0].match(/,/g) || []).length;
    if (firstCommas >= 1) {
      let matching = 0;
      for (let i = 1; i < Math.min(lines.length, 10); i++) {
        if ((lines[i].match(/,/g) || []).length === firstCommas) matching++;
      }
      if (matching >= Math.min(lines.length - 1, 5)) {
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i] || ''; });
          return obj;
        });
        return { type: 'csv', data: rows };
      }
    }
  }

  return null;
}

// --- Code Detection ---

function detectCode(content) {
  const lines = content.split('\n');
  if (lines.length < 5) return null;
  const sample = lines.slice(0, 50).join('\n');

  // TypeScript/JavaScript
  const tsIndicators = [
    /\bimport\s+.*\bfrom\s+['"]/,
    /\bexport\s+(default\s+)?(class|function|const|interface|type)\b/,
    /:\s*(string|number|boolean|void)\b/,
    /=>\s*[{(]/,
    /\binterface\s+\w+/,
    /\bconst\s+\w+\s*:\s*\w+/,
  ];
  if (tsIndicators.filter(p => p.test(sample)).length >= 2) return 'code-ts';

  // Python
  const pyIndicators = [
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+.*:/m,
    /^from\s+\w+\s+import\b/m,
    /^import\s+\w+/m,
    /^\s+self\./m,
    /:\s*$\n\s+/m,
  ];
  if (pyIndicators.filter(p => p.test(sample)).length >= 2) return 'code-py';

  // PHP
  const phpIndicators = [
    /^<\?php\b/m,
    /\bnamespace\s+[\w\\]+;/m,
    /\buse\s+[\w\\]+;/m,
    /\bfunction\s+\w+\s*\(/m,
    /\$this->/,
    /\bpublic\s+(static\s+)?(function|readonly)\b/m,
  ];
  if (phpIndicators.filter(p => p.test(sample)).length >= 2) return 'code-php';

  // Go
  const goIndicators = [
    /^package\s+\w+/m,
    /^func\s+/m,
    /\bfmt\.\w+/,
    /\b:=\s/,
    /\berr\s*!=\s*nil\b/,
  ];
  if (goIndicators.filter(p => p.test(sample)).length >= 2) return 'code-go';

  // Generic code
  const genericIndicators = [
    /[{}\[\]();]/,
    /\b(function|class|return|if|else|for|while)\b/,
    /\/\/.+$/m,
    /^\s{2,}\S/m,
  ];
  if (genericIndicators.filter(p => p.test(sample)).length >= 3) return 'code-generic';

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

// --- Code Compression (lightweight, safe layers only) ---

function compressCode(content, codeType) {
  let result = content;

  // Layer 1: Merge consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Layer 2: Remove inline comments (not pure comment lines)
  if (codeType === 'code-php') {
    const lines = [];
    let heredocTerminator = null;

    for (const line of result.split('\n')) {
      if (heredocTerminator) {
        lines.push(line);
        if (isPhpHeredocEnd(line, heredocTerminator)) heredocTerminator = null;
        continue;
      }

      const nextHeredocTerminator = getPhpHeredocTerminator(line);
      if (nextHeredocTerminator) {
        heredocTerminator = nextHeredocTerminator;
        lines.push(line);
        continue;
      }

      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
        lines.push(line);
        continue;
      }

      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        lines.push(line);
        continue;
      }
      if (/https?:\/\//.test(line)) {
        lines.push(line);
        continue;
      }

      const slashIdx = findInlineDoubleSlash(line);
      if (slashIdx > 0) {
        lines.push(line.slice(0, slashIdx).trimEnd());
        continue;
      }

      const hashIdx = findInlineHash(line, true);
      if (hashIdx > 0) {
        lines.push(line.slice(0, hashIdx).trimEnd());
        continue;
      }

      lines.push(line);
    }

    result = lines.join('\n');
  } else {
    result = result.split('\n').map(line => {
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) return line;
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) return line;
      if (/https?:\/\//.test(line)) return line;

      if (codeType === 'code-py') {
        // Python inline # (simple: split on first # not in string)
        const hashIdx = findInlineHash(line);
        if (hashIdx > 0) return line.slice(0, hashIdx).trimEnd();
      } else {
        // C-style inline // (simple: split on // not in string or URL)
        const slashIdx = findInlineDoubleSlash(line);
        if (slashIdx > 0) return line.slice(0, slashIdx).trimEnd();
      }
      return line;
    }).join('\n');
  }

  // Layer 3: Remove comment-only lines (preserve TODO/FIXME and JSDoc first line)
  if (codeType === 'code-php') {
    const lines = [];
    let heredocTerminator = null;

    for (const line of result.split('\n')) {
      const trimmed = line.trimStart();

      if (heredocTerminator) {
        lines.push(line);
        if (isPhpHeredocEnd(line, heredocTerminator)) heredocTerminator = null;
        continue;
      }

      const nextHeredocTerminator = getPhpHeredocTerminator(line);
      if (nextHeredocTerminator) {
        heredocTerminator = nextHeredocTerminator;
        lines.push(line);
        continue;
      }

      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(trimmed)) {
        lines.push(line);
        continue;
      }
      if (trimmed.startsWith('/**')) {
        lines.push(line);
        continue;
      }
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('#') && !trimmed.startsWith('#[')) continue;
      lines.push(line);
    }

    result = lines.join('\n');
  } else {
    result = result.split('\n').filter((line, idx, arr) => {
      const trimmed = line.trimStart();
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(trimmed)) return true;
      if (trimmed.startsWith('/**')) return true; // JSDoc first line
      if (codeType === 'code-py' && trimmed.startsWith('#')) return false;
      if (codeType !== 'code-py' && codeType !== 'code-php' && trimmed.startsWith('//')) return false;
      return true;
    }).join('\n');
  }

  // Layer 4: Shorten deep import paths
  if (codeType === 'code-ts' || codeType === 'code-generic') {
    result = result.replace(
      /(from\s+['"])(\.\.\/){2,}[^'"]*\/([^'"]+)(['"])/g,
      '$1…/$3$4'
    );
  }

  // Final cleanup
  result = result.split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

  return result;
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

function findInlineDoubleSlash(line) {
  let inString = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === inString && line[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '/' && line[i + 1] === '/') {
      const before = line.slice(0, i).trimEnd();
      if (before.length === 0) return -1; // Pure comment line
      return i;
    }
  }
  return -1;
}

function findInlineHash(line, preservePhpAttributeSyntax = false) {
  let inString = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === inString && line[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || (preservePhpAttributeSyntax && ch === '`')) {
      if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") return -1;
      inString = ch;
      continue;
    }
    if (ch === '#') {
      if (preservePhpAttributeSyntax && line[i + 1] === '[') continue;
      const before = line.slice(0, i).trimEnd();
      if (before.length === 0) return -1; // Pure comment line
      return i;
    }
  }
  return -1;
}

function getPhpHeredocTerminator(line) {
  const match = line.match(/<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[ \t]*$/);
  return match ? match[2] : null;
}

function isPhpHeredocEnd(line, terminator) {
  const escaped = terminator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped};?\\s*$`).test(line);
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
      const isDebugOutput = detectDebugOutput(tool_response);
      if (isDebugOutput) {
        const compressed = compressDebugOutput(tool_response);
        const originalLen = tool_response.length;
        const compressedLen = compressed.length;
        savingsPercent = ((originalLen - compressedLen) / originalLen) * 100;

        if (savingsPercent < 10) {
          return passthrough();
        }

        formatLabel = 'DEBUG';
        output = compressed;
      } else {
      // Try code detection + compression
        const codeType = detectCode(tool_response);
        if (!codeType) {
          return passthrough();
        }

        const compressed = compressCode(tool_response, codeType);
        const originalLen = tool_response.length;
        const compressedLen = compressed.length;
        savingsPercent = ((originalLen - compressedLen) / originalLen) * 100;

        // Code compression typically has lower savings — use lower threshold (10%)
        if (savingsPercent < 10) {
          return passthrough();
        }

        formatLabel = codeType.replace('code-', '').toUpperCase();
        output = compressed;
      }
    }

    if (config.showStats) {
      output += `\n\n--- Toonify: ${formatLabel} optimized, ~${savingsPercent.toFixed(0)}% smaller ---`;
    }

    // Return optimized content
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
