import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  type CommandRunner,
  type ClaudePluginRecord,
  CommandExecutionError,
  TOONIFY_MARKETPLACE_NAME,
  TOONIFY_MCP_NAME,
  TOONIFY_PLUGIN_ID,
  execCommand,
  getInstalledToonifyPlugin,
  getClaudeVersion,
  hasMarketplace,
  hasToonifyMcpRegistration,
} from './claude-cli.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

export type SetupMode = 'plugin' | 'mcp';
type SetupStatus = 'pass' | 'changed' | 'fail';

interface SetupStep {
  name: string;
  status: SetupStatus;
  message: string;
}

interface SetupReport {
  version: string;
  mode: SetupMode;
  steps: SetupStep[];
}

export interface SetupOptions {
  mode?: SetupMode;
  packageRoot?: string;
  commandRunner: CommandRunner;
}

export async function performSetup(options: SetupOptions): Promise<SetupReport> {
  const mode = options.mode || 'plugin';
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const commandRunner = options.commandRunner;
  const steps: SetupStep[] = [];

  const claudeVersion = await getClaudeVersion(commandRunner);
  steps.push({
    name: 'Claude CLI',
    status: 'pass',
    message: `Claude CLI is available (${claudeVersion}).`,
  });

  if (mode === 'plugin') {
    const marketplacePath = path.join(packageRoot, '.claude-plugin', 'marketplace.json');
    await fs.access(marketplacePath);

    const marketplaceConfigured = await hasMarketplace(TOONIFY_MARKETPLACE_NAME, commandRunner);
    if (marketplaceConfigured) {
      steps.push({
        name: 'Marketplace',
        status: 'pass',
        message: `Local marketplace \`${TOONIFY_MARKETPLACE_NAME}\` is already configured for this checkout.`,
      });
    } else {
      await commandRunner('claude', ['plugin', 'marketplace', 'add', marketplacePath]);
      steps.push({
        name: 'Marketplace',
        status: 'changed',
        message: `Added local marketplace \`${TOONIFY_MARKETPLACE_NAME}\` from this checkout.`,
      });
    }

    const plugin = await getInstalledToonifyPlugin(commandRunner, {
      preferredScope: 'local',
      projectPath: packageRoot,
    });
    steps.push(await ensurePluginState(plugin, commandRunner));
  } else {
    const mcpAlreadyConfigured = await hasToonifyMcpRegistration(commandRunner);
    if (mcpAlreadyConfigured) {
      steps.push({
        name: 'MCP server',
        status: 'pass',
        message: `MCP server \`${TOONIFY_MCP_NAME}\` is already registered and ready to reconnect.`,
      });
    } else {
      await commandRunner('claude', ['mcp', 'add', TOONIFY_MCP_NAME, '--', 'toonify-mcp']);
      steps.push({
        name: 'MCP server',
        status: 'changed',
        message: `Registered MCP server \`${TOONIFY_MCP_NAME}\` with command \`toonify-mcp\`.`,
      });
    }
  }

  return {
    version,
    mode,
    steps,
  };
}

export function formatSetupReport(report: SetupReport): string {
  const lines = [`Toonify MCP setup (${report.mode} mode, v${report.version})`, ''];

  for (const step of report.steps) {
    lines.push(`${statusIcon(step.status)} ${step.name}: ${step.message}`);
  }

  lines.push('');
  if (report.mode === 'plugin') {
    lines.push('Ready next:');
    lines.push('- Run `toonify-mcp doctor` to confirm the local install.');
    lines.push('- Open Claude Code normally, then run `toonify-mcp status` after a real session.');
  } else {
    lines.push('Ready next:');
    lines.push('- Run `claude mcp list` to confirm the server is connected.');
    lines.push('- Use MCP mode only when you need an explicit MCP server instead of plugin mode.');
  }

  return lines.join('\n');
}

export async function runSetup(
  args: string[] = [],
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  commandRunner?: CommandRunner
): Promise<number> {
  const modeArg = args[0];
  const mode: SetupMode = modeArg === 'mcp' ? 'mcp' : 'plugin';

  if (modeArg && modeArg !== 'plugin' && modeArg !== 'mcp') {
    stderr.write('Usage: toonify-mcp setup [plugin|mcp]\n');
    return 1;
  }

  try {
    const report = await performSetup({
      mode,
      commandRunner: commandRunner || execCommand,
    });
    stdout.write(`${formatSetupReport(report)}\n`);
    return report.steps.some(step => step.status === 'fail') ? 1 : 0;
  } catch (error) {
    const commandError = error as CommandExecutionError;
    if (commandError.code === 'ENOENT') {
      stderr.write('Toonify MCP setup failed: Claude Code is not available in PATH.\n');
      return 1;
    }

    stderr.write(`Toonify MCP setup failed: ${commandError.stderr || (error instanceof Error ? error.message : 'unknown error')}\n`);
    return 1;
  }
}

async function ensurePluginState(
  plugin: ClaudePluginRecord | null,
  commandRunner: CommandRunner
): Promise<SetupStep> {
  if (!plugin) {
    await commandRunner('claude', ['plugin', 'install', TOONIFY_PLUGIN_ID, '--scope', 'local']);
    return {
      name: 'Plugin install',
      status: 'changed',
      message: `Installed and enabled \`${TOONIFY_PLUGIN_ID}\` in local scope.`,
    };
  }

  if (plugin.version !== version) {
    await commandRunner('claude', ['plugin', 'update', TOONIFY_PLUGIN_ID, '--scope', 'local']);
    return {
      name: 'Plugin install',
      status: 'changed',
      message: `Updated local plugin \`${TOONIFY_PLUGIN_ID}\` from ${plugin.version || 'unknown'} to ${version}.`,
    };
  }

  if (!plugin.enabled) {
    await commandRunner('claude', ['plugin', 'enable', TOONIFY_PLUGIN_ID, '--scope', 'local']);
    return {
      name: 'Plugin install',
      status: 'changed',
      message: `Enabled local plugin \`${TOONIFY_PLUGIN_ID}\`.`,
    };
  }

  return {
    name: 'Plugin install',
    status: 'pass',
    message: `Local plugin \`${TOONIFY_PLUGIN_ID}\` is already enabled on ${plugin.version}.`,
  };
}

function resolvePackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..', '..');
}

function statusIcon(status: SetupStatus): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'changed':
      return '→';
    case 'fail':
      return '✗';
  }
}
