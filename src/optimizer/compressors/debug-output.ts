/**
 * Debug Output Compressor — conservative reduction for test failures,
 * stack traces, compiler diagnostics, and repetitive debug logs.
 *
 * Goals:
 * - preserve actionable lines
 * - reduce obvious repetition and whitespace
 * - avoid inventing summaries
 *
 * This class is intentionally kept in lockstep with compressDebugOutput()
 * and its helpers in hooks/post-tool-use.mjs — the hook is a standalone
 * .mjs with no build step, so it can't import from here and duplicates
 * this logic instead. Edit both together; a fix applied to only one (e.g.
 * the omitted-line marker or the location-preserving dedup key) will
 * silently diverge otherwise.
 */

import type { Compressor } from './compressor.js';
import type { ContentType, DetectResult, CompressResult } from '../pipeline/types.js';
import { capLineLengths } from '../pipeline/detector.js';

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
    let omitted = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      const nextTrimmed = lines[i + 1]?.trimStart() || '';

      if (/^\d+\s+\|/.test(trimmed)) {
        // Drop unhighlighted numbered context lines from excerpt blocks.
        omitted++;
        continue;
      }

      // Drop TypeScript-style excerpt lines when the diagnostic header already
      // includes the file and line number, and the next line is only a pointer.
      //
      // Regression: this pointer-line regex has the same
      // ambiguous-character-class ReDoS as hasMultipleFileLocationDiagnostics
      // (already fixed in Detector), but this call runs on the full,
      // uncapped content passed into compress() — Pipeline.run() never caps
      // it, only Detector.detectDebugOutput()'s internal scoring does.
      // Verified directly against the compiled compressor: an adversarial
      // payload took ~14s here before this fix. capLineLengths(nextTrimmed)
      // no-ops for any real pointer line (always short), so this changes
      // nothing for legitimate content — only what the vulnerable regex
      // sees is bounded, the actual line kept/dropped is still the real one.
      if (/^\d+\s{2,}\S/.test(trimmed) && /^\s*[|]?\s*(\^+|~+)\s*$/.test(capLineLengths(nextTrimmed))) {
        omitted++;
        continue;
      }

      // Keep highlighted lines like `> 43 | expect(...)`
      result.push(line);
    }

    // One summary marker for the whole document rather than one per drop
    // cluster — these lines duplicate the file:line:col already stated in
    // the diagnostic header above them, so per-cluster markers would often
    // cost more text than the noise they replace. The point is to avoid a
    // *zero*-indication silent drop, not to preserve per-line detail here.
    if (omitted > 0) {
      result.push(`[toonify] ${omitted} source excerpt line${omitted > 1 ? 's' : ''} omitted throughout`);
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
      const otherLocations: string[] = [];
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
          const loc = this.getDiagnosticLocation(lines[j]);
          if (loc) otherLocations.push(loc);
          separatorCount = 0;
          j++;
          continue;
        }

        break;
      }

      result.push(lines[i]);
      if (repeatCount > 1) {
        const suffix = otherLocations.length > 0 ? ` (also at ${otherLocations.join(', ')})` : '';
        result.push(`[toonify] similar diagnostic repeated ${repeatCount - 1} more time${repeatCount > 2 ? 's' : ''}${suffix}`);
      }

      if (j < lines.length && result[result.length - 1] !== '' && lines[j - 1]?.trim() === '') {
        result.push('');
      }

      i = j;
    }

    return result.join('\n');
  }

  private removePointerOnlyLines(content: string): string {
    // Drop pointer-only lines (nothing but ^^^ / ~~~ carets + whitespace).
    // This is the one collapse step with NO omission marker, deliberately:
    // a caret line has zero semantic payload — a visual underline of the
    // line above, which is preserved — so there's nothing to signal was
    // lost, unlike the content-bearing drops that all emit a marker.
    //
    // Same ReDoS-vulnerable regex as collapseSourceExcerptNoise — test the
    // capped form of each line for the same reason (real pointer lines are
    // always short; only adversarial padding is affected). The filter
    // decision applies to the real, uncapped line, so no content is ever
    // truncated.
    return content
      .split('\n')
      .filter(line => !/^\s*[|]?\s*(\^+|~+)\s*$/.test(capLineLengths(line)))
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

    const tscMatch = trimmed.match(/^([\w./-]+\.[A-Za-z0-9]+:\d+:\d+)\s+-\s+(error|warning)\s+([A-Z]+\d+):\s+(.+)$/);
    if (tscMatch) {
      return `tsc:${tscMatch[2]}:${tscMatch[3]}:${tscMatch[4].replace(/\s+/g, ' ')}`;
    }

    const eslintMatch = trimmed.match(/^(\d+:\d+)\s+(error|warning)\s+(.+?)\s{2,}(@[^\s]+\/[^\s]+|[^\s]+)$/);
    if (eslintMatch) {
      return `lint:${eslintMatch[2]}:${eslintMatch[3].replace(/\s+/g, ' ')}:${eslintMatch[4]}`;
    }

    return null;
  }

  // Location this diagnostic line refers to (file:line:col for tsc, line:col
  // for eslint), used only to avoid silently dropping WHERE collapsed
  // occurrences were, not for the dedup key itself — grouping by location
  // would defeat collapsing genuinely repeated diagnostics.
  private getDiagnosticLocation(line: string): string | null {
    const trimmed = line.trim();

    const tscMatch = trimmed.match(/^([\w./-]+\.[A-Za-z0-9]+:\d+:\d+)\s+-\s+(error|warning)\s+[A-Z]+\d+:/);
    if (tscMatch) return tscMatch[1];

    const eslintMatch = trimmed.match(/^(\d+:\d+)\s+(error|warning)\s+/);
    if (eslintMatch) return eslintMatch[1];

    return null;
  }
}
