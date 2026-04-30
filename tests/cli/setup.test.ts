import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performSetup, formatSetupReport } from '../../src/cli/setup';
import { type CommandRunner } from '../../src/cli/claude-cli';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

function createRunner(state: {
  marketplaceConfigured?: boolean;
  plugin?: { version?: string; enabled?: boolean; scope?: string; projectPath?: string } | null;
  plugins?: Array<{ id: string; version?: string; enabled?: boolean; scope?: string; projectPath?: string }>;
  mcpConfigured?: boolean;
}) {
  const commands: string[] = [];

  const runner: CommandRunner = async (_command, args) => {
    const key = args.join(' ');
    commands.push(key);

    if (key === '--version') {
      return { stdout: '1.2.3\n', stderr: '' };
    }

    if (key === 'plugin marketplace list') {
      return {
        stdout: state.marketplaceConfigured
          ? 'Configured marketplaces:\n\n  ❯ pcircle-ai\n    Source: File (/tmp/mock)\n'
          : 'Configured marketplaces:\n',
        stderr: '',
      };
    }

    if (key.startsWith('plugin marketplace add ') && key.endsWith('/.claude-plugin/marketplace.json')) {
      state.marketplaceConfigured = true;
      return { stdout: '', stderr: '' };
    }

    if (key === 'plugin list --json') {
      const plugins = state.plugins || (state.plugin
        ? [{ id: 'toonify-mcp@pcircle-ai', version: state.plugin.version, enabled: state.plugin.enabled, scope: state.plugin.scope || 'local', projectPath: state.plugin.projectPath }]
        : []);
      return {
        stdout: JSON.stringify(plugins),
        stderr: '',
      };
    }

    if (key === 'plugin install toonify-mcp@pcircle-ai --scope local') {
      state.plugin = { version, enabled: true };
      return { stdout: '', stderr: '' };
    }

    if (key === 'plugin update toonify-mcp@pcircle-ai --scope local') {
      state.plugin = { version, enabled: true };
      return { stdout: '', stderr: '' };
    }

    if (key === 'plugin enable toonify-mcp@pcircle-ai --scope local') {
      state.plugin = { version: state.plugin?.version || version, enabled: true };
      return { stdout: '', stderr: '' };
    }

    if (key === 'mcp get toonify') {
      if (state.mcpConfigured) {
        return {
          stdout: 'toonify:\n  Scope: Local config (private to you in this project)\n  Status: ✓ Connected\n  Type: stdio\n  Command: toonify-mcp\n',
          stderr: '',
        };
      }
      const error = new Error('No MCP server found with name: "toonify".');
      (error as Error & { stdout?: string; stderr?: string; code?: number }).stderr = 'No MCP server found with name: "toonify".';
      (error as Error & { stdout?: string; stderr?: string; code?: number }).code = 1;
      throw error;
    }

    if (key === 'mcp add toonify -- toonify-mcp') {
      state.mcpConfigured = true;
      return { stdout: '', stderr: '' };
    }

    throw new Error(`Unhandled command: ${key}`);
  };

  return { runner, commands };
}

describe('setup', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'toonify-setup-'));
    await fs.mkdir(path.join(tempRoot, '.claude-plugin'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, '.claude-plugin', 'marketplace.json'), '{"name":"pcircle-ai"}', 'utf-8');
  });

  test('adds marketplace and installs plugin on first run', async () => {
    const { runner, commands } = createRunner({ marketplaceConfigured: false, plugin: null });

    const report = await performSetup({
      mode: 'plugin',
      packageRoot: tempRoot,
      commandRunner: runner,
    });

    expect(report.steps.some(step => step.name === 'Marketplace' && step.status === 'changed')).toBe(true);
    expect(report.steps.some(step => step.name === 'Plugin install' && step.status === 'changed')).toBe(true);
    expect(commands).toContain(`plugin marketplace add ${path.join(tempRoot, '.claude-plugin', 'marketplace.json')}`);
    expect(commands).toContain('plugin install toonify-mcp@pcircle-ai --scope local');
  });

  test('updates outdated plugin instead of reinstalling', async () => {
    const { runner, commands } = createRunner({
      marketplaceConfigured: true,
      plugin: { version: '0.6.0', enabled: true, scope: 'local', projectPath: tempRoot },
    });

    const report = await performSetup({
      mode: 'plugin',
      packageRoot: tempRoot,
      commandRunner: runner,
    });

    expect(report.steps.find(step => step.name === 'Plugin install')?.message).toContain('Updated');
    expect(commands).toContain('plugin update toonify-mcp@pcircle-ai --scope local');
  });

  test('enables a disabled current plugin', async () => {
    const { runner, commands } = createRunner({
      marketplaceConfigured: true,
      plugin: { version, enabled: false, scope: 'local', projectPath: tempRoot },
    });

    const report = await performSetup({
      mode: 'plugin',
      packageRoot: tempRoot,
      commandRunner: runner,
    });

    expect(report.steps.find(step => step.name === 'Plugin install')?.message).toContain('Enabled');
    expect(commands).toContain('plugin enable toonify-mcp@pcircle-ai --scope local');
  });

  test('registers MCP server in mcp mode', async () => {
    const { runner, commands } = createRunner({ mcpConfigured: false });

    const report = await performSetup({
      mode: 'mcp',
      packageRoot: tempRoot,
      commandRunner: runner,
    });

    expect(report.steps.some(step => step.name === 'MCP server' && step.status === 'changed')).toBe(true);
    expect(commands).toContain('mcp add toonify -- toonify-mcp');
  });

  test('prefers the local project install when duplicate plugin scopes exist', async () => {
    const { runner, commands } = createRunner({
      marketplaceConfigured: true,
      plugins: [
        { id: 'toonify-mcp@pcircle-ai', version, enabled: true, scope: 'user' },
        { id: 'toonify-mcp@pcircle-ai', version: '0.6.0', enabled: true, scope: 'local', projectPath: tempRoot },
      ],
    });

    const report = await performSetup({
      mode: 'plugin',
      packageRoot: tempRoot,
      commandRunner: runner,
    });

    expect(report.steps.find(step => step.name === 'Plugin install')?.message).toContain('Updated');
    expect(commands).toContain('plugin update toonify-mcp@pcircle-ai --scope local');
  });

  test('formats a readable setup summary', async () => {
    const output = formatSetupReport({
      version,
      mode: 'plugin',
      steps: [
        { name: 'Claude CLI', status: 'pass', message: 'Claude CLI is available.' },
        { name: 'Plugin install', status: 'changed', message: 'Installed plugin locally.' },
      ],
    });

    expect(output).toContain('Toonify MCP setup');
    expect(output).toContain('Installed plugin locally');
    expect(output).toContain('toonify-mcp doctor');
  });
});
