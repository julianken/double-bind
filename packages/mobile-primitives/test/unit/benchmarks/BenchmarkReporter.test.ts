/**
 * Unit tests for BenchmarkReporter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BenchmarkReporter,
  createBenchmarkReporter,
  generateQuickSummary,
} from '../../../src/benchmarks/BenchmarkReporter';
import {
  ReportFormat,
  StartupType,
  QueryType,
  MetricSeverity,
  type BenchmarkResults,
} from '../../../src/benchmarks/types';

describe('BenchmarkReporter', () => {
  let reporter: BenchmarkReporter;
  let mockResults: BenchmarkResults;

  beforeEach(() => {
    reporter = new BenchmarkReporter();

    // Create comprehensive mock results
    mockResults = {
      startup: {
        type: StartupType.COLD,
        totalTime: 1500,
        timeToInteractive: 1200,
        phases: [
          { name: 'init', startTime: 0, endTime: 500, duration: 500 },
          { name: 'render', startTime: 500, endTime: 1200, duration: 700 },
        ],
        timestamp: Date.now(),
        severity: MetricSeverity.WARNING,
      },
      query: {
        executions: [
          {
            queryId: 'q1',
            type: QueryType.READ,
            executionTime: 50,
            resultCount: 10,
            cached: false,
            timestamp: Date.now(),
          },
          {
            queryId: 'q2',
            type: QueryType.READ,
            executionTime: 30,
            resultCount: 5,
            cached: true,
            timestamp: Date.now(),
          },
        ],
        stats: [
          {
            type: QueryType.READ,
            count: 2,
            avgTime: 40,
            minTime: 30,
            maxTime: 50,
            p95Time: 48,
            cacheHitRate: 0.5,
          },
        ],
        totalQueries: 2,
        duration: 1000,
        timestamp: Date.now(),
        severity: MetricSeverity.GOOD,
      },
      memory: {
        initial: {
          allocated: 100 * 1024 * 1024,
          used: 50 * 1024 * 1024,
          available: 50 * 1024 * 1024,
          usagePercent: 0.5,
          timestamp: Date.now(),
        },
        final: {
          allocated: 100 * 1024 * 1024,
          used: 60 * 1024 * 1024,
          available: 40 * 1024 * 1024,
          usagePercent: 0.6,
          timestamp: Date.now(),
        },
        peak: {
          allocated: 100 * 1024 * 1024,
          used: 65 * 1024 * 1024,
          available: 35 * 1024 * 1024,
          usagePercent: 0.65,
          timestamp: Date.now(),
        },
        snapshots: [],
        leaks: [
          {
            description: 'Memory leak detected',
            growthRate: 1024 * 100,
            duration: 10000,
            severity: MetricSeverity.WARNING,
          },
        ],
        memoryGrowth: 10 * 1024 * 1024,
        duration: 10000,
        timestamp: Date.now(),
        severity: MetricSeverity.WARNING,
      },
      battery: {
        drain: {
          startLevel: 0.8,
          endLevel: 0.75,
          drainPercent: 5,
          duration: 3600000,
          drainRate: 5,
        },
        cpuUsage: {
          average: 0.4,
          peak: 0.7,
          samples: [0.3, 0.4, 0.5, 0.7, 0.4],
        },
        wakeLocks: 0,
        charging: false,
        lowPowerMode: false,
        duration: 3600000,
        timestamp: Date.now(),
        severity: MetricSeverity.GOOD,
      },
      totalDuration: 15000,
      timestamp: Date.now(),
      device: {
        platform: 'iOS',
        osVersion: '17.0',
        model: 'iPhone 15 Pro',
        appVersion: '1.0.0',
      },
    };
  });

  describe('JSON format', () => {
    it('should generate detailed JSON report', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.JSON,
        includeDetails: true,
      });

      const parsed = JSON.parse(report);
      expect(parsed.startup).toBeDefined();
      expect(parsed.query).toBeDefined();
      expect(parsed.memory).toBeDefined();
      expect(parsed.battery).toBeDefined();
      expect(parsed.device).toBeDefined();
    });

    it('should generate summary JSON report', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.JSON,
        includeDetails: false,
      });

      const parsed = JSON.parse(report);
      expect(parsed.startup.type).toBe(StartupType.COLD);
      expect(parsed.startup.phases).toBeUndefined();
      expect(parsed.query.executions).toBeUndefined();
    });

    it('should handle missing benchmarks', () => {
      const partialResults: BenchmarkResults = {
        totalDuration: 1000,
        timestamp: Date.now(),
        device: mockResults.device,
      };

      const report = reporter.generateReport(partialResults, {
        format: ReportFormat.JSON,
      });

      const parsed = JSON.parse(report);
      expect(parsed.startup).toBeUndefined();
      expect(parsed.query).toBeUndefined();
    });
  });

  describe('Markdown format', () => {
    it('should generate markdown report', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('# Performance Benchmark Report');
      expect(report).toContain('## Startup Performance');
      expect(report).toContain('## Query Performance');
      expect(report).toContain('## Memory Usage');
      expect(report).toContain('## Battery Impact');
    });

    it('should include device information', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
      });

      expect(report).toContain('iPhone 15 Pro');
      expect(report).toContain('iOS 17.0');
      expect(report).toContain('1.0.0');
    });

    it('should format startup section', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('**Total Time:** 1500ms');
      expect(report).toContain('**Time to Interactive:** 1200ms');
      expect(report).toContain('cold');
    });

    it('should include startup phases when detailed', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('init');
      expect(report).toContain('render');
      expect(report).toContain('500ms');
      expect(report).toContain('700ms');
    });

    it('should format query section', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('**Total Queries:** 2');
      expect(report).toContain('read');
    });

    it('should include query stats when detailed', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('Cache Hit');
      expect(report).toContain('50.0%');
    });

    it('should format memory section', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('**Initial Usage:**');
      expect(report).toContain('**Final Usage:**');
      expect(report).toContain('**Peak Usage:**');
      expect(report).toContain('**Memory Growth:**');
    });

    it('should include memory leaks when detailed', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('Memory Leaks');
      expect(report).toContain('Memory leak detected');
    });

    it('should format battery section', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
      });

      expect(report).toContain('**Battery Drain:** 5.00%');
      expect(report).toContain('**Drain Rate:** 5.00% per hour');
      expect(report).toContain('**Avg CPU Usage:** 40.0%');
      expect(report).toContain('**Peak CPU Usage:** 70.0%');
    });

    it('should include severity emojis', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
      });

      expect(report).toContain('✅'); // GOOD
      expect(report).toContain('⚠️'); // WARNING
    });

    it('should handle partial results', () => {
      const partialResults: BenchmarkResults = {
        startup: mockResults.startup,
        totalDuration: 1000,
        timestamp: Date.now(),
        device: mockResults.device,
      };

      const report = reporter.generateReport(partialResults, {
        format: ReportFormat.MARKDOWN,
      });

      expect(report).toContain('## Startup Performance');
      expect(report).not.toContain('## Query Performance');
    });
  });

  describe('HTML format', () => {
    it('should generate HTML report', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.HTML,
      });

      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('<html>');
      expect(report).toContain('<head>');
      expect(report).toContain('<body>');
      expect(report).toContain('</html>');
    });

    it('should include CSS styles', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.HTML,
      });

      expect(report).toContain('<style>');
      expect(report).toContain('font-family');
    });

    it('should include content from markdown conversion', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.HTML,
      });

      expect(report).toContain('Performance Benchmark Report');
      expect(report).toContain('iPhone 15 Pro');
    });
  });

  describe('error handling', () => {
    it('should throw for unsupported format', () => {
      expect(() =>
        reporter.generateReport(mockResults, {
          format: 'unsupported' as ReportFormat,
        })
      ).toThrow('Unsupported format');
    });

    it('should throw when saving without output path', async () => {
      await expect(
        reporter.saveReport(mockResults, {
          format: ReportFormat.JSON,
        })
      ).rejects.toThrow('Output path is required');
    });
  });

  describe('factory function', () => {
    it('should create reporter via factory', () => {
      const newReporter = createBenchmarkReporter();
      expect(newReporter).toBeDefined();
    });
  });

  describe('generateQuickSummary', () => {
    it('should generate quick summary', () => {
      const summary = generateQuickSummary(mockResults);

      expect(summary).toContain('Benchmark completed');
      expect(summary).toContain('15000ms');
      expect(summary).toContain('Startup');
      expect(summary).toContain('Queries');
      expect(summary).toContain('Memory');
      expect(summary).toContain('Battery');
    });

    it('should include severity in summary', () => {
      const summary = generateQuickSummary(mockResults);

      expect(summary).toContain('good');
      expect(summary).toContain('warning');
    });

    it('should handle partial results', () => {
      const partialResults: BenchmarkResults = {
        startup: mockResults.startup,
        totalDuration: 1000,
        timestamp: Date.now(),
        device: mockResults.device,
      };

      const summary = generateQuickSummary(partialResults);
      expect(summary).toContain('Startup');
      expect(summary).not.toContain('Queries');
    });
  });

  describe('report completeness', () => {
    it('should include all sections for complete results', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
        includeDetails: true,
      });

      expect(report).toContain('Performance Benchmark Report');
      expect(report).toContain('Startup Performance');
      expect(report).toContain('Query Performance');
      expect(report).toContain('Memory Usage');
      expect(report).toContain('Battery Impact');
    });

    it('should format numbers appropriately', () => {
      const report = reporter.generateReport(mockResults, {
        format: ReportFormat.MARKDOWN,
      });

      // Check that numbers are formatted
      expect(report).toContain('1500ms');
      expect(report).toContain('5.00%');
      expect(report).toContain('40.0%');
    });
  });
});
