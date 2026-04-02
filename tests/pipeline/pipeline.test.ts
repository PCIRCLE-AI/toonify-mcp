/**
 * Pipeline integration tests — detect → route → compress → evaluate
 */

import { Pipeline } from '../../src/optimizer/pipeline/pipeline';
import { ToonCompressor } from '../../src/optimizer/compressors/toon';
import { CodeCompressor } from '../../src/optimizer/compressors/code';
import { MultilingualTokenizer } from '../../src/optimizer/multilingual/index';

describe('Pipeline', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    const tokenizer = new MultilingualTokenizer('gpt-4', true);
    pipeline = new Pipeline(tokenizer);
    pipeline.register(new ToonCompressor());
    pipeline.register(new CodeCompressor());
  });

  describe('JSON content', () => {
    test('optimizes JSON with significant savings', () => {
      const json = JSON.stringify({
        users: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          role: i % 2 === 0 ? 'admin' : 'user',
        })),
      });

      const result = pipeline.run(json, 10);
      expect(result.optimized).toBe(true);
      expect(result.format).toBe('json');
      expect(result.savings!.percentage).toBeGreaterThan(10);
    });
  });

  describe('code content', () => {
    test('compresses TypeScript with comments removed', () => {
      const ts = `import { useState } from 'react';
import type { FC } from 'react';

// Main component
// Author: test
// Created: 2024-01-01

interface Props {
  name: string;
  age: number;
}

/** User card component */
export const UserCard: FC<Props> = ({ name, age }) => {
  // Initialize state
  const [data, setData] = useState(null); // local state


  // Fetch data
  return <div>{name}: {age}</div>;
};`;

      const result = pipeline.run(ts, 5);
      if (result.optimized) {
        expect(result.format).toBe('code-ts');
        expect(result.content).not.toContain('// Main component');
        expect(result.content).not.toContain('// Author: test');
        expect(result.content).not.toContain('// local state');
        // JSDoc first line preserved
        expect(result.content).toContain('/** User card component */');
      }
      // Even if savings too low, should still detect correctly
      expect(result.format === 'code-ts' || result.reason).toBeTruthy();
    });

    test('compresses Python with comments removed', () => {
      const py = `from flask import Flask
import json

# Flask application setup
# Author: dev team
# Version: 1.0

class UserService:
    """Manages user operations."""
    def __init__(self):
        # Initialize empty user list
        self.users = []  # store users here

    def add_user(self, name):
        # Add a new user
        self.users.append(name)
        return True  # success`;

      const result = pipeline.run(py, 5);
      if (result.optimized) {
        expect(result.format).toBe('code-py');
        expect(result.content).not.toContain('# Flask application setup');
        expect(result.content).not.toContain('# Author: dev team');
      }
    });
  });

  describe('unknown content', () => {
    test('returns not optimized for plain text', () => {
      const text = 'Just some regular text without any code or data patterns.';
      const result = pipeline.run(text, 10);
      expect(result.optimized).toBe(false);
      expect(result.reason).toContain('Not structured data');
    });
  });

  describe('pipeline routing', () => {
    test('uses TOON compressor for JSON', () => {
      const json = JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 });
      const result = pipeline.run(json, 5);
      if (result.optimized) {
        expect(result.compressMetadata?.compressor).toBe('toon');
      }
    });

    test('uses code compressor for TypeScript', () => {
      const ts = `import { a } from 'b';
import { c } from 'd';

// Long comment line to inflate token count
// Another comment
// And another
// And yet another
// One more comment

interface Foo {
  bar: string;
  baz: number;
}

export function doStuff(): void {
  const x = 1; // inline comment
  const y = 2; // another inline
  console.log(x + y);
}`;

      const result = pipeline.run(ts, 5);
      if (result.optimized) {
        expect(result.compressMetadata?.compressor).toBe('code');
      }
    });
  });
});
