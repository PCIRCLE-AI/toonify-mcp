/**
 * Token savings benchmark - runs in Jest environment to avoid tiktoken initialization issues
 */

import { describe, test, expect } from '@jest/globals';
import { TokenOptimizer } from '../../src/optimizer/token-optimizer.js';

interface BenchmarkResult {
  name: string;
  category: string;
  originalTokens: number;
  optimizedTokens: number;
  savings: number;
  savingsPercent: number;
}

describe('Token Savings Benchmarks', () => {
  const optimizer = new TokenOptimizer();
  const results: BenchmarkResult[] = [];

  async function runBenchmark(name: string, category: string, data: Record<string, unknown>): Promise<BenchmarkResult> {
    const originalJson = JSON.stringify(data, null, 2);

    const result = await optimizer.optimize(originalJson, {
      toolName: 'benchmark',
      size: originalJson.length
    });

    const originalTokens = result.originalTokens;
    const optimizedTokens = result.optimizedTokens || result.originalTokens;

    const savings = originalTokens - optimizedTokens;
    const savingsPercent = (savings / originalTokens) * 100;

    return {
      name,
      category,
      originalTokens,
      optimizedTokens,
      savings,
      savingsPercent
    };
  }

  describe('Small JSON (< 100 tokens)', () => {
    test('Simple object', async () => {
      const result = await runBenchmark('Simple object', 'JSON-Small', {
        user: {
          id: 123,
          name: 'John Doe',
          email: 'john@example.com',
          active: true
        }
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('Small array', async () => {
      const result = await runBenchmark('Small array', 'JSON-Small', {
        items: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 30 }
        ]
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('Medium JSON (100-500 tokens)', () => {
    test('Product catalog', async () => {
      const result = await runBenchmark('Product catalog', 'JSON-Medium', {
        products: [
          { id: 101, name: 'Laptop Pro', price: 1299, stock: 45, category: 'Electronics' },
          { id: 102, name: 'Wireless Mouse', price: 29, stock: 150, category: 'Accessories' },
          { id: 103, name: 'USB-C Cable', price: 15, stock: 200, category: 'Accessories' },
          { id: 104, name: 'Monitor 27"', price: 399, stock: 30, category: 'Electronics' },
          { id: 105, name: 'Keyboard RGB', price: 89, stock: 75, category: 'Accessories' }
        ],
        metadata: {
          total: 5,
          timestamp: '2024-01-15T10:30:00Z',
          store: 'TechStore'
        }
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('User profiles', async () => {
      const result = await runBenchmark('User profiles', 'JSON-Medium', {
        users: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          username: `user${i}`,
          email: `user${i}@example.com`,
          active: true,
          role: i % 3 === 0 ? 'admin' : 'user'
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('API response with metadata', async () => {
      const result = await runBenchmark('API response with metadata', 'JSON-Medium', {
        status: 'success',
        data: [
          { id: 1, title: 'First Post', author: 'Alice', views: 1234, likes: 45 },
          { id: 2, title: 'Second Post', author: 'Bob', views: 5678, likes: 123 },
          { id: 3, title: 'Third Post', author: 'Charlie', views: 910, likes: 34 },
          { id: 4, title: 'Fourth Post', author: 'Diana', views: 2345, likes: 67 }
        ],
        meta: {
          total: 4,
          page: 1,
          perPage: 10
        }
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('Large JSON (> 500 tokens)', () => {
    test('Large user dataset', async () => {
      const result = await runBenchmark('Large user dataset', 'JSON-Large', {
        users: Array.from({ length: 30 }, (_, i) => ({
          id: 1000 + i,
          username: `user${i}`,
          email: `user${i}@example.com`,
          profile: {
            firstName: `First${i}`,
            lastName: `Last${i}`,
            age: 20 + (i % 50),
            country: ['USA', 'UK', 'Canada', 'Australia'][i % 4]
          },
          settings: {
            notifications: true,
            theme: 'dark',
            language: 'en'
          },
          metadata: {
            created: '2024-01-01',
            lastLogin: '2024-01-15'
          }
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0); // Allow 0% if TOON doesn't help this structure
    });

    test('Transaction records', async () => {
      const result = await runBenchmark('Transaction records', 'JSON-Large', {
        transactions: Array.from({ length: 25 }, (_, i) => ({
          id: `txn_${1000 + i}`,
          amount: (Math.random() * 1000).toFixed(2),
          currency: 'USD',
          status: i % 5 === 0 ? 'pending' : 'completed',
          timestamp: `2024-01-${String(i % 28 + 1).padStart(2, '0')}T10:30:00Z`,
          from: `account_${i % 10}`,
          to: `account_${(i + 1) % 10}`
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('CSV-like structured data', () => {
    test('Tabular data as JSON', async () => {
      const result = await runBenchmark('Tabular data', 'CSV-like', {
        headers: ['Date', 'Product', 'Quantity', 'Price', 'Total'],
        rows: Array.from({ length: 15 }, (_, i) => [
          `2024-01-${String(i + 1).padStart(2, '0')}`,
          `Product ${String.fromCharCode(65 + (i % 5))}`,
          Math.floor(Math.random() * 20) + 1,
          (Math.random() * 100).toFixed(2),
          (Math.random() * 500).toFixed(2)
        ])
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0); // Allow 0% if TOON doesn't help this structure
    });

    test('Spreadsheet-like structure', async () => {
      const result = await runBenchmark('Spreadsheet structure', 'CSV-like', {
        sheet: 'Sales',
        columns: ['ID', 'Name', 'Region', 'Sales', 'Target', 'Achieved'],
        data: Array.from({ length: 12 }, (_, i) => ({
          ID: i + 1,
          Name: `Rep ${i + 1}`,
          Region: ['North', 'South', 'East', 'West'][i % 4],
          Sales: Math.floor(Math.random() * 100000),
          Target: 50000,
          Achieved: Math.random() > 0.5
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('Nested structures', () => {
    test('Deeply nested organization', async () => {
      const result = await runBenchmark('Nested organization', 'Nested', {
        company: {
          name: 'TechCorp',
          departments: [
            {
              name: 'Engineering',
              teams: [
                { name: 'Frontend', members: 5, lead: 'Alice', projects: ['WebApp', 'MobileApp'] },
                { name: 'Backend', members: 7, lead: 'Bob', projects: ['API', 'Database'] },
                { name: 'DevOps', members: 3, lead: 'Charlie', projects: ['CI/CD', 'Infrastructure'] }
              ]
            },
            {
              name: 'Design',
              teams: [
                { name: 'UX', members: 3, lead: 'Diana', projects: ['Research', 'Prototyping'] },
                { name: 'UI', members: 4, lead: 'Eve', projects: ['Design System', 'Branding'] }
              ]
            },
            {
              name: 'Sales',
              teams: [
                { name: 'Enterprise', members: 8, lead: 'Frank', projects: ['B2B', 'Partnerships'] },
                { name: 'SMB', members: 6, lead: 'Grace', projects: ['B2C', 'Marketing'] }
              ]
            }
          ]
        }
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('Nested configuration', async () => {
      const result = await runBenchmark('Nested configuration', 'Nested', {
        config: {
          database: {
            host: 'localhost',
            port: 5432,
            credentials: { username: 'admin', password: 'secret' },
            pools: { min: 2, max: 10 }
          },
          cache: {
            redis: {
              host: 'localhost',
              port: 6379,
              options: { ttl: 3600, maxSize: 1000 }
            }
          },
          services: {
            api: { port: 3000, timeout: 30000 },
            worker: { concurrency: 5, retries: 3 }
          }
        }
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('Multilingual data', () => {
    test('English messages', async () => {
      const result = await runBenchmark('English messages', 'Multilingual-EN', {
        messages: [
          { id: 1, text: 'Hello, how are you today?', sender: 'Alice', timestamp: '2024-01-15T10:00:00Z' },
          { id: 2, text: 'I am doing great, thanks for asking!', sender: 'Bob', timestamp: '2024-01-15T10:01:00Z' },
          { id: 3, text: 'Would you like to grab coffee later?', sender: 'Alice', timestamp: '2024-01-15T10:02:00Z' },
          { id: 4, text: 'Sure, that sounds wonderful!', sender: 'Bob', timestamp: '2024-01-15T10:03:00Z' }
        ]
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('Chinese messages', async () => {
      const result = await runBenchmark('Chinese messages', 'Multilingual-ZH', {
        messages: [
          { id: 1, text: '你好，今天過得怎麼樣？', sender: 'Alice', timestamp: '2024-01-15T10:00:00Z' },
          { id: 2, text: '我很好，謝謝你的關心！', sender: 'Bob', timestamp: '2024-01-15T10:01:00Z' },
          { id: 3, text: '等一下要一起喝咖啡嗎？', sender: 'Alice', timestamp: '2024-01-15T10:02:00Z' },
          { id: 4, text: '好啊，聽起來很棒！', sender: 'Bob', timestamp: '2024-01-15T10:03:00Z' }
        ]
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('Japanese messages', async () => {
      const result = await runBenchmark('Japanese messages', 'Multilingual-JA', {
        messages: [
          { id: 1, text: 'こんにちは、今日はどうですか？', sender: 'Alice', timestamp: '2024-01-15T10:00:00Z' },
          { id: 2, text: '元気です、ありがとうございます！', sender: 'Bob', timestamp: '2024-01-15T10:01:00Z' },
          { id: 3, text: '後でコーヒーを飲みませんか？', sender: 'Alice', timestamp: '2024-01-15T10:02:00Z' },
          { id: 4, text: 'いいですね、素晴らしいです！', sender: 'Bob', timestamp: '2024-01-15T10:03:00Z' }
        ]
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('Mixed language content', async () => {
      const result = await runBenchmark('Mixed language', 'Multilingual-Mixed', {
        messages: [
          { id: 1, text: 'Hello 你好 こんにちは', sender: 'System', timestamp: '2024-01-15T10:00:00Z' },
          { id: 2, text: 'Welcome to our platform!', sender: 'System', timestamp: '2024-01-15T10:01:00Z' },
          { id: 3, text: '欢迎使用我们的平台', sender: 'System', timestamp: '2024-01-15T10:02:00Z' },
          { id: 4, text: 'プラットフォームへようこそ', sender: 'System', timestamp: '2024-01-15T10:03:00Z' }
        ]
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('Real-world API responses', () => {
    test('GitHub-style user API', async () => {
      const result = await runBenchmark('GitHub-style API', 'API-Response', {
        users: Array.from({ length: 10 }, (_, i) => ({
          login: `user${i}`,
          id: 1000 + i,
          avatar_url: `https://avatars.example.com/u/${1000 + i}`,
          type: 'User',
          site_admin: false,
          name: `User ${i}`,
          company: i % 3 === 0 ? 'Tech Corp' : null,
          blog: i % 2 === 0 ? 'https://blog.example.com' : '',
          location: ['San Francisco', 'New York', 'London', 'Tokyo'][i % 4],
          email: `user${i}@example.com`,
          public_repos: Math.floor(Math.random() * 50),
          public_gists: Math.floor(Math.random() * 20),
          followers: Math.floor(Math.random() * 1000),
          following: Math.floor(Math.random() * 500)
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    test('E-commerce order API', async () => {
      const result = await runBenchmark('E-commerce orders', 'API-Response', {
        orders: Array.from({ length: 8 }, (_, i) => ({
          order_id: `ORD-${1000 + i}`,
          customer_id: `CUST-${100 + i}`,
          status: ['pending', 'processing', 'shipped', 'delivered'][i % 4],
          items: [
            { product_id: 'PROD-1', quantity: 2, price: 29.99 },
            { product_id: 'PROD-2', quantity: 1, price: 49.99 }
          ],
          total: 109.97,
          currency: 'USD',
          shipping_address: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '62701',
            country: 'USA'
          },
          created_at: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`
        }))
      });
      results.push(result);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  // Print statistics after all tests
  afterAll(() => {
    if (results.length === 0) return;

    const percents = results.map(r => r.savingsPercent);
    const avg = percents.reduce((a, b) => a + b) / percents.length;
    const sorted = [...percents].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...percents);
    const max = Math.max(...percents);

    console.log('\n' + '='.repeat(90));
    console.log('TOKEN SAVINGS BENCHMARK RESULTS');
    console.log('='.repeat(90));

    // Group by category
    const categories = [...new Set(results.map(r => r.category))];
    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const categoryAvg = categoryResults.reduce((sum, r) => sum + r.savingsPercent, 0) / categoryResults.length;

      console.log(`\n📊 ${category} (${categoryResults.length} tests, avg: ${categoryAvg.toFixed(1)}%)`);
      console.log('-'.repeat(90));

      categoryResults.forEach(result => {
        console.log(`  ${result.name.padEnd(40)} ${result.originalTokens.toString().padStart(5)} → ${result.optimizedTokens.toString().padStart(5)} tokens (${result.savingsPercent.toFixed(1)}%)`);
      });
    });

    console.log('\n' + '='.repeat(90));
    console.log('OVERALL STATISTICS');
    console.log('='.repeat(90));
    console.log(`\n  Total Tests:        ${results.length}`);
    console.log(`  Average Savings:    ${avg.toFixed(1)}%`);
    console.log(`  Median Savings:     ${median.toFixed(1)}%`);
    console.log(`  Min Savings:        ${min.toFixed(1)}%`);
    console.log(`  Max Savings:        ${max.toFixed(1)}%`);
    console.log(`  Range:              ${min.toFixed(1)}% - ${max.toFixed(1)}%`);

    console.log('\n' + '='.repeat(90));
    console.log('RECOMMENDED README CLAIMS');
    console.log('='.repeat(90));

    console.log(`\n  Conservative:  "Reduces token usage by ${min.toFixed(0)}-${max.toFixed(0)}%"`);
    console.log(`  Typical:       "Typically saves ${median.toFixed(0)}% of tokens"`);
    console.log(`  Average:       "Saves ${avg.toFixed(0)}% on average"`);

    if (avg >= 60) {
      console.log(`\n  ✅ Current claim "60%+ on average" is ACCURATE (actual: ${avg.toFixed(1)}%)`);
    } else if (avg >= 55) {
      console.log(`\n  ⚠️  Current claim "60%+ on average" is SLIGHTLY HIGH (actual: ${avg.toFixed(1)}%)`);
      console.log(`  💡 Suggest: "Saves 55%+ on average" or "Typically saves ${median.toFixed(0)}%"`);
    } else {
      console.log(`\n  ❌ Current claim "60%+ on average" is TOO HIGH (actual: ${avg.toFixed(1)}%)`);
      console.log(`  💡 Suggest: "Saves ${Math.floor(avg / 5) * 5}%+ on average"`);
    }

    console.log('\n' + '='.repeat(90) + '\n');
  });
});
