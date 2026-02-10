/**
 * Unit tests for BenchmarkRunner.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BenchmarkRunner,
  MockDeviceInfoProvider,
  createBenchmarkRunner,
} from '../../../src/benchmarks/BenchmarkRunner';
import { MockMemoryInfoProvider } from '../../../src/benchmarks/MemoryBenchmark';
import { MockBatteryInfoProvider } from '../../../src/benchmarks/BatteryBenchmark';
import { StartupType } from '../../../src/benchmarks/types';

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;
  let deviceInfoProvider: MockDeviceInfoProvider;
  let memoryProvider: MockMemoryInfoProvider;
  let batteryProvider: MockBatteryInfoProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    deviceInfoProvider = new MockDeviceInfoProvider();
    memoryProvider = new MockMemoryInfoProvider();
    batteryProvider = new MockBatteryInfoProvider();

    runner = new BenchmarkRunner({
      deviceInfoProvider,
      memoryProvider,
      batteryProvider,
      config: {
        startup: { coldStartCount: 3 },
        query: { queriesPerType: 50 },
        memory: { duration: 1000, snapshotInterval: 100 },
        battery: { duration: 1000, sampleInterval: 100 },
      },
    });
  });

  describe('initialization', () => {
    it('should create runner with all providers', () => {
      expect(runner).toBeDefined();
      expect(runner.getStartupBenchmark()).toBeDefined();
      expect(runner.getQueryBenchmark()).toBeDefined();
      expect(runner.getMemoryBenchmark()).toBeDefined();
      expect(runner.getBatteryBenchmark()).toBeDefined();
    });

    it('should create runner without optional providers', () => {
      const minimalRunner = new BenchmarkRunner({ deviceInfoProvider });

      expect(minimalRunner.getStartupBenchmark()).toBeDefined();
      expect(minimalRunner.getQueryBenchmark()).toBeDefined();
      expect(minimalRunner.getMemoryBenchmark()).toBeUndefined();
      expect(minimalRunner.getBatteryBenchmark()).toBeUndefined();
    });
  });

  describe('run all benchmarks', () => {
    it('should run all benchmarks by default', async () => {
      const resultsPromise = runner.run();
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.startup).toBeDefined();
      expect(results.query).toBeDefined();
      expect(results.memory).toBeDefined();
      expect(results.battery).toBeDefined();
      expect(results.device).toBeDefined();
      expect(results.totalDuration).toBeGreaterThan(0);
    });

    it('should include device information', async () => {
      const resultsPromise = runner.run();
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.device.platform).toBe('test');
      expect(results.device.osVersion).toBe('1.0.0');
      expect(results.device.model).toBe('Test Device');
      expect(results.device.appVersion).toBe('0.1.0');
    });

    it('should track total duration', async () => {
      const resultsPromise = runner.run();
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;
      expect(results.totalDuration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('selective benchmark execution', () => {
    it('should run only startup benchmark', async () => {
      const resultsPromise = runner.run({ startup: true });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.startup).toBeDefined();
      expect(results.query).toBeUndefined();
      expect(results.memory).toBeUndefined();
      expect(results.battery).toBeUndefined();
    });

    it('should run only query benchmark', async () => {
      const resultsPromise = runner.run({ query: true });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.startup).toBeUndefined();
      expect(results.query).toBeDefined();
      expect(results.memory).toBeUndefined();
      expect(results.battery).toBeUndefined();
    });

    it('should run memory and battery in parallel', async () => {
      const resultsPromise = runner.run({ memory: true, battery: true });
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.startup).toBeUndefined();
      expect(results.query).toBeUndefined();
      expect(results.memory).toBeDefined();
      expect(results.battery).toBeDefined();
    });

    it('should run multiple benchmarks selectively', async () => {
      const resultsPromise = runner.run({ startup: true, query: true });
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const results = await resultsPromise;

      expect(results.startup).toBeDefined();
      expect(results.query).toBeDefined();
      expect(results.memory).toBeUndefined();
      expect(results.battery).toBeUndefined();
    });
  });

  describe('benchmark instance access', () => {
    it('should provide access to startup benchmark', () => {
      const startup = runner.getStartupBenchmark();
      expect(startup.getConfig().coldStartCount).toBe(3);
    });

    it('should provide access to query benchmark', () => {
      const query = runner.getQueryBenchmark();
      expect(query.getConfig().queriesPerType).toBe(50);
    });

    it('should provide access to memory benchmark', () => {
      const memory = runner.getMemoryBenchmark();
      expect(memory).toBeDefined();
      expect(memory!.getConfig().duration).toBe(1000);
    });

    it('should provide access to battery benchmark', () => {
      const battery = runner.getBatteryBenchmark();
      expect(battery).toBeDefined();
      expect(battery!.getConfig().duration).toBe(1000);
    });

    it('should return undefined for missing providers', () => {
      const minimalRunner = new BenchmarkRunner({ deviceInfoProvider });

      expect(minimalRunner.getMemoryBenchmark()).toBeUndefined();
      expect(minimalRunner.getBatteryBenchmark()).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset all benchmarks', async () => {
      await runner.run({ startup: true });
      runner.reset();

      const startup = runner.getStartupBenchmark();
      const result = startup.getResult('cold' as StartupType);
      expect(result.phases).toHaveLength(0);
    });
  });

  describe('factory function', () => {
    it('should create runner via factory', () => {
      const newRunner = createBenchmarkRunner({
        deviceInfoProvider,
        memoryProvider,
        batteryProvider,
      });

      expect(newRunner).toBeDefined();
      expect(newRunner.getStartupBenchmark()).toBeDefined();
    });
  });

  describe('MockDeviceInfoProvider', () => {
    it('should provide mock device info', async () => {
      const info = await deviceInfoProvider.getDeviceInfo();

      expect(info.platform).toBe('test');
      expect(info.osVersion).toBe('1.0.0');
      expect(info.model).toBe('Test Device');
      expect(info.appVersion).toBe('0.1.0');
    });
  });

  describe('configuration passing', () => {
    it('should pass config to benchmarks', () => {
      const startup = runner.getStartupBenchmark();
      const query = runner.getQueryBenchmark();
      const memory = runner.getMemoryBenchmark();
      const battery = runner.getBatteryBenchmark();

      expect(startup.getConfig().coldStartCount).toBe(3);
      expect(query.getConfig().queriesPerType).toBe(50);
      expect(memory!.getConfig().duration).toBe(1000);
      expect(battery!.getConfig().duration).toBe(1000);
    });
  });

  describe('without memory/battery providers', () => {
    it('should skip memory benchmark when provider not available', async () => {
      const minimalRunner = new BenchmarkRunner({ deviceInfoProvider });

      const results = await minimalRunner.run({ memory: true });
      expect(results.memory).toBeUndefined();
    });

    it('should skip battery benchmark when provider not available', async () => {
      const minimalRunner = new BenchmarkRunner({ deviceInfoProvider });

      const results = await minimalRunner.run({ battery: true });
      expect(results.battery).toBeUndefined();
    });
  });
});
