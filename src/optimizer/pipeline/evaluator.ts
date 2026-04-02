/**
 * Evaluator — decides if compression is worth keeping
 */

import { MultilingualTokenizer } from '../multilingual/index.js';

export class Evaluator {
  private tokenizer: MultilingualTokenizer;

  constructor(tokenizer: MultilingualTokenizer) {
    this.tokenizer = tokenizer;
  }

  /**
   * Count tokens using raw tiktoken BPE
   */
  countTokens(text: string): number {
    return this.tokenizer.countBase(text);
  }

  /**
   * Evaluate whether compression is worth it
   */
  evaluate(
    original: string,
    compressed: string,
    minSavingsThreshold: number
  ): { worth: boolean; originalTokens: number; compressedTokens: number; savingsPercent: number } {
    const originalTokens = this.countTokens(original);
    const compressedTokens = this.countTokens(compressed);

    const savingsPercent = originalTokens > 0
      ? ((originalTokens - compressedTokens) / originalTokens) * 100
      : 0;

    return {
      worth: savingsPercent >= minSavingsThreshold,
      originalTokens,
      compressedTokens,
      savingsPercent,
    };
  }
}
