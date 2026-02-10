/**
 * Tests for useKeyboard hook.
 *
 * These tests verify the keyboard state tracking functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';

// Mock react-native
vi.mock('react-native', () => ({
  Keyboard: {
    addListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
    dismiss: vi.fn(),
  },
  Platform: {
    OS: 'ios',
    select: vi.fn((options) => options.ios),
  },
}));

// Import after mocking
import {
  useKeyboard,
  useKeyboardDismiss,
  useDismissKeyboardOnTap,
} from '../../../src/editor/useKeyboard';
import { Keyboard } from 'react-native';

describe('useKeyboard', () => {
  let showCallback: ((event: { endCoordinates: { height: number } }) => void) | null = null;
  let hideCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    showCallback = null;
    hideCallback = null;

    // Capture the callbacks passed to addListener
    (Keyboard.addListener as any).mockImplementation((event: string, callback: any) => {
      if (event === 'keyboardWillShow' || event === 'keyboardDidShow') {
        showCallback = callback;
      } else if (event === 'keyboardWillHide' || event === 'keyboardDidHide') {
        hideCallback = callback;
      }
      return { remove: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useKeyboard', () => {
    it('should return initial state with keyboard hidden', () => {
      const { result } = renderHook(() => useKeyboard());

      expect(result.current.isVisible).toBe(false);
      expect(result.current.height).toBe(0);
    });

    it('should subscribe to keyboard events on mount', () => {
      renderHook(() => useKeyboard());

      expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
      expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));
    });

    it('should update state when keyboard shows', () => {
      const { result } = renderHook(() => useKeyboard());

      act(() => {
        showCallback?.({ endCoordinates: { height: 300 } });
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.height).toBe(300);
    });

    it('should update state when keyboard hides', () => {
      const { result } = renderHook(() => useKeyboard());

      // Show keyboard first
      act(() => {
        showCallback?.({ endCoordinates: { height: 300 } });
      });

      expect(result.current.isVisible).toBe(true);

      // Hide keyboard
      act(() => {
        hideCallback?.();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.height).toBe(0);
    });

    it('should cleanup subscriptions on unmount', () => {
      const removeMock = vi.fn();
      (Keyboard.addListener as any).mockReturnValue({ remove: removeMock });

      const { unmount } = renderHook(() => useKeyboard());

      unmount();

      expect(removeMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('useKeyboardDismiss', () => {
    it('should return a dismiss function', () => {
      const { result } = renderHook(() => useKeyboardDismiss());

      expect(result.current.dismiss).toBeDefined();
      expect(typeof result.current.dismiss).toBe('function');
    });

    it('should call Keyboard.dismiss when dismiss is called', () => {
      const { result } = renderHook(() => useKeyboardDismiss());

      act(() => {
        result.current.dismiss();
      });

      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
  });

  describe('useDismissKeyboardOnTap', () => {
    it('should return an onPress handler', () => {
      const { result } = renderHook(() => useDismissKeyboardOnTap());

      expect(result.current.onPress).toBeDefined();
      expect(typeof result.current.onPress).toBe('function');
    });

    it('should dismiss keyboard on press', () => {
      const { result } = renderHook(() => useDismissKeyboardOnTap());

      act(() => {
        result.current.onPress();
      });

      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
  });
});
