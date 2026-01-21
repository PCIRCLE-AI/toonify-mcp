/**
 * ToonifyMCPServer: MCP server that wraps tool results with token optimization
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TokenOptimizer } from '../optimizer/token-optimizer.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';

export class ToonifyMCPServer {
  private server: Server;
  private optimizer: TokenOptimizer;
  private metrics: MetricsCollector;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-code-toonify',
        version: '0.5.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.optimizer = new TokenOptimizer();
    this.metrics = new MetricsCollector();

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'optimize_content',
          description: 'Optimize structured data content for token efficiency using TOON format',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The content to optimize (JSON, CSV, or YAML)',
              },
              toolName: {
                type: 'string',
                description: 'Name of the tool that generated this content',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'get_stats',
          description: 'Get token optimization statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'clear_cache',
          description: 'Clear the optimization result cache',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_cache_stats',
          description: 'Get detailed cache statistics (LRU cache + Prompt cache)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'cleanup_expired_cache',
          description: 'Clean up expired cache entries and return the number of entries removed',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'optimize_content': {
            const { content, toolName } = args as {
              content: string;
              toolName?: string;
            };

            // Validate input
            if (!content || typeof content !== 'string') {
              return this.formatErrorResponse('INVALID_INPUT', 'content must be a non-empty string');
            }

            const result = await this.optimizer.optimize(content, {
              toolName: toolName || 'unknown',
              size: content.length,
            });

            // Record metrics
            await this.metrics.record({
              timestamp: new Date().toISOString(),
              toolName: toolName || 'unknown',
              originalTokens: result.originalTokens,
              optimizedTokens: result.optimizedTokens || result.originalTokens,
              savings: result.savings?.tokens || 0,
              savingsPercentage: result.savings?.percentage || 0,
              wasOptimized: result.optimized,
              format: result.format,
              reason: result.reason,
            });

            return this.formatSuccessResponse(result, 'Content optimization completed');
          }

          case 'get_stats': {
            const stats = await this.metrics.getStats();
            return this.formatSuccessResponse(stats, 'Statistics retrieved successfully');
          }

          case 'clear_cache': {
            this.optimizer.clearResultCache();
            return this.formatSuccessResponse(
              { cleared: true },
              'Cache cleared successfully'
            );
          }

          case 'get_cache_stats': {
            const cacheStats = this.optimizer.getCacheStats();
            return this.formatSuccessResponse(cacheStats, 'Cache statistics retrieved successfully');
          }

          case 'cleanup_expired_cache': {
            const removedCount = this.optimizer.cleanupExpiredCache();
            return this.formatSuccessResponse(
              { removedEntries: removedCount },
              `Cleaned up ${removedCount} expired cache entries`
            );
          }

          default:
            return this.formatErrorResponse('UNKNOWN_TOOL', `Unknown tool: ${name}`);
        }
      } catch (error) {
        // Catch any unhandled errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorCode = error instanceof Error && error.name ? error.name : 'INTERNAL_ERROR';

        console.error(`[ToonifyMCPServer] Error in tool ${name}:`, error);
        return this.formatErrorResponse(errorCode, errorMessage);
      }
    });
  }

  /**
   * Format successful response in standardized format
   */
  private formatSuccessResponse(data: unknown, message?: string) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              data,
              message,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Format error response in standardized format
   */
  private formatErrorResponse(code: string, message: string) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: {
                code,
                message,
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // MCP protocol uses stdout for messages, so we log status to stderr
    console.error('[ToonifyMCPServer] Server running on stdio');
  }
}
