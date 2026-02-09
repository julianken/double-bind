/**
 * Utility functions for memory management.
 *
 * Provides helpers for memory calculations, formatting,
 * and low-memory handling strategies.
 */

import type { MemoryState } from '@double-bind/types';
import { MemoryWarning } from '@double-bind/types';

/**
 * Format bytes as human-readable string.
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Calculate memory usage percentage.
 */
export function calculateMemoryPercentage(used: number, available: number): number {
  if (available === 0) return 0;
  return (used / available) * 100;
}

/**
 * Determine if memory state indicates pressure.
 */
export function isMemoryPressure(state: MemoryState): boolean {
  return state.pressureLevel === MemoryWarning.WARNING || state.pressureLevel === MemoryWarning.CRITICAL;
}

/**
 * Get memory pressure severity score (0-100).
 */
export function getMemoryPressureSeverity(state: MemoryState): number {
  switch (state.pressureLevel) {
    case MemoryWarning.NORMAL:
      return Math.min(state.usagePercentage, 60);
    case MemoryWarning.WARNING:
      return 60 + (state.usagePercentage - 60) * 2; // Scale 60-80 to 60-100
    case MemoryWarning.CRITICAL:
      return 100;
    default:
      return 0;
  }
}

/**
 * Suggest actions based on memory pressure level.
 */
export function suggestMemoryActions(state: MemoryState): string[] {
  const suggestions: string[] = [];

  switch (state.pressureLevel) {
    case MemoryWarning.CRITICAL:
      suggestions.push('Clear all non-essential caches immediately');
      suggestions.push('Release unused resources');
      suggestions.push('Reduce image quality');
      suggestions.push('Limit background operations');
      suggestions.push('Consider showing low-memory warning to user');
      break;

    case MemoryWarning.WARNING:
      suggestions.push('Clear old cache entries');
      suggestions.push('Reduce number of loaded images');
      suggestions.push('Defer non-critical tasks');
      break;

    case MemoryWarning.NORMAL:
      suggestions.push('No action needed - memory usage is normal');
      break;
  }

  return suggestions;
}

/**
 * Calculate bytes to free to reach target percentage.
 */
export function calculateBytesToFree(
  current: MemoryState,
  targetPercentage: number
): number {
  const targetUsed = (current.available * targetPercentage) / 100;
  return Math.max(0, current.used - targetUsed);
}

/**
 * Estimate object size in bytes (rough approximation).
 */
export function estimateObjectSize(obj: unknown): number {
  try {
    const str = JSON.stringify(obj);
    // UTF-16 encoding (2 bytes per character)
    return str.length * 2;
  } catch {
    // If object can't be stringified, return rough estimate
    return 1024; // 1KB default
  }
}

/**
 * Batch memory-intensive operations to avoid spikes.
 */
export async function batchMemoryOperations<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);

    // Delay between batches to allow garbage collection
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Request garbage collection hint (if available).
 * Note: This is a hint only and may not trigger immediate GC.
 */
export function requestGarbageCollection(): void {
  if (typeof global !== 'undefined' && 'gc' in global) {
    try {
      (global as { gc?: () => void }).gc?.();
    } catch {
      // GC not available or failed
    }
  }
}

/**
 * Create a memory-aware throttle function.
 * Increases throttle delay when under memory pressure.
 */
export function memoryAwareThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  normalDelayMs: number,
  pressureDelayMs: number,
  getMemoryState: () => MemoryState | null
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const memoryState = getMemoryState();
    const delay = memoryState && isMemoryPressure(memoryState) ? pressureDelayMs : normalDelayMs;

    if (now - lastRun >= delay) {
      fn(...args);
      lastRun = now;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        fn(...args);
        lastRun = Date.now();
      }, delay - (now - lastRun));
    }
  };
}

/**
 * Create a memory-aware debounce function.
 * Increases debounce delay when under memory pressure.
 */
export function memoryAwareDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  normalDelayMs: number,
  pressureDelayMs: number,
  getMemoryState: () => MemoryState | null
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    const memoryState = getMemoryState();
    const delay = memoryState && isMemoryPressure(memoryState) ? pressureDelayMs : normalDelayMs;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
