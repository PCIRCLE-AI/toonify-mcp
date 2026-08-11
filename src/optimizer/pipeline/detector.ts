/**
 * Content type detector — identifies JSON, YAML, code, or debug output
 *
 * CSV is deliberately not detected. Encoding CSV as TOON was reported as a
 * net loss at every size tried, -17.1% / -16.7% / -15.4% at 50 / 500 / 2000
 * rows (external audit); independently reproduced here with a differently
 * shaped CSV fixture at -9.7% / -9.0% / -8.5% for the same row counts. Both
 * runs agree on the sign (always a loss), so detecting CSV only bought a
 * parse + encode + reject cycle for no benefit.
 */

import yaml from 'yaml';
import type { DetectResult } from './types.js';

/**
 * ReDoS guard for detectDebugOutput()'s regex heuristics.
 *
 * hasMultipleFileLocationDiagnostics()'s /\b[\w./-]+\.(ts|...):\d+:\d+\b/g
 * has an ambiguous overlap between the `.` inside its character class and
 * the literal `.` before the extension: on a run like "a.a.a.a...." with no
 * valid `:line:col` suffix, the engine backtracks through the whole run at
 * every position — O(n^2). The same class of blowup hits
 * /^\s*at\s+.+\(.+:\d+:\d+\)/m in detectDebugOutput() (two greedy `.+` with
 * no closing `:N:N)` ever appearing). Verified independently: doubling
 * input length roughly quadrupled match time for both regexes (clean
 * quadratic fit). This is reachable through TokenOptimizer.optimize(), and
 * while the entry-time size guard there bounds content to ~800,000 chars at
 * default config, that bound was calibrated against TOON-encoding JSON —
 * an entirely different cost profile — so content that isn't JSON/YAML at
 * all can still pass that guard and then take orders of magnitude longer
 * than the maxProcessingTime budget the guard is meant to enforce.
 *
 * Fix is structural rather than per-regex: legitimate debug output (stack
 * traces, compiler diagnostics, test failures) never has a single line more
 * than a few hundred characters long, so capping line length before ANY of
 * these heuristic regexes run bounds worst-case backtracking to a constant
 * per line — regardless of whether some other regex here has a similar
 * latent ambiguity that hasn't been found yet. Mirrors the identical fix in
 * hooks/post-tool-use.mjs — fix both together so they don't drift.
 */
const MAX_LINE_LENGTH_FOR_SCAN = 2000;

function capLineLengths(content: string): string {
  const lines = content.split('\n');
  let capped = false;
  const result = lines.map(line => {
    if (line.length > MAX_LINE_LENGTH_FOR_SCAN) {
      capped = true;
      return line.slice(0, MAX_LINE_LENGTH_FOR_SCAN);
    }
    return line;
  });
  return capped ? result.join('\n') : content;
}

export class Detector {
  /**
   * Detect content type with confidence score.
   * Returns the best match or { type: 'unknown', confidence: 0 }.
   */
  detect(content: string): DetectResult {
    // Try JSON first (highest confidence when it works)
    const jsonResult = this.tryJSON(content);
    if (jsonResult) return jsonResult;

    // Try YAML (only if structurally complex)
    const yamlResult = this.tryYAML(content);
    if (yamlResult) return yamlResult;

    // Try code detection
    const codeResult = this.detectCode(content);
    if (codeResult) return codeResult;

    // Try debug-heavy output after structured data and code detection.
    const debugResult = this.detectDebugOutput(content);
    if (debugResult) return debugResult;

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Detect debug-heavy output such as test failures, stack traces,
   * compiler diagnostics, and repetitive build/lint output.
   *
   * This is currently exposed for upcoming pipeline work and regression tests.
   */
  detectDebugOutput(content: string): DetectResult | null {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 4) return null;

    const scanContent = capLineLengths(content);
    let score = 0;

    if (/\b(FAIL|FAILURES?|AssertionError|Traceback|Caused by:|UnhandledPromiseRejection)\b/m.test(scanContent)) {
      score += 2;
    }

    if (/\berror TS\d+:/m.test(scanContent) || /^\s*error(\[[^\]]+\])?:/im.test(scanContent)) {
      score += 2;
    }

    if (/^\s*File\s+"[^"]+",\s+line\s+\d+/m.test(scanContent) || /^\w+(Error|Exception):\s+/m.test(scanContent)) {
      score += 2;
    }

    if (/^\s*at\s+.+:\d+:\d+/m.test(scanContent) || /^\s*at\s+.+\(.+:\d+:\d+\)/m.test(scanContent)) {
      score += 2;
    }

    if (/^\s*\d+:\d+\s+error\s{2,}.+/m.test(scanContent) || /^\s*\d+:\d+\s+warning\s{2,}.+/m.test(scanContent)) {
      score += 2;
    }

    if (/^\s*(Test Suites:|Tests:|Snapshots:|Time:|Ran all test suites)/m.test(scanContent)) {
      score += 1;
    }

    if (/^\s*[×✕]\s+/m.test(scanContent) || /^\s*>\s+.+$/m.test(scanContent)) {
      score += 1;
    }

    if (/^\s*npm ERR!/m.test(scanContent) || /^\s*error Command failed/m.test(scanContent)) {
      score += 1;
    }

    if (this.hasRepeatedDiagnosticLines(lines)) {
      score += 1;
    }

    if (this.hasMultipleFileLocationDiagnostics(scanContent)) {
      score += 1;
    }

    if (score < 3) return null;

    const confidence = Math.min(0.92, 0.55 + score * 0.05);
    return { type: 'debug-output', confidence };
  }

  private tryJSON(content: string): DetectResult | null {
    try {
      const data = JSON.parse(content);
      if (typeof data === 'object' && data !== null) {
        return { type: 'json', confidence: 1.0, data };
      }
    } catch {}
    return null;
  }

  private tryYAML(content: string): DetectResult | null {
    if (!this.looksLikeYAML(content)) return null;
    try {
      const data = yaml.parse(content);
      if (typeof data === 'object' && data !== null) {
        return { type: 'yaml', confidence: 0.9, data };
      }
    } catch {}
    return null;
  }

  /**
   * Detect code by language using content heuristics
   */
  detectCode(content: string): DetectResult | null {
    const lines = content.split('\n');
    if (lines.length < 3) return null;

    const sample = capLineLengths(lines.slice(0, 50).join('\n'));

    // TypeScript/JavaScript
    if (this.looksLikeTypeScript(sample)) {
      return { type: 'code-ts', confidence: 0.85 };
    }

    // Python
    if (this.looksLikePython(sample)) {
      return { type: 'code-py', confidence: 0.85 };
    }

    // PHP
    if (this.looksLikePHP(sample)) {
      return { type: 'code-php', confidence: 0.85 };
    }

    // Go
    if (this.looksLikeGo(sample)) {
      return { type: 'code-go', confidence: 0.85 };
    }

    // Generic code (has code-like patterns but no specific language)
    if (this.looksLikeGenericCode(sample)) {
      return { type: 'code-generic', confidence: 0.6 };
    }

    return null;
  }

  // --- Language heuristics ---

  private looksLikeTypeScript(sample: string): boolean {
    const indicators = [
      /\bimport\s+.*\bfrom\s+['"]/,       // import ... from '...'
      /\bexport\s+(default\s+)?(class|function|const|interface|type)\b/,
      /:\s*(string|number|boolean|void)\b/, // type annotations
      /=>\s*[{(]/,                          // arrow functions
      /\binterface\s+\w+/,                 // interface declarations
      /\bconst\s+\w+\s*:\s*\w+/,           // const x: Type
    ];
    let matches = 0;
    for (const pattern of indicators) {
      if (pattern.test(sample)) matches++;
    }
    return matches >= 2;
  }

  private looksLikePython(sample: string): boolean {
    const indicators = [
      /^def\s+\w+\s*\(/m,                  // def function(
      /^class\s+\w+.*:/m,                  // class Name:
      /^from\s+\w+\s+import\b/m,           // from x import
      /^import\s+\w+/m,                    // import x
      /^\s+self\./m,                        // self.
      /:\s*$\n\s+/m,                        // colon + indented block
    ];
    let matches = 0;
    for (const pattern of indicators) {
      if (pattern.test(sample)) matches++;
    }
    return matches >= 2;
  }

  private looksLikePHP(sample: string): boolean {
    const indicators = [
      /^<\?php\b/m,                            // <?php opening tag
      /\bnamespace\s+[\w\\]+;/m,               // namespace App\Services;
      /\buse\s+[\w\\]+;/m,                     // use Illuminate\...;
      /\bfunction\s+\w+\s*\(/m,               // function name(
      /\$this->/,                              // $this->property
      /\bpublic\s+(static\s+)?(function|readonly)\b/m, // public function / public readonly
    ];
    let matches = 0;
    for (const pattern of indicators) {
      if (pattern.test(sample)) matches++;
    }
    return matches >= 2;
  }

  private looksLikeGo(sample: string): boolean {
    const indicators = [
      /^package\s+\w+/m,                   // package main
      /^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/m, // func (r *T) Name(
      /\bfmt\.\w+/,                         // fmt.Println
      /\b:=\s/,                             // short variable declaration
      /^import\s+\(/m,                      // import (
      /\berr\s*!=\s*nil\b/,                 // err != nil
    ];
    let matches = 0;
    for (const pattern of indicators) {
      if (pattern.test(sample)) matches++;
    }
    return matches >= 2;
  }

  private looksLikeGenericCode(sample: string): boolean {
    const codePatterns = [
      /[{}\[\]();]/,                        // braces, brackets, parens
      /\b(function|class|return|if|else|for|while)\b/,
      /\/\/.+$/m,                           // single-line comments
      /^\s{2,}\S/m,                         // indented code
    ];
    let matches = 0;
    for (const pattern of codePatterns) {
      if (pattern.test(sample)) matches++;
    }
    return matches >= 3;
  }

  private hasRepeatedDiagnosticLines(lines: string[]): boolean {
    const counts = new Map<string, number>();

    for (const line of lines) {
      const normalized = line
        .trim()
        .replace(/\d+/g, '#')
        .replace(/\s+/g, ' ');

      if (normalized.length < 12) continue;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    for (const count of counts.values()) {
      if (count >= 2) return true;
    }

    return false;
  }

  private hasMultipleFileLocationDiagnostics(content: string): boolean {
    const locationMatches = content.match(/\b[\w./-]+\.(ts|tsx|js|jsx|py|go|php):\d+:\d+\b/g) || [];
    const tracebackMatches = content.match(/^\s*File\s+"[^"]+",\s+line\s+\d+/gm) || [];
    return locationMatches.length >= 2 || tracebackMatches.length >= 2;
  }

  // --- Structured data heuristics (extracted from token-optimizer.ts) ---

  private looksLikeYAML(content: string): boolean {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 3) return false;

    const yamlLinePattern = /^\s*[\w][\w\s.-]*:\s*.+/;
    const listItemPattern = /^\s*-\s+/;
    const indentedPattern = /^\s{2,}\S/;

    let yamlLines = 0;
    let listItems = 0;
    let indented = 0;

    for (const line of lines.slice(0, 20)) {
      if (yamlLinePattern.test(line)) yamlLines++;
      if (listItemPattern.test(line)) listItems++;
      if (indentedPattern.test(line)) indented++;
    }

    const hasStructure = (yamlLines >= 3) || (listItems >= 2 && indented >= 2);
    const yamlDensity = (yamlLines + listItems) / Math.min(lines.length, 20);

    return hasStructure && yamlDensity >= 0.3;
  }
}
