/**
 * useKeyboard Hook Tests
 *
 * Tests iOS keyboard state management including visibility tracking,
 * height detection, and hardware keyboard detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock React Native Keyboard module BEFORE importing the hook
const keyboardListeners: Map<string, Array<(event: unknown) => void>> = new Map();

vi.mock('react-native', () => ({
  Keyboard: {
    dismiss: vi.fn(),
    addListener: vi.fn((eventType: string, handler: (event: unknown) => void) => {
      if (!keyboardListeners.has(eventType)) {
        keyboardListeners.set(eventType, []);
      }
      keyboardListeners.get(eventType)!.push(handler);

      return {
        remove: vi.fn(() => {
          const handlers = keyboardListeners.get(eventType) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }),
      };
    }),
  },
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
  },
}));

// Import after mock
import { useKeyboard } from '../../../src/ios/useKeyboard';

// Define type locally to avoid import issues
interface KeyboardEvent {
  duration: number;
  easing: string;
  endCoordinates: {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
  };
  startCoordinates?: {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
  };
}

// Helper to trigger keyboard events
function triggerKeyboardEvent(eventType: string, event: Partial<KeyboardEvent>) {
  const handlers = keyboardListeners.get(eventType) || [];
  const fullEvent: KeyboardEvent = {
    duration: event.duration ?? 0.25,
    easing: event.easing ?? 'keyboard',
    endCoordinates: event.endCoordinates ?? {
      screenX: 0,
      screenY: 500,
      width: 375,
      height: 300,
    },
    ...event,
  };

  handlers.forEach((handler) => handler(fullEvent));
}

describe('useKeyboard', () => {
  beforeEach(() => {
    keyboardListeners.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useKeyboard());

      expect(result.current.keyboardState.isVisible).toBe(false);
      expect(result.current.keyboardState.height).toBe(0);
      expect(result.current.hardwareKeyboard.isConnected).toBe(false);
      expect(result.current.isAnimating).toBe(false);
    });

    it('should provide dismiss function', () => {
      const { result } = renderHook(() => useKeyboard());

      expect(typeof result.current.dismiss).toBe('function');
    });
  });

  describe('keyboard show', () => {
    it('should update state when keyboard shows', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          duration: 0.25,
          easing: 'keyboard',
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.isVisible).toBe(true);
      expect(result.current.keyboardState.height).toBe(300);
      expect(result.current.keyboardState.duration).toBe(250); // Converted to ms
      expect(result.current.isAnimating).toBe(true);
    });

    it('should call onShow callback when keyboard appears', () => {
      const onShow = vi.fn();
      renderHook(() => useKeyboard({ onShow }));

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(onShow).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: true,
          height: 300,
        })
      );
    });

    it('should call onHeightChange callback when height changes', () => {
      const onHeightChange = vi.fn();
      renderHook(() => useKeyboard({ onHeightChange }));

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(onHeightChange).toHaveBeenCalledWith(300);
    });

    it('should set isAnimating to false after animation duration', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          duration: 0.25,
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.isAnimating).toBe(true);

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('keyboard hide', () => {
    it('should update state when keyboard hides', () => {
      const { result } = renderHook(() => useKeyboard());

      // Show keyboard first
      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.isVisible).toBe(true);

      // Hide keyboard
      act(() => {
        triggerKeyboardEvent('keyboardWillHide', {
          duration: 0.25,
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 0,
          },
        });
      });

      expect(result.current.keyboardState.isVisible).toBe(false);
      expect(result.current.keyboardState.height).toBe(0);
    });

    it('should call onHide callback when keyboard disappears', () => {
      const onHide = vi.fn();
      const { result } = renderHook(() => useKeyboard({ onHide }));

      // Show keyboard first
      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.isVisible).toBe(true);

      // Hide keyboard
      act(() => {
        triggerKeyboardEvent('keyboardWillHide', {
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 0,
          },
        });
      });

      expect(onHide).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: false,
          height: 0,
        })
      );
    });
  });

  describe('hardware keyboard detection', () => {
    it('should detect hardware keyboard when height is 0', () => {
      const onHardwareKeyboardDetected = vi.fn();
      const { result } = renderHook(() => useKeyboard({ onHardwareKeyboardDetected }));

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 0, // Hardware keyboard
          },
        });
      });

      expect(result.current.hardwareKeyboard.isConnected).toBe(true);
      expect(result.current.hardwareKeyboard.isActive).toBe(true);
      expect(onHardwareKeyboardDetected).toHaveBeenCalledWith(true);
    });

    it('should detect hardware keyboard when height is very small', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 30, // Very small height
          },
        });
      });

      expect(result.current.hardwareKeyboard.isConnected).toBe(true);
    });

    it('should not detect hardware keyboard for normal height', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300, // Normal software keyboard
          },
        });
      });

      expect(result.current.hardwareKeyboard.isConnected).toBe(false);
    });

    it('should set isActive to false when keyboard hides', () => {
      const { result } = renderHook(() => useKeyboard());

      // Show hardware keyboard
      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 0,
          },
        });
      });

      expect(result.current.hardwareKeyboard.isActive).toBe(true);

      // Hide keyboard
      act(() => {
        triggerKeyboardEvent('keyboardWillHide', {
          endCoordinates: {
            screenX: 0,
            screenY: 800,
            width: 375,
            height: 0,
          },
        });
      });

      expect(result.current.hardwareKeyboard.isActive).toBe(false);
    });
  });

  describe('easing conversion', () => {
    it('should parse easeInOut easing', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          easing: 'easeInEaseOut',
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.easing).toBe('easeIn');
    });

    it('should parse linear easing', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          easing: 'linear',
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.easing).toBe('linear');
    });

    it('should default to keyboard easing for unknown values', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        triggerKeyboardEvent('keyboardWillShow', {
          easing: 'unknownEasing',
          endCoordinates: {
            screenX: 0,
            screenY: 500,
            width: 375,
            height: 300,
          },
        });
      });

      expect(result.current.keyboardState.easing).toBe('keyboard');
    });
  });
});
