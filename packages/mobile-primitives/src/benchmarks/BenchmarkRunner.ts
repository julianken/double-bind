/**
 * BenchmarkRunner - Orchestrate all benchmarks.
 *
 * Provides a unified interface to run startup, query, memory, and battery
 * benchmarks together and collect comprehensive performance metrics.
 */

import type {
  BenchmarkConfig,
  BenchmarkResults,
  DeviceInfo,
  StartupBenchmarkResult,
  QueryBenchmarkResult,
  MemoryBenchmarkResult,
  BatteryBenchmarkResult,
} from './types';
import { StartupType } from './types';
import { StartupBenchmark } from './StartupBenchmark';
import { QueryBenchmark } from './QueryBenchmark';
import { MemoryBenchmark, type MemoryInfoProvider } from './MemoryBenchmark';
import { BatteryBenchmark, type BatteryInfoProvider } from './BatteryBenchmark';

// ============================================================================
// Types
// ============================================================================

/**
 * Device info provider interface for platform abstraction.
 */
export interface DeviceInfoProvider {
  /** Get device information */
  getDeviceInfo(): Promise<DeviceInfo>;
}

/**
 * Mock device info provider for testing.
 */
export class MockDeviceInfoProvider implements DeviceInfoProvider {
  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      platform: 'test',
      osVersion: '1.0.0',
      model: 'Test Device',
      appVersion: '0.1.0',
    };
  }
}

/**
 * Options for running benchmarks.
 */
export interface RunOptions {
  /** Run startup benchmark */
  startup?: boolean;
  /** Run query benchmark */
  query?: boolean;
  /** Run memory benchmark */
  memory?: boolean;
  /** Run battery benchmark */
  battery?: boolean;
}

// ============================================================================
// BenchmarkRunner
// ============================================================================

/**
 * Orchestrator for running comprehensive performance benchmarks.
 *
 * @example
 * ```typescript
 * const runner = new BenchmarkRunner({
 *   deviceInfoProvider,
 *   memoryProvider,
 *   batteryProvider,
 *   config: {
 *     startup: { coldStartCount: 3 },
 *     query: { queriesPerType: 50 },
 *     memory: { duration: 30000 },
 *     battery: { duration: 30000 },
 *   },
 * });
 *
 * // Run all benchmarks
 * const results = await runner.run();
 * // results.totalDuration contains the total duration in ms
 * ```
 */
export class BenchmarkRunner {
  private deviceInfoProvider: DeviceInfoProvider;
  private memoryProvider?: MemoryInfoProvider;
  private batteryProvider?: BatteryInfoProvider;
  private config: BenchmarkConfig;
  private startupBenchmark?: StartupBenchmark;
  private queryBenchmark?: QueryBenchmark;
  private memoryBenchmark?: MemoryBenchmark;
  private batteryBenchmark?: BatteryBenchmark;

  constructor(options: {
    deviceInfoProvider: DeviceInfoProvider;
    memoryProvider?: MemoryInfoProvider;
    batteryProvider?: BatteryInfoProvider;
    config?: BenchmarkConfig;
  }) {
    this.deviceInfoProvider = options.deviceInfoProvider;
    this.memoryProvider = options.memoryProvider;
    this.batteryProvider = options.batteryProvider;
    this.config = options.config ?? {};
  }

  /**
   * Run all configured benchmarks.
   *
   * @param options - Options to selectively run benchmarks
   * @returns Complete benchmark results
   */
  async run(options: RunOptions = {}): Promise<BenchmarkResults> {
    const startTime = Date.now();
    const device = await this.deviceInfoProvider.getDeviceInfo();

    // Default to running all benchmarks
    const runAll = Object.values(options).every((v) => v === undefined);
    const shouldRun = {
      startup: runAll || options.startup === true,
      query: runAll || options.query === true,
      memory: runAll || options.memory === true,
      battery: runAll || options.battery === true,
    };

    let startup: StartupBenchmarkResult | undefined;
    let query: QueryBenchmarkResult | undefined;
    let memory: MemoryBenchmarkResult | undefined;
    let battery: BatteryBenchmarkResult | undefined;

    // Run startup benchmark
    if (shouldRun.startup) {
      startup = await this.runStartupBenchmark();
    }

    // Run query benchmark
    if (shouldRun.query) {
      query = await this.runQueryBenchmark();
    }

    // Run memory and battery benchmarks in parallel if both enabled
    if (shouldRun.memory && shouldRun.battery) {
      const results = await Promise.all([this.runMemoryBenchmark(), this.runBatteryBenchmark()]);
      memory = results[0];
      battery = results[1];
    } else {
      if (shouldRun.memory) {
        memory = await this.runMemoryBenchmark();
      }
      if (shouldRun.battery) {
        battery = await this.runBatteryBenchmark();
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      startup,
      query,
      memory,
      battery,
      totalDuration,
      timestamp: startTime,
      device,
    };
  }

  /**
   * Get the startup benchmark instance.
   */
  getStartupBenchmark(): StartupBenchmark {
    if (!this.startupBenchmark) {
      this.startupBenchmark = new StartupBenchmark(this.config.startup);
    }
    return this.startupBenchmark;
  }

  /**
   * Get the query benchmark instance.
   */
  getQueryBenchmark(): QueryBenchmark {
    if (!this.queryBenchmark) {
      this.queryBenchmark = new QueryBenchmark(this.config.query);
    }
    return this.queryBenchmark;
  }

  /**
   * Get the memory benchmark instance.
   */
  getMemoryBenchmark(): MemoryBenchmark | undefined {
    if (!this.memoryProvider) return undefined;

    if (!this.memoryBenchmark) {
      this.memoryBenchmark = new MemoryBenchmark(this.memoryProvider, this.config.memory);
    }
    return this.memoryBenchmark;
  }

  /**
   * Get the battery benchmark instance.
   */
  getBatteryBenchmark(): BatteryBenchmark | undefined {
    if (!this.batteryProvider) return undefined;

    if (!this.batteryBenchmark) {
      this.batteryBenchmark = new BatteryBenchmark(this.batteryProvider, this.config.battery);
    }
    return this.batteryBenchmark;
  }

  /**
   * Reset all benchmarks.
   */
  reset(): void {
    this.startupBenchmark?.reset();
    this.queryBenchmark?.reset();
    this.memoryBenchmark?.reset();
    this.batteryBenchmark?.reset();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Run startup benchmark.
   */
  private async runStartupBenchmark(): Promise<StartupBenchmarkResult | undefined> {
    const benchmark = this.getStartupBenchmark();
    // Note: Actual startup measurement would be integrated into app initialization
    // This is a placeholder that returns the current result
    return benchmark.getResult('cold' as StartupType);
  }

  /**
   * Run query benchmark.
   */
  private async runQueryBenchmark(): Promise<QueryBenchmarkResult | undefined> {
    const benchmark = this.getQueryBenchmark();
    // Note: Actual queries would be executed by the application
    // This returns current accumulated results
    return benchmark.getResult();
  }

  /**
   * Run memory benchmark.
   */
  private async runMemoryBenchmark(): Promise<MemoryBenchmarkResult | undefined> {
    const benchmark = this.getMemoryBenchmark();
    if (!benchmark) return undefined;

    await benchmark.start();

    // Wait for configured duration
    const duration = benchmark.getConfig().duration;
    await new Promise<void>((resolve) => setTimeout(() => resolve(), duration));

    return await benchmark.stop();
  }

  /**
   * Run battery benchmark.
   */
  private async runBatteryBenchmark(): Promise<BatteryBenchmarkResult | undefined> {
    const benchmark = this.getBatteryBenchmark();
    if (!benchmark) return undefined;

    await benchmark.start();

    // Wait for configured duration
    const duration = benchmark.getConfig().duration;
    await new Promise<void>((resolve) => setTimeout(() => resolve(), duration));

    return await benchmark.stop();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a benchmark runner with the specified configuration.
 *
 * @param options - Runner configuration options
 * @returns Configured benchmark runner instance
 */
export function createBenchmarkRunner(options: {
  deviceInfoProvider: DeviceInfoProvider;
  memoryProvider?: MemoryInfoProvider;
  batteryProvider?: BatteryInfoProvider;
  config?: BenchmarkConfig;
}): BenchmarkRunner {
  return new BenchmarkRunner(options);
}
