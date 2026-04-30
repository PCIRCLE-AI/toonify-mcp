/**
 * CodeCompressor tests — 6-layer heuristic code compression
 */

import { CodeCompressor } from '../../src/optimizer/compressors/code';
import type { DetectResult } from '../../src/optimizer/pipeline/types';

describe('CodeCompressor', () => {
  let compressor: CodeCompressor;

  beforeEach(() => {
    compressor = new CodeCompressor();
  });

  const makeDetection = (type: 'code-ts' | 'code-py' | 'code-go' | 'code-php' | 'code-generic'): DetectResult => ({
    type,
    confidence: 0.85,
  });

  describe('Layer 1: merge blank lines', () => {
    test('collapses 3+ consecutive blank lines to 1', () => {
      const input = 'line1\n\n\n\nline2\n\n\n\n\nline3';
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).not.toMatch(/\n{3,}/);
      expect(result.compressed).toContain('line1');
      expect(result.compressed).toContain('line2');
      expect(result.compressed).toContain('line3');
    });
  });

  describe('Layer 2: remove inline comments', () => {
    test('removes C-style inline comments', () => {
      const input = 'const x = 42; // the answer\nconst y = 0;';
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('const x = 42;');
      expect(result.compressed).not.toContain('the answer');
      expect(result.compressed).toContain('const y = 0;');
    });

    test('removes Python inline comments', () => {
      const input = 'x = 42  # the answer\ny = 0';
      const result = compressor.compress(input, makeDetection('code-py'));
      expect(result.compressed).toContain('x = 42');
      expect(result.compressed).not.toContain('the answer');
    });

    test('removes PHP inline comments but preserves attribute syntax', () => {
      const input = `<?php
class ApiController {
    #[Route('/api/users')]
    public function listUsers() {
        return $this->users(); # trailing comment
    }
}`;
      const result = compressor.compress(input, makeDetection('code-php'));
      expect(result.compressed).toContain("#[Route('/api/users')]");
      expect(result.compressed).toContain('return $this->users();');
      expect(result.compressed).not.toContain('trailing comment');
    });

    test('preserves PHP hash characters inside strings', () => {
      const input = `<?php
class Banner {
    public function text() {
        return "# not a comment"; # remove this
    }
}`;
      const result = compressor.compress(input, makeDetection('code-php'));
      expect(result.compressed).toContain('return "# not a comment";');
      expect(result.compressed).not.toContain('remove this');
    });

    test('preserves TODO/FIXME comments', () => {
      const input = 'const x = 42; // TODO: fix this later';
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('TODO: fix this later');
    });

    test('preserves strings containing //', () => {
      const input = 'const url = "https://example.com";';
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('https://example.com');
    });

    test('does not remove comments inside strings', () => {
      const input = "const msg = 'hello // world'; // real comment";
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain("'hello // world'");
      expect(result.compressed).not.toContain('real comment');
    });
  });

  describe('Layer 3: remove comment-only lines', () => {
    test('removes pure comment lines', () => {
      const input = `// This is a comment
const x = 1;
// Another comment
const y = 2;`;
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).not.toContain('This is a comment');
      expect(result.compressed).not.toContain('Another comment');
      expect(result.compressed).toContain('const x = 1;');
      expect(result.compressed).toContain('const y = 2;');
    });

    test('removes Python comment lines', () => {
      const input = `# This is a comment
x = 1
# Another comment
y = 2`;
      const result = compressor.compress(input, makeDetection('code-py'));
      expect(result.compressed).not.toContain('This is a comment');
      expect(result.compressed).toContain('x = 1');
    });

    test('preserves JSDoc first line', () => {
      const input = `/** This is the summary */
function foo() {}`;
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('/** This is the summary */');
    });

    test('preserves TODO in comments', () => {
      const input = `// TODO: implement this
function foo() {}`;
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('TODO: implement this');
    });

    test('preserves PHP 8 attribute lines', () => {
      const input = `<?php
class ApiController {
    #[Route('/api/users', methods: ['GET'])]
    public function listUsers() {
        return $this->users();
    }
}`;
      const result = compressor.compress(input, makeDetection('code-php'));
      expect(result.compressed).toContain("#[Route('/api/users', methods: ['GET'])]");
      expect(result.compressed).toContain('public function listUsers()');
    });

    test('preserves PHP heredoc bodies', () => {
      const input = `<?php
class TemplateBuilder {
    public function html() {
        return <<<HTML
<h1>Title</h1>
// This is HTML, not a comment
# also not a comment
HTML;
    }
}`;
      const result = compressor.compress(input, makeDetection('code-php'));
      expect(result.compressed).toContain('// This is HTML, not a comment');
      expect(result.compressed).toContain('# also not a comment');
      expect(result.compressed).toContain('HTML;');
    });
  });

  describe('Layer 4: shorten import paths', () => {
    test('shortens deeply nested relative imports', () => {
      const input = "import { x } from '../../../deeply/nested/module';";
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain("from '…/module'");
    });

    test('does not shorten shallow imports', () => {
      const input = "import { x } from '../module';";
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain("from '../module'");
    });
  });

  describe('compression metadata', () => {
    test('reports applied layers', () => {
      const input = `// comment line
const x = 42; // inline comment


const y = 0;`;
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.metadata.compressor).toBe('code');
      expect(result.metadata.layers.length).toBeGreaterThan(0);
      expect(result.metadata.originalSize).toBe(input.length);
      expect(result.metadata.compressedSize).toBeLessThan(input.length);
    });
  });

  describe('safety guarantees', () => {
    test('never removes actual code', () => {
      const input = `const add = (a: number, b: number): number => {
  return a + b;
};

const multiply = (a: number, b: number): number => {
  return a * b;
};`;
      const result = compressor.compress(input, makeDetection('code-ts'));
      expect(result.compressed).toContain('const add');
      expect(result.compressed).toContain('return a + b');
      expect(result.compressed).toContain('const multiply');
      expect(result.compressed).toContain('return a * b');
    });

    test('preserves docstring first line in Python', () => {
      const input = `class Foo:
    """This is the class docstring."""
    pass`;
      const result = compressor.compress(input, makeDetection('code-py'));
      expect(result.compressed).toContain('"""This is the class docstring."""');
    });
  });
});
