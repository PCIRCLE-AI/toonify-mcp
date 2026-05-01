/**
 * Debug Output Compressor — conservative reduction for test failures,
 * stack traces, compiler diagnostics, and repetitive debug logs.
 *
 * Goals:
 * - preserve actionable lines
 * - reduce obvious repetition and whitespace
 * - avoid inventing summaries
 */

import type { Compressor } from './compressor.js';
import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';

export class DebugOutputCompressor implements Compressor {
  readonly name = 'debug-output';
  readonly supportedTypes: ContentType[] = ['debug-output'];

  compress(content: string, _detection: DetectResult): CompressResult {
    const layers: string[] = [];
    let result = content;

    const afterBlanks = this.mergeBlankLines(result);
    if (afterBlanks !== result) { layers.push('merge-blank-lines'); result = afterBlanks; }

    const afterExcerpt = this.collapseSourceExcerptNoise(result);
    if (afterExcerpt !== result) { layers.push('collapse-source-excerpts'); result = afterExcerpt; }

    const afterPointers = this.removePointerOnlyLines(result);
    if (afterPointers !== result) { layers.push('remove-pointer-lines'); result = afterPointers; }

    const afterSimilarDiagnostics = this.collapseSimilarDiagnosticLines(result);
    if (afterSimilarDiagnostics !== result) { layers.push('collapse-similar-diagnostics'); result = afterSimilarDiagnostics; }

    const afterDuplicates = this.collapseDuplicateLines(result);
    if (afterDuplicates !== result) { layers.push('collapse-duplicate-lines'); result = afterDuplicates; }

    const afterStack = this.collapseLongStackTraces(result);
    if (afterStack !== result) { layers.push('collapse-stack-traces'); result = afterStack; }

    result = result
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n';

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

  private mergeBlankLines(content: string): string {
    return content.replace(/\n{3,}/g, '\n\n');
  }

  private collapseSourceExcerptNoise(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      const nextTrimmed = lines[i + 1]?.trimStart() || '';

      if (/^\d+\s+\|/.test(trimmed)) {
        // Drop unhighlighted numbered context lines from excerpt blocks.
        continue;
      }

      // Drop TypeScript-style excerpt lines when the diagnostic header already
      // includes the file and line number, and the next line is only a pointer.
      if (/^\d+\s{2,}\S/.test(trimmed) && /^\s*[|]?\s*(\^+|~+)\s*$/.test(nextTrimmed)) {
        continue;
      }

      // Keep highlighted lines like `> 43 | expect(...)`
      result.push(line);
    }

    return result.join('\n');
  }

  private collapseSimilarDiagnosticLines(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const key = this.getNormalizedDiagnosticKey(lines[i]);
      if (!key) {
        result.push(lines[i]);
        i++;
        continue;
      }

      let repeatCount = 1;
      let j = i + 1;
      let separatorCount = 0;

      while (j < lines.length) {
        if (lines[j].trim() === '') {
          separatorCount++;
          j++;
          continue;
        }

        const nextKey = this.getNormalizedDiagnosticKey(lines[j]);
        if (nextKey === key && separatorCount <= 2) {
          repeatCount++;
          separatorCount = 0;
          j++;
          continue;
        }

        break;
      }

      result.push(lines[i]);
      if (repeatCount > 1) {
        result.push(`[toonify] similar diagnostic repeated ${repeatCount - 1} more time${repeatCount > 2 ? 's' : ''}`);
      }

      if (j < lines.length && result[result.length - 1] !== '' && lines[j - 1]?.trim() === '') {
        result.push('');
      }

      i = j;
    }

    return result.join('\n');
  }

  private removePointerOnlyLines(content: string): string {
    return content
      .split('\n')
      .filter(line => !/^\s*[|]?\s*(\^+|~+)\s*$/.test(line))
      .join('\n');
  }

  private collapseDuplicateLines(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const current = lines[i];
      let count = 1;

      while (i + count < lines.length && lines[i + count] === current) {
        count++;
      }

      if (count === 1) {
        result.push(current);
      } else {
        result.push(current);
        result.push(`[toonify] repeated ${count - 1} more time${count > 2 ? 's' : ''}`);
      }

      i += count;
    }

    return result.join('\n');
  }

  private collapseLongStackTraces(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    let i = 0;
    while (i < lines.length) {
      if (!this.isStackFrame(lines[i])) {
        result.push(lines[i]);
        i++;
        continue;
      }

      const frames: string[] = [];
      while (i < lines.length && this.isStackFrame(lines[i])) {
        frames.push(lines[i]);
        i++;
      }

      if (frames.length <= 5) {
        result.push(...frames);
        continue;
      }

      result.push(...frames.slice(0, 4));
      result.push(`[toonify] ${frames.length - 5} more stack frame${frames.length - 5 > 1 ? 's' : ''} omitted`);
      result.push(frames[frames.length - 1]);
    }

    return result.join('\n');
  }

  private isStackFrame(line: string): boolean {
    const trimmed = line.trimStart();
    return /^at\s+.+/.test(trimmed) || /^File\s+"[^"]+",\s+line\s+\d+/.test(trimmed);
  }

  private getNormalizedDiagnosticKey(line: string): string | null {
    const trimmed = line.trim();

    const tscMatch = trimmed.match(/^[\w./-]+\.[A-Za-z0-9]+:\d+:\d+\s+-\s+(error|warning)\s+([A-Z]+\d+):\s+(.+)$/);
    if (tscMatch) {
      return `tsc:${tscMatch[1]}:${tscMatch[2]}:${tscMatch[3].replace(/\s+/g, ' ')}`;
    }

    const eslintMatch = trimmed.match(/^\d+:\d+\s+(error|warning)\s+(.+?)\s{2,}(@[^\s]+\/[^\s]+|[^\s]+)$/);
    if (eslintMatch) {
      return `lint:${eslintMatch[1]}:${eslintMatch[2].replace(/\s+/g, ' ')}:${eslintMatch[3]}`;
    }

    return null;
  }
}
