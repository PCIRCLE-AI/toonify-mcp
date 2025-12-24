#!/usr/bin/env node

/**
 * Claude Code Toonify MCP Server
 *
 * Optimizes token usage by converting structured data to TOON format
 * before sending to Claude API, achieving 60%+ token reduction.
 */

import { ToonifyMCPServer } from './server/mcp-server.js';

async function main() {
  const server = new ToonifyMCPServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start Toonify MCP server:', error);
    process.exit(1);
  }
}

main();
