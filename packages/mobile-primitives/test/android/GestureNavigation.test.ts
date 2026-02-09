/**
 * GestureNavigation Tests
 *
 * Tests Android gesture navigation including edge swipe detection
 * and predictive back gesture support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock React Native modules
const backHandlerListeners: Array<() => boolean> = [];
let androidVersion = 33; // Android 13+

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
  get Platform() {
    return {
      OS: 'android',
      Version: androidVersion,
    };
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
import { useGestureNavigation } from '../../src/android/GestureNavigation';
import { clearAllHandlers } from '../../src/android/BackHandler';

// Helper to trigger back button press
function triggerBackPress(): boolean {
  if (backHandlerListeners.length === 0) {
    return false;
  }
  return backHandlerListeners[0]();
}

describe('GestureNavigation', () => {
  beforeEach(() => {
    backHandlerListeners.length = 0;
    androidVersion = 33; // Android 13+
    clearAllHandlers();
  });

  afterEach(() => {
    clearAllHandlers();
  });

  describe('useGestureNavigation', () => {
    it('should initialize with default gesture progress', () => {
      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.gestureProgress.progress).toBe(0);
      expect(result.current.gestureProgress.isActive).toBe(false);
      expect(result.current.gestureProgress.startX).toBe(0);
      expect(result.current.gestureProgress.currentX).toBe(0);
    });

    it('should detect predictive back support on Android 13+', () => {
      androidVersion = 33;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(true);
    });

    it('should not detect predictive back support on Android 12 and below', () => {
      androidVersion = 31;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(false);
    });

    it('should trigger back on button press for non-predictive devices', () => {
      androidVersion = 31;
      const onGestureComplete = vi.fn();

      renderHook(() => useGestureNavigation({ enabled: true, onGestureComplete }));

      act(() => {
        triggerBackPress();
      });

      expect(onGestureComplete).toHaveBeenCalledTimes(1);
    });

    it('should provide triggerBack function', () => {
      const onGestureComplete = vi.fn();
      const { result } = renderHook(() => useGestureNavigation({ onGestureComplete }));

      expect(typeof result.current.triggerBack).toBe('function');

      act(() => {
        result.current.triggerBack();
      });

      expect(onGestureComplete).toHaveBeenCalledTimes(1);
    });

    it('should not register handler when disabled', () => {
      renderHook(() => useGestureNavigation({ enabled: false }));

      expect(backHandlerListeners.length).toBe(0);
    });
  });

  describe('gesture callbacks', () => {
    it('should call onGestureComplete when triggerBack is called', () => {
      const onGestureComplete = vi.fn();
      const { result } = renderHook(() => useGestureNavigation({ onGestureComplete }));

      act(() => {
        result.current.triggerBack();
      });

      expect(onGestureComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('predictive back gestures', () => {
    // Note: Full predictive back gesture testing would require a native module
    // These tests verify the hook structure is correct

    it('should support custom edge sensitivity', () => {
      const { result } = renderHook(() => useGestureNavigation({ edgeSensitivity: 30 }));

      expect(result.current.gestureProgress.progress).toBe(0);
    });

    it('should support custom threshold', () => {
      const { result } = renderHook(() => useGestureNavigation({ threshold: 0.5 }));

      expect(result.current.gestureProgress.progress).toBe(0);
    });

    it('should accept all callback options', () => {
      const callbacks = {
        onGestureStart: vi.fn(),
        onGestureProgress: vi.fn(),
        onGestureComplete: vi.fn(),
        onGestureCancel: vi.fn(),
      };

      const { result } = renderHook(() => useGestureNavigation(callbacks));

      expect(result.current.gestureProgress.progress).toBe(0);
    });
  });

  describe('Android version handling', () => {
    it('should handle Android 10', () => {
      androidVersion = 29;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(false);
    });

    it('should handle Android 11', () => {
      androidVersion = 30;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(false);
    });

    it('should handle Android 12', () => {
      androidVersion = 31;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(false);
    });

    it('should handle Android 13', () => {
      androidVersion = 33;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(true);
    });

    it('should handle Android 14', () => {
      androidVersion = 34;

      const { result } = renderHook(() => useGestureNavigation());

      expect(result.current.isPredictiveBackSupported).toBe(true);
    });
  });
});
