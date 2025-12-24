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
        version: '0.1.0',
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
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'optimize_content': {
          const { content, toolName } = args as {
            content: string;
            toolName?: string;
          };

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

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_stats': {
          const stats = await this.metrics.getStats();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Toonify MCP Server running on stdio');
  }
}
