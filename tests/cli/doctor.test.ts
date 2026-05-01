import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { collectDoctorReport, formatDoctorReport } from '../../src/cli/doctor';
import { type CommandRunner, CommandExecutionError } from '../../src/cli/claude-cli';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

function createMockRunner(overrides: Record<string, string> = {}, errors: Record<string, CommandExecutionError> = {}): CommandRunner {
  return async (_command, args) => {
    const key = args.join(' ');
    if (errors[key]) {
      throw errors[key];
    }

    if (overrides[key] !== undefined) {
      return { stdout: overrides[key], stderr: '' };
    }

    if (key === '--version') {
      return { stdout: '1.2.3\n', stderr: '' };
    }

    if (key === 'plugin marketplace list') {
      return { stdout: 'Configured marketplaces:\n\n  ❯ pcircle-ai\n    Source: File (/tmp/mock)\n', stderr: '' };
    }

    if (key === 'plugin list --json') {
      return {
        stdout: JSON.stringify([
          { id: 'toonify-mcp@pcircle-ai', version, scope: 'local', enabled: true },
        ]),
        stderr: '',
      };
    }

    throw new Error(`Unhandled command: ${key}`);
  };
}

describe('doctor', () => {
  let tempRoot: string;
  let homeDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'toonify-doctor-'));
    homeDir = path.join(tempRoot, 'home');
    await fs.mkdir(path.join(homeDir, '.claude'), { recursive: true });
  });

  test('returns a usable report with pass and warning checks', async () => {
    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner(),
    });

    expect(report.version).toBeTruthy();
    expect(report.nextSteps).toEqual([]);
    expect(report.checks.some(check => check.name === 'Core optimizer' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Claude CLI' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Marketplace' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Plugin install' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Package assets' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Config' && check.status === 'warn')).toBe(true);
    expect(report.checks.some(check => check.name === 'Stats path' && check.status === 'pass')).toBe(true);
  });

  test('warns when config exists but is invalid', async () => {
    const configPath = path.join(homeDir, '.claude', 'toonify-config.json');
    await fs.writeFile(configPath, '{ invalid json', 'utf-8');

    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner(),
    });
    const configCheck = report.checks.find(check => check.name === 'Config');

    expect(configCheck?.status).toBe('warn');
    expect(configCheck?.message).toContain('could not be parsed');
  });

  test('suggests update when plugin version is older than current package', async () => {
    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner({
        'plugin list --json': JSON.stringify([
          { id: 'toonify-mcp@pcircle-ai', version: '0.6.0', scope: 'local', enabled: true },
        ]),
      }),
    });

    const pluginCheck = report.checks.find(check => check.name === 'Plugin install');

    expect(pluginCheck?.status).toBe('warn');
    expect(report.nextSteps.some(step => step.includes('claude plugin update toonify-mcp@pcircle-ai --scope local'))).toBe(true);
  });

  test('prefers the local project install when duplicate plugin scopes exist', async () => {
    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner({
        'plugin list --json': JSON.stringify([
          { id: 'toonify-mcp@pcircle-ai', version, scope: 'user', enabled: true },
          { id: 'toonify-mcp@pcircle-ai', version: '0.6.0', scope: 'local', enabled: true, projectPath: process.cwd() },
        ]),
      }),
    });

    const pluginCheck = report.checks.find(check => check.name === 'Plugin install');

    expect(pluginCheck?.status).toBe('warn');
    expect(pluginCheck?.message).toContain('0.6.0');
  });

  test('fails cleanly when Claude CLI is not available', async () => {
    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner(
        {},
        {
          '--version': new CommandExecutionError('Command not found: claude', { code: 'ENOENT' }),
        }
      ),
    });

    const claudeCheck = report.checks.find(check => check.name === 'Claude CLI');

    expect(claudeCheck?.status).toBe('fail');
    expect(report.nextSteps[0]).toContain('Install Claude Code');
  });

  test('formats human-readable output', async () => {
    const report = await collectDoctorReport({
      homeDir,
      packageRoot: process.cwd(),
      commandRunner: createMockRunner({
        'plugin list --json': JSON.stringify([]),
      }),
    });
    const output = formatDoctorReport(report);

    expect(output).toContain('Toonify MCP doctor');
    expect(output).toContain('Usable, with a few items worth checking.');
    expect(output).toContain('Core optimizer');
    expect(output).toContain('Run `toonify-mcp setup`');
  });
});
