/**
 * Unit tests for memory management types.
 */

import type {
  MemoryState,
  CacheConfig,
  CacheEntry,
  CacheStats,
  MemoryThreshold,
  MemoryMonitorOptions,
  EvictionResult,
  MemoryLeakDetectionConfig,
  MemoryLeakDetectionResult,
  CacheEvictionPolicy,
} from '../../src/memory';
import { MemoryWarning } from '../../src/memory';

describe('Memory Types', () => {
  describe('MemoryWarning', () => {
    it('should have correct warning levels', () => {
      expect(MemoryWarning.NORMAL).toBe('normal');
      expect(MemoryWarning.WARNING).toBe('warning');
      expect(MemoryWarning.CRITICAL).toBe('critical');
    });
  });

  describe('MemoryState', () => {
    it('should create memory state with all fields', () => {
      const state: MemoryState = {
        used: 50 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.NORMAL,
        usagePercentage: 25,
        timestamp: Date.now(),
      };

      expect(state.used).toBe(50 * 1024 * 1024);
      expect(state.available).toBe(200 * 1024 * 1024);
      expect(state.pressureLevel).toBe(MemoryWarning.NORMAL);
      expect(state.usagePercentage).toBe(25);
      expect(state.timestamp).toBeGreaterThan(0);
    });

    it('should support warning level state', () => {
      const state: MemoryState = {
        used: 120 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.WARNING,
        usagePercentage: 60,
        timestamp: Date.now(),
      };

      expect(state.pressureLevel).toBe(MemoryWarning.WARNING);
      expect(state.usagePercentage).toBe(60);
    });

    it('should support critical level state', () => {
      const state: MemoryState = {
        used: 160 * 1024 * 1024,
        available: 200 * 1024 * 1024,
        pressureLevel: MemoryWarning.CRITICAL,
        usagePercentage: 80,
        timestamp: Date.now(),
      };

      expect(state.pressureLevel).toBe(MemoryWarning.CRITICAL);
      expect(state.usagePercentage).toBe(80);
    });
  });

  describe('CacheConfig', () => {
    it('should create cache config with all fields', () => {
      const config: CacheConfig = {
        maxSize: 100,
        maxAge: 5 * 60 * 1000,
        evictionPolicy: 'lru',
        autoEvict: true,
      };

      expect(config.maxSize).toBe(100);
      expect(config.maxAge).toBe(5 * 60 * 1000);
      expect(config.evictionPolicy).toBe('lru');
      expect(config.autoEvict).toBe(true);
    });

    it('should support different eviction policies', () => {
      const policies: CacheEvictionPolicy[] = ['lru', 'lfu', 'fifo', 'ttl'];

      policies.forEach((policy) => {
        const config: CacheConfig = {
          maxSize: 100,
          maxAge: 60000,
          evictionPolicy: policy,
          autoEvict: false,
        };

        expect(config.evictionPolicy).toBe(policy);
      });
    });

    it('should support custom eviction function', () => {
      const customFn = <K, V>(entries: Map<K, CacheEntry<V>>) => {
        return Array.from(entries.keys()).slice(0, 5);
      };

      const config: CacheConfig = {
        maxSize: 100,
        maxAge: 60000,
        evictionPolicy: 'lru',
        autoEvict: true,
        customEvictionFn: customFn,
      };

      expect(config.customEvictionFn).toBeDefined();
      expect(typeof config.customEvictionFn).toBe('function');
    });
  });

  describe('CacheEntry', () => {
    it('should create cache entry with required fields', () => {
      const entry: CacheEntry<string> = {
        value: 'test-value',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 5,
      };

      expect(entry.value).toBe('test-value');
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.lastAccessedAt).toBeGreaterThan(0);
      expect(entry.accessCount).toBe(5);
    });

    it('should support optional size field', () => {
      const entry: CacheEntry<object> = {
        value: { data: 'test' },
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        size: 1024,
      };

      expect(entry.size).toBe(1024);
    });

    it('should support optional metadata field', () => {
      const entry: CacheEntry<string> = {
        value: 'test',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        metadata: {
          priority: 'high',
          category: 'images',
        },
      };

      expect(entry.metadata).toBeDefined();
      expect(entry.metadata?.priority).toBe('high');
    });
  });

  describe('CacheStats', () => {
    it('should create cache stats with all fields', () => {
      const stats: CacheStats = {
        size: 50,
        maxSize: 100,
        hits: 150,
        misses: 50,
        hitRate: 75,
        evictions: 10,
        totalSize: 1024 * 1024,
      };

      expect(stats.size).toBe(50);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBe(150);
      expect(stats.misses).toBe(50);
      expect(stats.hitRate).toBe(75);
      expect(stats.evictions).toBe(10);
      expect(stats.totalSize).toBe(1024 * 1024);
    });

    it('should support zero values', () => {
      const stats: CacheStats = {
        size: 0,
        maxSize: 100,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
        totalSize: 0,
      };

      expect(stats.size).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('MemoryThreshold', () => {
    it('should create threshold with warning and critical levels', () => {
      const threshold: MemoryThreshold = {
        warning: 60,
        critical: 80,
      };

      expect(threshold.warning).toBe(60);
      expect(threshold.critical).toBe(80);
    });
  });

  describe('MemoryMonitorOptions', () => {
    it('should create options with required fields', () => {
      const options: MemoryMonitorOptions = {
        interval: 5000,
        thresholds: {
          warning: 60,
          critical: 80,
        },
        autoEvictOnPressure: true,
      };

      expect(options.interval).toBe(5000);
      expect(options.thresholds.warning).toBe(60);
      expect(options.autoEvictOnPressure).toBe(true);
    });

    it('should support optional callbacks', () => {
      const onWarning = vi.fn();
      const onStateChange = vi.fn();

      const options: MemoryMonitorOptions = {
        interval: 1000,
        thresholds: { warning: 60, critical: 80 },
        autoEvictOnPressure: false,
        onWarningLevelChange: onWarning,
        onMemoryStateChange: onStateChange,
      };

      expect(options.onWarningLevelChange).toBeDefined();
      expect(options.onMemoryStateChange).toBeDefined();
    });
  });

  describe('EvictionResult', () => {
    it('should create eviction result', () => {
      const result: EvictionResult = {
        evictedCount: 5,
        bytesFreed: 5120,
        evictedKeys: ['key1', 'key2', 'key3', 'key4', 'key5'],
        success: true,
      };

      expect(result.evictedCount).toBe(5);
      expect(result.bytesFreed).toBe(5120);
      expect(result.evictedKeys).toHaveLength(5);
      expect(result.success).toBe(true);
    });

    it('should support failed eviction', () => {
      const result: EvictionResult = {
        evictedCount: 0,
        bytesFreed: 0,
        evictedKeys: [],
        success: false,
      };

      expect(result.success).toBe(false);
      expect(result.evictedCount).toBe(0);
    });
  });

  describe('MemoryLeakDetectionConfig', () => {
    it('should create leak detection config', () => {
      const config: MemoryLeakDetectionConfig = {
        enabled: true,
        sampleInterval: 10000,
        sampleSize: 100,
        growthRateThreshold: 1024 * 1024,
      };

      expect(config.enabled).toBe(true);
      expect(config.sampleInterval).toBe(10000);
      expect(config.sampleSize).toBe(100);
      expect(config.growthRateThreshold).toBe(1024 * 1024);
    });

    it('should support disabled state', () => {
      const config: MemoryLeakDetectionConfig = {
        enabled: false,
        sampleInterval: 5000,
        sampleSize: 50,
        growthRateThreshold: 512 * 1024,
      };

      expect(config.enabled).toBe(false);
    });
  });

  describe('MemoryLeakDetectionResult', () => {
    it('should create leak detection result with no leak', () => {
      const result: MemoryLeakDetectionResult = {
        leakDetected: false,
        growthRate: 0,
        samples: [],
        recommendations: ['No memory leak detected'],
      };

      expect(result.leakDetected).toBe(false);
      expect(result.growthRate).toBe(0);
      expect(result.samples).toHaveLength(0);
    });

    it('should create leak detection result with leak', () => {
      const samples: MemoryState[] = [
        {
          used: 50 * 1024 * 1024,
          available: 200 * 1024 * 1024,
          pressureLevel: MemoryWarning.NORMAL,
          usagePercentage: 25,
          timestamp: Date.now(),
        },
      ];

      const result: MemoryLeakDetectionResult = {
        leakDetected: true,
        growthRate: 2 * 1024 * 1024,
        samples,
        recommendations: [
          'Memory usage is growing consistently over time',
          'Check for uncleared timers or intervals',
          'Review event listener registrations',
        ],
      };

      expect(result.leakDetected).toBe(true);
      expect(result.growthRate).toBeGreaterThan(0);
      expect(result.samples).toHaveLength(1);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});
