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
class ToonifyHook {
    config;
    encoder;
    logFile;
    constructor() {
        this.logFile = path.join(os.homedir(), '.claude', 'toonify-hook.log');
        this.log('=== Hook Started ===');
        this.config = this.loadConfig();
        this.encoder = encoding_for_model('gpt-4');
    }
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = data
            ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
            : `[${timestamp}] ${message}\n`;
        try {
            fs.appendFileSync(this.logFile, logEntry);
        } catch (e) {
            // Silent fail for logging
        }
    }
    loadConfig() {
        const configPath = path.join(os.homedir(), '.claude', 'toonify-hook-config.json');
        const defaultConfig = {
            enabled: true,
            minTokensThreshold: 50,
            minSavingsThreshold: 30,
            skipToolPatterns: ['Bash', 'Write', 'Edit']
        };
        try {
            if (fs.existsSync(configPath)) {
                const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                const config = { ...defaultConfig, ...userConfig };
                this.log('Config loaded', config);
                return config;
            }
        }
        catch (error) {
            this.log('Config load error', { error: error.message });
            console.error('[Toonify Hook] Config load error:', error);
        }
        this.log('Using default config', defaultConfig);
        return defaultConfig;
    }
    shouldSkipTool(toolName) {
        return this.config.skipToolPatterns.some(pattern => toolName.toLowerCase().includes(pattern.toLowerCase()));
    }
    countTokens(text) {
        try {
            return this.encoder.encode(text).length;
        }
        catch (error) {
            return Math.ceil(text.length / 4);
        }
    }
    detectStructuredData(content) {
        try {
            const data = JSON.parse(content);
            if (typeof data === 'object' && data !== null) {
                return { type: 'json', data };
            }
        }
        catch { }
        try {
            const data = yaml.parse(content);
            if (typeof data === 'object' && data !== null && !content.includes(',')) {
                return { type: 'yaml', data };
            }
        }
        catch { }
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
                    }, {});
                });
                return { type: 'csv', data: rows };
            }
        }
        return null;
    }
    optimize(content) {
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
        }
        catch (error) {
            return { optimized: false, content };
        }
    }
    async process(input) {
        this.log('Processing tool', { toolName: input.toolName });
        if (this.shouldSkipTool(input.toolName)) {
            this.log('Tool skipped', { toolName: input.toolName });
            return input;
        }
        const processedContent = input.toolResult.content.map((block, index) => {
            if (block.type === 'text' && block.text) {
                this.log(`Processing block ${index}`, { textLength: block.text.length });
                const result = this.optimize(block.text);
                if (result.optimized && result.stats) {
                    this.log('Optimization successful', result.stats);
                    const notice = `\n\n[Token Optimization: ${result.stats.originalTokens} → ${result.stats.optimizedTokens} tokens (-${result.stats.savings}%)]`;
                    return {
                        ...block,
                        text: result.content + (process.env.TOONIFY_SHOW_STATS === 'true' ? notice : '')
                    };
                } else {
                    this.log('Optimization skipped', { reason: 'Did not meet criteria' });
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
    const logFile = path.join(os.homedir(), '.claude', 'toonify-hook.log');
    const log = (msg, data = null) => {
        const timestamp = new Date().toISOString();
        const entry = data
            ? `[${timestamp}] ${msg}\n${JSON.stringify(data, null, 2)}\n`
            : `[${timestamp}] ${msg}\n`;
        try {
            fs.appendFileSync(logFile, entry);
        } catch (e) {}
    };

    try {
        log('=== main() Started ===');
        const stdin = await new Promise((resolve) => {
            const chunks = [];
            process.stdin.on('data', chunk => chunks.push(chunk));
            process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });
        log('Stdin received', { length: stdin.length });
        const input = JSON.parse(stdin);
        log('Input parsed', { toolName: input.toolName });
        const hook = new ToonifyHook();
        const output = await hook.process(input);
        log('Processing complete');
        process.stdout.write(JSON.stringify(output, null, 2));
        process.exit(0);
    }
    catch (error) {
        log('Error in main()', { error: error.message, stack: error.stack });
        process.stdout.write(process.stdin.read());
        process.exit(0);
    }
}
main();
