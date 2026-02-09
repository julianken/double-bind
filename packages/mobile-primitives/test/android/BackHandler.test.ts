/**
 * BackHandler Tests
 *
 * Tests Android back button handling including priority-based handler registration,
 * handler cleanup, and event consumption.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock React Native BackHandler module BEFORE importing the hook
const backHandlerListeners: Array<() => boolean> = [];
let exitAppCalled = false;

vi.mock('react-native', () => ({
  BackHandler: {
    addEventListener: vi.fn((eventType: string, handler: () => boolean) => {
      if (eventType === 'hardwareBackPress') {
        backHandlerListeners.push(handler);
      }
      return {
        remove: vi.fn(() => {
          const index = backHandlerListeners.indexOf(handler);
          if (index > -1) {
            backHandlerListeners.splice(index, 1);
          }
        }),
      };
    }),
    removeEventListener: vi.fn((eventType: string, handler: () => boolean) => {
      const index = backHandlerListeners.indexOf(handler);
      if (index > -1) {
        backHandlerListeners.splice(index, 1);
      }
    }),
    exitApp: vi.fn(() => {
      exitAppCalled = true;
    }),
  },
  Platform: {
    OS: 'android',
    Version: 33,
  },
  ToastAndroid: {
    SHORT: 0,
    show: vi.fn(),
  },
  Keyboard: {
    dismiss: vi.fn(),
    isVisible: vi.fn(() => false),
  },
}));

// Import after mock
import {
  useBackHandler,
  exitApp,
  getHandlerCount,
  clearAllHandlers,
} from '../../src/android/BackHandler';
import { BackHandlerPriority } from '../../src/android/types';

// Helper to trigger back button press
function triggerBackPress(): boolean {
  if (backHandlerListeners.length === 0) {
    return false;
  }
  // The global handler should be the only listener
  return backHandlerListeners[0]();
}

describe('BackHandler', () => {
  beforeEach(() => {
    backHandlerListeners.length = 0;
    exitAppCalled = false;
    clearAllHandlers();
  });

  afterEach(() => {
    clearAllHandlers();
  });

  describe('useBackHandler', () => {
    it('should register handler when enabled', () => {
      const handler = vi.fn(() => true);
      renderHook(() => useBackHandler({ enabled: true, handler }));

      expect(getHandlerCount()).toBe(1);
    });

    it('should not register handler when disabled', () => {
      const handler = vi.fn(() => true);
      renderHook(() => useBackHandler({ enabled: false, handler }));

      expect(getHandlerCount()).toBe(0);
    });

    it('should call handler when back button is pressed', () => {
      const handler = vi.fn(() => true);
      renderHook(() => useBackHandler({ enabled: true, handler }));

      act(() => {
        triggerBackPress();
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should consume event when handler returns true', () => {
      const handler = vi.fn(() => true);
      renderHook(() => useBackHandler({ enabled: true, handler }));

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(true);
    });

    it('should pass through event when handler returns false', () => {
      const handler = vi.fn(() => false);
      renderHook(() => useBackHandler({ enabled: true, handler }));

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(false);
    });

    it('should cleanup handler on unmount', () => {
      const handler = vi.fn(() => true);
      const { unmount } = renderHook(() => useBackHandler({ enabled: true, handler }));

      expect(getHandlerCount()).toBe(1);

      unmount();

      expect(getHandlerCount()).toBe(0);
    });

    it('should update handler when enabled changes', () => {
      const handler = vi.fn(() => true);
      const { rerender } = renderHook(({ enabled }) => useBackHandler({ enabled, handler }), {
        initialProps: { enabled: true },
      });

      expect(getHandlerCount()).toBe(1);

      rerender({ enabled: false });

      expect(getHandlerCount()).toBe(0);

      rerender({ enabled: true });

      expect(getHandlerCount()).toBe(1);
    });
  });

  describe('priority handling', () => {
    it('should execute handlers in priority order', () => {
      const calls: string[] = [];

      const highPriorityHandler = vi.fn(() => {
        calls.push('high');
        return false; // Pass through
      });

      const lowPriorityHandler = vi.fn(() => {
        calls.push('low');
        return false; // Pass through
      });

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Modal,
          handler: highPriorityHandler,
        })
      );

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Root,
          handler: lowPriorityHandler,
        })
      );

      act(() => {
        triggerBackPress();
      });

      expect(calls).toEqual(['high', 'low']);
    });

    it('should stop at first handler that consumes event', () => {
      const calls: string[] = [];

      const highPriorityHandler = vi.fn(() => {
        calls.push('high');
        return true; // Consume
      });

      const lowPriorityHandler = vi.fn(() => {
        calls.push('low');
        return false;
      });

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Modal,
          handler: highPriorityHandler,
        })
      );

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Root,
          handler: lowPriorityHandler,
        })
      );

      act(() => {
        triggerBackPress();
      });

      expect(calls).toEqual(['high']);
      expect(lowPriorityHandler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers at same priority', () => {
      const handler1 = vi.fn(() => false);
      const handler2 = vi.fn(() => false);

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Page,
          handler: handler1,
        })
      );

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Page,
          handler: handler2,
        })
      );

      act(() => {
        triggerBackPress();
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should continue to next handler if one throws error', () => {
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      const normalHandler = vi.fn(() => true);

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Modal,
          handler: throwingHandler,
        })
      );

      renderHook(() =>
        useBackHandler({
          enabled: true,
          priority: BackHandlerPriority.Page,
          handler: normalHandler,
        })
      );

      act(() => {
        triggerBackPress();
      });

      // Verify the error was caught and didn't prevent the next handler from running
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('exitApp', () => {
    it('should call BackHandler.exitApp on Android', () => {
      exitApp();

      expect(exitAppCalled).toBe(true);
    });
  });

  describe('clearAllHandlers', () => {
    it('should remove all registered handlers', () => {
      const handler1 = vi.fn(() => true);
      const handler2 = vi.fn(() => true);

      renderHook(() => useBackHandler({ enabled: true, handler: handler1 }));
      renderHook(() => useBackHandler({ enabled: true, handler: handler2 }));

      expect(getHandlerCount()).toBe(2);

      clearAllHandlers();

      expect(getHandlerCount()).toBe(0);
    });
  });
});
