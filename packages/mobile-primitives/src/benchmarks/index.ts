/**
 * Performance benchmarking utilities for mobile applications.
 *
 * Provides comprehensive tools for measuring and analyzing mobile app
 * performance including startup time, query performance, memory usage,
 * and battery impact.
 */

// Types
export * from './types';

// Startup benchmarking
export {
  StartupBenchmark,
  createStartupBenchmark,
  measureStartupOperation,
} from './StartupBenchmark';

// Query benchmarking
export { QueryBenchmark, createQueryBenchmark, calculatePercentile } from './QueryBenchmark';

// Memory benchmarking
export {
  MemoryBenchmark,
  createMemoryBenchmark,
  type MemoryInfoProvider,
  MockMemoryInfoProvider,
} from './MemoryBenchmark';

// Battery benchmarking
export {
  BatteryBenchmark,
  createBatteryBenchmark,
  estimateBatteryTimeRemaining,
  type BatteryInfoProvider,
  MockBatteryInfoProvider,
} from './BatteryBenchmark';

// Benchmark orchestration
export {
  BenchmarkRunner,
  createBenchmarkRunner,
  type DeviceInfoProvider,
  MockDeviceInfoProvider,
  type RunOptions,
} from './BenchmarkRunner';

// Report generation
export {
  BenchmarkReporter,
  createBenchmarkReporter,
  generateQuickSummary,
} from './BenchmarkReporter';
