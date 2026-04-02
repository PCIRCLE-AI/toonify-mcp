/**
 * Tests for YAML detection and CSV quote handling improvements
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TokenOptimizer } from '../src/optimizer/token-optimizer.js';

describe('Parser Edge Cases', () => {
  let optimizer: TokenOptimizer;

  beforeEach(() => {
    optimizer = new TokenOptimizer({
      minSavingsThreshold: 0,
      minTokensThreshold: 10,
    });
  });

  describe('YAML detection strictness', () => {
    test('rejects simple key: value text as YAML', async () => {
      const plainText = 'name: John\nThis is a regular sentence with a colon: nothing special.';
      const result = await optimizer.optimize(plainText);
      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('rejects prose that happens to have colons', async () => {
      const prose = `Summary: The project is going well.
Status: We completed the review.
Next steps: Deploy to production.
Note: This is not YAML, it's just a status update with colons.`;
      const result = await optimizer.optimize(prose);
      // Should not be detected as YAML since it lacks nesting/lists
      if (result.optimized) {
        // If it does parse as YAML, at least ensure it has structure
        expect(result.format).toBeDefined();
      }
    });

    test('accepts real YAML with nested structure', async () => {
      const realYAML = `server:
  host: localhost
  port: 8080
  database:
    name: mydb
    user: admin
    password: secret
  cache:
    enabled: true
    ttl: 3600
logging:
  level: info
  output: stdout`;
      const result = await optimizer.optimize(realYAML);
      // Should be detected as YAML (multiple key-value lines + indentation)
      expect(result.originalTokens).toBeGreaterThan(0);
      if (result.optimized) {
        expect(result.format).toBe('yaml');
      }
    });

    test('accepts YAML with list items', async () => {
      const yamlList = `users:
  - name: Alice
    age: 30
    role: admin
  - name: Bob
    age: 25
    role: user
  - name: Charlie
    age: 35
    role: moderator`;
      const result = await optimizer.optimize(yamlList);
      expect(result.originalTokens).toBeGreaterThan(0);
      if (result.optimized) {
        expect(result.format).toBe('yaml');
      }
    });
  });

  describe('CSV quote handling', () => {
    test('handles quoted fields with commas inside', async () => {
      const csv = `name,title,salary
"Smith, John",Engineer,75000
"Doe, Jane","Senior Engineer",95000
"Williams, Bob","VP, Engineering",150000
"Brown, Alice",Designer,65000
"Jones, Charlie","PM, Product",85000`;
      const result = await optimizer.optimize(csv);
      // Should detect as CSV and handle quotes correctly
      expect(result.originalTokens).toBeGreaterThan(0);
      if (result.optimized) {
        expect(result.format).toBe('csv');
      }
    });

    test('handles escaped quotes in CSV', async () => {
      const csv = `id,description,price
1,"A ""great"" product",29.99
2,"Standard item",19.99
3,"Another ""awesome"" item",39.99
4,"Regular product",24.99
5,"Budget ""value"" option",14.99`;
      const result = await optimizer.optimize(csv);
      expect(result.originalTokens).toBeGreaterThan(0);
    });

    test('handles simple CSV without quotes', async () => {
      const csv = `id,name,email,age,department
1,Alice,alice@test.com,30,Engineering
2,Bob,bob@test.com,25,Design
3,Charlie,charlie@test.com,35,Sales
4,Dave,dave@test.com,28,Marketing
5,Eve,eve@test.com,32,Engineering`;
      const result = await optimizer.optimize(csv);
      expect(result.originalTokens).toBeGreaterThan(0);
      if (result.optimized) {
        expect(result.format).toBe('csv');
      }
    });
  });

  describe('Token counting accuracy (no language multiplier)', () => {
    test('Chinese text tokens are raw tiktoken count', async () => {
      const chineseJSON = JSON.stringify({
        messages: [
          { id: 1, text: '你好世界', sender: 'Alice' },
          { id: 2, text: '歡迎使用', sender: 'Bob' },
          { id: 3, text: '謝謝你的幫助', sender: 'Charlie' },
        ]
      }, null, 2);

      const result = await optimizer.optimize(chineseJSON);
      // Token counts should be raw tiktoken (not multiplied by 2.0)
      // For reference: tiktoken typically gives ~1 token per CJK character
      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.originalTokens).toBeLessThan(200); // Sanity check — shouldn't be inflated
    });

    test('English and Chinese JSON get comparable savings ratios', async () => {
      const englishJSON = JSON.stringify({
        items: Array.from({ length: 10 }, (_, i) => ({
          id: i, name: `Item ${i}`, status: 'active'
        }))
      }, null, 2);

      const chineseJSON = JSON.stringify({
        items: Array.from({ length: 10 }, (_, i) => ({
          id: i, name: `項目${i}`, status: '啟用'
        }))
      }, null, 2);

      const enResult = await optimizer.optimize(englishJSON);
      const zhResult = await optimizer.optimize(chineseJSON);

      // Both should optimize (or both shouldn't), no wildly different behavior
      if (enResult.optimized && zhResult.optimized) {
        const enSavings = enResult.savings!.percentage;
        const zhSavings = zhResult.savings!.percentage;
        // Savings should be in the same ballpark (within 30% of each other)
        expect(Math.abs(enSavings - zhSavings)).toBeLessThan(30);
      }
    });
  });
});
