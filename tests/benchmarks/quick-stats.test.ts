/**
 * Quick token savings benchmark - streamlined version
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import { TokenOptimizer } from '../../src/optimizer/token-optimizer.js';

interface Result {
  name: string;
  category: string;
  orig: number;
  opt: number;
  pct: number;
}

describe('Token Savings Stats', () => {
  // Use lower threshold for benchmark tests to show all achievable savings
  const optimizer = new TokenOptimizer({
    minSavingsThreshold: 0, // Show all savings, even small ones
    minTokensThreshold: 10  // Very low threshold for small test cases
  });
  const results: Result[] = [];

  async function bench(name: string, cat: string, data: Record<string, unknown>): Promise<Result> {
    const json = JSON.stringify(data, null, 2);
    const res = await optimizer.optimize(json, { toolName: 'bench', size: json.length });
    const orig = res.originalTokens;
    const opt = res.optimizedTokens || orig;
    const pct = ((orig - opt) / orig) * 100;
    const r = { name, category: cat, orig, opt, pct };
    results.push(r);
    return r;
  }

  test('Small-1', async () => {
    const r = await bench('Simple object', 'Small', {
      user: { id: 123, name: 'John Doe', email: 'john@example.com', active: true }
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Small-2', async () => {
    const r = await bench('Array', 'Small', {
      items: [{ id: 1, value: 10 }, { id: 2, value: 20 }, { id: 3, value: 30 }]
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Medium-1', async () => {
    const r = await bench('Products', 'Medium', {
      products: [
        { id: 101, name: 'Laptop', price: 1299, stock: 45, cat: 'Electronics' },
        { id: 102, name: 'Mouse', price: 29, stock: 150, cat: 'Access' },
        { id: 103, name: 'Cable', price: 15, stock: 200, cat: 'Access' },
        { id: 104, name: 'Monitor', price: 399, stock: 30, cat: 'Electronics' },
        { id: 105, name: 'Keyboard', price: 89, stock: 75, cat: 'Access' }
      ]
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Medium-2', async () => {
    const r = await bench('Users', 'Medium', {
      users: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        username: `user${i}`,
        email: `user${i}@example.com`,
        active: true
      }))
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Large-1', async () => {
    const r = await bench('UserDataset', 'Large', {
      users: Array.from({ length: 30 }, (_, i) => ({
        id: 1000 + i,
        username: `user${i}`,
        email: `user${i}@example.com`,
        profile: {
          firstName: `First${i}`,
          lastName: `Last${i}`,
          age: 20 + i % 50
        },
        settings: { theme: 'dark', language: 'en' }
      }))
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Large-2', async () => {
    const r = await bench('Transactions', 'Large', {
      txns: Array.from({ length: 25 }, (_, i) => ({
        id: `txn_${1000 + i}`,
        amount: 100.50,
        status: i % 5 === 0 ? 'pending' : 'done',
        date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`
      }))
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('CSV', async () => {
    const r = await bench('Table', 'CSV', {
      headers: ['Date', 'Product', 'Qty', 'Price'],
      rows: Array.from({ length: 15 }, (_, i) => [
        `2024-01-${i + 1}`,
        `Prod ${i}`,
        i + 1,
        100 + i
      ])
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('Nested', async () => {
    const r = await bench('Org', 'Nested', {
      company: {
        name: 'Corp',
        depts: [
          { name: 'Eng', teams: [{ name: 'FE', members: 5 }, { name: 'BE', members: 7 }] },
          { name: 'Design', teams: [{ name: 'UX', members: 3 }] }
        ]
      }
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('ML-EN', async () => {
    const r = await bench('English', 'Multilingual', {
      msgs: [
        { id: 1, text: 'Hello, how are you?', sender: 'A' },
        { id: 2, text: 'Great thanks!', sender: 'B' }
      ]
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('ML-ZH', async () => {
    const r = await bench('Chinese', 'Multilingual', {
      msgs: [
        { id: 1, text: '你好，今天過得怎麼樣？', sender: 'A' },
        { id: 2, text: '我很好，謝謝！', sender: 'B' }
      ]
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('API-1', async () => {
    const r = await bench('GitHub', 'API', {
      users: Array.from({ length: 10 }, (_, i) => ({
        login: `user${i}`,
        id: 1000 + i,
        repos: 10 + i,
        followers: 100 + i * 10
      }))
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  test('API-2', async () => {
    const r = await bench('Orders', 'API', {
      orders: Array.from({ length: 8 }, (_, i) => ({
        id: `O${1000 + i}`,
        items: [{ pid: 'P1', qty: 2, price: 30 }],
        total: 60,
        status: i % 2 === 0 ? 'done' : 'pending'
      }))
    });
    expect(r.pct).toBeGreaterThan(0);
  });

  afterAll(() => {
    if (results.length === 0) return;

    const ps = results.map(r => r.pct);
    const avg = ps.reduce((a, b) => a + b) / ps.length;
    const sorted = [...ps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...ps);
    const max = Math.max(...ps);

    console.log('\n' + '='.repeat(80));
    console.log('TOKEN SAVINGS BENCHMARK');
    console.log('='.repeat(80));

    const cats = [...new Set(results.map(r => r.category))];
    cats.forEach(c => {
      const rs = results.filter(r => r.category === c);
      const cavg = rs.reduce((s, r) => s + r.pct, 0) / rs.length;
      console.log(`\n${c} (${rs.length} tests, ${cavg.toFixed(1)}% avg)`);
      rs.forEach(r => {
        console.log(`  ${r.name.padEnd(20)} ${r.orig.toString().padStart(5)} → ${r.opt.toString().padStart(5)} (${r.pct.toFixed(1)}%)`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Tests: ${results.length} | Avg: ${avg.toFixed(1)}% | Median: ${median.toFixed(1)}% | Range: ${min.toFixed(1)}-${max.toFixed(1)}%`);

    if (avg >= 60) {
      console.log(`✅ "60%+ average" is ACCURATE (${avg.toFixed(1)}%)`);
    } else if (avg >= 55) {
      console.log(`⚠️  "60%+" slightly high (${avg.toFixed(1)}%). Suggest: "${Math.floor(avg / 5) * 5}%+"`);
    } else {
      console.log(`❌ "60%+" too high (${avg.toFixed(1)}%). Suggest: "${Math.floor(avg / 5) * 5}%+" or "${min.toFixed(0)}-${max.toFixed(0)}%"`);
    }
    console.log('='.repeat(80) + '\n');
  });
});
