/**
 * LRU (Least Recently Used) cache implementation with size limits.
 *
 * Provides automatic eviction based on access patterns and memory pressure.
 * Optimized for mobile environments with limited memory.
 */

import type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  EvictionResult,
} from '@double-bind/types';

/**
 * Default cache configuration.
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 100,
  maxAge: 5 * 60 * 1000, // 5 minutes
  evictionPolicy: 'lru',
  autoEvict: true,
};

/**
 * LRU cache with support for multiple eviction policies.
 */
export class LRUCache<K = string, V = unknown> {
  private cache: Map<K, CacheEntry<V>>;
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.stats = {
      size: 0,
      maxSize: this.config.maxSize,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      totalSize: 0,
    };
  }

  /**
   * Get value from cache.
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return undefined;
    }

    // Update access metadata for LRU
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache.
   */
  set(key: K, value: V, metadata?: Record<string, unknown>): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict(1);
    }

    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      size: this.estimateSize(value),
      metadata,
    };

    const existingEntry = this.cache.get(key);
    if (existingEntry && existingEntry.size) {
      this.stats.totalSize -= existingEntry.size;
    }

    this.cache.set(key, entry);

    if (!existingEntry) {
      this.stats.size++;
    }

    if (entry.size) {
      this.stats.totalSize += entry.size;
    }
  }

  /**
   * Check if key exists in cache.
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache.
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry && entry.size) {
      this.stats.totalSize -= entry.size;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size--;
    }
    return deleted;
  }

  /**
   * Clear all entries from cache.
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.totalSize = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys in cache.
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict entries based on configured policy.
   */
  evict(count: number = 1): EvictionResult {
    const keysToEvict = this.selectKeysForEviction(count);
    let bytesFreed = 0;

    keysToEvict.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry && entry.size) {
        bytesFreed += entry.size;
      }
      this.cache.delete(key);
    });

    this.stats.evictions += keysToEvict.length;
    this.stats.size -= keysToEvict.length;
    this.stats.totalSize -= bytesFreed;

    return {
      evictedCount: keysToEvict.length,
      bytesFreed,
      evictedKeys: keysToEvict.map(String),
      success: keysToEvict.length > 0,
    };
  }

  /**
   * Evict expired entries.
   */
  evictExpired(): EvictionResult {
    const keysToEvict: K[] = [];
    let bytesFreed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToEvict.push(key);
        if (entry.size) {
          bytesFreed += entry.size;
        }
      }
    }

    keysToEvict.forEach((key) => {
      this.cache.delete(key);
    });

    this.stats.size -= keysToEvict.length;
    this.stats.totalSize -= bytesFreed;

    return {
      evictedCount: keysToEvict.length,
      bytesFreed,
      evictedKeys: keysToEvict.map(String),
      success: keysToEvict.length > 0,
    };
  }

  /**
   * Select keys for eviction based on policy.
   */
  private selectKeysForEviction(count: number): K[] {
    if (this.config.customEvictionFn) {
      return this.config.customEvictionFn(this.cache);
    }

    const entries = Array.from(this.cache.entries());

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
        break;

      case 'lfu':
        // Sort by access count (least frequent first)
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;

      case 'fifo':
        // Sort by creation time (oldest first)
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
        break;

      case 'ttl':
        // Sort by time remaining (least time first)
        entries.sort((a, b) => {
          const timeLeftA = this.config.maxAge - (Date.now() - a[1].createdAt);
          const timeLeftB = this.config.maxAge - (Date.now() - b[1].createdAt);
          return timeLeftA - timeLeftB;
        });
        break;

      default:
        // Default to LRU
        entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
    }

    return entries.slice(0, count).map(([key]) => key);
  }

  /**
   * Check if entry is expired.
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    const age = Date.now() - entry.createdAt;
    return age > this.config.maxAge;
  }

  /**
   * Estimate size of a value in bytes.
   */
  private estimateSize(value: V): number {
    try {
      // Rough estimation based on JSON serialization
      const str = JSON.stringify(value);
      // UTF-16 encoding (2 bytes per character)
      return str.length * 2;
    } catch {
      // If value can't be stringified, use a rough estimate
      return 1024; // 1KB default
    }
  }

  /**
   * Update hit rate statistic.
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache configuration.
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration.
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.stats.maxSize = this.config.maxSize;

    // If maxSize was reduced, evict excess entries
    if (this.cache.size > this.config.maxSize) {
      const toEvict = this.cache.size - this.config.maxSize;
      this.evict(toEvict);
    }
  }
}
