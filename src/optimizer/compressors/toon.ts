/**
 * TOON Compressor — converts JSON/YAML to TOON format
 * Extracted from TokenOptimizer for pipeline architecture.
 *
 * 'csv' is deliberately excluded — see detector.ts for why the detector
 * never routes CSV here.
 */

import { encode as toonEncode } from '@toon-format/toon';
import type { Compressor } from './compressor.js';
import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';

// --- Numeric-fidelity guard ---
// (Lockstep with numbersPreserved() in hooks/post-tool-use.mjs — keep in sync.)
//
// `detection.data` came from the detector's JSON.parse/yamlParse, which
// coerces every scalar to a native JS number — a LOSSY step: integers > 2^53
// lose precision, so distinct 64-bit IDs (snowflakes, Postgres bigint, ns
// timestamps) collapse to the SAME value, and trailing/leading zeros and
// exponents are rewritten (10.10→10.1, 0000→0, 1e3→1000). toonEncode then
// serializes those already-mangled numbers, and the compressed output REPLACES
// the source, so a wrong value reaches the caller with no original to compare
// against. Verified against @toon-format/toon: whenever a source token
// satisfies String(JSON.parse(tok)) === tok the encoder reproduces it
// byte-for-byte, and every lossy token fails that test. So only compress when
// every numeric token in the source round-trips exactly — otherwise pass the
// content through untouched. Correctness over compression rate.
function numbersPreserved(sourceText: string): boolean {
  const noStrings = sourceText
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:[^']|'')*'/g, "''");
  // Require a value boundary on both sides so the `-` in an unquoted identifier
  // like `pod-0` / `node-4` (or a date `2024-01-15`, version `1.2.3`) is not
  // read as a number: `-0` fails the round-trip (String(-0) === "0") and would
  // otherwise block legitimate YAML from compressing. See the hook copy.
  const tokens = noStrings.match(/(?<![\w.-])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w.-])/g);
  if (!tokens) return true;
  for (const tok of tokens) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(tok);
    } catch {
      return false;
    }
    if (String(parsed) !== tok) return false;
  }
  return true;
}

export class ToonCompressor implements Compressor {
  readonly name = 'toon';
  readonly supportedTypes: ContentType[] = ['json', 'yaml'];

  compress(content: string, detection: DetectResult): CompressResult {
    // Use pre-parsed data from detector when available. Also bail when the
    // lossy parse would mangle any number (see numbersPreserved) — both cases
    // pass the content through untouched, applying no compression layers.
    const data = detection.data;
    if (!data || !numbersPreserved(content)) {
      return {
        compressed: content,
        metadata: { compressor: this.name, layers: [], originalSize: content.length, compressedSize: content.length }
      };
    }

    const compressed = toonEncode(data);

    return {
      compressed,
      metadata: {
        compressor: this.name,
        layers: ['toon-encode'],
        originalSize: content.length,
        compressedSize: compressed.length,
      },
    };
  }
}
