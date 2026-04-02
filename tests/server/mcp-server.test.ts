/**
 * MCP Server handler tests
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ToonifyMCPServer } from '../../src/server/mcp-server.js';

describe('ToonifyMCPServer', () => {
  let server: ToonifyMCPServer;

  beforeEach(() => {
    server = new ToonifyMCPServer();
  });

  describe('optimize_content tool', () => {
    test('optimizes valid JSON content', async () => {
      const json = JSON.stringify({
        users: Array.from({ length: 10 }, (_, i) => ({
          id: i, name: `User ${i}`, email: `user${i}@test.com`
        }))
      }, null, 2);

      const response = await server.handleToolCall('optimize_content', { content: json });
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data.originalTokens).toBeGreaterThan(0);
    });

    test('rejects empty content', async () => {
      const response = await server.handleToolCall('optimize_content', { content: '' });
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_INPUT');
      expect(response.isError).toBe(true);
    });

    test('rejects non-string content', async () => {
      const response = await server.handleToolCall('optimize_content', { content: 123 });
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_INPUT');
    });

    test('handles plain text gracefully', async () => {
      const response = await server.handleToolCall('optimize_content', {
        content: 'This is just plain text, not structured data at all.'
      });
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data.optimized).toBe(false);
      expect(body.data.reason).toBe('Not structured data');
    });

    test('includes toolName in metadata', async () => {
      const json = JSON.stringify({
        items: Array.from({ length: 10 }, (_, i) => ({ id: i, val: `v${i}` }))
      }, null, 2);

      const response = await server.handleToolCall('optimize_content', {
        content: json,
        toolName: 'Read'
      });
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
    });
  });

  describe('get_stats tool', () => {
    test('returns stats object', async () => {
      const response = await server.handleToolCall('get_stats', {});
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('totalRequests');
      expect(body.data).toHaveProperty('optimizedRequests');
      expect(body.data).toHaveProperty('totalSavings');
    });
  });

  describe('cache tools', () => {
    test('clear_cache returns success', async () => {
      const response = await server.handleToolCall('clear_cache', {});
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data.cleared).toBe(true);
    });

    test('get_cache_stats returns both cache types', async () => {
      const response = await server.handleToolCall('get_cache_stats', {});
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('resultCache');
      expect(body.data).toHaveProperty('promptCache');
    });

    test('cleanup_expired_cache returns count', async () => {
      const response = await server.handleToolCall('cleanup_expired_cache', {});
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('removedEntries');
      expect(typeof body.data.removedEntries).toBe('number');
    });
  });

  describe('unknown tool', () => {
    test('returns error for unknown tool name', async () => {
      const response = await server.handleToolCall('nonexistent_tool', {});
      const body = JSON.parse(response.content[0].text);

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNKNOWN_TOOL');
      expect(response.isError).toBe(true);
    });
  });

  describe('response format', () => {
    test('success response has correct structure', () => {
      const response = server.formatSuccessResponse({ key: 'value' }, 'test message');

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');

      const body = JSON.parse(response.content[0].text);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ key: 'value' });
      expect(body.message).toBe('test message');
    });

    test('error response has correct structure', () => {
      const response = server.formatErrorResponse('TEST_ERROR', 'something went wrong');

      expect(response.content).toHaveLength(1);
      expect(response.isError).toBe(true);

      const body = JSON.parse(response.content[0].text);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TEST_ERROR');
      expect(body.error.message).toBe('something went wrong');
    });
  });
});
