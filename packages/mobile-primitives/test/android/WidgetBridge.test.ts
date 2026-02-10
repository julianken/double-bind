/**
 * Tests for Android WidgetBridge
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import {
  useAndroidWidgetBridge,
  MockAndroidWidgetBridge,
  type AndroidWidgetBridge,
} from '../../src/android/WidgetBridge';
import { AndroidWidgetKind } from '../../src/android/WidgetTypes';
import type {
  AndroidWidgetUpdatePayload,
  AndroidWidgetTapAction,
} from '../../src/android/WidgetTypes';

describe('MockAndroidWidgetBridge', () => {
  let bridge: MockAndroidWidgetBridge;

  beforeEach(() => {
    bridge = new MockAndroidWidgetBridge();
  });

  describe('updateWidget', () => {
    it('should record widget updates', async () => {
      const payload: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      await bridge.updateWidget(payload);

      const history = bridge.getUpdateHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(payload);
    });

    it('should record multiple updates', async () => {
      const payload1: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-1',
        kind: AndroidWidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      const payload2: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-2',
        kind: AndroidWidgetKind.DailyNote,
        data: {
          pageId: 'page-daily',
          title: '2026-02-09',
          date: '2026-02-09',
          blockCount: 0,
          lastUpdated: Date.now(),
        },
        timestamp: Date.now(),
      };

      await bridge.updateWidget(payload1);
      await bridge.updateWidget(payload2);

      const history = bridge.getUpdateHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('onWidgetTap', () => {
    it('should register tap handler', () => {
      const handler = vi.fn();
      const unsubscribe = bridge.onWidgetTap(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call tap handler when widget is tapped', () => {
      const handler = vi.fn();
      bridge.onWidgetTap(handler);

      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        action: 'openNote',
        payload: { pageId: 'page-456' },
      };

      bridge.simulateTap(action);

      expect(handler).toHaveBeenCalledWith(action);
    });

    it('should unregister tap handler', () => {
      const handler = vi.fn();
      const unsubscribe = bridge.onWidgetTap(handler);

      unsubscribe();

      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('isSupported', () => {
    it('should return true by default', () => {
      expect(bridge.isSupported()).toBe(true);
    });
  });

  describe('registerWidget', () => {
    it('should register widget', async () => {
      await bridge.registerWidget('widget-123');

      const registered = bridge.getRegisteredWidgets();
      expect(registered.has('widget-123')).toBe(true);
    });

    it('should register multiple widgets', async () => {
      await bridge.registerWidget('widget-1');
      await bridge.registerWidget('widget-2');

      const registered = bridge.getRegisteredWidgets();
      expect(registered.size).toBe(2);
      expect(registered.has('widget-1')).toBe(true);
      expect(registered.has('widget-2')).toBe(true);
    });
  });

  describe('unregisterWidget', () => {
    it('should unregister widget', async () => {
      await bridge.registerWidget('widget-123');
      await bridge.unregisterWidget('widget-123');

      const registered = bridge.getRegisteredWidgets();
      expect(registered.has('widget-123')).toBe(false);
    });
  });

  describe('test utilities', () => {
    it('should clear update history', async () => {
      const payload: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      await bridge.updateWidget(payload);
      bridge.clearHistory();

      expect(bridge.getUpdateHistory()).toHaveLength(0);
    });

    it('should reset all state', async () => {
      const payload: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      await bridge.updateWidget(payload);
      await bridge.registerWidget('widget-123');
      const handler = vi.fn();
      bridge.onWidgetTap(handler);

      bridge.reset();

      expect(bridge.getUpdateHistory()).toHaveLength(0);
      expect(bridge.getRegisteredWidgets().size).toBe(0);

      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        action: 'openNote',
      };
      bridge.simulateTap(action);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('useAndroidWidgetBridge', () => {
  let bridge: MockAndroidWidgetBridge;

  beforeEach(() => {
    bridge = new MockAndroidWidgetBridge();
  });

  it('should return bridge methods', () => {
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge));

    expect(result.current.updateWidget).toBeDefined();
    expect(result.current.isSupported).toBe(true);
    expect(result.current.registerTapHandler).toBeDefined();
    expect(result.current.unregisterTapHandler).toBeDefined();
    expect(result.current.registerWidget).toBeDefined();
    expect(result.current.unregisterWidget).toBeDefined();
  });

  it('should update widget', async () => {
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge));

    const payload: AndroidWidgetUpdatePayload = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      data: { notes: [], lastUpdated: Date.now() },
      timestamp: Date.now(),
    };

    await act(async () => {
      await result.current.updateWidget(payload);
    });

    const history = bridge.getUpdateHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(payload);
  });

  it('should register widget', async () => {
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge));

    await act(async () => {
      await result.current.registerWidget('widget-123');
    });

    const registered = bridge.getRegisteredWidgets();
    expect(registered.has('widget-123')).toBe(true);
  });

  it('should unregister widget', async () => {
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge));

    await act(async () => {
      await result.current.registerWidget('widget-123');
      await result.current.unregisterWidget('widget-123');
    });

    const registered = bridge.getRegisteredWidgets();
    expect(registered.has('widget-123')).toBe(false);
  });

  it('should handle tap actions with auto-registered handler', () => {
    const onTap = vi.fn();
    renderHook(() => useAndroidWidgetBridge(bridge, { onTap }));

    const action: AndroidWidgetTapAction = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      action: 'openNote',
    };

    act(() => {
      bridge.simulateTap(action);
    });

    expect(onTap).toHaveBeenCalledWith(action);
  });

  it('should not auto-register handler when autoRegister is false', () => {
    const onTap = vi.fn();
    renderHook(() => useAndroidWidgetBridge(bridge, { onTap, autoRegister: false }));

    const action: AndroidWidgetTapAction = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      action: 'openNote',
    };

    act(() => {
      bridge.simulateTap(action);
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it('should manually register tap handler', () => {
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge, { autoRegister: false }));

    const handler = vi.fn();

    act(() => {
      result.current.registerTapHandler(handler);
    });

    const action: AndroidWidgetTapAction = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      action: 'openNote',
    };

    act(() => {
      bridge.simulateTap(action);
    });

    expect(handler).toHaveBeenCalledWith(action);
  });

  it('should unregister tap handler', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useAndroidWidgetBridge(bridge, { onTap: handler }));

    act(() => {
      result.current.unregisterTapHandler();
    });

    const action: AndroidWidgetTapAction = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      action: 'openNote',
    };

    act(() => {
      bridge.simulateTap(action);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should warn when updating widget on unsupported platform', async () => {
    const unsupportedBridge: AndroidWidgetBridge = {
      updateWidget: vi.fn(),
      onWidgetTap: vi.fn(() => () => {}),
      isSupported: () => false,
      registerWidget: vi.fn(),
      unregisterWidget: vi.fn(),
    };

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAndroidWidgetBridge(unsupportedBridge));

    const payload: AndroidWidgetUpdatePayload = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      data: { notes: [], lastUpdated: Date.now() },
      timestamp: Date.now(),
    };

    await act(async () => {
      await result.current.updateWidget(payload);
    });

    expect(consoleWarn).toHaveBeenCalledWith('Widget bridge not supported on this platform');
    expect(unsupportedBridge.updateWidget).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('should cleanup on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useAndroidWidgetBridge(bridge, { onTap: handler }));

    unmount();

    const action: AndroidWidgetTapAction = {
      widgetId: 'widget-123',
      kind: AndroidWidgetKind.RecentNotes,
      action: 'openNote',
    };

    act(() => {
      bridge.simulateTap(action);
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
