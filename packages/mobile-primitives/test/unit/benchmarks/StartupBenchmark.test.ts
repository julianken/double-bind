/**
 * Unit tests for StartupBenchmark.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StartupBenchmark,
  createStartupBenchmark,
  measureStartupOperation,
} from '../../../src/benchmarks/StartupBenchmark';
import { StartupType, MetricSeverity } from '../../../src/benchmarks/types';

describe('StartupBenchmark', () => {
  let benchmark: StartupBenchmark;

  beforeEach(() => {
    vi.useFakeTimers();
    benchmark = new StartupBenchmark();
  });

  describe('initialization', () => {
    it('should create benchmark with default config', () => {
      const config = benchmark.getConfig();
      expect(config.coldStartCount).toBe(5);
      expect(config.warmStartCount).toBe(10);
      expect(config.delayBetweenRuns).toBe(1000);
    });

    it('should create benchmark with custom config', () => {
      benchmark = new StartupBenchmark({
        coldStartCount: 3,
        warmStartCount: 5,
        delayBetweenRuns: 500,
      });

      const config = benchmark.getConfig();
      expect(config.coldStartCount).toBe(3);
      expect(config.warmStartCount).toBe(5);
      expect(config.delayBetweenRuns).toBe(500);
    });
  });

  describe('phase tracking', () => {
    it('should track startup phases', () => {
      benchmark.markPhaseStart('init');
      vi.advanceTimersByTime(100);
      benchmark.markPhaseEnd('init');

      benchmark.markPhaseStart('render');
      vi.advanceTimersByTime(200);
      benchmark.markPhaseEnd('render');

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.phases).toHaveLength(2);
      expect(result.phases[0].name).toBe('init');
      expect(result.phases[0].duration).toBe(100);
      expect(result.phases[1].name).toBe('render');
      expect(result.phases[1].duration).toBe(200);
    });

    it('should throw error when ending non-existent phase', () => {
      expect(() => benchmark.markPhaseEnd('nonexistent')).toThrow(
        'Phase "nonexistent" was not started'
      );
    });

    it('should track relative timing for phases', () => {
      benchmark.markPhaseStart('phase1');
      vi.advanceTimersByTime(50);
      benchmark.markPhaseEnd('phase1');

      const result = benchmark.getResult(StartupType.COLD);
      const phase = result.phases[0];
      expect(phase.startTime).toBeGreaterThanOrEqual(0);
      expect(phase.endTime).toBeGreaterThan(phase.startTime);
    });
  });

  describe('time to interactive', () => {
    it('should track time to interactive', () => {
      vi.advanceTimersByTime(500);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.timeToInteractive).toBe(500);
    });

    it('should use total time when interactive not marked', () => {
      vi.advanceTimersByTime(300);
      const result = benchmark.getResult(StartupType.COLD);
      expect(result.timeToInteractive).toBe(result.totalTime);
    });
  });

  describe('severity calculation', () => {
    it('should mark cold start as GOOD under 1000ms', () => {
      vi.advanceTimersByTime(800);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.severity).toBe(MetricSeverity.GOOD);
    });

    it('should mark cold start as WARNING between 1000-2000ms', () => {
      vi.advanceTimersByTime(1500);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.severity).toBe(MetricSeverity.WARNING);
    });

    it('should mark cold start as CRITICAL over 2000ms', () => {
      vi.advanceTimersByTime(2500);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.severity).toBe(MetricSeverity.CRITICAL);
    });

    it('should mark warm start as GOOD under 500ms', () => {
      vi.advanceTimersByTime(400);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.WARM);
      expect(result.severity).toBe(MetricSeverity.GOOD);
    });

    it('should mark hot start as GOOD under 200ms', () => {
      vi.advanceTimersByTime(150);
      benchmark.markInteractive();

      const result = benchmark.getResult(StartupType.HOT);
      expect(result.severity).toBe(MetricSeverity.GOOD);
    });
  });

  describe('reset', () => {
    it('should reset benchmark state', () => {
      benchmark.markPhaseStart('test');
      vi.advanceTimersByTime(100);
      benchmark.markPhaseEnd('test');
      benchmark.markInteractive();

      benchmark.reset();

      const result = benchmark.getResult(StartupType.COLD);
      expect(result.phases).toHaveLength(0);
      expect(result.totalTime).toBeLessThan(10);
    });
  });

  describe('factory function', () => {
    it('should create benchmark via factory', () => {
      const bench = createStartupBenchmark({ coldStartCount: 10 });
      expect(bench.getConfig().coldStartCount).toBe(10);
    });
  });

  describe('measureStartupOperation', () => {
    it('should measure synchronous operation', async () => {
      const operation = vi.fn(() => {
        vi.advanceTimersByTime(50);
      });

      const duration = await measureStartupOperation('test', operation);
      expect(duration).toBe(50);
      expect(operation).toHaveBeenCalled();
    });

    it('should measure asynchronous operation', async () => {
      const operation = vi.fn(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      const duration = await measureStartupOperation('test', operation);
      expect(duration).toBe(100);
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('result structure', () => {
    it('should include all required fields', () => {
      vi.advanceTimersByTime(500);
      benchmark.markInteractive();
      benchmark.markPhaseStart('test');
      vi.advanceTimersByTime(100);
      benchmark.markPhaseEnd('test');

      const result = benchmark.getResult(StartupType.COLD);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('totalTime');
      expect(result).toHaveProperty('timeToInteractive');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('severity');
    });
  });
});
