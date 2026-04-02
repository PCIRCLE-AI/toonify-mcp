/**
 * Pipeline engine — orchestrates detect → route → compress → evaluate
 */

import { Detector } from './detector.js';
import { Evaluator } from './evaluator.js';
import type { ContentType, PipelineResult } from './types.js';
import type { Compressor } from '../compressors/compressor.js';
import type { MultilingualTokenizer } from '../multilingual/index.js';

export class Pipeline {
  private detector: Detector;
  private evaluator: Evaluator;
  private compressors: Map<ContentType, Compressor> = new Map();

  constructor(tokenizer: MultilingualTokenizer) {
    this.detector = new Detector();
    this.evaluator = new Evaluator(tokenizer);
  }

  /**
   * Register a compressor for specific content types
   */
  register(compressor: Compressor): void {
    for (const type of compressor.supportedTypes) {
      this.compressors.set(type, compressor);
    }
  }

  /**
   * Run the pipeline: detect → route → compress → evaluate
   */
  run(content: string, minSavingsThreshold: number): PipelineResult {
    // Step 1: Detect content type
    const detection = this.detector.detect(content);

    if (detection.type === 'unknown') {
      return {
        optimized: false,
        content,
        originalTokens: this.evaluator.countTokens(content),
        reason: 'Not structured data',
      };
    }

    // Step 2: Route to compressor
    const compressor = this.compressors.get(detection.type);
    if (!compressor) {
      return {
        optimized: false,
        content,
        originalTokens: this.evaluator.countTokens(content),
        reason: `No compressor for type: ${detection.type}`,
      };
    }

    // Step 3: Compress
    const compressed = compressor.compress(content, detection);

    // Step 4: Evaluate
    const evaluation = this.evaluator.evaluate(content, compressed.compressed, minSavingsThreshold);

    if (!evaluation.worth) {
      return {
        optimized: false,
        content,
        originalTokens: evaluation.originalTokens,
        reason: `Savings too low: ${evaluation.savingsPercent.toFixed(1)}%`,
      };
    }

    return {
      optimized: true,
      content: compressed.compressed,
      originalTokens: evaluation.originalTokens,
      optimizedTokens: evaluation.compressedTokens,
      savings: {
        tokens: evaluation.originalTokens - evaluation.compressedTokens,
        percentage: evaluation.savingsPercent,
      },
      format: detection.type,
      compressMetadata: compressed.metadata,
    };
  }

}
