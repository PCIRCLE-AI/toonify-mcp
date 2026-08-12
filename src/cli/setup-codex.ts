/**
 * `toonify-mcp setup codex` — register toonify as an MCP server for the
 * OpenAI Codex CLI by adding an `[mcp_servers.toonify]` entry to
 * `~/.codex/config.toml`.
 *
 * Scope (documented honestly): this gives Codex users ON-DEMAND compression —
 * the model can call the `optimize_content` tool when it chooses to. It is
 * NOT the automatic per-tool-output compression the Claude Code plugin
 * provides: Codex's PostToolUse hooks cannot replace tool output (their
 * parser explicitly rejects `updatedMCPToolOutput` as unsupported), and
 * appending a compressed copy via additionalContext would grow context
 * instead of shrinking it. For pipe-level automatic compression on any agent
 * CLI, see `toonify-mcp compress`.
 *
 * Safety: `config.toml` is user data — before any write, an adjacent
 * timestamped backup (`config.toml.bak-<YYYY-MM-DD-HHMM>`) is created, and
 * the report includes the backup path and a one-line restore command.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SERVER_SECTION_HEADER = '[mcp_servers.toonify]';

const SERVER_SECTION = `
# Added by \`toonify-mcp setup codex\` — on-demand context compression tool.
${SERVER_SECTION_HEADER}
command = "toonify-mcp"
`;

export interface CodexSetupResult {
  changed: boolean;
  message: string;
}

export async function performCodexSetup(codexHome?: string): Promise<CodexSetupResult> {
  const home = codexHome || path.join(os.homedir(), '.codex');
  const configPath = path.join(home, 'config.toml');

  let existing = '';
  let exists = true;
  try {
    existing = await fs.readFile(configPath, 'utf-8');
  } catch {
    exists = false;
  }

  if (existing.includes(SERVER_SECTION_HEADER)) {
    return {
      changed: false,
      message: `Codex is already configured: ${SERVER_SECTION_HEADER} present in ${configPath}. Nothing changed.`,
    };
  }

  let backupNote = '';
  if (exists) {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    const backupPath = `${configPath}.bak-${stamp}`;
    await fs.copyFile(configPath, backupPath);
    backupNote = `\nBackup: ${backupPath}\nRestore with: cp "${backupPath}" "${configPath}"`;
  } else {
    await fs.mkdir(home, { recursive: true });
  }

  const next = existing.length > 0 && !existing.endsWith('\n')
    ? `${existing}\n${SERVER_SECTION}`
    : `${existing}${SERVER_SECTION}`;
  await fs.writeFile(configPath, next, 'utf-8');

  return {
    changed: true,
    message:
      `Registered ${SERVER_SECTION_HEADER} in ${configPath}.` +
      backupNote +
      `\n\nCodex can now call the \`optimize_content\` tool on demand.` +
      `\nNote: this is on-demand MCP compression, not the automatic per-tool-output` +
      `\ncompression of the Claude Code plugin — Codex hooks cannot replace tool` +
      `\noutput yet. For automatic pipe-level compression, use \`toonify-mcp compress\`.`,
  };
}

export async function runSetupCodex(
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  codexHome?: string
): Promise<number> {
  try {
    const result = await performCodexSetup(codexHome);
    stdout.write(`${result.message}\n`);
    return 0;
  } catch (error) {
    stderr.write(`Toonify Codex setup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    return 1;
  }
}
