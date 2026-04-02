/**
 * Evaluator tests — token counting and savings evaluation
 */

import { Evaluator } from '../../src/optimizer/pipeline/evaluator';
import { MultilingualTokenizer } from '../../src/optimizer/multilingual/index';

describe('Evaluator', () => {
  let evaluator: Evaluator;

  beforeEach(() => {
    const tokenizer = new MultilingualTokenizer('gpt-4', true);
    evaluator = new Evaluator(tokenizer);
  });

  describe('countTokens', () => {
    test('counts tokens for English text', () => {
      const tokens = evaluator.countTokens('Hello, world!');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    test('counts tokens for empty string', () => {
      const tokens = evaluator.countTokens('');
      expect(tokens).toBe(0);
    });

    test('counts tokens for code', () => {
      const code = 'const x: number = 42;\nconst y: string = "hello";';
      const tokens = evaluator.countTokens(code);
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe('evaluate', () => {
    test('returns worth=true when savings exceed threshold', () => {
      // Simulate significant compression
      const original = '{"a":"b","c":"d","e":"f","g":"h","i":"j","k":"l","m":"n","o":"p"}';
      const compressed = 'a:b c:d e:f g:h i:j k:l m:n o:p';
      const result = evaluator.evaluate(original, compressed, 10);
      expect(result.worth).toBe(true);
      expect(result.savingsPercent).toBeGreaterThan(10);
      expect(result.originalTokens).toBeGreaterThan(result.compressedTokens);
    });

    test('returns worth=false when savings below threshold', () => {
      const text = 'hello world';
      const almostSame = 'hello world';
      const result = evaluator.evaluate(text, almostSame, 30);
      expect(result.worth).toBe(false);
      expect(result.savingsPercent).toBe(0);
    });

    test('handles empty original gracefully', () => {
      const result = evaluator.evaluate('', 'something', 10);
      expect(result.worth).toBe(false);
      expect(result.savingsPercent).toBe(0);
    });
  });
});
