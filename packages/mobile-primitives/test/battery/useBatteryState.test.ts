/**
 * Tests for useBatteryState hook and battery monitoring utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import { MockBatteryMonitor } from '../../src/battery/useBatteryState.js';

describe('MockBatteryMonitor', () => {
  it('should provide initial state', async () => {
    const monitor = new MockBatteryMonitor();
    const state = await monitor.getState();

    expect(state).toMatchObject({
      charging: true,
      level: 0.8,
      lowPowerMode: false,
    });
    expect(state.timestamp).toBeDefined();
  });

  it('should notify callback when monitoring starts', () => {
    const monitor = new MockBatteryMonitor();
    const callback = vi.fn();

    monitor.startMonitoring(callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        charging: true,
        level: 0.8,
        lowPowerMode: false,
      })
    );
  });

  it('should notify callback when state changes', () => {
    const monitor = new MockBatteryMonitor();
    const callback = vi.fn();

    monitor.startMonitoring(callback);
    callback.mockClear();

    monitor.setMockState({ level: 0.5 });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 0.5,
      })
    );
  });

  it('should stop notifying after stopMonitoring', () => {
    const monitor = new MockBatteryMonitor();
    const callback = vi.fn();

    monitor.startMonitoring(callback);
    monitor.stopMonitoring();
    callback.mockClear();

    monitor.setMockState({ level: 0.3 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should update timestamp when state changes', async () => {
    const monitor = new MockBatteryMonitor();

    const state1 = await monitor.getState();
    const timestamp1 = state1.timestamp;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    monitor.setMockState({ level: 0.5 });
    const state2 = await monitor.getState();

    expect(state2.timestamp).toBeGreaterThan(timestamp1);
  });

  it('should merge partial state updates', async () => {
    const monitor = new MockBatteryMonitor();

    monitor.setMockState({ level: 0.3 });
    let state = await monitor.getState();
    expect(state.level).toBe(0.3);
    expect(state.charging).toBe(true); // Should preserve other fields

    monitor.setMockState({ charging: false });
    state = await monitor.getState();
    expect(state.level).toBe(0.3); // Should preserve previous update
    expect(state.charging).toBe(false);
  });

  it('should allow setting all state properties', async () => {
    const monitor = new MockBatteryMonitor();

    monitor.setMockState({
      level: 0.25,
      charging: false,
      lowPowerMode: true,
    });

    const state = await monitor.getState();
    expect(state).toMatchObject({
      level: 0.25,
      charging: false,
      lowPowerMode: true,
    });
  });
});
