/**
 * MemoryBenchmark - Track memory allocation and detect leaks.
 *
 * Provides utilities to monitor memory usage over time, detect memory leaks,
 * and analyze memory allocation patterns in mobile applications.
 */

import type {
  MemoryBenchmarkConfig,
  MemoryBenchmarkResult,
  MemorySnapshot,
  MemoryLeak,
  Bytes,
} from './types';
import { MetricSeverity } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Memory info provider interface for platform abstraction.
 */
export interface MemoryInfoProvider {
  /** Get current memory usage */
  getMemoryInfo(): Promise<{
    allocated: Bytes;
    used: Bytes;
    available: Bytes;
  }>;
}

/**
 * Mock memory info provider for testing.
 */
export class MockMemoryInfoProvider implements MemoryInfoProvider {
  private mockUsed: Bytes = 50 * 1024 * 1024; // 50MB

  async getMemoryInfo(): Promise<{ allocated: Bytes; used: Bytes; available: Bytes }> {
    const allocated = 100 * 1024 * 1024; // 100MB
    const available = allocated - this.mockUsed;
    return {
      allocated,
      used: this.mockUsed,
      available,
    };
  }

  /** Test helper: Update mock memory usage */
  setMockUsed(bytes: Bytes): void {
    this.mockUsed = bytes;
  }
}

// ============================================================================
// MemoryBenchmark
// ============================================================================

/**
 * Utility for monitoring memory usage and detecting leaks.
 *
 * @example
 * ```typescript
 * const benchmark = new MemoryBenchmark(memoryProvider);
 *
 * // Start monitoring
 * await benchmark.start();
 *
 * // Perform operations
 * await loadLargeDataset();
 *
 * // Take periodic snapshots
 * setInterval(() => benchmark.takeSnapshot(), 5000);
 *
 * // Get results
 * const result = await benchmark.stop();
 * // result.memoryGrowth contains the memory growth in bytes
 * ```
 */
export class MemoryBenchmark {
  private snapshots: MemorySnapshot[] = [];
  private startTime: number | null = null;
  private intervalId?: ReturnType<typeof setInterval>;
  private config: Required<MemoryBenchmarkConfig>;
  private provider: MemoryInfoProvider;

  constructor(provider: MemoryInfoProvider, config: MemoryBenchmarkConfig = {}) {
    this.provider = provider;
    this.config = {
      duration: config.duration ?? 60000,
      snapshotInterval: config.snapshotInterval ?? 1000,
      leakThreshold: config.leakThreshold ?? 1024 * 100, // 100KB/s
    };
  }

  /**
   * Start the memory benchmark with automatic snapshots.
   */
  async start(): Promise<void> {
    this.startTime = Date.now();
    this.snapshots = [];

    // Take initial snapshot
    await this.takeSnapshot();

    // Start periodic snapshots
    this.intervalId = setInterval(async () => {
      await this.takeSnapshot();
    }, this.config.snapshotInterval);
  }

  /**
   * Stop the benchmark and return results.
   *
   * @returns Complete memory benchmark result
   */
  async stop(): Promise<MemoryBenchmarkResult> {
    // Stop periodic snapshots
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Take final snapshot
    await this.takeSnapshot();

    if (!this.startTime || this.snapshots.length === 0) {
      throw new Error('Benchmark not started');
    }

    const duration = Date.now() - this.startTime;
    const initial = this.snapshots[0];
    const final = this.snapshots[this.snapshots.length - 1];
    const peak = this.findPeakSnapshot();
    const leaks = this.detectLeaks();
    const memoryGrowth = final.used - initial.used;
    const severity = this.calculateSeverity(memoryGrowth, leaks);

    return {
      initial,
      final,
      peak,
      snapshots: [...this.snapshots],
      leaks,
      memoryGrowth,
      duration,
      timestamp: this.startTime,
      severity,
    };
  }

  /**
   * Take a memory snapshot at the current moment.
   */
  async takeSnapshot(): Promise<MemorySnapshot> {
    const info = await this.provider.getMemoryInfo();
    const snapshot: MemorySnapshot = {
      allocated: info.allocated,
      used: info.used,
      available: info.available,
      usagePercent: info.used / info.allocated,
      timestamp: Date.now(),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get current snapshots.
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Reset the benchmark.
   */
  reset(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.snapshots = [];
    this.startTime = null;
  }

  /**
   * Get configuration.
   */
  getConfig(): Required<MemoryBenchmarkConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Find the snapshot with peak memory usage.
   */
  private findPeakSnapshot(): MemorySnapshot {
    if (this.snapshots.length === 0) {
      throw new Error('No snapshots available');
    }

    return this.snapshots.reduce((peak, snapshot) => (snapshot.used > peak.used ? snapshot : peak));
  }

  /**
   * Detect memory leaks based on growth rate.
   */
  private detectLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.snapshots.length < 2) {
      return leaks;
    }

    // Analyze memory growth over time
    const windowSize = 10; // Number of snapshots to analyze
    for (let i = windowSize; i < this.snapshots.length; i++) {
      const window = this.snapshots.slice(i - windowSize, i);
      const growthRate = this.calculateGrowthRate(window);
      const duration = window[window.length - 1].timestamp - window[0].timestamp;

      if (Math.abs(growthRate) > this.config.leakThreshold) {
        const severity =
          Math.abs(growthRate) > this.config.leakThreshold * 2
            ? MetricSeverity.CRITICAL
            : MetricSeverity.WARNING;

        leaks.push({
          description: `Sustained memory growth detected at ${new Date(
            window[window.length - 1].timestamp
          ).toISOString()}`,
          growthRate,
          duration,
          severity,
        });
      }
    }

    return leaks;
  }

  /**
   * Calculate memory growth rate from snapshots (bytes per second).
   */
  private calculateGrowthRate(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const memoryChange = last.used - first.used;
    const timeChange = (last.timestamp - first.timestamp) / 1000; // Convert to seconds

    return timeChange > 0 ? memoryChange / timeChange : 0;
  }

  /**
   * Calculate overall performance severity.
   */
  private calculateSeverity(memoryGrowth: Bytes, leaks: MemoryLeak[]): MetricSeverity {
    // Critical if we have critical leaks
    if (leaks.some((leak) => leak.severity === MetricSeverity.CRITICAL)) {
      return MetricSeverity.CRITICAL;
    }

    // Warning if we have any leaks or significant growth
    if (leaks.length > 0 || memoryGrowth > 10 * 1024 * 1024) {
      // > 10MB
      return MetricSeverity.WARNING;
    }

    return MetricSeverity.GOOD;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a memory benchmark with the specified configuration.
 *
 * @param provider - Memory info provider
 * @param config - Benchmark configuration
 * @returns Configured memory benchmark instance
 */
export function createMemoryBenchmark(
  provider: MemoryInfoProvider,
  config?: MemoryBenchmarkConfig
): MemoryBenchmark {
  return new MemoryBenchmark(provider, config);
}

/**
 * Format bytes as a human-readable string.
 * Re-export from memory module for convenience.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export { formatBytes } from '../memory/utils';
