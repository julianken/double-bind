/**
 * Type definitions for performance benchmarking utilities.
 *
 * Provides comprehensive types for measuring and reporting on mobile app
 * performance including startup time, query performance, memory usage,
 * and battery impact.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Timestamp in milliseconds.
 */
export type Timestamp = number;

/**
 * Duration in milliseconds.
 */
export type Duration = number;

/**
 * Memory size in bytes.
 */
export type Bytes = number;

/**
 * Performance metrics severity level.
 */
export enum MetricSeverity {
  /** Performance is optimal */
  GOOD = 'good',
  /** Performance is acceptable but could be better */
  WARNING = 'warning',
  /** Performance is poor and needs attention */
  CRITICAL = 'critical',
}

// ============================================================================
// Startup Benchmark Types
// ============================================================================

/**
 * Type of app startup.
 */
export enum StartupType {
  /** App launched from terminated state */
  COLD = 'cold',
  /** App resumed from background */
  WARM = 'warm',
  /** App already in foreground */
  HOT = 'hot',
}

/**
 * Startup phase measurement.
 */
export interface StartupPhase {
  /** Phase name */
  name: string;
  /** Start time relative to app launch */
  startTime: Timestamp;
  /** End time relative to app launch */
  endTime: Timestamp;
  /** Phase duration in milliseconds */
  duration: Duration;
}

/**
 * Complete startup benchmark result.
 */
export interface StartupBenchmarkResult {
  /** Type of startup measured */
  type: StartupType;
  /** Total startup time in milliseconds */
  totalTime: Duration;
  /** Time to interactive (when app is usable) */
  timeToInteractive: Duration;
  /** Individual startup phases */
  phases: StartupPhase[];
  /** Timestamp when measurement started */
  timestamp: Timestamp;
  /** Performance severity */
  severity: MetricSeverity;
}

// ============================================================================
// Query Benchmark Types
// ============================================================================

/**
 * Type of database query being measured.
 */
export enum QueryType {
  /** Simple read query */
  READ = 'read',
  /** Complex read with joins */
  COMPLEX_READ = 'complex_read',
  /** Write/mutation query */
  WRITE = 'write',
  /** Full-text search query */
  SEARCH = 'search',
  /** Graph traversal query */
  GRAPH = 'graph',
}

/**
 * Individual query execution measurement.
 */
export interface QueryExecution {
  /** Query identifier */
  queryId: string;
  /** Type of query */
  type: QueryType;
  /** Query execution time in milliseconds */
  executionTime: Duration;
  /** Number of rows/results returned */
  resultCount: number;
  /** Whether query used cached results */
  cached: boolean;
  /** Timestamp when query executed */
  timestamp: Timestamp;
}

/**
 * Aggregated query performance statistics.
 */
export interface QueryStats {
  /** Type of query */
  type: QueryType;
  /** Total number of executions */
  count: number;
  /** Average execution time */
  avgTime: Duration;
  /** Minimum execution time */
  minTime: Duration;
  /** Maximum execution time */
  maxTime: Duration;
  /** 95th percentile execution time */
  p95Time: Duration;
  /** Cache hit rate (0.0-1.0) */
  cacheHitRate: number;
}

/**
 * Complete query benchmark result.
 */
export interface QueryBenchmarkResult {
  /** Individual query executions */
  executions: QueryExecution[];
  /** Aggregated statistics by query type */
  stats: QueryStats[];
  /** Total queries executed */
  totalQueries: number;
  /** Benchmark duration in milliseconds */
  duration: Duration;
  /** Timestamp when benchmark started */
  timestamp: Timestamp;
  /** Overall performance severity */
  severity: MetricSeverity;
}

// ============================================================================
// Memory Benchmark Types
// ============================================================================

/**
 * Memory snapshot at a point in time.
 */
export interface MemorySnapshot {
  /** Total memory allocated in bytes */
  allocated: Bytes;
  /** Memory actively in use in bytes */
  used: Bytes;
  /** Memory available for allocation in bytes */
  available: Bytes;
  /** Memory usage percentage (0.0-1.0) */
  usagePercent: number;
  /** Timestamp of snapshot */
  timestamp: Timestamp;
}

/**
 * Memory leak detection result.
 */
export interface MemoryLeak {
  /** Description of suspected leak */
  description: string;
  /** Memory growth rate in bytes/second */
  growthRate: number;
  /** Duration over which leak was detected */
  duration: Duration;
  /** Severity of leak */
  severity: MetricSeverity;
}

/**
 * Complete memory benchmark result.
 */
export interface MemoryBenchmarkResult {
  /** Initial memory snapshot */
  initial: MemorySnapshot;
  /** Final memory snapshot */
  final: MemorySnapshot;
  /** Peak memory usage */
  peak: MemorySnapshot;
  /** Memory snapshots during benchmark */
  snapshots: MemorySnapshot[];
  /** Detected memory leaks */
  leaks: MemoryLeak[];
  /** Total memory growth in bytes */
  memoryGrowth: Bytes;
  /** Benchmark duration in milliseconds */
  duration: Duration;
  /** Timestamp when benchmark started */
  timestamp: Timestamp;
  /** Overall performance severity */
  severity: MetricSeverity;
}

// ============================================================================
// Battery Benchmark Types
// ============================================================================

/**
 * Battery drain measurement.
 */
export interface BatteryDrain {
  /** Battery level at start (0.0-1.0) */
  startLevel: number;
  /** Battery level at end (0.0-1.0) */
  endLevel: number;
  /** Battery drain percentage */
  drainPercent: number;
  /** Duration of measurement in milliseconds */
  duration: Duration;
  /** Drain rate (percent per hour) */
  drainRate: number;
}

/**
 * CPU usage measurement.
 */
export interface CPUUsage {
  /** Average CPU usage percentage (0.0-1.0) */
  average: number;
  /** Peak CPU usage percentage (0.0-1.0) */
  peak: number;
  /** CPU usage samples */
  samples: number[];
}

/**
 * Complete battery benchmark result.
 */
export interface BatteryBenchmarkResult {
  /** Battery drain measurement */
  drain: BatteryDrain;
  /** CPU usage during benchmark */
  cpuUsage: CPUUsage;
  /** Number of wake locks held */
  wakeLocks: number;
  /** Whether device was charging */
  charging: boolean;
  /** Whether low power mode was active */
  lowPowerMode: boolean;
  /** Benchmark duration in milliseconds */
  duration: Duration;
  /** Timestamp when benchmark started */
  timestamp: Timestamp;
  /** Overall performance severity */
  severity: MetricSeverity;
}

// ============================================================================
// Benchmark Configuration Types
// ============================================================================

/**
 * Configuration for startup benchmarks.
 */
export interface StartupBenchmarkConfig {
  /** Number of cold starts to measure */
  coldStartCount?: number;
  /** Number of warm starts to measure */
  warmStartCount?: number;
  /** Delay between measurements in milliseconds */
  delayBetweenRuns?: number;
}

/**
 * Configuration for query benchmarks.
 */
export interface QueryBenchmarkConfig {
  /** Number of queries to execute per type */
  queriesPerType?: number;
  /** Whether to clear cache between queries */
  clearCache?: boolean;
  /** Query timeout in milliseconds */
  timeout?: number;
}

/**
 * Configuration for memory benchmarks.
 */
export interface MemoryBenchmarkConfig {
  /** Duration to run benchmark in milliseconds */
  duration?: number;
  /** Interval between snapshots in milliseconds */
  snapshotInterval?: number;
  /** Memory growth threshold to detect leaks (bytes/second) */
  leakThreshold?: number;
}

/**
 * Configuration for battery benchmarks.
 */
export interface BatteryBenchmarkConfig {
  /** Duration to run benchmark in milliseconds */
  duration?: number;
  /** Interval between CPU samples in milliseconds */
  sampleInterval?: number;
  /** Whether to measure during charging */
  includeCharging?: boolean;
}

/**
 * Master configuration for all benchmarks.
 */
export interface BenchmarkConfig {
  /** Startup benchmark configuration */
  startup?: StartupBenchmarkConfig;
  /** Query benchmark configuration */
  query?: QueryBenchmarkConfig;
  /** Memory benchmark configuration */
  memory?: MemoryBenchmarkConfig;
  /** Battery benchmark configuration */
  battery?: BatteryBenchmarkConfig;
}

// ============================================================================
// Benchmark Result Types
// ============================================================================

/**
 * Complete benchmark suite results.
 */
export interface BenchmarkResults {
  /** Startup benchmark result */
  startup?: StartupBenchmarkResult;
  /** Query benchmark result */
  query?: QueryBenchmarkResult;
  /** Memory benchmark result */
  memory?: MemoryBenchmarkResult;
  /** Battery benchmark result */
  battery?: BatteryBenchmarkResult;
  /** Overall benchmark duration */
  totalDuration: Duration;
  /** Timestamp when benchmarks started */
  timestamp: Timestamp;
  /** Device information */
  device: DeviceInfo;
}

/**
 * Device information for context.
 */
export interface DeviceInfo {
  /** Device platform (iOS/Android) */
  platform: string;
  /** OS version */
  osVersion: string;
  /** Device model */
  model: string;
  /** App version */
  appVersion: string;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Output format for benchmark reports.
 */
export enum ReportFormat {
  /** JSON format */
  JSON = 'json',
  /** Markdown format */
  MARKDOWN = 'markdown',
  /** HTML format */
  HTML = 'html',
}

/**
 * Benchmark report configuration.
 */
export interface ReportConfig {
  /** Output format */
  format: ReportFormat;
  /** Whether to include detailed metrics */
  includeDetails?: boolean;
  /** Whether to include historical comparison */
  includeHistory?: boolean;
  /** Output file path (if saving to file) */
  outputPath?: string;
}
