/**
 * `toonify-mcp compress` — stdin→stdout compression filter.
 *
 * Pipes command output through the same detect→compress pipeline the plugin
 * hook uses (JSON/YAML → TOON, repetitive debug output → collapsed, source
 * code and prose passed through untouched, numeric-fidelity guarded), so any
 * agent CLI can shrink tool output BEFORE it enters the model's context:
 *
 *   curl -s https://api.example.com/users | toonify-mcp compress
 *
 * Uses the Pipeline directly rather than TokenOptimizer: the optimizer wraps
 * structured results in an MCP-oriented `[SYSTEM] Token-Optimized Data ...`
 * caching preamble, which in a raw pipe is framing noise that costs tokens.
 * The registration below (Toon + DebugOutput, deliberately no CodeCompressor)
 * mirrors TokenOptimizer's — keep them in sync.
 *
 * Contract: always exits 0 and always writes something — the original input
 * verbatim whenever compression doesn't apply — so inserting the filter into
 * a pipe can never break the pipe or lose data. Errors go to stderr only.
 */

import { Pipeline } from '../optimizer/pipeline/pipeline.js';
import { ToonCompressor } from '../optimizer/compressors/toon.js';
import { DebugOutputCompressor } from '../optimizer/compressors/debug-output.js';
import { MultilingualTokenizer } from '../optimizer/multilingual/index.js';

/** Same DoS ceiling as the hook and TokenOptimizer (10 MB). */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/** Same default savings floor as the hook — below this, compression isn't worth the reshaping. */
const MIN_SAVINGS_PERCENT = 30;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function runCompress(): Promise<number> {
  let input: string;
  try {
    input = await readStdin();
  } catch (error) {
    console.error('[toonify-mcp compress] failed to read stdin:', (error as Error).message);
    return 0;
  }

  if (input.length === 0) {
    return 0;
  }

  if (input.length > MAX_CONTENT_SIZE) {
    process.stdout.write(input);
    return 0;
  }

  try {
    let tokenizer: MultilingualTokenizer;
    try {
      tokenizer = new MultilingualTokenizer('gpt-4', true);
    } catch {
      tokenizer = new MultilingualTokenizer('gpt-4', false);
    }
    const pipeline = new Pipeline(tokenizer);
    pipeline.register(new ToonCompressor());
    pipeline.register(new DebugOutputCompressor());

    const result = pipeline.run(input, MIN_SAVINGS_PERCENT);
    process.stdout.write(result.optimized ? result.content : input);
  } catch (error) {
    // Never lose the data: on any failure the filter degrades to `cat`.
    console.error('[toonify-mcp compress] compression failed, passing through:', (error as Error).message);
    process.stdout.write(input);
  }

  return 0;
}
