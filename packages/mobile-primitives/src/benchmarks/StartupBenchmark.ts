/**
 * StartupBenchmark - Measure app cold/warm start times.
 *
 * Provides utilities to measure and analyze application startup performance
 * including time to interactive and breakdown by startup phases.
 */

import type {
  StartupBenchmarkConfig,
  StartupBenchmarkResult,
  StartupPhase,
  Timestamp,
  Duration,
} from './types';
import { StartupType, MetricSeverity } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Startup phase tracker for internal use.
 */
interface PhaseTracker {
  name: string;
  startTime: Timestamp;
  endTime?: Timestamp;
}

// ============================================================================
// StartupBenchmark
// ============================================================================

/**
 * Utility for measuring application startup performance.
 *
 * @example
 * ```typescript
 * const benchmark = new StartupBenchmark();
 *
 * // Mark startup phases
 * benchmark.markPhaseStart('init');
 * await initializeApp();
 * benchmark.markPhaseEnd('init');
 *
 * benchmark.markPhaseStart('render');
 * await renderUI();
 * benchmark.markPhaseEnd('render');
 *
 * // Get results
 * const result = benchmark.getResult(StartupType.COLD);
 * // result.totalTime contains the startup time in ms
 * ```
 */
export class StartupBenchmark {
  private appLaunchTime: Timestamp;
  private interactiveTime?: Timestamp;
  private phases = new Map<string, PhaseTracker>();
  private config: Required<StartupBenchmarkConfig>;

  constructor(config: StartupBenchmarkConfig = {}) {
    this.appLaunchTime = Date.now();
    this.config = {
      coldStartCount: config.coldStartCount ?? 5,
      warmStartCount: config.warmStartCount ?? 10,
      delayBetweenRuns: config.delayBetweenRuns ?? 1000,
    };
  }

  /**
   * Mark the start of a startup phase.
   *
   * @param name - Name of the phase (e.g., 'init', 'database', 'render')
   */
  markPhaseStart(name: string): void {
    const startTime = Date.now();
    this.phases.set(name, { name, startTime });
  }

  /**
   * Mark the end of a startup phase.
   *
   * @param name - Name of the phase to end
   */
  markPhaseEnd(name: string): void {
    const phase = this.phases.get(name);
    if (!phase) {
      throw new Error(`Phase "${name}" was not started`);
    }

    phase.endTime = Date.now();
  }

  /**
   * Mark when the app becomes interactive (usable by user).
   */
  markInteractive(): void {
    this.interactiveTime = Date.now();
  }

  /**
   * Get the benchmark result.
   *
   * @param type - Type of startup (cold/warm/hot)
   * @returns Complete startup benchmark result
   */
  getResult(type: StartupType): StartupBenchmarkResult {
    const now = Date.now();
    const totalTime = now - this.appLaunchTime;
    const timeToInteractive = this.interactiveTime
      ? this.interactiveTime - this.appLaunchTime
      : totalTime;

    const phases: StartupPhase[] = Array.from(this.phases.values())
      .filter((p) => p.endTime !== undefined)
      .map((p) => ({
        name: p.name,
        startTime: p.startTime - this.appLaunchTime,
        endTime: p.endTime! - this.appLaunchTime,
        duration: p.endTime! - p.startTime,
      }));

    const severity = this.calculateSeverity(type, totalTime, timeToInteractive);

    return {
      type,
      totalTime,
      timeToInteractive,
      phases,
      timestamp: this.appLaunchTime,
      severity,
    };
  }

  /**
   * Reset the benchmark for a new measurement.
   */
  reset(): void {
    this.appLaunchTime = Date.now();
    this.interactiveTime = undefined;
    this.phases.clear();
  }

  /**
   * Get configuration.
   */
  getConfig(): Required<StartupBenchmarkConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate performance severity based on startup time.
   */
  private calculateSeverity(
    type: StartupType,
    totalTime: Duration,
    timeToInteractive: Duration
  ): MetricSeverity {
    // Thresholds based on Google's mobile performance guidelines
    const thresholds = {
      [StartupType.COLD]: { good: 1000, warning: 2000 },
      [StartupType.WARM]: { good: 500, warning: 1000 },
      [StartupType.HOT]: { good: 200, warning: 500 },
    };

    const threshold = thresholds[type];

    if (timeToInteractive <= threshold.good) {
      return MetricSeverity.GOOD;
    } else if (timeToInteractive <= threshold.warning) {
      return MetricSeverity.WARNING;
    } else {
      return MetricSeverity.CRITICAL;
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a startup benchmark with automatic phase tracking.
 *
 * @param config - Benchmark configuration
 * @returns Configured startup benchmark instance
 */
export function createStartupBenchmark(config?: StartupBenchmarkConfig): StartupBenchmark {
  return new StartupBenchmark(config);
}

/**
 * Measure a single startup operation.
 *
 * @param name - Operation name
 * @param fn - Function to measure
 * @returns Operation duration in milliseconds
 */
export async function measureStartupOperation(
  name: string,
  fn: () => Promise<void> | void
): Promise<Duration> {
  const start = Date.now();
  await fn();
  const duration = Date.now() - start;
  return duration;
}
