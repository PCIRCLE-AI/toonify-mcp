#!/usr/bin/env node

/**
 * Claude Code Toonify MCP Server
 *
 * Optimizes token usage by converting structured data to TOON format
 * before sending to Claude API, achieving 30-65% token reduction
 * (typically 40-55% depending on data structure).
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
