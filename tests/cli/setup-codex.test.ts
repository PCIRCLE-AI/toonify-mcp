/**
 * Tests for `toonify-mcp setup codex` — all against a temp dir, never the
 * user's real ~/.codex.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { performCodexSetup } from '../../src/cli/setup-codex';

describe('performCodexSetup', () => {
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'toonify-codex-'));
  });

  afterEach(async () => {
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  test('creates config.toml with the server section when none exists', async () => {
    const result = await performCodexSetup(tempHome);
    expect(result.changed).toBe(true);

    const config = await fs.readFile(path.join(tempHome, 'config.toml'), 'utf-8');
    expect(config).toContain('[mcp_servers.toonify]');
    expect(config).toContain('command = "toonify-mcp"');
    // No pre-existing file → no backup to make.
    const entries = await fs.readdir(tempHome);
    expect(entries.filter((e) => e.includes('.bak-'))).toHaveLength(0);
  });

  test('appends to an existing config.toml and creates a timestamped backup first', async () => {
    const configPath = path.join(tempHome, 'config.toml');
    const original = 'model = "gpt-5"\n\n[features]\ncodex_hooks = true\n';
    await fs.writeFile(configPath, original, 'utf-8');

    const result = await performCodexSetup(tempHome);
    expect(result.changed).toBe(true);
    expect(result.message).toContain('Backup:');
    expect(result.message).toContain('Restore with:');

    const config = await fs.readFile(configPath, 'utf-8');
    // Existing content preserved, section appended.
    expect(config.startsWith(original)).toBe(true);
    expect(config).toContain('[mcp_servers.toonify]');

    // Backup exists and holds the exact original bytes.
    const backups = (await fs.readdir(tempHome)).filter((e) => e.startsWith('config.toml.bak-'));
    expect(backups).toHaveLength(1);
    const backupContent = await fs.readFile(path.join(tempHome, backups[0]), 'utf-8');
    expect(backupContent).toBe(original);
  });

  test('is idempotent: a second run changes nothing and makes no extra backup', async () => {
    await performCodexSetup(tempHome);
    const after1 = await fs.readFile(path.join(tempHome, 'config.toml'), 'utf-8');

    const result = await performCodexSetup(tempHome);
    expect(result.changed).toBe(false);

    const after2 = await fs.readFile(path.join(tempHome, 'config.toml'), 'utf-8');
    expect(after2).toBe(after1);
    const backups = (await fs.readdir(tempHome)).filter((e) => e.includes('.bak-'));
    expect(backups).toHaveLength(0);
  });
});
