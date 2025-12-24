/**
 * Type definitions for token optimization
 */

export interface OptimizationResult {
  optimized: boolean;
  originalContent: string;
  optimizedContent?: string;
  originalTokens: number;
  optimizedTokens?: number;
  savings?: {
    tokens: number;
    percentage: number;
  };
  format?: 'json' | 'csv' | 'yaml' | 'unknown';
  reason?: string; // Why optimization was skipped
}

export interface ToolMetadata {
  toolName: string;
  contentType?: string;
  size: number;
}

export interface StructuredData {
  type: 'json' | 'csv' | 'yaml';
  data: any;
  confidence: number;
}

export interface OptimizationConfig {
  enabled: boolean;
  minTokensThreshold: number; // Only optimize if content > N tokens
  minSavingsThreshold: number; // Only use if savings > N%
  maxProcessingTime: number; // Max ms to spend optimizing
  skipToolPatterns?: string[]; // Tool names to skip
}

export interface TokenStats {
  totalRequests: number;
  optimizedRequests: number;
  tokensBeforeOptimization: number;
  tokensAfterOptimization: number;
  totalSavings: number;
  averageSavingsPercentage: number;
}
