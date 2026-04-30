/**
 * Pipeline type definitions
 */

export type ContentType =
  | 'json' | 'csv' | 'yaml'
  | 'debug-output'
  | 'code-ts' | 'code-py' | 'code-go' | 'code-php' | 'code-generic'
  | 'unknown';

export interface DetectResult {
  type: ContentType;
  confidence: number;
  /** Parsed data for structured formats (JSON/CSV/YAML) */
  data?: Record<string, unknown> | unknown[];
}

export interface CompressResult {
  compressed: string;
  metadata: {
    compressor: string;
    layers: string[];
    originalSize: number;
    compressedSize: number;
  };
}

export interface PipelineResult {
  optimized: boolean;
  content: string;
  originalTokens: number;
  optimizedTokens?: number;
  savings?: {
    tokens: number;
    percentage: number;
  };
  format?: ContentType;
  compressMetadata?: CompressResult['metadata'];
  reason?: string;
}
