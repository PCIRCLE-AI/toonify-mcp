#!/usr/bin/env node

/**
 * Toonify PostToolUse Hook
 *
 * Intercepts tool results from Read, Grep, Glob, WebFetch and
 * converts structured data (JSON/CSV/YAML) to TOON format to
 * reduce token usage by 30-65%.
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
    if (!structured) {
      return passthrough();
    }

    // Convert to TOON format
    const toonContent = toonEncode(structured.data);

    // Calculate savings
    const originalLen = tool_response.length;
    const optimizedLen = toonContent.length;
    const savingsPercent = ((originalLen - optimizedLen) / originalLen) * 100;

    // Skip if savings too low
    if (savingsPercent < config.minSavingsThreshold) {
      return passthrough();
    }

    // Build optimized output
    const header = `[TOON-${structured.type.toUpperCase()}]`;
    let output = `${header}\n${toonContent}`;

    if (config.showStats) {
      output += `\n\n--- Toonify: ${structured.type.toUpperCase()} optimized, ~${savingsPercent.toFixed(0)}% smaller ---`;
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
