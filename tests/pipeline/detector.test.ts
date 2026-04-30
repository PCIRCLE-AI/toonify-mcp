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

  describe('CSV detection', () => {
    test('detects CSV with consistent columns', () => {
      const csv = `name,age,city
Alice,30,NYC
Bob,25,LA
Carol,35,Chicago
Dave,28,Seattle
Eve,32,Portland`;
      const result = detector.detect(csv);
      expect(result.type).toBe('csv');
      expect(result.confidence).toBe(0.8);
    });

    test('rejects content with inconsistent commas', () => {
      const result = detector.detect('hello,world\njust one line with no commas\nno,pattern,here,at,all');
      expect(result.type).not.toBe('csv');
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
  });
});
