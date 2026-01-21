/**
 * Caching strategies for different providers
 */

import type { CacheStrategy, CachedContent, AnthropicContentBlock, OpenAIMessageFormat } from './cache-types.js';

/**
 * Anthropic Prompt Caching Strategy
 * https://docs.anthropic.com/claude/docs/prompt-caching
 */
export const anthropicStrategy: CacheStrategy = {
  name: 'anthropic',

  shouldCache(content: string, tokens: number): boolean {
    // Anthropic requires minimum 1024 tokens for cache breakpoints
    // and minimum 2048 tokens for effective caching
    return tokens >= 1024;
  },

  formatCacheStructure(cached: CachedContent): AnthropicContentBlock[] {
    return [
      {
        type: 'text',
        text: cached.staticPrefix,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: cached.dynamicContent
      }
    ];
  }
};

/**
 * OpenAI Prompt Caching Strategy (Placeholder)
 * Note: OpenAI's caching is automatic and not configurable via API
 */
export const openaiStrategy: CacheStrategy = {
  name: 'openai',

  shouldCache(content: string, tokens: number): boolean {
    // OpenAI's caching is automatic
    // We still structure prompts for better reuse
    return tokens >= 500;
  },

  formatCacheStructure(cached: CachedContent): OpenAIMessageFormat {
    // OpenAI doesn't have explicit cache_control
    // Just return structured content
    return {
      system: cached.staticPrefix,
      user: cached.dynamicContent
    };
  }
};

/**
 * Get strategy by provider name
 */
export function getStrategy(provider: 'anthropic' | 'openai' | 'auto'): CacheStrategy {
  if (provider === 'auto') {
    // Auto-detect based on environment
    if (process.env.ANTHROPIC_API_KEY) {
      return anthropicStrategy;
    }
    return openaiStrategy;
  }

  return provider === 'anthropic' ? anthropicStrategy : openaiStrategy;
}
