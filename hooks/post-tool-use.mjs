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

// --- Code Compression (lightweight, safe layers only) ---

function compressCode(content, codeType) {
  let result = content;

  // Layer 1: Merge consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Layer 2: Remove inline comments (not pure comment lines)
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

  // Layer 3: Remove comment-only lines (preserve TODO/FIXME and JSDoc first line)
  result = result.split('\n').filter((line, idx, arr) => {
    const trimmed = line.trimStart();
    if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(trimmed)) return true;
    if (trimmed.startsWith('/**')) return true; // JSDoc first line
    if (codeType === 'code-py' && trimmed.startsWith('#')) return false;
    if (codeType !== 'code-py' && trimmed.startsWith('//')) return false;
    return true;
  }).join('\n');

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

function findInlineHash(line) {
  let inString = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === inString && line[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") return -1;
      inString = ch;
      continue;
    }
    if (ch === '#') {
      const before = line.slice(0, i).trimEnd();
      if (before.length === 0) return -1; // Pure comment line
      return i;
    }
  }
  return -1;
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
