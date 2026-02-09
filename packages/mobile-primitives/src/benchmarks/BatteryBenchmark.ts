/**
 * BatteryBenchmark - Measure battery impact and CPU usage.
 *
 * Integrates with existing battery utilities to measure battery drain,
 * CPU usage, and overall power consumption during benchmark operations.
 */

import type { BatteryState } from '@double-bind/types';
import type {
  BatteryBenchmarkConfig,
  BatteryBenchmarkResult,
  BatteryDrain,
  CPUUsage,
} from './types';
import { MetricSeverity } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Battery and CPU info provider interface for platform abstraction.
 */
export interface BatteryInfoProvider {
  /** Get current battery state */
  getBatteryState(): Promise<BatteryState>;

  /** Get current CPU usage (0.0-1.0) */
  getCPUUsage(): Promise<number>;
}

/**
 * Mock battery info provider for testing.
 */
export class MockBatteryInfoProvider implements BatteryInfoProvider {
  private mockBatteryLevel = 0.8;
  private mockCPUUsage = 0.3;

  async getBatteryState(): Promise<BatteryState> {
    return {
      charging: false,
      level: this.mockBatteryLevel,
      lowPowerMode: false,
      timestamp: Date.now(),
    };
  }

  async getCPUUsage(): Promise<number> {
    return this.mockCPUUsage;
  }

  /** Test helper: Set mock battery level */
  setMockBatteryLevel(level: number): void {
    this.mockBatteryLevel = level;
  }

  /** Test helper: Set mock CPU usage */
  setMockCPUUsage(usage: number): void {
    this.mockCPUUsage = usage;
  }
}

// ============================================================================
// BatteryBenchmark
// ============================================================================

/**
 * Utility for measuring battery impact and CPU usage.
 *
 * @example
 * ```typescript
 * const benchmark = new BatteryBenchmark(batteryProvider);
 *
 * // Start monitoring
 * await benchmark.start();
 *
 * // Perform operations
 * await performIntensiveOperations();
 *
 * // Get results
 * const result = await benchmark.stop();
 * // result.drain.drainPercent contains battery drain percentage
 * // result.cpuUsage.average contains average CPU usage
 * ```
 */
export class BatteryBenchmark {
  private startState: BatteryState | null = null;
  private cpuSamples: number[] = [];
  private startTime: number | null = null;
  private intervalId?: ReturnType<typeof setInterval>;
  private config: Required<BatteryBenchmarkConfig>;
  private provider: BatteryInfoProvider;

  constructor(provider: BatteryInfoProvider, config: BatteryBenchmarkConfig = {}) {
    this.provider = provider;
    this.config = {
      duration: config.duration ?? 60000,
      sampleInterval: config.sampleInterval ?? 1000,
      includeCharging: config.includeCharging ?? false,
    };
  }

  /**
   * Start the battery benchmark with automatic CPU sampling.
   */
  async start(): Promise<void> {
    this.startTime = Date.now();
    this.cpuSamples = [];

    // Get initial battery state
    this.startState = await this.provider.getBatteryState();

    // Start periodic CPU sampling
    this.intervalId = setInterval(async () => {
      const cpuUsage = await this.provider.getCPUUsage();
      this.cpuSamples.push(cpuUsage);
    }, this.config.sampleInterval);
  }

  /**
   * Stop the benchmark and return results.
   *
   * @returns Complete battery benchmark result
   */
  async stop(): Promise<BatteryBenchmarkResult> {
    // Stop periodic sampling
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (!this.startState || !this.startTime) {
      throw new Error('Benchmark not started');
    }

    // Get final battery state
    const endState = await this.provider.getBatteryState();

    const duration = Date.now() - this.startTime;
    const drain = this.calculateDrain(this.startState, endState, duration);
    const cpuUsage = this.calculateCPUStats();
    const severity = this.calculateSeverity(drain, cpuUsage);

    return {
      drain,
      cpuUsage,
      wakeLocks: 0, // Platform-specific, would need native implementation
      charging: endState.charging,
      lowPowerMode: endState.lowPowerMode,
      duration,
      timestamp: this.startTime,
      severity,
    };
  }

  /**
   * Get current CPU samples.
   */
  getCPUSamples(): number[] {
    return [...this.cpuSamples];
  }

  /**
   * Reset the benchmark.
   */
  reset(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.startState = null;
    this.cpuSamples = [];
    this.startTime = null;
  }

  /**
   * Get configuration.
   */
  getConfig(): Required<BatteryBenchmarkConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate battery drain metrics.
   */
  private calculateDrain(start: BatteryState, end: BatteryState, duration: number): BatteryDrain {
    const drainPercent = (start.level - end.level) * 100;
    const durationHours = duration / (1000 * 60 * 60);
    const drainRate = durationHours > 0 ? drainPercent / durationHours : 0;

    return {
      startLevel: start.level,
      endLevel: end.level,
      drainPercent,
      duration,
      drainRate,
    };
  }

  /**
   * Calculate CPU usage statistics.
   */
  private calculateCPUStats(): CPUUsage {
    if (this.cpuSamples.length === 0) {
      return {
        average: 0,
        peak: 0,
        samples: [],
      };
    }

    const average =
      this.cpuSamples.reduce((sum, sample) => sum + sample, 0) / this.cpuSamples.length;
    const peak = Math.max(...this.cpuSamples);

    return {
      average,
      peak,
      samples: [...this.cpuSamples],
    };
  }

  /**
   * Calculate overall performance severity.
   */
  private calculateSeverity(drain: BatteryDrain, cpuUsage: CPUUsage): MetricSeverity {
    // Thresholds for mobile apps
    const criticalDrainRate = 20; // % per hour
    const warningDrainRate = 10; // % per hour
    const criticalCPU = 0.8; // 80%
    const warningCPU = 0.5; // 50%

    // Check drain rate
    if (drain.drainRate > criticalDrainRate) {
      return MetricSeverity.CRITICAL;
    }

    // Check CPU usage
    if (cpuUsage.average > criticalCPU || cpuUsage.peak > criticalCPU) {
      return MetricSeverity.CRITICAL;
    }

    // Warning thresholds
    if (drain.drainRate > warningDrainRate || cpuUsage.average > warningCPU) {
      return MetricSeverity.WARNING;
    }

    return MetricSeverity.GOOD;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a battery benchmark with the specified configuration.
 *
 * @param provider - Battery info provider
 * @param config - Benchmark configuration
 * @returns Configured battery benchmark instance
 */
export function createBatteryBenchmark(
  provider: BatteryInfoProvider,
  config?: BatteryBenchmarkConfig
): BatteryBenchmark {
  return new BatteryBenchmark(provider, config);
}

/**
 * Estimate battery time remaining at current drain rate.
 *
 * @param currentLevel - Current battery level (0.0-1.0)
 * @param drainRate - Drain rate in percent per hour
 * @returns Estimated time remaining in hours
 */
export function estimateBatteryTimeRemaining(currentLevel: number, drainRate: number): number {
  if (drainRate <= 0) return Infinity;
  const percentRemaining = currentLevel * 100;
  return percentRemaining / drainRate;
}
