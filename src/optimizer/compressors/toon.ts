/**
 * TOON Compressor — converts JSON/CSV/YAML to TOON format
 * Extracted from TokenOptimizer for pipeline architecture.
 */

import { encode as toonEncode } from '@toon-format/toon';
import type { Compressor } from './compressor.js';
import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';

export class ToonCompressor implements Compressor {
  readonly name = 'toon';
  readonly supportedTypes: ContentType[] = ['json', 'csv', 'yaml'];

  compress(content: string, detection: DetectResult): CompressResult {
    // Use pre-parsed data from detector when available
    const data = detection.data;
    if (!data) {
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
