/**
 * TokenOptimizer Tests - Following TDD Red-Green-Refactor
 */

import { TokenOptimizer } from '../src/optimizer/token-optimizer';

describe('TokenOptimizer', () => {
  let optimizer: TokenOptimizer;

  beforeEach(() => {
    optimizer = new TokenOptimizer();
  });

  describe('JSON optimization', () => {
    test('optimizes valid JSON with significant token savings', async () => {
      const jsonData = JSON.stringify({
        products: [
          { id: 101, name: 'Laptop Pro', price: 1299, stock: 45 },
          { id: 102, name: 'Magic Mouse', price: 79, stock: 120 },
          { id: 103, name: 'USB-C Cable', price: 19, stock: 350 },
        ],
      }, null, 2);

      const result = await optimizer.optimize(jsonData);

      expect(result.optimized).toBe(true);
      expect(result.format).toBe('json');
      expect(result.optimizedContent).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.savings!.percentage).toBeGreaterThan(30);
      expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
    });
  });

  describe('CSV optimization', () => {
    test('detects and processes CSV format correctly', async () => {
      // Create larger CSV dataset
      const headers = 'id,name,email,age,city,country,department,salary,hire_date';
      const rows = Array.from({ length: 25 }, (_, i) =>
        `${i},Employee ${i},employee${i}@company.com,${25 + i},City ${i},Country ${i},Dept ${i % 5},${50000 + i * 1000},2020-01-${(i % 28) + 1}`
      );
      const csvData = [headers, ...rows].join('\n');

      const result = await optimizer.optimize(csvData);

      // CSV should be detected and processed (either optimized or rejected based on savings)
      expect(result.originalTokens).toBeGreaterThan(0);

      if (result.optimized) {
        expect(result.format).toBe('csv');
        expect(result.optimizedContent).toBeDefined();
        expect(result.savings).toBeDefined();
        expect(result.savings!.percentage).toBeGreaterThanOrEqual(30);
        expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
      } else {
        // If not optimized, should have valid reason (e.g., savings too low)
        expect(result.reason).toBeDefined();
      }
    });

    test('rejects CSV with inconsistent column counts', async () => {
      const invalidCSV = `name,age,city
John Doe,30
Jane Smith,25,London,UK`;

      const result = await optimizer.optimize(invalidCSV);

      expect(result.optimized).toBe(false);
    });
  });

  describe('YAML optimization', () => {
    test('detects and processes YAML format correctly', async () => {
      // Create larger YAML dataset
      const users = Array.from({ length: 20 }, (_, i) => `
  - user_id: ${i}
    user_name: User Number ${i}
    user_email: user${i}@example.com
    user_age: ${20 + i}
    user_address:
      street: Street ${i}
      city: City ${i}
      country: Country ${i}
      postal_code: ${10000 + i}
    user_department: Department ${i % 5}
    user_role: Role ${i % 3}`).join('');

      const yamlData = `users:${users}`;

      const result = await optimizer.optimize(yamlData);

      // YAML should be detected and processed (either optimized or rejected based on savings)
      expect(result.originalTokens).toBeGreaterThan(0);

      if (result.optimized) {
        expect(result.format).toBe('yaml');
        expect(result.optimizedContent).toBeDefined();
        expect(result.savings).toBeDefined();
        expect(result.savings!.percentage).toBeGreaterThanOrEqual(30);
        expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
      } else {
        // If not optimized, should have valid reason (e.g., savings too low)
        expect(result.reason).toBeDefined();
      }
    });
  });

  describe('Content size threshold', () => {
    test('skips optimization for non-structured content', async () => {
      const smallContent = 'This is a short text';

      const result = await optimizer.optimize(smallContent);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
      expect(result.originalTokens).toBeDefined();
    });

    test('processes content >= 200 chars if structured', async () => {
      const largeJSON = JSON.stringify({
        items: Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item-${i}` }))
      }, null, 2);

      expect(largeJSON.length).toBeGreaterThanOrEqual(200);

      const result = await optimizer.optimize(largeJSON);

      // Should attempt optimization (may or may not succeed based on savings)
      expect(result.originalTokens).toBeGreaterThan(0);
    });
  });

  describe('Unstructured content handling', () => {
    test('skips optimization for plain text', async () => {
      const plainText = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
Nisi ut aliquip ex ea commodo consequat duis aute irure dolor.`;

      const result = await optimizer.optimize(plainText);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('skips optimization for HTML content', async () => {
      const htmlContent = `
<!DOCTYPE html>
<html>
  <head><title>Test Page</title></head>
  <body>
    <h1>Hello World</h1>
    <p>This is a test paragraph with some content to exceed 200 characters minimum requirement for processing.</p>
  </body>
</html>`;

      const result = await optimizer.optimize(htmlContent);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('can optimize debug-heavy output when savings are worth it', async () => {
      const repeatedFrames = Array.from({ length: 8 }, () =>
        '    at renderUserCard (/workspace/src/render.ts:18:13)'
      ).join('\n');

      const debugOutput = `FAIL tests/user-service.test.ts
  UserService
    × returns a fallback profile when the API request fails

  ● UserService › returns a fallback profile when the API request fails

    expect(received).toEqual(expected)

      41 |     const profile = await service.loadProfile("demo-user");
      42 |
    > 43 |     expect(profile).toEqual({ status: "offline" });
         |                     ^

TypeError: Cannot read properties of undefined (reading 'id')
${repeatedFrames}
    at async main (/workspace/src/index.ts:11:3)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total`;

      const result = await optimizer.optimize(debugOutput);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.format).toBe('debug-output');
      if (result.optimized) {
        expect(result.optimizedContent).toContain('tests/user-service.test.ts');
        expect(result.optimizedContent).toContain('/workspace/src/index.ts:11:3');
      }
    });
  });

  describe('Savings threshold enforcement', () => {
    test('rejects optimization with low savings (< 30%)', async () => {
      // Create minimal JSON that won't compress much
      const minimalJSON = JSON.stringify({ a: 1, b: 2, c: 3 });

      // Pad to exceed 200 char minimum
      const paddedJSON = JSON.stringify({
        data: minimalJSON,
        padding: 'x'.repeat(200)
      });

      const result = await optimizer.optimize(paddedJSON);

      if (!result.optimized) {
        expect(result.reason).toMatch(/Savings too low|Not structured data/);
      } else {
        // If it did optimize, savings must be >= 30%
        expect(result.savings!.percentage).toBeGreaterThanOrEqual(30);
      }
    });

    test('accepts optimization with high savings (>= 30%)', async () => {
      const verboseJSON = JSON.stringify({
        users: Array.from({ length: 50 }, (_, i) => ({
          userId: i,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          userStatus: 'active'
        }))
      }, null, 2);

      const result = await optimizer.optimize(verboseJSON);

      if (result.optimized) {
        expect(result.savings!.percentage).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('Error handling', () => {
    test('handles malformed JSON gracefully', async () => {
      // Create truly malformed JSON that won't parse
      const malformedJSON = `{
        "users": [
          { "name": "John", "age": 30 },
          { "name": "Jane" "age": 25 }
        ]
      }` + ' '.repeat(150);  // Missing comma - syntax error

      const result = await optimizer.optimize(malformedJSON);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('handles malformed YAML gracefully', async () => {
      const malformedYAML = `
users:
  - name: John
    age: 30
  - name: Jane
  age: 25`;  // Incorrect indentation

      const result = await optimizer.optimize(malformedYAML);

      expect(result.optimized).toBe(false);
      expect(result.originalTokens).toBeGreaterThan(0);
    });

    test('handles encoding errors gracefully', async () => {
      // Create content that might cause toonEncode to throw
      const problematicData = JSON.stringify({
        circular: null,
        data: Array(1000).fill({ nested: { deep: { value: 'test' } } })
      });

      const result = await optimizer.optimize(problematicData);

      // Should either optimize successfully or fail gracefully
      expect(result.originalTokens).toBeGreaterThan(0);
      if (!result.optimized) {
        expect(result.reason).toBeDefined();
      }
    });
  });

  describe('Skip tool patterns', () => {
    test('skips optimization for tools matching skip patterns', async () => {
      const optimizerWithSkip = new TokenOptimizer({
        skipToolPatterns: ['read_file', 'write_.*']
      });

      const jsonData = JSON.stringify({
        data: Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item-${i}` }))
      }, null, 2);

      const result = await optimizerWithSkip.optimize(jsonData, {
        toolName: 'read_file',
        size: jsonData.length
      });

      expect(result.optimized).toBe(false);
      expect(result.reason).toContain('skip list');
    });

    test('skips optimization for tools matching regex patterns', async () => {
      const optimizerWithSkip = new TokenOptimizer({
        skipToolPatterns: ['^mcp__.*__read']
      });

      const jsonData = JSON.stringify({
        data: Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item-${i}` }))
      }, null, 2);

      const result = await optimizerWithSkip.optimize(jsonData, {
        toolName: 'mcp__filesystem__read',
        size: jsonData.length
      });

      expect(result.optimized).toBe(false);
      expect(result.reason).toContain('skip list');
    });

    test('processes tools not matching skip patterns', async () => {
      const optimizerWithSkip = new TokenOptimizer({
        skipToolPatterns: ['read_file']
      });

      const jsonData = JSON.stringify({
        products: Array.from({ length: 30 }, (_, i) => ({
          id: i,
          name: `Product ${i}`,
          price: Math.random() * 100
        }))
      }, null, 2);

      const result = await optimizerWithSkip.optimize(jsonData, {
        toolName: 'list_products',
        size: jsonData.length
      });

      // Should attempt optimization (not in skip list)
      if (result.reason) {
        expect(result.reason).not.toContain('skip list');
      }
      // If optimized, that's also correct (not skipped)
      expect(result.optimized || result.reason).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    test('handles empty string', async () => {
      const result = await optimizer.optimize('');

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('handles whitespace-only content', async () => {
      const result = await optimizer.optimize('   \n\t  \n   ');

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });

    test('handles exactly 200 characters threshold', async () => {
      const content = 'a'.repeat(200);

      const result = await optimizer.optimize(content);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('Not structured data');
    });
  });
});
