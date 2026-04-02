/**
 * Language detection for token estimation
 */

import { LANGUAGE_PROFILES, type LanguageProfile } from './language-profiles.js';

/** Expected characters per pattern match for density calculation */
const EXPECTED_CHARS_PER_MATCH = 5;

export interface LanguageDetectionResult {
  language: LanguageProfile;
  confidence: number;
  detectedPatterns: number;
}

/**
 * Pre-compiled global RegExp variants for each language profile pattern.
 * Created once at module load to avoid repeated `new RegExp()` calls per detection,
 * which would be both a performance issue and a potential ReDoS vector if patterns
 * were ever made configurable.
 */
const GLOBAL_PATTERNS: Map<LanguageProfile, RegExp[]> = new Map();
const TEST_PATTERNS: Map<LanguageProfile, RegExp[]> = new Map();

for (const profile of LANGUAGE_PROFILES) {
  GLOBAL_PATTERNS.set(
    profile,
    profile.detectionPatterns.map(p => new RegExp(p.source, 'g'))
  );
  TEST_PATTERNS.set(
    profile,
    profile.detectionPatterns.map(p => new RegExp(p.source, p.flags.replace('g', '')))
  );
}

export class LanguageDetector {
  private sampleSize: number;

  constructor(sampleSize: number = 500) {
    this.sampleSize = sampleSize;
  }

  /**
   * Detect language from text content
   */
  detect(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        language: LANGUAGE_PROFILES[0], // Default to English
        confidence: 0,
        detectedPatterns: 0
      };
    }

    // Use first N characters for detection (performance optimization)
    const sample = text.slice(0, this.sampleSize);

    // Score each language profile using pre-compiled global patterns
    const scores = LANGUAGE_PROFILES.map(profile => {
      let matchedPatterns = 0;
      let totalMatches = 0;

      const globalPatterns = GLOBAL_PATTERNS.get(profile)!;
      for (const pattern of globalPatterns) {
        pattern.lastIndex = 0; // Reset global regex state
        const matches = sample.match(pattern);
        if (matches && matches.length > 0) {
          matchedPatterns++;
          totalMatches += matches.length;
        }
      }

      // Calculate confidence based on:
      // 1. Number of patterns matched
      // 2. Total number of matches relative to sample size (density)
      // 3. Profile's inherent confidence
      const patternScore = matchedPatterns / profile.detectionPatterns.length;

      // Density score: how much of the text matches this language
      const sampleLength = Math.max(sample.length, 1);
      // For character-based languages (CJK, Arabic, etc.), matches can be very high
      const matchDensity = Math.min(totalMatches / (sampleLength / EXPECTED_CHARS_PER_MATCH), 1.0);
      const densityScore = matchDensity;

      // Adaptive weighting: if density is very high, trust it more
      // (many characters match = strong signal, even if only 1 pattern matched)
      const patternWeight = densityScore > 0.9 ? 0.4 : 0.7;
      const densityWeight = 1.0 - patternWeight;

      // Boost confidence for high-confidence scenarios
      let boost = 1.0;
      if (patternScore === 1.0) boost = 1.1; // All patterns matched
      if (densityScore > 0.95) boost = Math.max(boost, 1.05); // Very high density

      // Calculate final confidence
      const rawConfidence = (patternScore * patternWeight + densityScore * densityWeight) * boost;
      const confidence = Math.min(rawConfidence, 1.0) * profile.confidence;

      return {
        profile,
        confidence,
        matchedPatterns
      };
    });

    // Find the highest scoring language
    const best = scores.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );

    // If confidence is too low, default to English
    if (best.confidence < 0.1) {
      return {
        language: LANGUAGE_PROFILES[0], // English
        confidence: 0.5, // Low confidence fallback
        detectedPatterns: 0
      };
    }

    return {
      language: best.profile,
      confidence: best.confidence,
      detectedPatterns: best.matchedPatterns
    };
  }

  /**
   * Detect if text is mixed-language
   */
  detectMixed(text: string): LanguageProfile[] {
    const sample = text.slice(0, this.sampleSize);
    const detected: LanguageProfile[] = [];

    for (const profile of LANGUAGE_PROFILES) {
      const testPats = TEST_PATTERNS.get(profile)!;
      for (const pattern of testPats) {
        if (pattern.test(sample)) {
          detected.push(profile);
          break;
        }
      }
    }

    // Handle CJK overlap: Japanese Kanji overlaps with Chinese
    // If both Chinese and Japanese are detected, check for Japanese-specific characters
    const hasChinese = detected.some(p => p.code === 'zh');
    const hasJapanese = detected.some(p => p.code === 'ja');

    if (hasChinese && hasJapanese) {
      // Check for Hiragana or Katakana (Japanese-specific)
      const hasHiragana = /[\u3040-\u309f]/.test(sample);
      const hasKatakana = /[\u30a0-\u30ff]/.test(sample);

      if (!hasHiragana && !hasKatakana) {
        // No Japanese-specific characters, remove Japanese
        return detected.filter(p => p.code !== 'ja');
      }
    }

    return detected;
  }

  /**
   * Estimate token multiplier for mixed-language content
   */
  estimateMultiplierForMixed(languages: LanguageProfile[]): number {
    if (languages.length === 0) return 1.0;
    if (languages.length === 1) return languages[0].tokenMultiplier;

    // Use weighted average (favor higher multipliers for safety)
    const multipliers = languages.map(l => l.tokenMultiplier);
    const max = Math.max(...multipliers);
    const avg = multipliers.reduce((a, b) => a + b) / multipliers.length;

    // Weight toward max to be conservative
    return avg * 0.4 + max * 0.6;
  }

  /**
   * Estimate tokens with language awareness
   */
  estimateTokens(text: string, baseTokens: number): number {
    const detection = this.detect(text);

    // If very low confidence, use base tokens
    if (detection.confidence < 0.3) {
      return baseTokens;
    }

    // Apply language multiplier
    return Math.ceil(baseTokens * detection.language.tokenMultiplier);
  }

  /**
   * Estimate tokens for mixed-language content
   */
  estimateTokensMixed(text: string, baseTokens: number): number {
    const languages = this.detectMixed(text);
    const multiplier = this.estimateMultiplierForMixed(languages);
    return Math.ceil(baseTokens * multiplier);
  }

  /**
   * Get detailed language breakdown
   */
  analyze(text: string): {
    primary: LanguageDetectionResult;
    all: LanguageProfile[];
    estimatedMultiplier: number;
    isMixed: boolean;
  } {
    const primary = this.detect(text);
    const all = this.detectMixed(text);
    const isMixed = all.length > 1;
    const estimatedMultiplier = isMixed
      ? this.estimateMultiplierForMixed(all)
      : primary.language.tokenMultiplier;

    return {
      primary,
      all,
      estimatedMultiplier,
      isMixed
    };
  }
}
