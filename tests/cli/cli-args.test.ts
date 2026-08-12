/**
 * CLI argument handling — regression for the `--version` hang: any flag or
 * unknown argument used to fall through to starting the MCP server, which
 * reads stdin forever. Now only a bare `toonify-mcp` starts the server.
 * Spawns the real built binary; stdin is closed immediately, so a regression
 * back to server-start would time the test out rather than pass.
 */

import { describe, test, expect } from '@jest/globals';
import { execFile } from 'child_process';
import path from 'path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

const binPath = path.resolve('dist/index.js');

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = execFile(
      'node',
      [binPath, ...args],
      { timeout: 10000 },
      (error, stdout, stderr) => {
        resolve({ stdout, stderr, code: error ? (error as { code?: number }).code ?? 1 : 0 });
      }
    );
    proc.stdin!.end();
  });
}

describe('CLI argument handling', () => {
  test('--version prints the package version and exits 0', async () => {
    const { stdout, code } = await runCli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(version);
  });

  test('-v prints the package version and exits 0', async () => {
    const { stdout, code } = await runCli(['-v']);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(version);
  });

  test('--help prints usage listing every command and exits 0', async () => {
    const { stdout, code } = await runCli(['--help']);
    expect(code).toBe(0);
    for (const cmd of ['setup', 'doctor', 'status', 'compress', '--version']) {
      expect(stdout).toContain(cmd);
    }
  });

  test('an unknown argument prints usage to stderr and exits 1 (never starts the server)', async () => {
    const { stderr, code } = await runCli(['bogus-cmd']);
    expect(code).toBe(1);
    expect(stderr).toContain('Unknown command: bogus-cmd');
    expect(stderr).toContain('Usage:');
  });
});
