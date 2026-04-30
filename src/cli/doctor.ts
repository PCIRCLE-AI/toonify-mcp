import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TokenOptimizer } from '../optimizer/token-optimizer.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';

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
  verifyPluginCommand: string;
}

export interface DoctorOptions {
  homeDir?: string;
  packageRoot?: string;
  createOptimizer?: () => TokenOptimizer;
}

export async function collectDoctorReport(options: DoctorOptions = {}): Promise<DoctorReport> {
  const homeDir = options.homeDir || os.homedir();
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const createOptimizer = options.createOptimizer || (() => new TokenOptimizer());

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

  checks.push(await checkConfig(configPath));
  checks.push(await checkPackageAssets(packageRoot));
  checks.push(await checkStatsPath(metrics.getStatsPath()));

  return {
    version,
    checks,
    verifyPluginCommand: 'claude plugin list',
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [`Toonify MCP doctor (v${report.version})`, ''];

  for (const check of report.checks) {
    lines.push(`${statusIcon(check.status)} ${check.name}: ${check.message}`);
  }

  lines.push('');
  lines.push(`Next: run \`${report.verifyPluginCommand}\` to verify Claude Code plugin registration.`);
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
        message: `No config file found at ${configPath}; Toonify will use defaults.`,
      };
    }

    return {
      name: 'Config',
      status: 'warn',
      message: `Config file exists but could not be parsed at ${configPath}; fix JSON syntax or remove it to use defaults.`,
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
