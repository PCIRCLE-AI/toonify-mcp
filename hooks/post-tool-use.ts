#!/usr/bin/env node
/**
 * Claude Code PostToolUse Hook for Automatic Toonify Optimization
 */

import { encode as toonEncode } from '@toon-format/toon';
import { encoding_for_model } from 'tiktoken';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface HookInput {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult: {
    content: Array<{ type: string; text?: string }>;
  };
}

interface OptimizationConfig {
  enabled: boolean;
  minTokensThreshold: number;
  minSavingsThreshold: number;
  skipToolPatterns: string[];
}

class ToonifyHook {
  private config: OptimizationConfig;
  private encoder;

  constructor() {
    this.config = this.loadConfig();
    this.encoder = encoding_for_model('gpt-4');
  }

  private loadConfig(): OptimizationConfig {
    const configPath = path.join(os.homedir(), '.claude', 'toonify-hook-config.json');
    const defaultConfig: OptimizationConfig = {
      enabled: true,
      minTokensThreshold: 50,
      minSavingsThreshold: 30,
      skipToolPatterns: ['Bash', 'Write', 'Edit']
    };

    try {
      if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ...defaultConfig, ...userConfig };
      }
    } catch (error) {
      console.error('[Toonify Hook] Config load error:', error);
    }

    return defaultConfig;
  }

  private shouldSkipTool(toolName: string): boolean {
    return this.config.skipToolPatterns.some(pattern =>
      toolName.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private countTokens(text: string): number {
    try {
      return this.encoder.encode(text).length;
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }

  private detectStructuredData(content: string): { type: 'json' | 'csv' | 'yaml'; data: any } | null {
    try {
      const data = JSON.parse(content);
      if (typeof data === 'object' && data !== null) {
        return { type: 'json', data };
      }
    } catch {}

    try {
      const data = yaml.parse(content);
      if (typeof data === 'object' && data !== null && !content.includes(',')) {
        return { type: 'yaml', data };
      }
    } catch {}

    const lines = content.trim().split('\n');
    if (lines.length > 1) {
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      const columnCount = firstLine.split(delimiter).length;

      if (columnCount > 1 && lines.every(line => line.split(delimiter).length === columnCount)) {
        const headers = firstLine.split(delimiter);
        const rows = lines.slice(1).map(line => {
          const values = line.split(delimiter);
          return headers.reduce((obj, header, i) => {
            obj[header.trim()] = values[i]?.trim() || '';
            return obj;
          }, {} as Record<string, string>);
        });
        return { type: 'csv', data: rows };
      }
    }

    return null;
  }

  private optimize(content: string): { optimized: boolean; content: string; stats?: { originalTokens: number; optimizedTokens: number; savings: number } } {
    if (!this.config.enabled) {
      return { optimized: false, content };
    }

    const originalTokens = this.countTokens(content);
    if (originalTokens < this.config.minTokensThreshold) {
      return { optimized: false, content };
    }

    const structured = this.detectStructuredData(content);
    if (!structured) {
      return { optimized: false, content };
    }

    try {
      const toonContent = toonEncode(structured.data);
      const optimizedTokens = this.countTokens(toonContent);
      const savings = ((originalTokens - optimizedTokens) / originalTokens) * 100;

      if (savings < this.config.minSavingsThreshold) {
        return { optimized: false, content };
      }

      const optimizedContent = `[TOON-${structured.type.toUpperCase()}]\n${toonContent}`;

      return {
        optimized: true,
        content: optimizedContent,
        stats: {
          originalTokens,
          optimizedTokens,
          savings: Math.round(savings)
        }
      };
    } catch (error) {
      return { optimized: false, content };
    }
  }

  async process(input: HookInput): Promise<HookInput> {
    if (this.shouldSkipTool(input.toolName)) {
      return input;
    }

    const processedContent = input.toolResult.content.map(block => {
      if (block.type === 'text' && block.text) {
        const result = this.optimize(block.text);

        if (result.optimized && result.stats) {
          const notice = `\n\n[Token Optimization: ${result.stats.originalTokens} → ${result.stats.optimizedTokens} tokens (-${result.stats.savings}%)]`;
          return {
            ...block,
            text: result.content + (process.env.TOONIFY_SHOW_STATS === 'true' ? notice : '')
          };
        }

        return block;
      }
      return block;
    });

    return {
      ...input,
      toolResult: {
        ...input.toolResult,
        content: processedContent
      }
    };
  }
}

async function main() {
  let stdin = '';

  try {
    stdin = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      process.stdin.on('data', chunk => chunks.push(chunk));
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });

    const input: HookInput = JSON.parse(stdin);
    const hook = new ToonifyHook();
    const output = await hook.process(input);

    process.stdout.write(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('[Toonify Hook Error]:', error);
    // Write back original input if available (hook failed, pass through unchanged)
    if (stdin) {
      process.stdout.write(stdin);
    }
    process.exit(0);
  }
}

main();
