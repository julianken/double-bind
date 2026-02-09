/**
 * Unit tests for memory utility functions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  formatBytes,
  calculateMemoryPercentage,
  isMemoryPressure,
  getMemoryPressureSeverity,
  suggestMemoryActions,
  calculateBytesToFree,
  estimateObjectSize,
  batchMemoryOperations,
  requestGarbageCollection,
  memoryAwareThrottle,
  memoryAwareDebounce,
} from '../../../src/memory/utils';
import { MemoryWarning, type MemoryState } from '@double-bind/types';

describe('Memory Utils', () => {
  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 3)).toBe('1.5 KB');
    });
  });

  describe('calculateMemoryPercentage', () => {
    it('should calculate percentage', () => {
      expect(calculateMemoryPercentage(50, 100)).toBe(50);
      expect(calculateMemoryPercentage(25, 100)).toBe(25);
      expect(calculateMemoryPercentage(75, 100)).toBe(75);
    });

    it('should handle zero available', () => {
      expect(calculateMemoryPercentage(50, 0)).toBe(0);
    });

    it('should calculate precise percentages', () => {
      expect(calculateMemoryPercentage(1, 3)).toBeCloseTo(33.33, 2);
    });
  });

  describe('isMemoryPressure', () => {
    it('should return false for normal state', () => {
      const state: MemoryState = {
        used: 50 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.NORMAL,
        usagePercentage: 25,
        timestamp: Date.now(),
      };

      expect(isMemoryPressure(state)).toBe(false);
    });

    it('should return true for warning state', () => {
      const state: MemoryState = {
        used: 120 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.WARNING,
        usagePercentage: 60,
        timestamp: Date.now(),
      };

      expect(isMemoryPressure(state)).toBe(true);
    });

    it('should return true for critical state', () => {
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };

      expect(isMemoryPressure(state)).toBe(true);
    });
  });

  describe('getMemoryPressureSeverity', () => {
    it('should return low severity for normal state', () => {
      const state: MemoryState = {
        used: 50 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.NORMAL,
        usagePercentage: 25,
        timestamp: Date.now(),
      };

      expect(getMemoryPressureSeverity(state)).toBe(25);
    });

    it('should return high severity for critical state', () => {
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };

      expect(getMemoryPressureSeverity(state)).toBe(100);
    });

    it('should scale warning state appropriately', () => {
      const state: MemoryState = {
        used: 140 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.WARNING,
        usagePercentage: 70,
        timestamp: Date.now(),
      };

      const severity = getMemoryPressureSeverity(state);
      expect(severity).toBeGreaterThan(60);
      expect(severity).toBeLessThanOrEqual(100);
    });
  });

  describe('suggestMemoryActions', () => {
    it('should suggest no action for normal state', () => {
      const state: MemoryState = {
        used: 50 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.NORMAL,
        usagePercentage: 25,
        timestamp: Date.now(),
      };

      const suggestions = suggestMemoryActions(state);
      expect(suggestions).toContain('No action needed - memory usage is normal');
    });

    it('should suggest actions for warning state', () => {
      const state: MemoryState = {
        used: 120 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.WARNING,
        usagePercentage: 60,
        timestamp: Date.now(),
      };

      const suggestions = suggestMemoryActions(state);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes('cache'))).toBe(true);
    });

    it('should suggest urgent actions for critical state', () => {
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };

      const suggestions = suggestMemoryActions(state);
      expect(suggestions.length).toBeGreaterThan(2);
      expect(suggestions.some((s) => s.includes('immediately'))).toBe(true);
    });
  });

  describe('calculateBytesToFree', () => {
    it('should calculate bytes to free', () => {
      const state: MemoryState = {
        used: 100 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.WARNING,
        usagePercentage: 50,
        timestamp: Date.now(),
      };

      const toFree = calculateBytesToFree(state, 40);
      expect(toFree).toBe(20 * 1024 * 1024);
    });

    it('should return 0 if target is higher than current', () => {
      const state: MemoryState = {
        used: 50 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.NORMAL,
        usagePercentage: 25,
        timestamp: Date.now(),
      };

      const toFree = calculateBytesToFree(state, 30);
      expect(toFree).toBe(0);
    });
  });

  describe('estimateObjectSize', () => {
    it('should estimate simple object size', () => {
      const obj = { name: 'test', value: 42 };
      const size = estimateObjectSize(obj);
      expect(size).toBeGreaterThan(0);
    });

    it('should estimate string size', () => {
      const str = 'hello world';
      const size = estimateObjectSize(str);
      expect(size).toBeGreaterThan(0);
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      const size = estimateObjectSize(arr);
      expect(size).toBeGreaterThan(0);
    });

    it('should handle nested objects', () => {
      const obj = { nested: { data: 'test', more: { deep: 'value' } } };
      const size = estimateObjectSize(obj);
      expect(size).toBeGreaterThan(0);
    });

    it('should handle circular references', () => {
      const obj: { name: string; self?: unknown } = { name: 'test' };
      obj.self = obj;

      const size = estimateObjectSize(obj);
      expect(size).toBe(1024); // Fallback value
    });
  });

  describe('batchMemoryOperations', () => {
    it('should batch operations', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const operation = vi.fn<[number], Promise<number>>(async (n: number) => n * 2);

      const results = await batchMemoryOperations(items, operation, 3, 10);

      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
      expect(operation).toHaveBeenCalledTimes(10);
    });

    it('should handle empty array', async () => {
      const results = await batchMemoryOperations([], async (n) => n, 5);
      expect(results).toEqual([]);
    });

    it('should handle single batch', async () => {
      const items = [1, 2, 3];
      const operation = async (n: number) => n * 2;

      const results = await batchMemoryOperations(items, operation, 10);
      expect(results).toEqual([2, 4, 6]);
    });

    it('should delay between batches', async () => {
      const start = Date.now();
      const items = [1, 2, 3, 4, 5, 6];
      const operation = async (n: number) => n;

      await batchMemoryOperations(items, operation, 2, 50);

      const duration = Date.now() - start;
      // Should have 2 delays (50ms each) between 3 batches
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('requestGarbageCollection', () => {
    it('should not throw when gc not available', () => {
      expect(() => requestGarbageCollection()).not.toThrow();
    });

    it('should call gc if available', () => {
      const mockGc = vi.fn();
      (global as { gc?: () => void }).gc = mockGc;

      requestGarbageCollection();

      expect(mockGc).toHaveBeenCalled();

      delete (global as { gc?: () => void }).gc;
    });
  });

  describe('memoryAwareThrottle', () => {
    it('should throttle function calls', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const getState = () => null;

      const throttled = memoryAwareThrottle(fn, 100, 200, getState);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should increase delay under pressure', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };
      const getState = () => state;

      const throttled = memoryAwareThrottle(fn, 100, 300, getState);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(1); // Still throttled

      vi.advanceTimersByTime(200);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2); // Now called

      vi.useRealTimers();
    });
  });

  describe('memoryAwareDebounce', () => {
    it('should debounce function calls', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const getState = () => null;

      const debounced = memoryAwareDebounce(fn, 100, 200, getState);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should increase delay under pressure', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };
      const getState = () => state;

      const debounced = memoryAwareDebounce(fn, 100, 300, getState);

      debounced();

      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should reset timer on new calls', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const getState = () => null;

      const debounced = memoryAwareDebounce(fn, 100, 200, getState);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
