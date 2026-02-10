/**
 * Battery optimization types for mobile platforms.
 *
 * Provides types for battery state monitoring, activity scheduling,
 * and low-power mode detection to minimize background CPU usage
 * and optimize sync operations.
 */

// ============================================================================
// Battery State
// ============================================================================

/**
 * Current battery state of the device.
 */
export interface BatteryState {
  /** Whether device is currently charging */
  charging: boolean;

  /** Battery level (0.0 to 1.0) */
  level: number;

  /** Whether device is in low power mode (iOS) or battery saver mode (Android) */
  lowPowerMode: boolean;

  /** Timestamp when state was last updated */
  timestamp: number;
}

// ============================================================================
// Activity Priority
// ============================================================================

/**
 * Priority levels for scheduled activities.
 *
 * Higher priority activities run more frequently and are less
 * likely to be deferred during low power conditions.
 */
export enum ActivityPriority {
  /** Critical operations that must run immediately (e.g., saving user edits) */
  CRITICAL = 0,

  /** High priority operations (e.g., quick sync) */
  HIGH = 1,

  /** Normal priority operations (e.g., full sync) */
  NORMAL = 2,

  /** Low priority operations (e.g., prefetching) */
  LOW = 3,

  /** Idle operations that only run when device is charging (e.g., cleanup) */
  IDLE = 4,
}

// ============================================================================
// Schedule Configuration
// ============================================================================

/**
 * Constraints for scheduling an activity based on battery state.
 */
export interface ScheduleConstraints {
  /** Minimum battery level required (0.0 to 1.0) */
  minBatteryLevel?: number;

  /** Whether activity requires device to be charging */
  requiresCharging?: boolean;

  /** Whether activity can run in low power mode */
  allowInLowPowerMode?: boolean;

  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number;
}

/**
 * Configuration for scheduled activity.
 */
export interface ScheduleConfig {
  /** Unique identifier for this activity */
  id: string;

  /** Human-readable name */
  name: string;

  /** Activity priority level */
  priority: ActivityPriority;

  /** Scheduling constraints */
  constraints: ScheduleConstraints;

  /** Interval between executions in milliseconds */
  interval: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;

  /** Whether this activity is currently enabled */
  enabled: boolean;
}

// ============================================================================
// Activity Scheduling
// ============================================================================

/**
 * Result of attempting to schedule an activity.
 */
export interface ScheduleResult {
  /** Whether activity was scheduled successfully */
  scheduled: boolean;

  /** Reason for deferral if not scheduled */
  reason?: 'low_battery' | 'low_power_mode' | 'not_charging' | 'disabled';

  /** Estimated time until next scheduling attempt (milliseconds) */
  retryAfter?: number;
}

/**
 * Statistics for battery-optimized operations.
 */
export interface BatteryOptimizationStats {
  /** Number of activities deferred due to battery constraints */
  activitiesDeferred: number;

  /** Number of activities executed */
  activitiesExecuted: number;

  /** Total time saved by deferring operations (estimated, milliseconds) */
  timeSaved: number;

  /** Current battery level */
  currentBatteryLevel: number;

  /** Whether currently in low power mode */
  lowPowerMode: boolean;

  /** Timestamp of last stats update */
  lastUpdated: number;
}
