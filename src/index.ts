#!/usr/bin/env node

/**
 * Claude Code Toonify MCP Server
 *
 * Local-first context compression for structured data, debug-heavy output,
 * and supported source files inside Claude Code and MCP workflows.
 */

import { createRequire } from 'node:module';
import { ToonifyMCPServer } from './server/mcp-server.js';
import { runDoctor } from './cli/doctor.js';
import { runStatus } from './cli/status.js';
import { runSetup } from './cli/setup.js';
import { runCompress } from './cli/compress.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const USAGE = `toonify-mcp v${version} — context compression for Claude Code and MCP workflows

Usage:
  toonify-mcp                  Start the MCP server on stdio (used by MCP clients)
  toonify-mcp setup [mode]     Configure integration (plugin | mcp | codex)
  toonify-mcp doctor           Check the local install
  toonify-mcp status           Show recent optimization activity
  toonify-mcp compress         Compress stdin to stdout (pipe filter)
  toonify-mcp --version        Print the version
  toonify-mcp --help           Show this help
`;

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
  if (args[0] === 'compress') {
    return await runCompress();
  }
  if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(`${version}\n`);
    return 0;
  }
  if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }
  // Unknown argument: print usage and fail instead of falling through to the
  // MCP server, which reads stdin forever — a bare `toonify-mcp --version`
  // used to hang exactly that way. The server starts ONLY with no args.
  if (args.length > 0) {
    process.stderr.write(`Unknown command: ${args[0]}\n\n${USAGE}`);
    return 1;
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
