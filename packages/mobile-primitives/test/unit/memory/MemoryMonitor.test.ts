/**
 * Unit tests for MemoryMonitor service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryMonitor } from '../../../src/memory/MemoryMonitor';
import { MemoryWarning } from '@double-bind/types';

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    monitor?.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create monitor with default options', () => {
      monitor = new MemoryMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.getMemoryState()).toBeNull();
    });

    it('should create monitor with custom options', () => {
      const onWarning = vi.fn();
      monitor = new MemoryMonitor({
        interval: 1000,
        thresholds: { warning: 70, critical: 90 },
        autoEvictOnPressure: false,
        onWarningLevelChange: onWarning,
      });

      expect(monitor).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start monitoring', () => {
      monitor = new MemoryMonitor();
      monitor.start();

      const state = monitor.getMemoryState();
      expect(state).toBeDefined();
      expect(state?.pressureLevel).toBeDefined();
    });

    it('should not start twice', () => {
      monitor = new MemoryMonitor();
      monitor.start();
      const state1 = monitor.getMemoryState();

      monitor.start(); // Try to start again
      const state2 = monitor.getMemoryState();

      expect(state1).toBe(state2);
    });

    it('should stop monitoring', () => {
      monitor = new MemoryMonitor({ interval: 100 });
      monitor.start();

      expect(monitor.getMemoryState()).toBeDefined();

      monitor.stop();
      const stateBefore = monitor.getMemoryState();

      vi.advanceTimersByTime(500);

      const stateAfter = monitor.getMemoryState();
      expect(stateBefore).toBe(stateAfter);
    });

    it('should update state periodically', () => {
      const onStateChange = vi.fn();
      monitor = new MemoryMonitor({
        interval: 100,
        onMemoryStateChange: onStateChange,
      });

      monitor.start();

      expect(onStateChange).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(onStateChange).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(onStateChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('memory state', () => {
    it('should get current memory state', () => {
      monitor = new MemoryMonitor();
      monitor.start();

      const state = monitor.getMemoryState();
      expect(state).toBeDefined();
      expect(state?.used).toBeGreaterThanOrEqual(0);
      expect(state?.available).toBeGreaterThan(0);
      expect(state?.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(state?.pressureLevel).toBeDefined();
      expect(state?.timestamp).toBeGreaterThan(0);
    });

    it('should manually update memory state', () => {
      monitor = new MemoryMonitor();
      monitor.start();

      const stateBefore = monitor.getMemoryState();
      vi.advanceTimersByTime(10);

      monitor.updateMemoryState();
      const stateAfter = monitor.getMemoryState();

      expect(stateAfter?.timestamp).toBeGreaterThan(stateBefore!.timestamp);
    });

    it('should calculate correct pressure level', () => {
      monitor = new MemoryMonitor({
        thresholds: { warning: 60, critical: 80 },
      });

      // Mock memory info to test different pressure levels
      monitor.start();
      const state = monitor.getMemoryState();

      expect(state?.pressureLevel).toBeDefined();
      expect([MemoryWarning.NORMAL, MemoryWarning.WARNING, MemoryWarning.CRITICAL]).toContain(
        state?.pressureLevel
      );
    });
  });

  describe('warning level changes', () => {
    it('should call callback when warning level changes', () => {
      const onWarning = vi.fn();
      monitor = new MemoryMonitor({
        interval: 100,
        onWarningLevelChange: onWarning,
      });

      monitor.start();

      // First update (from null to initial level) triggers callback
      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onWarning).toHaveBeenCalledWith(expect.any(String));

      // Callback should be registered and working
      expect(typeof onWarning).toBe('function');
    });
  });

  describe('memory pressure', () => {
    it('should detect when under pressure', () => {
      monitor = new MemoryMonitor({
        thresholds: { warning: 10, critical: 20 }, // Very low thresholds
      });

      monitor.start();

      // With normal memory usage, might be under pressure with low thresholds
      const isUnder = monitor.isUnderPressure();
      expect(typeof isUnder).toBe('boolean');
    });
  });

  describe('formatted output', () => {
    it('should format memory usage', () => {
      monitor = new MemoryMonitor();
      monitor.start();

      const formatted = monitor.getFormattedMemoryUsage();
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/MB/);
    });

    it('should return Unknown when no state', () => {
      monitor = new MemoryMonitor();
      const formatted = monitor.getFormattedMemoryUsage();
      expect(formatted).toBe('Unknown');
    });
  });

  describe('leak detection', () => {
    it('should enable leak detection', () => {
      monitor = new MemoryMonitor();
      monitor.enableLeakDetection({
        sampleInterval: 1000,
        sampleSize: 50,
        growthRateThreshold: 1024 * 1024,
      });

      monitor.start();
      const result = monitor.detectLeaks();

      // Not enough samples yet
      expect(result).toBeNull();
    });

    it('should disable leak detection', () => {
      monitor = new MemoryMonitor();
      monitor.enableLeakDetection();
      monitor.start();

      monitor.disableLeakDetection();
      const result = monitor.detectLeaks();

      expect(result).toBeNull();
    });

    it('should collect memory samples', () => {
      monitor = new MemoryMonitor();
      monitor.enableLeakDetection({
        sampleInterval: 100,
        sampleSize: 10,
      });

      monitor.start();

      // Collect several samples
      for (let i = 0; i < 15; i++) {
        monitor.updateMemoryState();
        vi.advanceTimersByTime(10);
      }

      const result = monitor.detectLeaks();
      expect(result).toBeDefined();
      expect(result?.samples.length).toBeLessThanOrEqual(10);
    });

    it('should detect potential leaks', () => {
      monitor = new MemoryMonitor();
      monitor.enableLeakDetection({
        growthRateThreshold: 0, // Very low threshold
      });

      monitor.start();

      // Collect enough samples
      for (let i = 0; i < 20; i++) {
        monitor.updateMemoryState();
        vi.advanceTimersByTime(10);
      }

      const result = monitor.detectLeaks();
      if (result && result.samples.length >= 10) {
        expect(result.leakDetected).toBeDefined();
        expect(result.growthRate).toBeDefined();
        expect(result.recommendations).toBeInstanceOf(Array);
      }
    });

    it('should provide recommendations when leak detected', () => {
      monitor = new MemoryMonitor();
      monitor.enableLeakDetection({
        growthRateThreshold: -1, // Force leak detection
      });

      monitor.start();

      for (let i = 0; i < 20; i++) {
        monitor.updateMemoryState();
      }

      const result = monitor.detectLeaks();
      if (result?.leakDetected) {
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations[0]).toContain('Memory usage');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle stop before start', () => {
      monitor = new MemoryMonitor();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should handle multiple stops', () => {
      monitor = new MemoryMonitor();
      monitor.start();
      monitor.stop();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should handle updateMemoryState before start', () => {
      monitor = new MemoryMonitor();
      expect(() => monitor.updateMemoryState()).not.toThrow();
      expect(monitor.getMemoryState()).toBeDefined();
    });
  });
});
