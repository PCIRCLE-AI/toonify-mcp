import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TokenOptimizer } from '../optimizer/token-optimizer.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import {
  type CommandRunner,
  CommandExecutionError,
  TOONIFY_MARKETPLACE_NAME,
  TOONIFY_PLUGIN_ID,
  execCommand,
  getClaudeVersion,
  getInstalledToonifyPlugin,
  hasMarketplace,
} from './claude-cli.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorReport {
  version: string;
  checks: DoctorCheck[];
  nextSteps: string[];
}

export interface DoctorOptions {
  homeDir?: string;
  packageRoot?: string;
  createOptimizer?: () => TokenOptimizer;
  commandRunner?: CommandRunner;
}

export async function collectDoctorReport(options: DoctorOptions = {}): Promise<DoctorReport> {
  const homeDir = options.homeDir || os.homedir();
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const createOptimizer = options.createOptimizer || (() => new TokenOptimizer());
  const commandRunner = options.commandRunner || execCommand;

  const checks: DoctorCheck[] = [];
  const configPath = path.join(homeDir, '.claude', 'toonify-config.json');
  const metrics = new MetricsCollector(homeDir);

  try {
    const optimizer = createOptimizer();
    optimizer.destroy();
    checks.push({
      name: 'Core optimizer',
      status: 'pass',
      message: 'Binary can boot and core optimizer dependencies load successfully.',
    });
  } catch (error) {
    checks.push({
      name: 'Core optimizer',
      status: 'fail',
      message: `Failed to boot optimizer: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }

  checks.push(await checkClaudeCli(commandRunner));
  checks.push(await checkMarketplace(commandRunner));
  checks.push(await checkPluginInstall(commandRunner, packageRoot));
  checks.push(await checkConfig(configPath));
  checks.push(await checkPackageAssets(packageRoot));
  checks.push(await checkStatsPath(metrics.getStatsPath()));

  const nextSteps = buildNextSteps(checks);

  return {
    version,
    checks,
    nextSteps,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [`Toonify MCP doctor (v${report.version})`, ''];
  const summary = report.checks.some(check => check.status === 'fail')
    ? 'Attention needed before Toonify is fully ready.'
    : report.checks.some(check => check.status === 'warn')
      ? 'Usable, with a few items worth checking.'
      : 'Ready: Toonify looks healthy in this checkout.';

  lines.push(summary);
  lines.push('');

  for (const check of report.checks) {
    lines.push(`${statusIcon(check.status)} ${check.name}: ${check.message}`);
  }

  if (report.nextSteps.length > 0) {
    lines.push('');
    lines.push('Next steps:');
    for (const step of report.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join('\n');
}

export async function runDoctor(stdout: NodeJS.WritableStream = process.stdout, stderr: NodeJS.WritableStream = process.stderr): Promise<number> {
  try {
    const report = await collectDoctorReport();
    stdout.write(`${formatDoctorReport(report)}\n`);
    return report.checks.some(check => check.status === 'fail') ? 1 : 0;
  } catch (error) {
    stderr.write(`Toonify MCP doctor failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    return 1;
  }
}

async function checkConfig(configPath: string): Promise<DoctorCheck> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    JSON.parse(raw);
    return {
      name: 'Config',
      status: 'pass',
      message: `Config file loaded from ${configPath}.`,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        name: 'Config',
        status: 'warn',
        message: `No config file found at ${configPath}; Toonify will use built-in defaults.`,
      };
    }

    return {
      name: 'Config',
      status: 'warn',
      message: `Config file exists but could not be parsed at ${configPath}; fix JSON syntax or remove it to use defaults.`,
    };
  }
}

async function checkClaudeCli(commandRunner?: CommandRunner): Promise<DoctorCheck> {
  try {
    const claudeVersion = await getClaudeVersion(commandRunner);
    return {
      name: 'Claude CLI',
      status: 'pass',
      message: `Claude CLI is available (${claudeVersion}).`,
    };
  } catch (error) {
    const commandError = error as CommandExecutionError;
    return {
      name: 'Claude CLI',
      status: 'fail',
      message: commandError.code === 'ENOENT'
        ? 'Claude CLI is not available in PATH. Install Claude Code before setting up Toonify.'
        : `Could not run Claude CLI: ${commandError.stderr || commandError.message}`,
    };
  }
}

async function checkMarketplace(commandRunner?: CommandRunner): Promise<DoctorCheck> {
  try {
    const configured = await hasMarketplace(TOONIFY_MARKETPLACE_NAME, commandRunner);
    return configured
      ? {
          name: 'Marketplace',
          status: 'pass',
          message: `Local marketplace \`${TOONIFY_MARKETPLACE_NAME}\` is configured.`,
        }
      : {
          name: 'Marketplace',
          status: 'warn',
          message: `Local marketplace \`${TOONIFY_MARKETPLACE_NAME}\` is not configured yet.`,
        };
  } catch (error) {
    const commandError = error as CommandExecutionError;
    return {
      name: 'Marketplace',
      status: 'warn',
      message: `Could not inspect marketplaces: ${commandError.stderr || commandError.message}`,
    };
  }
}

async function checkPluginInstall(commandRunner: CommandRunner | undefined, packageRoot: string): Promise<DoctorCheck> {
  try {
    const plugin = await getInstalledToonifyPlugin(commandRunner, {
      preferredScope: 'local',
      projectPath: packageRoot,
    });

    if (!plugin) {
      return {
        name: 'Plugin install',
        status: 'warn',
        message: `Local plugin \`${TOONIFY_PLUGIN_ID}\` is not installed yet.`,
      };
    }

    if (!plugin.enabled) {
      return {
        name: 'Plugin install',
        status: 'warn',
        message: `Local plugin \`${TOONIFY_PLUGIN_ID}\` is installed but disabled.`,
      };
    }

    if (plugin.version !== version) {
      return {
        name: 'Plugin install',
        status: 'warn',
        message: `Local plugin \`${TOONIFY_PLUGIN_ID}\` is on ${plugin.version || 'unknown'}, but this checkout is ${version}.`,
      };
    }

    return {
      name: 'Plugin install',
      status: 'pass',
      message: `Local plugin \`${TOONIFY_PLUGIN_ID}\` is enabled on ${plugin.version}.`,
    };
  } catch (error) {
    const commandError = error as CommandExecutionError;
    return {
      name: 'Plugin install',
      status: 'warn',
      message: `Could not inspect plugin state: ${commandError.stderr || commandError.stdout || commandError.message}`,
    };
  }
}

async function checkPackageAssets(packageRoot: string): Promise<DoctorCheck> {
  const pluginManifest = path.join(packageRoot, '.claude-plugin', 'plugin.json');
  const hookManifest = path.join(packageRoot, 'hooks', 'hooks.json');

  const [pluginOk, hookOk] = await Promise.all([
    exists(pluginManifest),
    exists(hookManifest),
  ]);

  if (pluginOk && hookOk) {
    return {
      name: 'Package assets',
      status: 'pass',
      message: 'Plugin manifest and hook definitions are present in the installed package.',
    };
  }

  return {
    name: 'Package assets',
    status: 'fail',
    message: 'Expected plugin or hook assets are missing from the installed package.',
  };
}

async function checkStatsPath(statsPath: string): Promise<DoctorCheck> {
  const statsDir = path.dirname(statsPath);

  try {
    await fs.mkdir(statsDir, { recursive: true });
    await fs.access(statsDir, fsConstants.W_OK);
    return {
      name: 'Stats path',
      status: 'pass',
      message: `Local stats directory is writable at ${statsDir}.`,
    };
  } catch (error) {
    return {
      name: 'Stats path',
      status: 'fail',
      message: `Stats directory is not writable at ${statsDir}: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolvePackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..', '..');
}

function statusIcon(status: DoctorStatus): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'warn':
      return '!';
    case 'fail':
      return '✗';
  }
}

function buildNextSteps(checks: DoctorCheck[]): string[] {
  const nextSteps: string[] = [];
  const checkByName = new Map(checks.map(check => [check.name, check]));

  const claudeCheck = checkByName.get('Claude CLI');
  if (claudeCheck?.status === 'fail') {
    nextSteps.push('Install Claude Code, then rerun `toonify-mcp setup`.');
    return nextSteps;
  }

  const marketplaceCheck = checkByName.get('Marketplace');
  const pluginCheck = checkByName.get('Plugin install');

  if (marketplaceCheck?.status !== 'pass' || pluginCheck?.status !== 'pass') {
    nextSteps.push('Run `toonify-mcp setup` to configure the local marketplace and repair plugin mode.');
  }

  if (pluginCheck?.message.includes('disabled')) {
    nextSteps.push(`If you only need a quick recovery, run \`claude plugin enable ${TOONIFY_PLUGIN_ID} --scope local\`.`);
  }

  if (pluginCheck?.message.includes('but this checkout is')) {
    nextSteps.push(`If you want the current checkout version, run \`claude plugin update ${TOONIFY_PLUGIN_ID} --scope local\`.`);
  }

  const configCheck = checkByName.get('Config');
  if (configCheck?.message.includes('could not be parsed')) {
    nextSteps.push('Fix `~/.claude/toonify-config.json` or remove it to fall back to defaults.');
  }

  return nextSteps;
}
