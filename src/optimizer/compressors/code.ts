/**
 * Code Compressor — heuristic-based compression for source code
 *
 * 6 layers from safe to aggressive:
 * 1. Merge consecutive blank lines → 1
 * 2. Remove inline comments (// and block comments)
 * 3. Remove comment-only lines
 * 4. Shorten long import paths
 * 5. Summarize consecutive imports (>500 tokens only)
 * 6. Collapse repetitive patterns (>500 tokens only)
 *
 * Safety: never deletes code logic, preserves TODO/FIXME, preserves docstring first line.
 */

import type { Compressor } from './compressor.js';
import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';

/** Minimum estimated tokens to enable aggressive layers (5-6) */
const AGGRESSIVE_THRESHOLD = 500;

/** Estimated tokens per character for threshold check */
const CHARS_PER_TOKEN = 4;

export class CodeCompressor implements Compressor {
  readonly name = 'code';
  readonly supportedTypes: ContentType[] = ['code-ts', 'code-py', 'code-go', 'code-php', 'code-generic'];

  compress(content: string, detection: DetectResult): CompressResult {
    const layers: string[] = [];
    let result = content;

    // Layer 1: Merge consecutive blank lines
    const afterBlanks = this.mergeBlankLines(result);
    if (afterBlanks !== result) { layers.push('merge-blank-lines'); result = afterBlanks; }

    // Layer 2: Remove inline comments
    const afterInline = this.removeInlineComments(result, detection.type);
    if (afterInline !== result) { layers.push('remove-inline-comments'); result = afterInline; }

    // Layer 3: Remove comment-only lines
    const afterCommentLines = this.removeCommentOnlyLines(result, detection.type);
    if (afterCommentLines !== result) { layers.push('remove-comment-lines'); result = afterCommentLines; }

    // Layer 4: Shorten import paths
    const afterImports = this.shortenImportPaths(result, detection.type);
    if (afterImports !== result) { layers.push('shorten-imports'); result = afterImports; }

    // Aggressive layers only for large files
    const estimatedTokens = content.length / CHARS_PER_TOKEN;
    if (estimatedTokens > AGGRESSIVE_THRESHOLD) {
      // Layer 5: Summarize consecutive imports
      const afterSummary = this.summarizeImports(result, detection.type);
      if (afterSummary !== result) { layers.push('summarize-imports'); result = afterSummary; }

      // Layer 6: Collapse repetitive patterns
      const afterCollapse = this.collapseRepetitive(result);
      if (afterCollapse !== result) { layers.push('collapse-repetitive'); result = afterCollapse; }
    }

    // Final cleanup: remove trailing whitespace on each line + trailing newlines
    result = result.split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

    return {
      compressed: result,
      metadata: {
        compressor: this.name,
        layers,
        originalSize: content.length,
        compressedSize: result.length,
      },
    };
  }

  // --- Layer 1: Merge blank lines ---

  private mergeBlankLines(content: string): string {
    return content.replace(/\n{3,}/g, '\n\n');
  }

  // --- Layer 2: Remove inline comments ---

  private removeInlineComments(content: string, type: ContentType): string {
    if (type === 'code-php') {
      const result: string[] = [];
      let heredocTerminator: string | null = null;

      for (const line of content.split('\n')) {
        if (heredocTerminator) {
          result.push(line);
          if (this.isPhpHeredocEnd(line, heredocTerminator)) {
            heredocTerminator = null;
          }
          continue;
        }

        const nextHeredocTerminator = this.getPhpHeredocTerminator(line);
        if (nextHeredocTerminator) {
          heredocTerminator = nextHeredocTerminator;
          result.push(line);
          continue;
        }

        // Preserve TODO/FIXME comments
        if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
          result.push(line);
          continue;
        }

        // Preserve lines that are ONLY comments (Layer 3 handles those)
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
          result.push(line);
          continue;
        }

        if (/https?:\/\//.test(line)) {
          result.push(line);
          continue;
        }

        // PHP supports both // and # as inline comment styles.
        const afterSlash = this.removeInlineCStyleComment(line);
        result.push(afterSlash !== line ? afterSlash : this.removeInlinePythonComment(line, true));
      }

      return result.join('\n');
    }

    return content.split('\n').map(line => {
      // Preserve TODO/FIXME comments
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) return line;

      // Preserve lines that are ONLY comments (Layer 3 handles those)
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) return line;

      if (type === 'code-py') {
        // Python: remove inline # comments (but not inside strings)
        return this.removeInlinePythonComment(line);
      } else {
        // TS/Go/Generic: remove inline // comments (but not URLs)
        return this.removeInlineCStyleComment(line);
      }
    }).join('\n');
  }

  private removeInlineCStyleComment(line: string): string {
    // Don't touch lines with URLs containing //
    if (/https?:\/\//.test(line)) return line;

    // Find // that's not inside a string
    let inString: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inString) {
        if (char === inString && line[i - 1] !== '\\') inString = null;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = char;
        continue;
      }

      if (char === '/' && line[i + 1] === '/') {
        // Found inline comment — check if the remaining part is just a comment
        const before = line.slice(0, i).trimEnd();
        if (before.length === 0) return line; // Pure comment line, keep
        return before;
      }
    }
    return line;
  }

  private removeInlinePythonComment(line: string, preservePhpAttributeSyntax = false): string {
    let inString: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inString) {
        if (char === inString && line[i - 1] !== '\\') inString = null;
        continue;
      }

      if (char === '"' || char === "'" || (preservePhpAttributeSyntax && char === '`')) {
        // Check for triple quotes
        if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") {
          return line; // Don't mess with docstrings
        }
        inString = char;
        continue;
      }

      if (char === '#') {
        if (preservePhpAttributeSyntax && line[i + 1] === '[') {
          continue;
        }
        const before = line.slice(0, i).trimEnd();
        if (before.length === 0) return line; // Pure comment line
        return before;
      }
    }
    return line;
  }

  // --- Layer 3: Remove comment-only lines ---

  private removeCommentOnlyLines(content: string, type: ContentType): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inBlockComment = false;
    let inDocstring = false;
    let docstringFirstLine = false;
    let phpHeredocTerminator: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();

      if (type === 'code-php') {
        if (phpHeredocTerminator) {
          result.push(lines[i]);
          if (this.isPhpHeredocEnd(lines[i], phpHeredocTerminator)) {
            phpHeredocTerminator = null;
          }
          continue;
        }

        const nextHeredocTerminator = this.getPhpHeredocTerminator(lines[i]);
        if (nextHeredocTerminator) {
          phpHeredocTerminator = nextHeredocTerminator;
          result.push(lines[i]);
          continue;
        }
      }

      // Preserve TODO/FIXME in any comment
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(trimmed)) {
        result.push(lines[i]);
        continue;
      }

      // Handle block comments (/* ... */)
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        continue; // Skip block comment lines
      }

      if (trimmed.startsWith('/*')) {
        // Preserve JSDoc first line (/** ... )
        if (trimmed.startsWith('/**')) {
          // Keep the summary line of JSDoc
          result.push(lines[i]);
          if (!trimmed.includes('*/')) inBlockComment = true;
          continue;
        }
        if (!trimmed.includes('*/')) inBlockComment = true;
        continue;
      }

      // Handle Python docstrings
      if (type === 'code-py') {
        if ((trimmed.startsWith('"""') || trimmed.startsWith("'''")) && !inDocstring) {
          // Preserve first line of docstring
          result.push(lines[i]);
          if (trimmed.slice(3).includes(trimmed.slice(0, 3))) {
            // Single-line docstring — keep it
            continue;
          }
          inDocstring = true;
          docstringFirstLine = true;
          continue;
        }
        if (inDocstring) {
          if (docstringFirstLine) {
            docstringFirstLine = false;
          }
          if (trimmed.includes('"""') || trimmed.includes("'''")) {
            inDocstring = false;
          }
          continue; // Skip docstring body lines
        }
      }

      // Single-line comments
      if (type === 'code-py' && trimmed.startsWith('#')) {
        continue;
      }
      if (type === 'code-php' && (trimmed.startsWith('//') || (trimmed.startsWith('#') && !trimmed.startsWith('#[')))) {
        continue;
      }
      if ((type === 'code-ts' || type === 'code-go' || type === 'code-generic') && trimmed.startsWith('//')) {
        continue;
      }

      result.push(lines[i]);
    }

    return result.join('\n');
  }

  private getPhpHeredocTerminator(line: string): string | null {
    const match = line.match(/<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[ \t]*$/);
    return match ? match[2] : null;
  }

  private isPhpHeredocEnd(line: string, terminator: string): boolean {
    const escaped = terminator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s*${escaped};?\\s*$`).test(line);
  }

  // --- Layer 4: Shorten import paths ---

  private shortenImportPaths(content: string, type: ContentType): string {
    if (type === 'code-ts' || type === 'code-generic') {
      // Shorten: import x from '../../deeply/nested/path/module'
      //       → import x from '…/module'
      return content.replace(
        /(from\s+['"])(\.\.\/){2,}[^'"]*\/([^'"]+)(['"])/g,
        '$1…/$3$4'
      );
    }
    return content;
  }

  // --- Layer 5: Summarize consecutive imports ---

  private summarizeImports(content: string, type: ContentType): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let importBlock: string[] = [];

    const isImport = (line: string) => {
      const t = line.trimStart();
      if (type === 'code-ts' || type === 'code-generic') return t.startsWith('import ');
      if (type === 'code-py') return t.startsWith('import ') || t.startsWith('from ');
      if (type === 'code-go') return t.startsWith('import ') || t === 'import (' || /^\s+"/.test(t);
      return false;
    };

    const flushImports = () => {
      if (importBlock.length <= 5) {
        result.push(...importBlock);
      } else {
        // Keep first 3, summarize rest
        result.push(...importBlock.slice(0, 3));
        result.push(`// ... ${importBlock.length - 3} more imports`);
      }
      importBlock = [];
    };

    for (const line of lines) {
      if (isImport(line)) {
        importBlock.push(line);
      } else {
        if (importBlock.length > 0) flushImports();
        result.push(line);
      }
    }
    if (importBlock.length > 0) flushImports();

    return result.join('\n');
  }

  // --- Layer 6: Collapse repetitive patterns ---

  private collapseRepetitive(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let repeatStart = -1;
    let repeatPattern = '';
    let repeatCount = 0;

    const getStructure = (line: string): string => {
      // Normalize a line to its "structure" — replace literals with placeholders
      return line
        .replace(/['"][^'"]*['"]/g, '"…"')       // string literals
        .replace(/\b\d+\b/g, 'N')                 // numbers
        .replace(/\b[a-z][a-zA-Z0-9]*\d+\b/g, 'ID') // identifiers with numbers (test1, item2)
        .trim();
    };

    for (let i = 0; i < lines.length; i++) {
      const structure = getStructure(lines[i]);

      if (structure === repeatPattern && structure.length > 10) {
        repeatCount++;
      } else {
        // Flush previous repeat block
        if (repeatCount >= 5) {
          // Keep first 3 of the repeat block, summarize rest
          for (let j = repeatStart; j < repeatStart + 3 && j < lines.length; j++) {
            result.push(lines[j]);
          }
          result.push(`// ... ${repeatCount - 2} more similar lines`);
        } else {
          // Not enough repeats, keep all
          for (let j = repeatStart; j >= 0 && j < repeatStart + repeatCount && j < lines.length; j++) {
            result.push(lines[j]);
          }
        }

        repeatStart = i;
        repeatPattern = structure;
        repeatCount = 1;
      }
    }

    // Flush final block
    if (repeatCount >= 5) {
      for (let j = repeatStart; j < repeatStart + 3 && j < lines.length; j++) {
        result.push(lines[j]);
      }
      result.push(`// ... ${repeatCount - 2} more similar lines`);
    } else {
      for (let j = repeatStart; j >= 0 && j < repeatStart + repeatCount && j < lines.length; j++) {
        result.push(lines[j]);
      }
    }

    return result.join('\n');
  }
}
