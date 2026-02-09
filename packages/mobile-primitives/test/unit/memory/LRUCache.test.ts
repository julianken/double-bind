/**
 * Unit tests for LRUCache implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUCache } from '../../../src/memory/LRUCache';

describe('LRUCache', () => {
  let cache: LRUCache<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('initialization', () => {
    it('should create cache with default config', () => {
      cache = new LRUCache();
      expect(cache.size()).toBe(0);

      const stats = cache.getStats();
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should create cache with custom config', () => {
      cache = new LRUCache({
        maxSize: 50,
        maxAge: 30000,
        evictionPolicy: 'lfu',
      });

      const config = cache.getConfig();
      expect(config.maxSize).toBe(50);
      expect(config.maxAge).toBe(30000);
      expect(config.evictionPolicy).toBe('lfu');
    });
  });

  describe('get and set', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 10 });
    });

    it('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
      expect(cache.size()).toBe(1);
    });

    it('should handle multiple keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.size()).toBe(3);
    });

    it('should track access count', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should track misses', () => {
      cache.get('missing1');
      cache.get('missing2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });
  });

  describe('has and delete', () => {
    beforeEach(() => {
      cache = new LRUCache();
    });

    it('should check key existence', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should handle delete of nonexistent key', () => {
      const result = cache.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      cache = new LRUCache();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('eviction - LRU', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3, evictionPolicy: 'lru' });
    });

    it('should evict least recently used', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');

      // Access key1 to make it recently used
      vi.advanceTimersByTime(10);
      cache.get('key1');

      // Add new key, should evict key2 (least recently used)
      vi.advanceTimersByTime(10);
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should evict manually', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const result = cache.evict(2);
      expect(result.evictedCount).toBe(2);
      expect(cache.size()).toBe(1);
    });
  });

  describe('eviction - LFU', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3, evictionPolicy: 'lfu' });
    });

    it('should evict least frequently used', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 multiple times
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Access key3 once
      cache.get('key3');

      // key2 never accessed, should be evicted first
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('eviction - FIFO', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 3, evictionPolicy: 'fifo' });
    });

    it('should evict oldest entry', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');

      // Access all keys (shouldn't matter for FIFO)
      cache.get('key1');
      cache.get('key2');
      cache.get('key3');

      // Add new key, should evict key1 (oldest)
      vi.advanceTimersByTime(10);
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('expiration', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxAge: 1000 });
    });

    it('should expire old entries', () => {
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should evict expired entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(1001);

      const result = cache.evictExpired();
      expect(result.evictedCount).toBe(2);
      expect(cache.size()).toBe(0);
    });

    it('should not evict non-expired entries', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(500);
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(600);

      const result = cache.evictExpired();
      expect(result.evictedCount).toBe(1);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 10 });
    });

    it('should track cache size', () => {
      const stats1 = cache.getStats();
      expect(stats1.size).toBe(0);

      cache.set('key1', 'value1');
      const stats2 = cache.getStats();
      expect(stats2.size).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should track evictions', () => {
      cache = new LRUCache({ maxSize: 2 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3'); // Triggers eviction

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it('should estimate total size', () => {
      cache.set('key1', 'short');
      cache.set('key2', 'a longer value');

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('keys', () => {
    beforeEach(() => {
      cache = new LRUCache();
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array when empty', () => {
      const keys = cache.keys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('config updates', () => {
    beforeEach(() => {
      cache = new LRUCache({ maxSize: 10 });
    });

    it('should update config', () => {
      cache.updateConfig({ maxSize: 20 });

      const config = cache.getConfig();
      expect(config.maxSize).toBe(20);
    });

    it('should evict excess entries when reducing maxSize', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.updateConfig({ maxSize: 2 });

      expect(cache.size()).toBe(2);
    });
  });

  describe('custom eviction function', () => {
    it('should use custom eviction function', () => {
      const customFn = vi.fn((entries) => {
        // Evict entries with specific pattern
        return Array.from(entries.keys()).filter((key) => String(key).startsWith('temp'));
      });

      cache = new LRUCache({
        maxSize: 5,
        customEvictionFn: customFn,
      });

      cache.set('temp1', 'value1');
      cache.set('keep1', 'value2');
      cache.set('temp2', 'value3');
      cache.set('keep2', 'value4');

      cache.evict(2);

      expect(customFn).toHaveBeenCalled();
      expect(cache.has('temp1')).toBe(false);
      expect(cache.has('temp2')).toBe(false);
      expect(cache.has('keep1')).toBe(true);
      expect(cache.has('keep2')).toBe(true);
    });
  });

  describe('metadata', () => {
    beforeEach(() => {
      cache = new LRUCache();
    });

    it('should store metadata with entries', () => {
      cache.set('key1', 'value1', { priority: 'high', category: 'important' });

      expect(cache.get('key1')).toBe('value1');
      // Metadata is stored internally but not returned by get
    });
  });

  describe('edge cases', () => {
    it('should handle zero maxSize', () => {
      cache = new LRUCache({ maxSize: 0 });
      cache.set('key1', 'value1');
      // Should immediately evict
    });

    it('should handle very short maxAge', () => {
      cache = new LRUCache({ maxAge: 1 });
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(2);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should handle complex objects', () => {
      cache = new LRUCache<string, object>();

      const obj1 = { nested: { data: 'test', array: [1, 2, 3] } };
      const obj2 = { another: 'object' };

      cache.set('obj1', obj1);
      cache.set('obj2', obj2);

      expect(cache.get('obj1')).toEqual(obj1);
      expect(cache.get('obj2')).toEqual(obj2);
    });

    it('should handle null and undefined values', () => {
      cache = new LRUCache<string, unknown>();

      cache.set('null', null);
      cache.set('undefined', undefined);

      expect(cache.get('null')).toBe(null);
      expect(cache.get('undefined')).toBe(undefined);
    });
  });
});
