/**
 * useBatteryState - React Native hook for monitoring battery state.
 *
 * Provides real-time battery level, charging status, and low power mode
 * detection for React Native applications.
 *
 * This is a platform-agnostic interface that should be implemented with
 * platform-specific battery APIs (expo-battery, react-native-device-info, etc.)
 */

import { useEffect, useState } from 'react';
import type { BatteryState } from '@double-bind/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Platform-specific battery monitor interface.
 *
 * Implementations should use appropriate native APIs:
 * - iOS: UIDevice.current.batteryLevel, UIDevice.current.batteryState
 * - Android: BatteryManager, PowerManager
 * - Expo: expo-battery
 */
export interface BatteryMonitor {
  /** Get current battery state */
  getState(): Promise<BatteryState>;

  /** Start monitoring battery changes */
  startMonitoring(callback: (state: BatteryState) => void): void;

  /** Stop monitoring battery changes */
  stopMonitoring(): void;
}

/**
 * Mock battery monitor for testing and development.
 */
export class MockBatteryMonitor implements BatteryMonitor {
  private callback?: (state: BatteryState) => void;
  private mockState: BatteryState = {
    charging: true,
    level: 0.8,
    lowPowerMode: false,
    timestamp: Date.now(),
  };

  async getState(): Promise<BatteryState> {
    return { ...this.mockState };
  }

  startMonitoring(callback: (state: BatteryState) => void): void {
    this.callback = callback;
    // Immediately notify with current state
    callback(this.mockState);
  }

  stopMonitoring(): void {
    this.callback = undefined;
  }

  /** Test helper: Update mock battery state */
  setMockState(state: Partial<BatteryState>): void {
    this.mockState = {
      ...this.mockState,
      ...state,
      timestamp: Date.now(),
    };
    if (this.callback) {
      this.callback(this.mockState);
    }
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for monitoring battery state in React Native.
 *
 * @param monitor - Platform-specific battery monitor implementation
 * @returns Current battery state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const battery = useBatteryState(batteryMonitor);
 *
 *   if (battery.lowPowerMode) {
 *     return <Text>Low Power Mode - sync paused</Text>;
 *   }
 *
 *   return <Text>Battery: {Math.round(battery.level * 100)}%</Text>;
 * }
 * ```
 */
export function useBatteryState(monitor: BatteryMonitor): BatteryState | null {
  const [state, setState] = useState<BatteryState | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get initial state
    monitor.getState().then((initialState) => {
      if (mounted) {
        setState(initialState);
      }
    });

    // Subscribe to changes
    const handleStateChange = (newState: BatteryState) => {
      if (mounted) {
        setState(newState);
      }
    };

    monitor.startMonitoring(handleStateChange);

    return () => {
      mounted = false;
      monitor.stopMonitoring();
    };
  }, [monitor]);

  return state;
}

/**
 * Hook for checking if device is in low power mode.
 *
 * @param monitor - Platform-specific battery monitor implementation
 * @returns True if device is in low power mode
 */
export function useLowPowerMode(monitor: BatteryMonitor): boolean {
  const state = useBatteryState(monitor);
  return state?.lowPowerMode ?? false;
}

/**
 * Hook for checking if device is charging.
 *
 * @param monitor - Platform-specific battery monitor implementation
 * @returns True if device is currently charging
 */
export function useIsCharging(monitor: BatteryMonitor): boolean {
  const state = useBatteryState(monitor);
  return state?.charging ?? false;
}

/**
 * Hook for getting battery level as a percentage (0-100).
 *
 * @param monitor - Platform-specific battery monitor implementation
 * @returns Battery level percentage (0-100) or null if not available
 */
export function useBatteryLevel(monitor: BatteryMonitor): number | null {
  const state = useBatteryState(monitor);
  return state ? Math.round(state.level * 100) : null;
}

/**
 * Hook for checking if battery level is critically low.
 *
 * @param monitor - Platform-specific battery monitor implementation
 * @param threshold - Battery level threshold (0.0-1.0), defaults to 0.2 (20%)
 * @returns True if battery is below threshold and not charging
 */
export function useIsBatteryLow(monitor: BatteryMonitor, threshold = 0.2): boolean {
  const state = useBatteryState(monitor);
  if (!state) return false;

  return state.level < threshold && !state.charging;
}
