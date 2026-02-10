/**
 * Battery optimization module for mobile platforms.
 *
 * Provides services, hooks, and utilities for battery-aware scheduling
 * and operation batching to minimize background CPU usage and reduce
 * wake locks.
 */

export { BatteryOptimizer } from './BatteryOptimizer.js';
export type { ActivityHandler, BatteryStateProvider } from './BatteryOptimizer.js';

export {
  useBatteryState,
  useLowPowerMode,
  useIsCharging,
  useBatteryLevel,
  useIsBatteryLow,
  MockBatteryMonitor,
} from './useBatteryState.js';
export type { BatteryMonitor } from './useBatteryState.js';

export {
  debounce,
  debounceAsync,
  createBatcher,
  throttle,
  rateLimit,
} from './operations.js';
export type { BatchOptions } from './operations.js';
