/**
 * Tests for useWidgetBridge hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useWidgetBridge, MockWidgetBridge } from '../../src/ios/useWidgetBridge';
import { WidgetKind } from '../../src/ios/WidgetTypes';
import type { WidgetUpdatePayload, WidgetTapAction } from '../../src/ios/WidgetTypes';

describe('MockWidgetBridge', () => {
  let bridge: MockWidgetBridge;

  beforeEach(() => {
    bridge = new MockWidgetBridge();
  });

  it('should update widget and track history', async () => {
    const payload: WidgetUpdatePayload = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      data: { notes: [], lastUpdated: Date.now() },
      timestamp: Date.now(),
    };

    await bridge.updateWidget(payload);

    const history = bridge.getUpdateHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(payload);
  });

  it('should register and call tap handler', () => {
    const handler = vi.fn();
    const action: WidgetTapAction = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      action: 'openNote',
      payload: { pageId: 'page-123' },
    };

    bridge.onWidgetTap(handler);
    bridge.simulateTap(action);

    expect(handler).toHaveBeenCalledWith(action);
  });

  it('should unregister tap handler', () => {
    const handler = vi.fn();
    const action: WidgetTapAction = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      action: 'openNote',
    };

    const unsubscribe = bridge.onWidgetTap(handler);
    unsubscribe();
    bridge.simulateTap(action);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear update history', async () => {
    const payload: WidgetUpdatePayload = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      data: { notes: [], lastUpdated: Date.now() },
      timestamp: Date.now(),
    };

    await bridge.updateWidget(payload);
    bridge.clearHistory();

    const history = bridge.getUpdateHistory();
    expect(history).toHaveLength(0);
  });

  it('should report as supported', () => {
    expect(bridge.isSupported()).toBe(true);
  });
});

describe('useWidgetBridge', () => {
  let bridge: MockWidgetBridge;

  beforeEach(() => {
    bridge = new MockWidgetBridge();
  });

  describe('basic functionality', () => {
    it('should initialize with bridge support status', () => {
      const { result } = renderHook(() => useWidgetBridge(bridge));

      expect(result.current.isSupported).toBe(true);
    });

    it('should update widget', async () => {
      const { result } = renderHook(() => useWidgetBridge(bridge));

      const payload: WidgetUpdatePayload = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
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

    it('should handle update errors', async () => {
      const errorBridge = new MockWidgetBridge();
      errorBridge.updateWidget = vi.fn().mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useWidgetBridge(errorBridge));

      const payload: WidgetUpdatePayload = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      await expect(result.current.updateWidget(payload)).rejects.toThrow('Update failed');
    });
  });

  describe('tap handler registration', () => {
    it('should auto-register tap handler on mount', () => {
      const onTap = vi.fn();
      const { unmount } = renderHook(() => useWidgetBridge(bridge, { onTap }));

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(onTap).toHaveBeenCalledWith(action);

      unmount();
    });

    it('should not auto-register when autoRegister is false', () => {
      const onTap = vi.fn();
      renderHook(() => useWidgetBridge(bridge, { onTap, autoRegister: false }));

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(onTap).not.toHaveBeenCalled();
    });

    it('should manually register tap handler', () => {
      const { result } = renderHook(() => useWidgetBridge(bridge, { autoRegister: false }));

      const handler = vi.fn();
      act(() => {
        result.current.registerTapHandler(handler);
      });

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(handler).toHaveBeenCalledWith(action);
    });

    it('should manually unregister tap handler', () => {
      const { result } = renderHook(() => useWidgetBridge(bridge, { autoRegister: false }));

      const handler = vi.fn();
      act(() => {
        result.current.registerTapHandler(handler);
        result.current.unregisterTapHandler();
      });

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should cleanup tap handler on unmount', () => {
      const onTap = vi.fn();
      const { unmount } = renderHook(() => useWidgetBridge(bridge, { onTap }));

      unmount();

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);

      expect(onTap).not.toHaveBeenCalled();
    });

    it('should handle tap handler updates', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = renderHook(({ onTap }) => useWidgetBridge(bridge, { onTap }), {
        initialProps: { onTap: handler1 },
      });

      const action: WidgetTapAction = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        action: 'openNote',
      };

      bridge.simulateTap(action);
      expect(handler1).toHaveBeenCalledWith(action);

      rerender({ onTap: handler2 });
      bridge.simulateTap(action);
      expect(handler2).toHaveBeenCalledWith(action);
    });
  });

  describe('unsupported bridge', () => {
    it('should warn when updating widget on unsupported platform', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unsupportedBridge = {
        ...bridge,
        isSupported: () => false,
      } as MockWidgetBridge;

      const { result } = renderHook(() => useWidgetBridge(unsupportedBridge));

      const payload: WidgetUpdatePayload = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        data: { notes: [], lastUpdated: Date.now() },
        timestamp: Date.now(),
      };

      await act(async () => {
        await result.current.updateWidget(payload);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Widget bridge not supported on this platform');

      consoleWarnSpy.mockRestore();
    });

    it('should report unsupported status', () => {
      const unsupportedBridge = {
        ...bridge,
        isSupported: () => false,
      } as MockWidgetBridge;

      const { result } = renderHook(() => useWidgetBridge(unsupportedBridge));

      expect(result.current.isSupported).toBe(false);
    });
  });
});
