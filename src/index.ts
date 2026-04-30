#!/usr/bin/env node

/**
 * Claude Code Toonify MCP Server
 *
 * Local-first context compression for structured data, debug-heavy output,
 * and supported source files inside Claude Code and MCP workflows.
 */

import { ToonifyMCPServer } from './server/mcp-server.js';
import { runDoctor } from './cli/doctor.js';
import { runStatus } from './cli/status.js';
import { runSetup } from './cli/setup.js';

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  if (args[0] === 'setup') {
    return await runSetup(args.slice(1));
  }
  if (args[0] === 'doctor') {
    return await runDoctor();
  }
  if (args[0] === 'status') {
    return await runStatus();
  }

  const server = new ToonifyMCPServer();

  try {
    await server.start();
    return 0;
  } catch (error) {
    console.error('Failed to start Toonify MCP server:', error);
    return 1;
  }
}

async function main() {
  const exitCode = await runCli();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main();
