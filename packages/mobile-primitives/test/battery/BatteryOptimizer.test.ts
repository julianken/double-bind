/**
 * Tests for BatteryOptimizer service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BatteryOptimizer } from '../../src/battery/BatteryOptimizer.js';
import type { BatteryStateProvider } from '../../src/battery/BatteryOptimizer.js';
import type { BatteryState, ScheduleConfig } from '@double-bind/types';
import { ActivityPriority } from '@double-bind/types';

describe('BatteryOptimizer', () => {
  let provider: MockBatteryStateProvider;
  let optimizer: BatteryOptimizer;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = new MockBatteryStateProvider();
    optimizer = new BatteryOptimizer(provider);
  });

  afterEach(() => {
    optimizer.stop();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should start monitoring battery state', async () => {
      await optimizer.start();

      const stats = optimizer.getStats();
      expect(stats.currentBatteryLevel).toBe(0.8);
      expect(stats.lowPowerMode).toBe(false);
    });

    it('should subscribe to battery state changes', async () => {
      await optimizer.start();

      provider.updateState({ level: 0.5, lowPowerMode: true });

      const stats = optimizer.getStats();
      expect(stats.currentBatteryLevel).toBe(0.5);
      expect(stats.lowPowerMode).toBe(true);
    });

    it('should cleanup on stop', async () => {
      await optimizer.start();
      optimizer.stop();

      expect(provider.subscriberCount).toBe(0);
    });
  });

  describe('Activity Scheduling', () => {
    it('should schedule activity when conditions are met', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should defer activity when battery is low', async () => {
      provider.setState({ level: 0.1, charging: false });
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {
          minBatteryLevel: 0.2,
        },
        interval: 1000,
        enabled: true,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe('low_battery');
    });

    it('should defer activity in low power mode', async () => {
      provider.setState({ lowPowerMode: true });
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {
          allowInLowPowerMode: false,
        },
        interval: 1000,
        enabled: true,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe('low_power_mode');
    });

    it('should defer activity when not charging if required', async () => {
      provider.setState({ charging: false });
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.IDLE,
        constraints: {
          requiresCharging: true,
        },
        interval: 1000,
        enabled: true,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe('not_charging');
    });

    it('should always schedule critical activities', async () => {
      provider.setState({ level: 0.05, lowPowerMode: true, charging: false });
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'critical-activity',
        name: 'Critical Activity',
        priority: ActivityPriority.CRITICAL,
        constraints: {
          minBatteryLevel: 0.5,
          allowInLowPowerMode: false,
        },
        interval: 1000,
        enabled: true,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(true);
    });

    it('should not schedule disabled activities', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: false,
      };

      const result = optimizer.scheduleActivity(config, handler);

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe('disabled');
    });
  });

  describe('Activity Execution', () => {
    it('should execute activity at scheduled interval', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);

      // Fast-forward past interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should update stats when activity executes', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);
      await vi.advanceTimersByTimeAsync(1000);

      const stats = optimizer.getStats();
      expect(stats.activitiesExecuted).toBe(1);
    });

    it('should update stats when activity is deferred', async () => {
      provider.setState({ level: 0.1 });
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {
          minBatteryLevel: 0.2,
        },
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);

      const stats = optimizer.getStats();
      expect(stats.activitiesDeferred).toBeGreaterThan(0);
    });

    it('should not execute activity if already running', async () => {
      await optimizer.start();

      let resolveHandler: (() => void) | undefined;
      const handler = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveHandler = resolve;
          })
      );

      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 100,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);

      // Trigger first execution
      await vi.advanceTimersByTimeAsync(100);
      expect(handler).toHaveBeenCalledTimes(1);

      // Try to trigger second execution while first is still running
      await vi.advanceTimersByTimeAsync(100);
      expect(handler).toHaveBeenCalledTimes(1); // Still only called once

      // Resolve first execution
      resolveHandler!();
      await vi.advanceTimersByTimeAsync(0);

      // Now second execution should proceed
      await vi.advanceTimersByTimeAsync(100);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle activity errors gracefully', async () => {
      await optimizer.start();

      const handler = vi.fn().mockRejectedValue(new Error('Test error'));
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);
      await vi.advanceTimersByTimeAsync(1000);

      // Should still reschedule despite error
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Activity Management', () => {
    it('should unschedule activity', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);
      optimizer.unscheduleActivity('test-activity');

      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should update activity configuration', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);

      // Update interval
      optimizer.updateActivity('test-activity', { interval: 2000 });

      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should disable activity', async () => {
      await optimizer.start();

      const handler = vi.fn();
      const config: ScheduleConfig = {
        id: 'test-activity',
        name: 'Test Activity',
        priority: ActivityPriority.NORMAL,
        constraints: {},
        interval: 1000,
        enabled: true,
      };

      optimizer.scheduleActivity(config, handler);

      // Disable activity
      optimizer.updateActivity('test-activity', { enabled: false });

      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should get list of all activities', async () => {
      await optimizer.start();

      optimizer.scheduleActivity(
        {
          id: 'activity-1',
          name: 'Activity 1',
          priority: ActivityPriority.NORMAL,
          constraints: {},
          interval: 1000,
          enabled: true,
        },
        vi.fn()
      );

      optimizer.scheduleActivity(
        {
          id: 'activity-2',
          name: 'Activity 2',
          priority: ActivityPriority.HIGH,
          constraints: {},
          interval: 2000,
          enabled: true,
        },
        vi.fn()
      );

      const activities = optimizer.getActivities();
      expect(activities).toHaveLength(2);
      expect(activities.map((a) => a.id)).toEqual(['activity-1', 'activity-2']);
    });
  });

  describe('Battery State Reactivity', () => {
    it('should reschedule activities when battery level improves', async () => {
      provider.setState({ level: 0.1 });
      await optimizer.start();

      const handler = vi.fn();
      optimizer.scheduleActivity(
        {
          id: 'test-activity',
          name: 'Test Activity',
          priority: ActivityPriority.NORMAL,
          constraints: {
            minBatteryLevel: 0.2,
          },
          interval: 1000,
          enabled: true,
        },
        handler
      );

      // Activity should be deferred
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();

      // Improve battery level
      provider.updateState({ level: 0.5 });

      // Activity should now run
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalled();
    });

    it('should defer activities when entering low power mode', async () => {
      await optimizer.start();

      const handler = vi.fn();
      optimizer.scheduleActivity(
        {
          id: 'test-activity',
          name: 'Test Activity',
          priority: ActivityPriority.NORMAL,
          constraints: {
            allowInLowPowerMode: false,
          },
          interval: 1000,
          enabled: true,
        },
        handler
      );

      // Enter low power mode before execution
      provider.updateState({ lowPowerMode: true });

      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should reschedule IDLE activities when charging starts', async () => {
      provider.setState({ charging: false });
      await optimizer.start();

      const handler = vi.fn();
      optimizer.scheduleActivity(
        {
          id: 'idle-activity',
          name: 'Idle Activity',
          priority: ActivityPriority.IDLE,
          constraints: {},
          interval: 1000,
          enabled: true,
        },
        handler
      );

      // Activity should be deferred (not charging)
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).not.toHaveBeenCalled();

      // Start charging
      provider.updateState({ charging: true });

      // Activity should now run
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track battery optimization stats', async () => {
      provider.setState({ level: 0.3 });
      await optimizer.start();

      const initialStats = optimizer.getStats();
      expect(initialStats.activitiesDeferred).toBe(0);
      expect(initialStats.activitiesExecuted).toBe(0);

      // Schedule activity that will be deferred
      optimizer.scheduleActivity(
        {
          id: 'deferred-activity',
          name: 'Deferred Activity',
          priority: ActivityPriority.NORMAL,
          constraints: {
            minBatteryLevel: 0.5,
          },
          interval: 1000,
          enabled: true,
        },
        vi.fn()
      );

      // Schedule activity that will execute
      const executedHandler = vi.fn();
      optimizer.scheduleActivity(
        {
          id: 'executed-activity',
          name: 'Executed Activity',
          priority: ActivityPriority.CRITICAL,
          constraints: {},
          interval: 1000,
          enabled: true,
        },
        executedHandler
      );

      await vi.advanceTimersByTimeAsync(1000);

      const stats = optimizer.getStats();
      expect(stats.activitiesDeferred).toBeGreaterThan(0);
      expect(stats.activitiesExecuted).toBe(1);
    });

    it('should reset statistics', async () => {
      await optimizer.start();

      optimizer.scheduleActivity(
        {
          id: 'test-activity',
          name: 'Test Activity',
          priority: ActivityPriority.NORMAL,
          constraints: {},
          interval: 1000,
          enabled: true,
        },
        vi.fn()
      );

      await vi.advanceTimersByTimeAsync(1000);

      let stats = optimizer.getStats();
      expect(stats.activitiesExecuted).toBeGreaterThan(0);

      optimizer.resetStats();

      stats = optimizer.getStats();
      expect(stats.activitiesExecuted).toBe(0);
      expect(stats.activitiesDeferred).toBe(0);
      expect(stats.timeSaved).toBe(0);
    });
  });
});

// ============================================================================
// Mock Battery State Provider
// ============================================================================

class MockBatteryStateProvider implements BatteryStateProvider {
  private state: BatteryState = {
    charging: true,
    level: 0.8,
    lowPowerMode: false,
    timestamp: Date.now(),
  };

  private callbacks: Array<(state: BatteryState) => void> = [];

  subscriberCount = 0;

  async getState(): Promise<BatteryState> {
    return { ...this.state };
  }

  subscribe(callback: (state: BatteryState) => void): () => void {
    this.callbacks.push(callback);
    this.subscriberCount++;

    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
        this.subscriberCount--;
      }
    };
  }

  setState(newState: Partial<BatteryState>): void {
    this.state = {
      ...this.state,
      ...newState,
      timestamp: Date.now(),
    };
  }

  updateState(newState: Partial<BatteryState>): void {
    this.setState(newState);
    this.callbacks.forEach((cb) => cb(this.state));
  }
}
