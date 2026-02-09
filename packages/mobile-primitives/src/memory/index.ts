/**
 * Memory management for mobile platforms.
 *
 * Provides memory monitoring, cache management, and utilities
 * for handling memory pressure on resource-constrained devices.
 */

export { MemoryMonitor } from './MemoryMonitor';
export { LRUCache } from './LRUCache';
export {
  useMemoryPressure,
  useMemoryPressureEviction,
  type UseMemoryPressureOptions,
  type UseMemoryPressureResult,
  type UseMemoryPressureEvictionOptions,
} from './useMemoryPressure';
export {
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
} from './utils';
