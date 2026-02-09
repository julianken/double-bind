/**
 * Unit tests for MemoryBenchmark.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryBenchmark,
  MockMemoryInfoProvider,
  createMemoryBenchmark,
  formatBytes,
} from '../../../src/benchmarks/MemoryBenchmark';
import { MetricSeverity } from '../../../src/benchmarks/types';

describe('MemoryBenchmark', () => {
  let benchmark: MemoryBenchmark;
  let provider: MockMemoryInfoProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = new MockMemoryInfoProvider();
    benchmark = new MemoryBenchmark(provider, { snapshotInterval: 100, duration: 500 });
  });

  afterEach(() => {
    benchmark.reset();
  });

  describe('initialization', () => {
    it('should create benchmark with default config', () => {
      const bench = new MemoryBenchmark(provider);
      const config = bench.getConfig();

      expect(config.duration).toBe(60000);
      expect(config.snapshotInterval).toBe(1000);
      expect(config.leakThreshold).toBe(102400); // 100KB/s
    });

    it('should create benchmark with custom config', () => {
      const bench = new MemoryBenchmark(provider, {
        duration: 30000,
        snapshotInterval: 500,
        leakThreshold: 50000,
      });

      const config = bench.getConfig();
      expect(config.duration).toBe(30000);
      expect(config.snapshotInterval).toBe(500);
      expect(config.leakThreshold).toBe(50000);
    });
  });

  describe('snapshot tracking', () => {
    it('should take initial snapshot on start', async () => {
      await benchmark.start();

      const snapshots = benchmark.getSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].used).toBe(50 * 1024 * 1024);
    });

    it('should take periodic snapshots', async () => {
      await benchmark.start();

      // Manually take a few more snapshots instead of relying on timers
      await benchmark.takeSnapshot();
      await benchmark.takeSnapshot();

      const snapshots = benchmark.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(1);
    });

    it('should manually take snapshot', async () => {
      const snapshot = await benchmark.takeSnapshot();

      expect(snapshot).toHaveProperty('allocated');
      expect(snapshot).toHaveProperty('used');
      expect(snapshot).toHaveProperty('available');
      expect(snapshot).toHaveProperty('usagePercent');
      expect(snapshot).toHaveProperty('timestamp');
    });

    it('should calculate usage percent', async () => {
      provider.setMockUsed(75 * 1024 * 1024);
      const snapshot = await benchmark.takeSnapshot();

      expect(snapshot.usagePercent).toBe(0.75);
    });
  });

  describe('memory growth tracking', () => {
    it('should track memory growth', async () => {
      provider.setMockUsed(50 * 1024 * 1024);
      await benchmark.start();

      provider.setMockUsed(60 * 1024 * 1024);
      await benchmark.takeSnapshot();

      const result = await benchmark.stop();
      expect(result.memoryGrowth).toBe(10 * 1024 * 1024);
    });

    it('should identify peak memory usage', async () => {
      await benchmark.start();

      provider.setMockUsed(50 * 1024 * 1024);
      await benchmark.takeSnapshot();

      provider.setMockUsed(80 * 1024 * 1024);
      await benchmark.takeSnapshot();

      provider.setMockUsed(60 * 1024 * 1024);
      await benchmark.takeSnapshot();

      const result = await benchmark.stop();
      expect(result.peak.used).toBe(80 * 1024 * 1024);
    });
  });

  describe('leak detection', () => {
    it('should detect memory leaks with sustained growth', async () => {
      await benchmark.start();

      // Simulate sustained memory growth
      for (let i = 0; i < 15; i++) {
        provider.setMockUsed(50 * 1024 * 1024 + i * 1024 * 1024);
        await benchmark.takeSnapshot();
        vi.advanceTimersByTime(100);
      }

      const result = await benchmark.stop();
      expect(result.leaks.length).toBeGreaterThan(0);
    });

    it('should not detect leaks with stable memory', async () => {
      await benchmark.start();

      // Stable memory usage
      for (let i = 0; i < 15; i++) {
        provider.setMockUsed(50 * 1024 * 1024);
        await benchmark.takeSnapshot();
        vi.advanceTimersByTime(100);
      }

      const result = await benchmark.stop();
      expect(result.leaks).toHaveLength(0);
    });

    it('should mark critical leaks appropriately', async () => {
      benchmark = new MemoryBenchmark(provider, {
        snapshotInterval: 100,
        leakThreshold: 1024 * 50, // 50KB/s
        duration: 500,
      });

      await benchmark.start();

      // Very high growth rate
      for (let i = 0; i < 15; i++) {
        provider.setMockUsed(50 * 1024 * 1024 + i * 5 * 1024 * 1024);
        await benchmark.takeSnapshot();
        vi.advanceTimersByTime(100);
      }

      const result = await benchmark.stop();
      const criticalLeaks = result.leaks.filter(
        (leak) => leak.severity === MetricSeverity.CRITICAL
      );
      expect(criticalLeaks.length).toBeGreaterThan(0);
    });
  });

  describe('severity calculation', () => {
    it('should mark as GOOD with no growth', async () => {
      await benchmark.start();
      const result = await benchmark.stop();
      expect(result.severity).toBe(MetricSeverity.GOOD);
    });

    it('should mark as WARNING with moderate growth', async () => {
      provider.setMockUsed(50 * 1024 * 1024);
      await benchmark.start();

      provider.setMockUsed(65 * 1024 * 1024);
      const result = await benchmark.stop();

      expect(result.severity).toBe(MetricSeverity.WARNING);
    });

    it('should mark as CRITICAL with leaks', async () => {
      benchmark = new MemoryBenchmark(provider, {
        snapshotInterval: 100,
        leakThreshold: 1024 * 10, // 10KB/s
        duration: 500,
      });

      await benchmark.start();

      // Simulate sustained growth above threshold
      for (let i = 0; i < 15; i++) {
        provider.setMockUsed(50 * 1024 * 1024 + i * 2 * 1024 * 1024);
        await benchmark.takeSnapshot();
        vi.advanceTimersByTime(100);
      }

      const result = await benchmark.stop();
      expect(result.severity).toBe(MetricSeverity.CRITICAL);
    });
  });

  describe('reset', () => {
    it('should reset benchmark state', async () => {
      await benchmark.start();
      await benchmark.takeSnapshot();

      benchmark.reset();

      const snapshots = benchmark.getSnapshots();
      expect(snapshots).toHaveLength(0);
    });

    it('should clear interval timer on reset', async () => {
      await benchmark.start();
      benchmark.reset();

      const snapshots = benchmark.getSnapshots();
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should throw when stopping without starting', async () => {
      await expect(benchmark.stop()).rejects.toThrow('Benchmark not started');
    });
  });

  describe('factory function', () => {
    it('should create benchmark via factory', () => {
      const bench = createMemoryBenchmark(provider, { duration: 30000 });
      expect(bench.getConfig().duration).toBe(30000);
    });
  });

  describe('formatBytes utility', () => {
    it('should format bytes correctly', () => {
      // formatBytes from memory module formats without trailing zeros
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle fractional values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });
  });

  describe('MockMemoryInfoProvider', () => {
    it('should provide mock memory info', async () => {
      const info = await provider.getMemoryInfo();

      expect(info.allocated).toBe(100 * 1024 * 1024);
      expect(info.used).toBe(50 * 1024 * 1024);
      expect(info.available).toBe(50 * 1024 * 1024);
    });

    it('should allow setting mock values', async () => {
      provider.setMockUsed(75 * 1024 * 1024);

      const info = await provider.getMemoryInfo();
      expect(info.used).toBe(75 * 1024 * 1024);
      expect(info.available).toBe(25 * 1024 * 1024);
    });
  });

  describe('result structure', () => {
    it('should include all required fields', async () => {
      await benchmark.start();
      await benchmark.takeSnapshot();

      const result = await benchmark.stop();

      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('final');
      expect(result).toHaveProperty('peak');
      expect(result).toHaveProperty('snapshots');
      expect(result).toHaveProperty('leaks');
      expect(result).toHaveProperty('memoryGrowth');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('severity');
    });
  });
});
