/**
 * Content type detector — identifies JSON, CSV, YAML, or code
 */

import yaml from 'yaml';
import type { ContentType, DetectResult } from './types.js';

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

    // Try CSV
    const csvResult = this.tryCSV(content);
    if (csvResult) return csvResult;

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

    let score = 0;

    if (/\b(FAIL|FAILURES?|AssertionError|Traceback|Caused by:|UnhandledPromiseRejection)\b/m.test(content)) {
      score += 2;
    }

    if (/\berror TS\d+:/m.test(content) || /^\s*error(\[[^\]]+\])?:/im.test(content)) {
      score += 2;
    }

    if (/^\s*File\s+"[^"]+",\s+line\s+\d+/m.test(content) || /^\w+(Error|Exception):\s+/m.test(content)) {
      score += 2;
    }

    if (/^\s*at\s+.+:\d+:\d+/m.test(content) || /^\s*at\s+.+\(.+:\d+:\d+\)/m.test(content)) {
      score += 2;
    }

    if (/^\s*\d+:\d+\s+error\s{2,}.+/m.test(content) || /^\s*\d+:\d+\s+warning\s{2,}.+/m.test(content)) {
      score += 2;
    }

    if (/^\s*(Test Suites:|Tests:|Snapshots:|Time:|Ran all test suites)/m.test(content)) {
      score += 1;
    }

    if (/^\s*[×✕]\s+/m.test(content) || /^\s*>\s+.+$/m.test(content)) {
      score += 1;
    }

    if (/^\s*npm ERR!/m.test(content) || /^\s*error Command failed/m.test(content)) {
      score += 1;
    }

    if (this.hasRepeatedDiagnosticLines(lines)) {
      score += 1;
    }

    if (this.hasMultipleFileLocationDiagnostics(content)) {
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

  private tryCSV(content: string): DetectResult | null {
    if (!this.looksLikeCSV(content)) return null;
    try {
      const data = this.parseCSV(content);
      return { type: 'csv', confidence: 0.8, data };
    } catch {}
    return null;
  }

  /**
   * Detect code by language using content heuristics
   */
  detectCode(content: string): DetectResult | null {
    const lines = content.split('\n');
    if (lines.length < 3) return null;

    const sample = lines.slice(0, 50).join('\n');

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

  private looksLikeCSV(content: string): boolean {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return false;

    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    if (firstLineCommas === 0) return false;

    let matchingLines = 0;
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const commas = (lines[i].match(/,/g) || []).length;
      if (commas === firstLineCommas) matchingLines++;
    }

    return matchingLines >= Math.min(lines.length - 1, 7);
  }

  private parseCSV(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter(l => l.trim());
    const headers = this.parseCSVLine(lines[0]);

    return lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    fields.push(current.trim());
    return fields;
  }
}
