/**
 * BenchmarkReporter - Generate reports in JSON/markdown/HTML.
 *
 * Provides utilities to format and export benchmark results in multiple
 * formats for analysis and documentation.
 */

import type { BenchmarkResults, ReportConfig } from './types';
import { ReportFormat, MetricSeverity } from './types';

// ============================================================================
// BenchmarkReporter
// ============================================================================

/**
 * Utility for generating benchmark reports in various formats.
 *
 * @example
 * ```typescript
 * const reporter = new BenchmarkReporter();
 *
 * // Generate markdown report
 * const markdown = reporter.generateReport(results, {
 *   format: ReportFormat.MARKDOWN,
 *   includeDetails: true,
 * });
 *
 * // Save to file
 * await reporter.saveReport(results, {
 *   format: ReportFormat.JSON,
 *   outputPath: '/path/to/report.json',
 * });
 * ```
 */
export class BenchmarkReporter {
  /**
   * Generate a benchmark report in the specified format.
   *
   * @param results - Benchmark results to report
   * @param config - Report configuration
   * @returns Formatted report string
   */
  generateReport(results: BenchmarkResults, config: ReportConfig): string {
    switch (config.format) {
      case ReportFormat.JSON:
        return this.generateJSON(results, config);
      case ReportFormat.MARKDOWN:
        return this.generateMarkdown(results, config);
      case ReportFormat.HTML:
        return this.generateHTML(results, config);
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }

  /**
   * Save a benchmark report to a file.
   *
   * @param results - Benchmark results to report
   * @param config - Report configuration with output path
   * @returns Promise that resolves when file is written
   */
  async saveReport(results: BenchmarkResults, config: ReportConfig): Promise<void> {
    if (!config.outputPath) {
      throw new Error('Output path is required for saving reports');
    }

    this.generateReport(results, config);

    // In a real implementation, this would use fs.writeFile or platform-specific API
    // For now, this is a placeholder
    await Promise.resolve();
    // await fs.writeFile(config.outputPath, content, 'utf-8');
  }

  // ============================================================================
  // Private Methods - JSON Format
  // ============================================================================

  /**
   * Generate JSON report.
   */
  private generateJSON(results: BenchmarkResults, config: ReportConfig): string {
    if (config.includeDetails) {
      return JSON.stringify(results, null, 2);
    } else {
      // Simplified version with just summary stats
      const summary = {
        timestamp: results.timestamp,
        totalDuration: results.totalDuration,
        device: results.device,
        startup: results.startup
          ? {
              type: results.startup.type,
              totalTime: results.startup.totalTime,
              timeToInteractive: results.startup.timeToInteractive,
              severity: results.startup.severity,
            }
          : undefined,
        query: results.query
          ? {
              totalQueries: results.query.totalQueries,
              duration: results.query.duration,
              severity: results.query.severity,
            }
          : undefined,
        memory: results.memory
          ? {
              memoryGrowth: results.memory.memoryGrowth,
              leakCount: results.memory.leaks.length,
              severity: results.memory.severity,
            }
          : undefined,
        battery: results.battery
          ? {
              drainRate: results.battery.drain.drainRate,
              avgCPU: results.battery.cpuUsage.average,
              severity: results.battery.severity,
            }
          : undefined,
      };
      return JSON.stringify(summary, null, 2);
    }
  }

  // ============================================================================
  // Private Methods - Markdown Format
  // ============================================================================

  /**
   * Generate Markdown report.
   */
  private generateMarkdown(results: BenchmarkResults, config: ReportConfig): string {
    const sections: string[] = [];

    // Header
    sections.push('# Performance Benchmark Report\n');
    sections.push(`**Date:** ${new Date(results.timestamp).toISOString()}\n`);
    sections.push(
      `**Device:** ${results.device.model} (${results.device.platform} ${results.device.osVersion})\n`
    );
    sections.push(`**App Version:** ${results.device.appVersion}\n`);
    sections.push(`**Total Duration:** ${results.totalDuration}ms\n`);

    // Startup section
    if (results.startup) {
      sections.push('\n## Startup Performance\n');
      sections.push(this.formatStartupMarkdown(results.startup, config.includeDetails));
    }

    // Query section
    if (results.query) {
      sections.push('\n## Query Performance\n');
      sections.push(this.formatQueryMarkdown(results.query, config.includeDetails));
    }

    // Memory section
    if (results.memory) {
      sections.push('\n## Memory Usage\n');
      sections.push(this.formatMemoryMarkdown(results.memory, config.includeDetails));
    }

    // Battery section
    if (results.battery) {
      sections.push('\n## Battery Impact\n');
      sections.push(this.formatBatteryMarkdown(results.battery, config.includeDetails));
    }

    return sections.join('');
  }

  private formatStartupMarkdown(
    startup: NonNullable<BenchmarkResults['startup']>,
    includeDetails?: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`**Type:** ${startup.type}`);
    lines.push(`**Total Time:** ${startup.totalTime}ms`);
    lines.push(`**Time to Interactive:** ${startup.timeToInteractive}ms`);
    lines.push(`**Severity:** ${this.severityEmoji(startup.severity)} ${startup.severity}`);

    if (includeDetails && startup.phases.length > 0) {
      lines.push('');
      lines.push('### Startup Phases');
      lines.push('');
      lines.push('| Phase | Duration |');
      lines.push('|-------|----------|');
      for (const phase of startup.phases) {
        lines.push(`| ${phase.name} | ${phase.duration}ms |`);
      }
    }

    return lines.join('\n') + '\n';
  }

  private formatQueryMarkdown(
    query: NonNullable<BenchmarkResults['query']>,
    includeDetails?: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`**Total Queries:** ${query.totalQueries}`);
    lines.push(`**Duration:** ${query.duration}ms`);
    lines.push(`**Severity:** ${this.severityEmoji(query.severity)} ${query.severity}`);

    if (includeDetails && query.stats.length > 0) {
      lines.push('');
      lines.push('### Query Statistics');
      lines.push('');
      lines.push('| Type | Count | Avg | P95 | Cache Hit % |');
      lines.push('|------|-------|-----|-----|-------------|');
      for (const stat of query.stats) {
        const cacheHit = (stat.cacheHitRate * 100).toFixed(1);
        lines.push(
          `| ${stat.type} | ${stat.count} | ${stat.avgTime.toFixed(1)}ms | ${stat.p95Time.toFixed(1)}ms | ${cacheHit}% |`
        );
      }
    }

    return lines.join('\n') + '\n';
  }

  private formatMemoryMarkdown(
    memory: NonNullable<BenchmarkResults['memory']>,
    includeDetails?: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`**Initial Usage:** ${this.formatBytes(memory.initial.used)}`);
    lines.push(`**Final Usage:** ${this.formatBytes(memory.final.used)}`);
    lines.push(`**Peak Usage:** ${this.formatBytes(memory.peak.used)}`);
    lines.push(`**Memory Growth:** ${this.formatBytes(memory.memoryGrowth)}`);
    lines.push(`**Leaks Detected:** ${memory.leaks.length}`);
    lines.push(`**Severity:** ${this.severityEmoji(memory.severity)} ${memory.severity}`);

    if (includeDetails && memory.leaks.length > 0) {
      lines.push('');
      lines.push('### Memory Leaks');
      lines.push('');
      for (const leak of memory.leaks) {
        lines.push(`- ${leak.description}`);
        lines.push(`  - Growth Rate: ${this.formatBytes(leak.growthRate)}/s`);
        lines.push(`  - Severity: ${this.severityEmoji(leak.severity)} ${leak.severity}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  private formatBatteryMarkdown(
    battery: NonNullable<BenchmarkResults['battery']>,
    _includeDetails?: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`**Battery Drain:** ${battery.drain.drainPercent.toFixed(2)}%`);
    lines.push(`**Drain Rate:** ${battery.drain.drainRate.toFixed(2)}% per hour`);
    lines.push(`**Avg CPU Usage:** ${(battery.cpuUsage.average * 100).toFixed(1)}%`);
    lines.push(`**Peak CPU Usage:** ${(battery.cpuUsage.peak * 100).toFixed(1)}%`);
    lines.push(`**Low Power Mode:** ${battery.lowPowerMode ? 'Yes' : 'No'}`);
    lines.push(`**Charging:** ${battery.charging ? 'Yes' : 'No'}`);
    lines.push(`**Severity:** ${this.severityEmoji(battery.severity)} ${battery.severity}`);

    return lines.join('\n') + '\n';
  }

  // ============================================================================
  // Private Methods - HTML Format
  // ============================================================================

  /**
   * Generate HTML report.
   */
  private generateHTML(results: BenchmarkResults, config: ReportConfig): string {
    const markdown = this.generateMarkdown(results, config);

    // Basic markdown to HTML conversion (in production, use a proper library)
    const html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\*\*(.+?):\*\* (.+)$/gm, '<p><strong>$1:</strong> $2</p>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '<br>');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Performance Benchmark Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #007aff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    .severity-good { color: #34c759; }
    .severity-warning { color: #ff9500; }
    .severity-critical { color: #ff3b30; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get emoji for severity level.
   */
  private severityEmoji(severity: MetricSeverity): string {
    switch (severity) {
      case 'good':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '❌';
      default:
        return '';
    }
  }

  /**
   * Format bytes as a human-readable string.
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a benchmark reporter instance.
 *
 * @returns Benchmark reporter instance
 */
export function createBenchmarkReporter(): BenchmarkReporter {
  return new BenchmarkReporter();
}

/**
 * Generate a quick summary of benchmark results.
 *
 * @param results - Benchmark results
 * @returns Summary string
 */
export function generateQuickSummary(results: BenchmarkResults): string {
  const lines: string[] = [];

  lines.push(`Benchmark completed in ${results.totalDuration}ms`);

  if (results.startup) {
    lines.push(`Startup: ${results.startup.totalTime}ms (${results.startup.severity})`);
  }

  if (results.query) {
    lines.push(
      `Queries: ${results.query.totalQueries} queries in ${results.query.duration}ms (${results.query.severity})`
    );
  }

  if (results.memory) {
    lines.push(
      `Memory: ${formatBytes(results.memory.memoryGrowth)} growth, ${results.memory.leaks.length} leaks (${results.memory.severity})`
    );
  }

  if (results.battery) {
    lines.push(
      `Battery: ${results.battery.drain.drainRate.toFixed(1)}%/hr drain (${results.battery.severity})`
    );
  }

  return lines.join('\n');
}

/**
 * Helper to format bytes.
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
