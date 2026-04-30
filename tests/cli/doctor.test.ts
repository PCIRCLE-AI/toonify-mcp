import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectDoctorReport, formatDoctorReport } from '../../src/cli/doctor';

describe('doctor', () => {
  let tempRoot: string;
  let homeDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'toonify-doctor-'));
    homeDir = path.join(tempRoot, 'home');
    await fs.mkdir(path.join(homeDir, '.claude'), { recursive: true });
  });

  test('returns a usable report with pass and warning checks', async () => {
    const report = await collectDoctorReport({ homeDir, packageRoot: process.cwd() });

    expect(report.version).toBeTruthy();
    expect(report.verifyPluginCommand).toBe('claude plugin list');
    expect(report.checks.some(check => check.name === 'Core optimizer' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Package assets' && check.status === 'pass')).toBe(true);
    expect(report.checks.some(check => check.name === 'Config' && check.status === 'warn')).toBe(true);
    expect(report.checks.some(check => check.name === 'Stats path' && check.status === 'pass')).toBe(true);
  });

  test('warns when config exists but is invalid', async () => {
    const configPath = path.join(homeDir, '.claude', 'toonify-config.json');
    await fs.writeFile(configPath, '{ invalid json', 'utf-8');

    const report = await collectDoctorReport({ homeDir, packageRoot: process.cwd() });
    const configCheck = report.checks.find(check => check.name === 'Config');

    expect(configCheck?.status).toBe('warn');
    expect(configCheck?.message).toContain('could not be parsed');
  });

  test('formats human-readable output', async () => {
    const report = await collectDoctorReport({ homeDir, packageRoot: process.cwd() });
    const output = formatDoctorReport(report);

    expect(output).toContain('Toonify MCP doctor');
    expect(output).toContain('Core optimizer');
    expect(output).toContain('claude plugin list');
  });
});
