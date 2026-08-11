/**
 * Detector tests — content type detection heuristics
 */

import { Detector } from '../../src/optimizer/pipeline/detector';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name: string): string {
  return readFileSync(path.join(__dirname, '..', 'fixtures', 'debug-output', name), 'utf-8');
}

describe('Detector', () => {
  let detector: Detector;

  beforeEach(() => {
    detector = new Detector();
  });

  describe('JSON detection', () => {
    test('detects valid JSON object', () => {
      const result = detector.detect('{"name": "test", "value": 42}');
      expect(result.type).toBe('json');
      expect(result.confidence).toBe(1.0);
      expect(result.data).toEqual({ name: 'test', value: 42 });
    });

    test('detects valid JSON array', () => {
      const result = detector.detect('[1, 2, 3]');
      expect(result.type).toBe('json');
      expect(result.confidence).toBe(1.0);
    });

    test('rejects primitive JSON', () => {
      const result = detector.detect('"just a string"');
      expect(result.type).not.toBe('json');
    });
  });

  describe('YAML detection', () => {
    test('detects YAML with key-value pairs', () => {
      const yaml = `name: myapp
version: 1.0.0
description: A test app
author: dev
license: MIT`;
      const result = detector.detect(yaml);
      expect(result.type).toBe('yaml');
      expect(result.confidence).toBe(0.9);
      expect(result.data).toBeTruthy();
    });

    test('rejects plain text that vaguely looks like YAML', () => {
      const result = detector.detect('hello world\nfoo bar baz');
      expect(result.type).not.toBe('yaml');
    });
  });

  describe('CSV is deliberately not detected', () => {
    // TOON encoding measured as a net loss on CSV at every row count tried,
    // so well-formed CSV must not be routed to a compressor at all.
    test('does not classify well-formed CSV as csv', () => {
      const csv = `name,age,city
Alice,30,NYC
Bob,25,LA
Carol,35,Chicago
Dave,28,Seattle
Eve,32,Portland`;
      const result = detector.detect(csv);
      expect(result.type).toBe('unknown');
    });

    test('rejects content with inconsistent commas', () => {
      const result = detector.detect('hello,world\njust one line with no commas\nno,pattern,here,at,all');
      expect(result.type).toBe('unknown');
    });
  });

  describe('code detection', () => {
    test('detects TypeScript', () => {
      const ts = `import { useState } from 'react';
import type { FC } from 'react';

interface Props {
  name: string;
  age: number;
}

export const Comp: FC<Props> = ({ name }) => {
  const [data, setData] = useState(null);
  return <div>{name}</div>;
};`;
      const result = detector.detect(ts);
      expect(result.type).toBe('code-ts');
      expect(result.confidence).toBe(0.85);
    });

    test('detects Python', () => {
      const py = `from flask import Flask, request
import json

class UserService:
    def __init__(self):
        self.users = []

    def add_user(self, name):
        self.users.append(name)
        return True`;
      const result = detector.detect(py);
      expect(result.type).toBe('code-py');
      expect(result.confidence).toBe(0.85);
    });

    test('detects Go', () => {
      const go = `package main

import (
	"fmt"
	"net/http"
)

func main() {
	resp, err := http.Get("https://example.com")
	if err != nil {
		fmt.Println(err)
	}
	fmt.Println(resp.Status)
}`;
      const result = detector.detect(go);
      expect(result.type).toBe('code-go');
      expect(result.confidence).toBe(0.85);
    });

    test('detects PHP with framework imports and methods', () => {
      const php = `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;

class UserController
{
    public function index(Request $request)
    {
        return $this->users();
    }
}`;
      const result = detector.detect(php);
      expect(result.type).toBe('code-php');
      expect(result.confidence).toBe(0.85);
    });

    test('detects PHP with attributes', () => {
      const php = `<?php

use Symfony\\Component\\Routing\\Attribute\\Route;

class ApiController
{
    #[Route('/api/users', methods: ['GET'])]
    public function listUsers()
    {
        return [];
    }
}`;
      const result = detector.detect(php);
      expect(result.type).toBe('code-php');
      expect(result.confidence).toBe(0.85);
    });

    test('detects PHP without opening tag when other signals are present', () => {
      const php = `namespace App\\Services;

use Illuminate\\Support\\Collection;

class UserService
{
    public function all()
    {
        return $this->users;
    }
}`;
      const result = detector.detect(php);
      expect(result.type).toBe('code-php');
      expect(result.confidence).toBe(0.85);
    });

    test('detects generic code', () => {
      const code = `function greet(name) {
  if (name) {
    return "Hello, " + name;
  } else {
    return "Hello, World";
  }
}

for (let i = 0; i < 10; i++) {
  console.log(greet("user" + i));
}`;
      const result = detector.detect(code);
      // Could be code-ts or code-generic depending on heuristics
      expect(result.type).toMatch(/^code-/);
    });

    test('returns unknown for plain text', () => {
      const text = 'This is just a paragraph of text without any code patterns. It talks about everyday things like weather and news.';
      const result = detector.detect(text);
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    // Regression: source in a language with no dedicated indicator set
    // (Java, C, Rust, ...) plus repeated near-identical lines can score
    // >= 3 on detectDebugOutput's heuristics (the literal word "FAIL" +
    // hasRepeatedDiagnosticLines). The hook needed an explicit generic-code
    // fallback added to its own looksLikeSourceCode() to avoid
    // misclassifying this as debug output and corrupting it (see
    // tests/hooks/post-tool-use.test.ts). The library achieves the same
    // protection structurally, since detect() tries detectCode() (which
    // has looksLikeGenericCode()) before detectDebugOutput() — this test
    // closes the coverage gap for that path specifically, using the same
    // Java fixture as the hook's regression test.
    test('generic-language code with repeated lines is classified as code, not debug output', () => {
      const java = `package com.example.service;

public class RetryHandler {
    public void run(int attempt) {
        if (attempt == 1) { throw new RuntimeException("FAIL"); }
        if (attempt == 2) { throw new RuntimeException("FAIL"); }
        if (attempt == 3) { throw new RuntimeException("FAIL"); }
        if (attempt == 4) { throw new RuntimeException("FAIL"); }
        if (attempt == 5) { throw new RuntimeException("FAIL"); }
    }
}
`;
      const result = detector.detect(java);
      expect(result.type).toMatch(/^code-/);
      expect(result.type).not.toBe('debug-output');
    });
  });

  describe('debug output detection', () => {
    test('detects Jest failure output from fixture', () => {
      const result = detector.detectDebugOutput(loadFixture('jest-failure.txt'));
      expect(result).toEqual(
        expect.objectContaining({
          type: 'debug-output',
        })
      );
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('detects TypeScript compiler errors from fixture', () => {
      const result = detector.detectDebugOutput(loadFixture('tsc-errors.txt'));
      expect(result?.type).toBe('debug-output');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('detects Python traceback from fixture', () => {
      const result = detector.detectDebugOutput(loadFixture('python-traceback.txt'));
      expect(result?.type).toBe('debug-output');
    });

    test('detects repeated lint diagnostics from fixture', () => {
      const result = detector.detectDebugOutput(loadFixture('eslint-output.txt'));
      expect(result?.type).toBe('debug-output');
    });

    test('does not misclassify ordinary prose as debug output', () => {
      const text = `We completed the migration review this morning.
The team discussed versioning, benchmarks, and rollout timing.
Nothing failed, and there are no file paths or stack traces in this note.`;
      const result = detector.detectDebugOutput(text);
      expect(result).toBeNull();
    });

    // Regression: hasMultipleFileLocationDiagnostics()'s
    // /\b[\w./-]+\.(ts|...):\d+:\d+\b/g has an ambiguous overlap between the
    // `.` inside its character class and the literal `.` before the
    // extension, causing O(n^2) backtracking on content shaped like
    // "a.a.a.a...." with no valid :line:col suffix ever appearing (same
    // class of bug independently affects /^\s*at\s+.+\(.+:\d+:\d+\)/m).
    // Reachable via TokenOptimizer.optimize() -> Pipeline.run() ->
    // Detector.detect(), where a caller's own maxProcessingTime budget
    // (default 2000ms) is the thing this should complete well within.
    test('does not hang on a ReDoS-shaped adversarial payload', () => {
      const adversarial = 'line one\nline two\nline three\n' + 'a.'.repeat(60000) + '\nline five';

      const start = Date.now();
      const result = detector.detectDebugOutput(adversarial);
      const elapsedMs = Date.now() - start;

      expect(elapsedMs).toBeLessThan(500);
      // Not a correctness assertion either way — this content has no real
      // debug-output structure, just proving detection completes fast.
      expect(result === null || result.type === 'debug-output').toBe(true);
    });

    // The 2000-char scan cap truncates line HEADS. Real diagnostics
    // front-load their file:line:col (tsc: "src/a.ts:12:5 - error TS...";
    // the huge generic/union type lives in the MESSAGE, after the location),
    // so a legitimately long diagnostic line (>2000 chars) must still detect
    // as debug output — the cap must not strip a real location and flip a
    // true positive to a false negative.
    test('a legitimately long diagnostic line (>2000 chars) still detects as debug output', () => {
      const hugeUnion = Array.from({ length: 200 }, (_, i) => `'Variant${i}'`).join(' | ');
      const line1 = `src/a.ts:12:5 - error TS2345: Argument of type '${hugeUnion}' is not assignable to parameter.`;
      const line2 = `src/b.ts:20:9 - error TS2345: Argument of type '${hugeUnion}' is not assignable to parameter.`;
      const line3 = `src/c.ts:30:1 - error TS2345: Argument of type '${hugeUnion}' is not assignable to parameter.`;
      expect(line1.length).toBeGreaterThan(2000);
      const content = [line1, '', line2, '', line3, '', 'Found 3 errors in 3 files.'].join('\n');

      const result = detector.detectDebugOutput(content);
      expect(result?.type).toBe('debug-output');
    });
  });
});
