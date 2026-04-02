/**
 * Compressor interface — all compressors implement this
 */

import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';

export interface Compressor {
  /** Human-readable name */
  readonly name: string;

  /** Content types this compressor handles */
  readonly supportedTypes: ContentType[];

  /**
   * Compress content.
   * @param content - Raw string content
   * @param detection - Detection result (includes parsed data for structured formats)
   */
  compress(content: string, detection: DetectResult): CompressResult;
}
