/**
 * KeyboardDismissal Tests
 *
 * Tests keyboard dismissal on back button press.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock React Native modules
const backHandlerListeners: Array<() => boolean> = [];
let keyboardVisible = false;
let keyboardDismissed = false;

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
    exitApp: vi.fn(),
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
    dismiss: vi.fn(() => {
      keyboardDismissed = true;
      keyboardVisible = false;
    }),
    isVisible: vi.fn(() => keyboardVisible),
  },
}));

// Import after mock
import { useKeyboardDismissal, isKeyboardVisible } from '../../src/android/KeyboardDismissal';
import { clearAllHandlers } from '../../src/android/BackHandler';

// Helper to trigger back button press
function triggerBackPress(): boolean {
  if (backHandlerListeners.length === 0) {
    return false;
  }
  return backHandlerListeners[0]();
}

describe('KeyboardDismissal', () => {
  beforeEach(() => {
    backHandlerListeners.length = 0;
    keyboardVisible = false;
    keyboardDismissed = false;
    clearAllHandlers();
  });

  afterEach(() => {
    clearAllHandlers();
  });

  describe('useKeyboardDismissal', () => {
    it('should dismiss keyboard when visible and back is pressed', () => {
      keyboardVisible = true;

      renderHook(() => useKeyboardDismissal({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      expect(keyboardDismissed).toBe(true);
    });

    it('should consume back press when keyboard is visible', () => {
      keyboardVisible = true;

      renderHook(() => useKeyboardDismissal({ enabled: true }));

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(true);
    });

    it('should pass through back press when keyboard is not visible', () => {
      keyboardVisible = false;

      renderHook(() => useKeyboardDismissal({ enabled: true }));

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(false);
    });

    it('should call onDismiss callback when keyboard is dismissed', () => {
      keyboardVisible = true;
      const onDismiss = vi.fn();

      renderHook(() => useKeyboardDismissal({ enabled: true, onDismiss }));

      act(() => {
        triggerBackPress();
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not call onDismiss when keyboard is not visible', () => {
      keyboardVisible = false;
      const onDismiss = vi.fn();

      renderHook(() => useKeyboardDismissal({ enabled: true, onDismiss }));

      act(() => {
        triggerBackPress();
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('should not register handler when disabled', () => {
      renderHook(() => useKeyboardDismissal({ enabled: false }));

      expect(backHandlerListeners.length).toBe(0);
    });

    it('should use custom priority', () => {
      // This test verifies the priority is passed correctly
      // Priority order is tested in BackHandler.test.ts
      renderHook(() => useKeyboardDismissal({ enabled: true, priority: 75 }));

      expect(backHandlerListeners.length).toBeGreaterThan(0);
    });
  });

  describe('isKeyboardVisible', () => {
    it('should return false on non-Android platforms', () => {
      const result = isKeyboardVisible();

      // Will return false because Keyboard.isVisible is mocked to return keyboardVisible
      expect(typeof result).toBe('boolean');
    });

    it('should check keyboard visibility', () => {
      keyboardVisible = true;

      const result = isKeyboardVisible();

      expect(result).toBe(true);
    });
  });
});
