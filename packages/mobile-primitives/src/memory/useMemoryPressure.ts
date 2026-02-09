/**
 * React hook for monitoring memory pressure in React Native.
 *
 * Provides real-time memory state and warning levels to components
 * so they can respond appropriately to memory constraints.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MemoryState } from '@double-bind/types';
import { MemoryWarning } from '@double-bind/types';
import { MemoryMonitor } from './MemoryMonitor';

/**
 * Options for memory pressure hook.
 */
export interface UseMemoryPressureOptions {
  /** Whether to automatically start monitoring */
  autoStart?: boolean;

  /** Custom monitoring interval in milliseconds */
  interval?: number;

  /** Callback when memory warning level changes */
  onWarningChange?: (level: MemoryWarning) => void;

  /** Callback when memory pressure is detected */
  onPressure?: (state: MemoryState) => void;
}

/**
 * Result of useMemoryPressure hook.
 */
export interface UseMemoryPressureResult {
  /** Current memory state */
  memoryState: MemoryState | null;

  /** Current warning level */
  warningLevel: MemoryWarning | null;

  /** Whether currently under memory pressure */
  isUnderPressure: boolean;

  /** Manually trigger memory state update */
  updateMemoryState: () => void;

  /** Start monitoring */
  startMonitoring: () => void;

  /** Stop monitoring */
  stopMonitoring: () => void;

  /** Formatted memory usage string */
  formattedUsage: string;
}

/**
 * Hook for monitoring memory pressure in React Native components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { memoryState, isUnderPressure, warningLevel } = useMemoryPressure({
 *     autoStart: true,
 *     onPressure: (state) => {
 *       console.warn('Memory pressure detected:', state);
 *       // Clear caches, reduce quality, etc.
 *     }
 *   });
 *
 *   if (warningLevel === MemoryWarning.CRITICAL) {
 *     return <LowMemoryMode />;
 *   }
 *
 *   return <NormalContent />;
 * }
 * ```
 */
export function useMemoryPressure(
  options: UseMemoryPressureOptions = {}
): UseMemoryPressureResult {
  const { autoStart = true, interval = 5000, onWarningChange, onPressure } = options;

  const [memoryState, setMemoryState] = useState<MemoryState | null>(null);
  const [warningLevel, setWarningLevel] = useState<MemoryWarning | null>(null);
  const [isUnderPressure, setIsUnderPressure] = useState(false);

  const monitorRef = useRef<MemoryMonitor | null>(null);
  const callbacksRef = useRef({ onWarningChange, onPressure });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onWarningChange, onPressure };
  }, [onWarningChange, onPressure]);

  // Initialize monitor
  useEffect(() => {
    const monitor = new MemoryMonitor({
      interval,
      thresholds: {
        warning: 60,
        critical: 80,
      },
      autoEvictOnPressure: true,
      onMemoryStateChange: (state) => {
        setMemoryState(state);
        setWarningLevel(state.pressureLevel);
        setIsUnderPressure(monitor.isUnderPressure());

        // Call user callback if under pressure
        if (monitor.isUnderPressure() && callbacksRef.current.onPressure) {
          callbacksRef.current.onPressure(state);
        }
      },
      onWarningLevelChange: (level) => {
        setWarningLevel(level);

        if (callbacksRef.current.onWarningChange) {
          callbacksRef.current.onWarningChange(level);
        }
      },
    });

    monitorRef.current = monitor;

    if (autoStart) {
      monitor.start();
    }

    return () => {
      monitor.stop();
    };
  }, [interval, autoStart]);

  const updateMemoryState = useCallback(() => {
    monitorRef.current?.updateMemoryState();
  }, []);

  const startMonitoring = useCallback(() => {
    monitorRef.current?.start();
  }, []);

  const stopMonitoring = useCallback(() => {
    monitorRef.current?.stop();
  }, []);

  const formattedUsage = monitorRef.current?.getFormattedMemoryUsage() || 'Unknown';

  return {
    memoryState,
    warningLevel,
    isUnderPressure,
    updateMemoryState,
    startMonitoring,
    stopMonitoring,
    formattedUsage,
  };
}

/**
 * Hook for automatic cache eviction on memory pressure.
 *
 * Automatically clears provided caches when memory pressure is detected.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const imageCache = useRef(new LRUCache<string, Image>());
 *
 *   useMemoryPressureEviction([imageCache.current], {
 *     evictOnWarning: false, // Only evict on critical
 *     evictPercentage: 50, // Clear 50% of cache
 *   });
 *
 *   return <ImageGallery cache={imageCache.current} />;
 * }
 * ```
 */
export interface UseMemoryPressureEvictionOptions {
  /** Whether to evict on WARNING level (default: false, only CRITICAL) */
  evictOnWarning?: boolean;

  /** Percentage of cache to evict (0-100, default: 50) */
  evictPercentage?: number;
}

export function useMemoryPressureEviction(
  caches: Array<{ evict: (count: number) => void; size: () => number }>,
  options: UseMemoryPressureEvictionOptions = {}
): void {
  const { evictOnWarning = false, evictPercentage = 50 } = options;

  useMemoryPressure({
    autoStart: true,
    onWarningChange: (level) => {
      const shouldEvict =
        level === MemoryWarning.CRITICAL || (evictOnWarning && level === MemoryWarning.WARNING);

      if (shouldEvict) {
        caches.forEach((cache) => {
          const toEvict = Math.ceil((cache.size() * evictPercentage) / 100);
          if (toEvict > 0) {
            cache.evict(toEvict);
          }
        });
      }
    },
  });
}
