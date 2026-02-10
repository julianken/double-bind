/**
 * ExitConfirmation Tests
 *
 * Tests Android exit confirmation including double-tap to exit pattern,
 * toast messages, and timeout handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock React Native modules
const backHandlerListeners: Array<() => boolean> = [];
let toastMessage: string | null = null;

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
    show: vi.fn((message: string) => {
      toastMessage = message;
    }),
  },
  Keyboard: {
    dismiss: vi.fn(),
    isVisible: vi.fn(() => false),
  },
}));

// Import after mock
import { useExitConfirmation } from '../../src/android/ExitConfirmation';
import { clearAllHandlers } from '../../src/android/BackHandler';

// Helper to trigger back button press
function triggerBackPress(): boolean {
  if (backHandlerListeners.length === 0) {
    return false;
  }
  return backHandlerListeners[0]();
}

describe('ExitConfirmation', () => {
  beforeEach(() => {
    backHandlerListeners.length = 0;
    toastMessage = null;
    clearAllHandlers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearAllHandlers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('useExitConfirmation', () => {
    it('should initialize with isPendingExit false', () => {
      const { result } = renderHook(() => useExitConfirmation());

      expect(result.current.isPendingExit).toBe(false);
    });

    it('should set isPendingExit true on first back press', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);
    });

    it('should show toast message on first back press', () => {
      renderHook(() => useExitConfirmation({ enabled: true, message: 'Press back again to exit' }));

      act(() => {
        triggerBackPress();
      });

      expect(toastMessage).toBe('Press back again to exit');
    });

    it('should consume first back press', () => {
      renderHook(() => useExitConfirmation({ enabled: true }));

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(true);
    });

    it('should pass through second back press', () => {
      renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      let result: boolean = false;
      act(() => {
        result = triggerBackPress();
      });

      expect(result).toBe(false);
    });

    it('should call onFirstPress callback on first press', () => {
      const onFirstPress = vi.fn();
      renderHook(() => useExitConfirmation({ enabled: true, onFirstPress }));

      act(() => {
        triggerBackPress();
      });

      expect(onFirstPress).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirmExit callback on second press', () => {
      const onConfirmExit = vi.fn();
      const { result } = renderHook(() => useExitConfirmation({ enabled: true, onConfirmExit }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        triggerBackPress();
      });

      expect(onConfirmExit).toHaveBeenCalledTimes(1);
    });

    it('should reset isPendingExit after timeout', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true, timeout: 2000 }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isPendingExit).toBe(false);
    });

    it('should reset isPendingExit after second press', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(false);
    });

    it('should use custom timeout', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true, timeout: 1000 }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        vi.advanceTimersByTime(999);
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.isPendingExit).toBe(false);
    });

    it('should use default message when not provided', () => {
      renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      expect(toastMessage).toBe('Press back again to exit');
    });
  });

  describe('manual control', () => {
    it('should allow manual trigger via triggerExitConfirmation', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: false }));

      expect(result.current.isPendingExit).toBe(false);

      act(() => {
        result.current.triggerExitConfirmation();
      });

      expect(result.current.isPendingExit).toBe(true);
    });

    it('should allow manual reset via resetExitConfirmation', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      expect(result.current.isPendingExit).toBe(true);

      act(() => {
        result.current.resetExitConfirmation();
      });

      expect(result.current.isPendingExit).toBe(false);
    });

    it('should clear timeout when resetExitConfirmation is called', () => {
      const { result } = renderHook(() => useExitConfirmation({ enabled: true, timeout: 2000 }));

      act(() => {
        triggerBackPress();
      });

      act(() => {
        result.current.resetExitConfirmation();
      });

      // Advance past timeout to ensure it doesn't trigger
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.isPendingExit).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup timeout on unmount', () => {
      const { unmount } = renderHook(() => useExitConfirmation({ enabled: true }));

      act(() => {
        triggerBackPress();
      });

      unmount();

      // Should not throw
      act(() => {
        vi.advanceTimersByTime(3000);
      });
    });
  });
});
