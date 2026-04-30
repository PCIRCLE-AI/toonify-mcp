import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export const TOONIFY_MARKETPLACE_NAME = 'pcircle-ai';
export const TOONIFY_PLUGIN_ID = 'toonify-mcp@pcircle-ai';
export const TOONIFY_PLUGIN_NAME = 'toonify-mcp';
export const TOONIFY_MCP_NAME = 'toonify';

export interface CommandOutput {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandOutput>;

export interface ClaudePluginRecord {
  id: string;
  version?: string;
  scope?: string;
  enabled?: boolean;
  installPath?: string;
  projectPath?: string;
  errors?: string[];
}

export interface PluginLookupOptions {
  preferredScope?: string;
  projectPath?: string;
}

export class CommandExecutionError extends Error {
  stdout: string;
  stderr: string;
  code?: number | string;
  originalError?: unknown;

  constructor(
    message: string,
    options: {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      originalError?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'CommandExecutionError';
    this.stdout = options.stdout || '';
    this.stderr = options.stderr || '';
    this.code = options.code;
    this.originalError = options.originalError;
  }
}

export const execCommand: CommandRunner = async (command, args) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: DEFAULT_MAX_BUFFER,
    });
    return { stdout, stderr };
  } catch (error) {
    const details = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };

    throw new CommandExecutionError(
      details.code === 'ENOENT'
        ? `Command not found: ${command}`
        : `Command failed: ${command} ${args.join(' ')}`.trim(),
      {
        stdout: details.stdout,
        stderr: details.stderr,
        code: details.code,
        originalError: error,
      }
    );
  }
};

export async function getClaudeVersion(runner: CommandRunner = execCommand): Promise<string> {
  const { stdout } = await runner('claude', ['--version']);
  return stdout.trim();
}

export async function listPlugins(runner: CommandRunner = execCommand): Promise<ClaudePluginRecord[]> {
  const { stdout } = await runner('claude', ['plugin', 'list', '--json']);
  return JSON.parse(stdout) as ClaudePluginRecord[];
}

export async function getInstalledToonifyPlugin(
  runner: CommandRunner = execCommand,
  options: PluginLookupOptions = {}
): Promise<ClaudePluginRecord | null> {
  const plugins = await listPlugins(runner);
  const matches = plugins.filter(plugin => plugin.id === TOONIFY_PLUGIN_ID);
  if (matches.length === 0) {
    return null;
  }

  const preferredScope = options.preferredScope;
  const projectPath = options.projectPath;

  if (preferredScope && projectPath) {
    const exact = matches.find(
      plugin => plugin.scope === preferredScope && plugin.projectPath === projectPath
    );
    if (exact) return exact;
  }

  if (preferredScope) {
    const scoped = matches.find(plugin => plugin.scope === preferredScope);
    if (scoped) return scoped;
  }

  if (projectPath) {
    const projectScoped = matches.find(plugin => plugin.projectPath === projectPath);
    if (projectScoped) return projectScoped;
  }

  return matches[0];
}

export async function listMarketplaces(runner: CommandRunner = execCommand): Promise<string[]> {
  const { stdout } = await runner('claude', ['plugin', 'marketplace', 'list']);
  return stdout
    .split('\n')
    .map(line => line.match(/^\s+❯\s+(.+)\s*$/)?.[1]?.trim())
    .filter((name): name is string => Boolean(name));
}

export async function hasMarketplace(
  marketplaceName: string,
  runner: CommandRunner = execCommand
): Promise<boolean> {
  const marketplaces = await listMarketplaces(runner);
  return marketplaces.includes(marketplaceName);
}

export async function hasToonifyMcpRegistration(
  runner: CommandRunner = execCommand
): Promise<boolean> {
  try {
    await runner('claude', ['mcp', 'get', TOONIFY_MCP_NAME]);
    return true;
  } catch (error) {
    const commandError = error as CommandExecutionError;
    const combined = `${commandError.stdout}\n${commandError.stderr}\n${commandError.message}`;
    if (combined.includes('No MCP server found with name')) {
      return false;
    }
    throw error;
  }
}
