/**
 * QueryBenchmark - Measure database query performance.
 *
 * Provides utilities to track query execution times, aggregate statistics,
 * and identify performance bottlenecks in database operations.
 */

import type {
  QueryBenchmarkConfig,
  QueryBenchmarkResult,
  QueryExecution,
  QueryStats,
  Duration,
} from './types';
import { QueryType, MetricSeverity } from './types';

// ============================================================================
// QueryBenchmark
// ============================================================================

/**
 * Utility for measuring database query performance.
 *
 * @example
 * ```typescript
 * const benchmark = new QueryBenchmark();
 *
 * // Record query execution
 * const execution = await benchmark.measureQuery(
 *   'fetch-blocks',
 *   QueryType.READ,
 *   async () => {
 *     return await db.query('SELECT * FROM blocks');
 *   }
 * );
 *
 * // Get aggregated statistics
 * const result = benchmark.getResult();
 * // result.stats[0].avgTime contains the average query time
 * ```
 */
export class QueryBenchmark {
  private executions: QueryExecution[] = [];
  private startTime: number;
  private config: Required<QueryBenchmarkConfig>;

  constructor(config: QueryBenchmarkConfig = {}) {
    this.startTime = Date.now();
    this.config = {
      queriesPerType: config.queriesPerType ?? 100,
      clearCache: config.clearCache ?? false,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Measure a query execution and record the result.
   *
   * @param queryId - Unique identifier for the query
   * @param type - Type of query being executed
   * @param fn - Query function to execute
   * @param cached - Whether results are from cache
   * @returns Query execution record
   */
  async measureQuery<T>(
    queryId: string,
    type: QueryType,
    fn: () => Promise<T>,
    cached = false
  ): Promise<QueryExecution> {
    const start = Date.now();

    let resultCount = 0;
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), this.config.timeout)
        ),
      ]);

      // Estimate result count
      if (Array.isArray(result)) {
        resultCount = result.length;
      } else if (result && typeof result === 'object') {
        resultCount = 1;
      }
    } catch {
      // Query failed or timed out
      resultCount = 0;
    }

    const executionTime = Date.now() - start;

    const execution: QueryExecution = {
      queryId,
      type,
      executionTime,
      resultCount,
      cached,
      timestamp: start,
    };

    this.executions.push(execution);
    return execution;
  }

  /**
   * Record a pre-measured query execution.
   *
   * @param execution - Query execution to record
   */
  recordExecution(execution: QueryExecution): void {
    this.executions.push(execution);
  }

  /**
   * Get the complete benchmark result with statistics.
   *
   * @returns Query benchmark result
   */
  getResult(): QueryBenchmarkResult {
    const stats = this.calculateStats();
    const duration = Date.now() - this.startTime;
    const severity = this.calculateSeverity(stats);

    return {
      executions: [...this.executions],
      stats,
      totalQueries: this.executions.length,
      duration,
      timestamp: this.startTime,
      severity,
    };
  }

  /**
   * Get statistics for a specific query type.
   *
   * @param type - Query type to get statistics for
   * @returns Query statistics or undefined if no queries of that type
   */
  getStatsByType(type: QueryType): QueryStats | undefined {
    const stats = this.calculateStats();
    return stats.find((s) => s.type === type);
  }

  /**
   * Reset the benchmark for a new measurement.
   */
  reset(): void {
    this.executions = [];
    this.startTime = Date.now();
  }

  /**
   * Get configuration.
   */
  getConfig(): Required<QueryBenchmarkConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate aggregated statistics by query type.
   */
  private calculateStats(): QueryStats[] {
    const statsByType = new Map<QueryType, QueryExecution[]>();

    // Group executions by type
    for (const execution of this.executions) {
      const existing = statsByType.get(execution.type) ?? [];
      existing.push(execution);
      statsByType.set(execution.type, existing);
    }

    // Calculate stats for each type
    const stats: QueryStats[] = [];
    for (const [type, executions] of statsByType) {
      if (executions.length === 0) continue;

      const times = executions.map((e) => e.executionTime).sort((a, b) => a - b);
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const minTime = times[0];
      const maxTime = times[times.length - 1];
      const p95Time = times[Math.floor(times.length * 0.95)] ?? maxTime;

      const cachedCount = executions.filter((e) => e.cached).length;
      const cacheHitRate = cachedCount / executions.length;

      stats.push({
        type,
        count: executions.length,
        avgTime,
        minTime,
        maxTime,
        p95Time,
        cacheHitRate,
      });
    }

    return stats;
  }

  /**
   * Calculate overall performance severity.
   */
  private calculateSeverity(stats: QueryStats[]): MetricSeverity {
    if (stats.length === 0) {
      return MetricSeverity.GOOD;
    }

    // Define thresholds for different query types (in milliseconds)
    const thresholds = {
      [QueryType.READ]: { good: 50, warning: 100 },
      [QueryType.COMPLEX_READ]: { good: 200, warning: 500 },
      [QueryType.WRITE]: { good: 100, warning: 200 },
      [QueryType.SEARCH]: { good: 150, warning: 300 },
      [QueryType.GRAPH]: { good: 300, warning: 600 },
    };

    let criticalCount = 0;
    let warningCount = 0;

    for (const stat of stats) {
      const threshold = thresholds[stat.type];
      if (stat.p95Time > threshold.warning) {
        criticalCount++;
      } else if (stat.p95Time > threshold.good) {
        warningCount++;
      }
    }

    // If any query type is critical, overall is critical
    if (criticalCount > 0) {
      return MetricSeverity.CRITICAL;
    } else if (warningCount > 0) {
      return MetricSeverity.WARNING;
    } else {
      return MetricSeverity.GOOD;
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a query benchmark with the specified configuration.
 *
 * @param config - Benchmark configuration
 * @returns Configured query benchmark instance
 */
export function createQueryBenchmark(config?: QueryBenchmarkConfig): QueryBenchmark {
  return new QueryBenchmark(config);
}

/**
 * Calculate percentile from an array of durations.
 *
 * @param durations - Array of duration values
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value
 */
export function calculatePercentile(durations: Duration[], percentile: number): Duration {
  if (durations.length === 0) return 0;

  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil((sorted.length * percentile) / 100) - 1;
  return sorted[Math.max(0, index)] ?? sorted[sorted.length - 1];
}
