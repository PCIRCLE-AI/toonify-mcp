import { MetricsCollector } from '../metrics/metrics-collector.js';

export async function runStatus(
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr
): Promise<number> {
  try {
    const metrics = new MetricsCollector();
    stdout.write(`${await metrics.formatStatus()}\n`);
    return 0;
  } catch (error) {
    stderr.write(`Toonify MCP status failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    return 1;
  }
}
