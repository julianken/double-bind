/**
 * Memory management types for mobile platform.
 *
 * Provides types for memory monitoring, cache configuration,
 * and memory pressure handling to ensure optimal performance
 * on resource-constrained mobile devices.
 */

/**
 * Memory warning levels based on system pressure.
 */
export enum MemoryWarning {
  /** Normal memory usage - no action needed */
  NORMAL = 'normal',
  /** Memory usage above 60% - consider clearing non-critical caches */
  WARNING = 'warning',
  /** Memory usage above 80% - aggressive cache eviction required */
  CRITICAL = 'critical',
}

/**
 * Current memory state of the application.
 */
export interface MemoryState {
  /** Memory currently used by the app in bytes */
  used: number;

  /** Total memory available to the app in bytes */
  available: number;

  /** Current memory pressure level */
  pressureLevel: MemoryWarning;

  /** Percentage of memory used (0-100) */
  usagePercentage: number;

  /** When this state was measured (Unix timestamp) */
  timestamp: number;
}

/**
 * Cache eviction policies.
 */
export type CacheEvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * Configuration for cache behavior.
 */
export interface CacheConfig {
  /** Maximum number of entries in the cache */
  maxSize: number;

  /** Maximum age of cache entries in milliseconds */
  maxAge: number;

  /** Policy for evicting cache entries when limit is reached */
  evictionPolicy: CacheEvictionPolicy;

  /** Whether to automatically evict entries when memory pressure is high */
  autoEvict: boolean;

  /** Optional: Custom eviction function for complex scenarios */
  customEvictionFn?: <K, V>(entries: Map<K, CacheEntry<V>>) => K[];
}

/**
 * Cache entry with metadata for eviction policies.
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T;

  /** When this entry was created (Unix timestamp) */
  createdAt: number;

  /** When this entry was last accessed (Unix timestamp) */
  lastAccessedAt: number;

  /** Number of times this entry has been accessed */
  accessCount: number;

  /** Approximate size of this entry in bytes (optional) */
  size?: number;

  /** Custom metadata for application-specific eviction logic */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics about cache usage.
 */
export interface CacheStats {
  /** Total number of entries in cache */
  size: number;

  /** Maximum cache size */
  maxSize: number;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate as percentage (0-100) */
  hitRate: number;

  /** Number of evictions performed */
  evictions: number;

  /** Approximate total size of cached data in bytes */
  totalSize: number;
}

/**
 * Memory threshold configuration for triggering actions.
 */
export interface MemoryThreshold {
  /** Warning level threshold as percentage (e.g., 60) */
  warning: number;

  /** Critical level threshold as percentage (e.g., 80) */
  critical: number;
}

/**
 * Options for memory monitoring.
 */
export interface MemoryMonitorOptions {
  /** How often to check memory usage in milliseconds */
  interval: number;

  /** Memory thresholds for warning levels */
  thresholds: MemoryThreshold;

  /** Whether to enable automatic cache eviction on pressure */
  autoEvictOnPressure: boolean;

  /** Callback when memory warning level changes */
  onWarningLevelChange?: (level: MemoryWarning) => void;

  /** Callback when memory state is updated */
  onMemoryStateChange?: (state: MemoryState) => void;
}

/**
 * Result of a cache eviction operation.
 */
export interface EvictionResult {
  /** Number of entries evicted */
  evictedCount: number;

  /** Approximate bytes freed */
  bytesFreed: number;

  /** Keys of evicted entries */
  evictedKeys: string[];

  /** Whether eviction was successful */
  success: boolean;
}

/**
 * Memory leak detection configuration.
 */
export interface MemoryLeakDetectionConfig {
  /** Enable memory leak detection */
  enabled: boolean;

  /** Sample interval for memory snapshots in milliseconds */
  sampleInterval: number;

  /** Number of samples to keep for trend analysis */
  sampleSize: number;

  /** Threshold for memory growth rate (bytes/second) to trigger warning */
  growthRateThreshold: number;
}

/**
 * Memory leak detection result.
 */
export interface MemoryLeakDetectionResult {
  /** Whether a potential leak was detected */
  leakDetected: boolean;

  /** Memory growth rate in bytes per second */
  growthRate: number;

  /** Memory samples collected */
  samples: MemoryState[];

  /** Recommendations for investigation */
  recommendations: string[];
}
