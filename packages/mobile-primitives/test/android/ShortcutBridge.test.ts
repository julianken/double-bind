/**
 * Tests for ShortcutBridge hook and implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import {
  useShortcutBridge,
  MockShortcutBridge,
  type ShortcutLaunchEvent,
} from '../../src/android/ShortcutBridge';
import { ShortcutAction, type Shortcut } from '../../src/android/ShortcutTypes';

describe('MockShortcutBridge', () => {
  let bridge: MockShortcutBridge;

  beforeEach(() => {
    bridge = new MockShortcutBridge();
  });

  describe('setStaticShortcuts', () => {
    it('should set static shortcuts and track history', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setStaticShortcuts(shortcuts);

      const staticShortcuts = bridge.getStaticShortcuts();
      expect(staticShortcuts).toHaveLength(1);
      expect(staticShortcuts[0].id).toBe('shortcut_1');

      const history = bridge.getUpdateHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('setStatic');
    });
  });

  describe('setDynamicShortcuts', () => {
    it('should set dynamic shortcuts and track history', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setDynamicShortcuts(shortcuts);

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(1);
      expect(dynamicShortcuts[0].id).toBe('dynamic_1');

      const history = bridge.getUpdateHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('setDynamic');
    });

    it('should replace existing dynamic shortcuts', async () => {
      const shortcuts1: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      const shortcuts2: Shortcut[] = [
        {
          id: 'dynamic_2',
          shortLabel: 'D2',
          longLabel: 'Dynamic 2',
          icon: 'ic_2',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setDynamicShortcuts(shortcuts1);
      await bridge.setDynamicShortcuts(shortcuts2);

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(1);
      expect(dynamicShortcuts[0].id).toBe('dynamic_2');
    });
  });

  describe('addDynamicShortcuts', () => {
    it('should add to existing dynamic shortcuts', async () => {
      const shortcuts1: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      const shortcuts2: Shortcut[] = [
        {
          id: 'dynamic_2',
          shortLabel: 'D2',
          longLabel: 'Dynamic 2',
          icon: 'ic_2',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setDynamicShortcuts(shortcuts1);
      await bridge.addDynamicShortcuts(shortcuts2);

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(2);
    });
  });

  describe('removeDynamicShortcuts', () => {
    it('should remove shortcuts by IDs', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
        {
          id: 'dynamic_2',
          shortLabel: 'D2',
          longLabel: 'Dynamic 2',
          icon: 'ic_2',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setDynamicShortcuts(shortcuts);
      await bridge.removeDynamicShortcuts(['dynamic_1']);

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(1);
      expect(dynamicShortcuts[0].id).toBe('dynamic_2');
    });
  });

  describe('removeAllDynamicShortcuts', () => {
    it('should remove all dynamic shortcuts', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
        {
          id: 'dynamic_2',
          shortLabel: 'D2',
          longLabel: 'Dynamic 2',
          icon: 'ic_2',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setDynamicShortcuts(shortcuts);
      await bridge.removeAllDynamicShortcuts();

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(0);
    });
  });

  describe('updateShortcuts', () => {
    it('should update existing shortcuts', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setStaticShortcuts(shortcuts);

      const updated: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'Updated',
          longLabel: 'Updated Shortcut',
          icon: 'ic_updated',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: false,
        },
      ];

      await bridge.updateShortcuts(updated);

      const staticShortcuts = bridge.getStaticShortcuts();
      expect(staticShortcuts[0].shortLabel).toBe('Updated');
      expect(staticShortcuts[0].enabled).toBe(false);
    });
  });

  describe('disableShortcuts', () => {
    it('should disable shortcuts by IDs', async () => {
      await bridge.disableShortcuts(['shortcut_1', 'shortcut_2']);

      const disabled = bridge.getDisabledShortcutIds();
      expect(disabled).toContain('shortcut_1');
      expect(disabled).toContain('shortcut_2');
    });
  });

  describe('enableShortcuts', () => {
    it('should enable previously disabled shortcuts', async () => {
      await bridge.disableShortcuts(['shortcut_1']);
      await bridge.enableShortcuts(['shortcut_1']);

      const disabled = bridge.getDisabledShortcutIds();
      expect(disabled).not.toContain('shortcut_1');
    });
  });

  describe('onShortcutLaunch', () => {
    it('should register launch handler', () => {
      const handler = vi.fn();
      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.onShortcutLaunch(handler);
      bridge.simulateLaunch(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should unregister launch handler', () => {
      const handler = vi.fn();
      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      const unsubscribe = bridge.onShortcutLaunch(handler);
      unsubscribe();
      bridge.simulateLaunch(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('isSupported', () => {
    it('should return true', () => {
      expect(bridge.isSupported()).toBe(true);
    });
  });

  describe('getMaxShortcutCount', () => {
    it('should return max shortcut count', () => {
      expect(bridge.getMaxShortcutCount()).toBe(4);
    });
  });

  describe('test utilities', () => {
    it('should get all shortcuts', async () => {
      const staticShortcuts: Shortcut[] = [
        {
          id: 'static_1',
          shortLabel: 'S1',
          longLabel: 'Static 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      const dynamicShortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setStaticShortcuts(staticShortcuts);
      await bridge.setDynamicShortcuts(dynamicShortcuts);

      const allShortcuts = bridge.getAllShortcuts();
      expect(allShortcuts).toHaveLength(2);
    });

    it('should clear history', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setStaticShortcuts(shortcuts);
      expect(bridge.getUpdateHistory()).toHaveLength(1);

      bridge.clearHistory();
      expect(bridge.getUpdateHistory()).toHaveLength(0);
    });

    it('should reset all state', async () => {
      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await bridge.setStaticShortcuts(shortcuts);
      await bridge.disableShortcuts(['shortcut_1']);

      bridge.reset();

      expect(bridge.getStaticShortcuts()).toHaveLength(0);
      expect(bridge.getDynamicShortcuts()).toHaveLength(0);
      expect(bridge.getDisabledShortcutIds()).toHaveLength(0);
      expect(bridge.getUpdateHistory()).toHaveLength(0);
    });
  });
});

describe('useShortcutBridge', () => {
  let bridge: MockShortcutBridge;

  beforeEach(() => {
    bridge = new MockShortcutBridge();
  });

  describe('basic functionality', () => {
    it('should initialize with bridge properties', () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      expect(result.current.isSupported).toBe(true);
      expect(result.current.maxShortcutCount).toBe(4);
    });

    it('should set static shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.setStaticShortcuts(shortcuts);
      });

      const staticShortcuts = bridge.getStaticShortcuts();
      expect(staticShortcuts).toHaveLength(1);
    });

    it('should set dynamic shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.setDynamicShortcuts(shortcuts);
      });

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(1);
    });

    it('should handle errors', async () => {
      const errorBridge = new MockShortcutBridge();
      errorBridge.setDynamicShortcuts = vi.fn().mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useShortcutBridge(errorBridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await expect(result.current.setDynamicShortcuts(shortcuts)).rejects.toThrow('Failed');
    });
  });

  describe('launch handler registration', () => {
    it('should auto-register launch handler on mount', () => {
      const onLaunch = vi.fn();
      const { unmount } = renderHook(() => useShortcutBridge(bridge, { onLaunch }));

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);

      expect(onLaunch).toHaveBeenCalledWith(event);

      unmount();
    });

    it('should not auto-register when autoRegister is false', () => {
      const onLaunch = vi.fn();
      renderHook(() => useShortcutBridge(bridge, { onLaunch, autoRegister: false }));

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);

      expect(onLaunch).not.toHaveBeenCalled();
    });

    it('should manually register launch handler', () => {
      const { result } = renderHook(() => useShortcutBridge(bridge, { autoRegister: false }));

      const handler = vi.fn();
      act(() => {
        result.current.registerLaunchHandler(handler);
      });

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should manually unregister launch handler', () => {
      const { result } = renderHook(() => useShortcutBridge(bridge, { autoRegister: false }));

      const handler = vi.fn();
      act(() => {
        result.current.registerLaunchHandler(handler);
        result.current.unregisterLaunchHandler();
      });

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should cleanup launch handler on unmount', () => {
      const onLaunch = vi.fn();
      const { unmount } = renderHook(() => useShortcutBridge(bridge, { onLaunch }));

      unmount();

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);

      expect(onLaunch).not.toHaveBeenCalled();
    });

    it('should handle launch handler updates', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = renderHook(({ onLaunch }) => useShortcutBridge(bridge, { onLaunch }), {
        initialProps: { onLaunch: handler1 },
      });

      const event: ShortcutLaunchEvent = {
        shortcutId: 'shortcut_1',
        action: ShortcutAction.NewNote,
        timestamp: Date.now(),
      };

      bridge.simulateLaunch(event);
      expect(handler1).toHaveBeenCalledWith(event);

      rerender({ onLaunch: handler2 });
      bridge.simulateLaunch(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });
  });

  describe('unsupported bridge', () => {
    it('should warn when updating shortcuts on unsupported platform', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unsupportedBridge = new MockShortcutBridge();
      unsupportedBridge.isSupported = () => false;

      const { result } = renderHook(() => useShortcutBridge(unsupportedBridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.setStaticShortcuts(shortcuts);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Shortcuts not supported on this platform');

      consoleWarnSpy.mockRestore();
    });

    it('should report unsupported status', () => {
      const unsupportedBridge = new MockShortcutBridge();
      unsupportedBridge.isSupported = () => false;

      const { result } = renderHook(() => useShortcutBridge(unsupportedBridge));

      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('all shortcut operations', () => {
    it('should add dynamic shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.addDynamicShortcuts(shortcuts);
      });

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(1);
    });

    it('should remove dynamic shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.setDynamicShortcuts(shortcuts);
        await result.current.removeDynamicShortcuts(['dynamic_1']);
      });

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(0);
    });

    it('should remove all dynamic shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'dynamic_1',
          shortLabel: 'D1',
          longLabel: 'Dynamic 1',
          icon: 'ic_1',
          action: ShortcutAction.OpenPage,
          rank: 0,
          enabled: true,
        },
      ];

      await act(async () => {
        await result.current.setDynamicShortcuts(shortcuts);
        await result.current.removeAllDynamicShortcuts();
      });

      const dynamicShortcuts = bridge.getDynamicShortcuts();
      expect(dynamicShortcuts).toHaveLength(0);
    });

    it('should update shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      const shortcuts: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
      ];

      const updated: Shortcut[] = [
        {
          id: 'shortcut_1',
          shortLabel: 'Updated',
          longLabel: 'Updated Shortcut',
          icon: 'ic_updated',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: false,
        },
      ];

      await act(async () => {
        await result.current.setStaticShortcuts(shortcuts);
        await result.current.updateShortcuts(updated);
      });

      const staticShortcuts = bridge.getStaticShortcuts();
      expect(staticShortcuts[0].shortLabel).toBe('Updated');
    });

    it('should disable shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      await act(async () => {
        await result.current.disableShortcuts(['shortcut_1']);
      });

      const disabled = bridge.getDisabledShortcutIds();
      expect(disabled).toContain('shortcut_1');
    });

    it('should enable shortcuts', async () => {
      const { result } = renderHook(() => useShortcutBridge(bridge));

      await act(async () => {
        await result.current.disableShortcuts(['shortcut_1']);
        await result.current.enableShortcuts(['shortcut_1']);
      });

      const disabled = bridge.getDisabledShortcutIds();
      expect(disabled).not.toContain('shortcut_1');
    });
  });
});
