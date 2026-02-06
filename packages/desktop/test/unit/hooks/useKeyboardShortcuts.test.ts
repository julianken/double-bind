/**
 * Tests for useKeyboardShortcuts hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  useAppKeyboardShortcuts,
  type KeyboardShortcut,
} from '../../../src/hooks/useKeyboardShortcuts.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Simulate a keyboard event
 */
function fireKeyboardEvent(
  key: string,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    target?: HTMLElement;
  } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });

  // If target is specified, dispatch from that element
  if (options.target) {
    options.target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }

  return event;
}

/**
 * Mock navigator.platform for platform detection
 */
function mockPlatform(platform: string) {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to non-Mac platform
    mockPlatform('Win32');
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Basic Functionality
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('calls handler when shortcut key is pressed', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        fireKeyboardEvent('a');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not call handler for non-matching keys', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        fireKeyboardEvent('b');
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('handles multiple shortcuts', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      const shortcuts: KeyboardShortcut[] = [
        { key: 'a', handler: handlerA },
        { key: 'b', handler: handlerB },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        fireKeyboardEvent('a');
        fireKeyboardEvent('b');
      });

      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledTimes(1);
    });

    it('is case-insensitive for key matching', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'd', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      act(() => {
        fireKeyboardEvent('D');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Modifier Keys
  // ==========================================================================

  describe('Modifier Keys', () => {
    describe('Ctrl/Cmd modifier', () => {
      it('requires Ctrl key on Windows/Linux', () => {
        mockPlatform('Win32');
        const handler = vi.fn();
        const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

        renderHook(() => useKeyboardShortcuts(shortcuts));

        // Without Ctrl
        act(() => {
          fireKeyboardEvent('d');
        });
        expect(handler).not.toHaveBeenCalled();

        // With Ctrl
        act(() => {
          fireKeyboardEvent('d', { ctrlKey: true });
        });
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('requires Cmd key on macOS', () => {
        mockPlatform('MacIntel');
        const handler = vi.fn();
        const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

        renderHook(() => useKeyboardShortcuts(shortcuts));

        // Without Cmd
        act(() => {
          fireKeyboardEvent('d');
        });
        expect(handler).not.toHaveBeenCalled();

        // With Ctrl (wrong modifier on Mac)
        act(() => {
          fireKeyboardEvent('d', { ctrlKey: true });
        });
        expect(handler).not.toHaveBeenCalled();

        // With Cmd (correct modifier on Mac)
        act(() => {
          fireKeyboardEvent('d', { metaKey: true });
        });
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Shift modifier', () => {
      it('requires Shift key when specified', () => {
        const handler = vi.fn();
        const shortcuts: KeyboardShortcut[] = [{ key: 'a', shift: true, handler }];

        renderHook(() => useKeyboardShortcuts(shortcuts));

        // Without Shift
        act(() => {
          fireKeyboardEvent('a');
        });
        expect(handler).not.toHaveBeenCalled();

        // With Shift
        act(() => {
          fireKeyboardEvent('a', { shiftKey: true });
        });
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Alt modifier', () => {
      it('requires Alt key when specified', () => {
        const handler = vi.fn();
        const shortcuts: KeyboardShortcut[] = [{ key: 'a', alt: true, handler }];

        renderHook(() => useKeyboardShortcuts(shortcuts));

        // Without Alt
        act(() => {
          fireKeyboardEvent('a');
        });
        expect(handler).not.toHaveBeenCalled();

        // With Alt
        act(() => {
          fireKeyboardEvent('a', { altKey: true });
        });
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Combined modifiers', () => {
      it('requires all specified modifiers', () => {
        const handler = vi.fn();
        const shortcuts: KeyboardShortcut[] = [{ key: 's', ctrlOrCmd: true, shift: true, handler }];

        renderHook(() => useKeyboardShortcuts(shortcuts));

        // Ctrl only
        act(() => {
          fireKeyboardEvent('s', { ctrlKey: true });
        });
        expect(handler).not.toHaveBeenCalled();

        // Shift only
        act(() => {
          fireKeyboardEvent('s', { shiftKey: true });
        });
        expect(handler).not.toHaveBeenCalled();

        // Both Ctrl+Shift
        act(() => {
          fireKeyboardEvent('s', { ctrlKey: true, shiftKey: true });
        });
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==========================================================================
  // Enabled Option
  // ==========================================================================

  describe('Enabled Option', () => {
    it('does not trigger when disabled', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }));

      act(() => {
        fireKeyboardEvent('a');
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('triggers when enabled is true (default)', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: true }));

      act(() => {
        fireKeyboardEvent('a');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('responds to enabled changes', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      const { rerender } = renderHook(
        ({ enabled }) => useKeyboardShortcuts(shortcuts, { enabled }),
        { initialProps: { enabled: false } }
      );

      // Initially disabled
      act(() => {
        fireKeyboardEvent('a');
      });
      expect(handler).not.toHaveBeenCalled();

      // Enable
      rerender({ enabled: true });

      act(() => {
        fireKeyboardEvent('a');
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Input Element Handling
  // ==========================================================================

  describe('Input Element Handling', () => {
    it('ignores shortcuts in input elements', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        fireKeyboardEvent('d', { ctrlKey: true, target: input });
      });

      expect(handler).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('ignores shortcuts in textarea elements', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        fireKeyboardEvent('d', { ctrlKey: true, target: textarea });
      });

      expect(handler).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('ignores shortcuts in contenteditable elements', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      act(() => {
        fireKeyboardEvent('d', { ctrlKey: true, target: div });
      });

      expect(handler).not.toHaveBeenCalled();
      document.body.removeChild(div);
    });

    it('allows Escape key in input elements', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'Escape', handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        fireKeyboardEvent('Escape', { target: input });
      });

      expect(handler).toHaveBeenCalledTimes(1);
      document.body.removeChild(input);
    });
  });

  // ==========================================================================
  // Event Prevention
  // ==========================================================================

  describe('Event Prevention', () => {
    it('prevents default browser behavior when shortcut matches', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'd', ctrlOrCmd: true, handler }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const preventDefaultSpy = vi.fn();
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault = preventDefaultSpy;

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe('Cleanup', () => {
    it('removes event listener on unmount', () => {
      const handler = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{ key: 'a', handler }];

      const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

      unmount();

      act(() => {
        fireKeyboardEvent('a');
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// useAppKeyboardShortcuts Tests
// ============================================================================

describe('useAppKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform('Win32');
    // Reset store to initial state
    useAppStore.setState({
      currentPageId: 'some-page',
      commandPaletteOpen: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('sets currentPageId to null on Ctrl+D', () => {
    renderHook(() => useAppKeyboardShortcuts());

    // Initially has a page ID
    expect(useAppStore.getState().currentPageId).toBe('some-page');

    act(() => {
      fireKeyboardEvent('d', { ctrlKey: true });
    });

    // Should be null now (shows daily notes)
    expect(useAppStore.getState().currentPageId).toBeNull();
  });

  it('sets currentPageId to null on Cmd+D (macOS)', () => {
    mockPlatform('MacIntel');

    renderHook(() => useAppKeyboardShortcuts());

    expect(useAppStore.getState().currentPageId).toBe('some-page');

    act(() => {
      fireKeyboardEvent('d', { metaKey: true });
    });

    expect(useAppStore.getState().currentPageId).toBeNull();
  });

  it('does not trigger on plain D key', () => {
    renderHook(() => useAppKeyboardShortcuts());

    act(() => {
      fireKeyboardEvent('d');
    });

    expect(useAppStore.getState().currentPageId).toBe('some-page');
  });

  it('respects enabled option', () => {
    renderHook(() => useAppKeyboardShortcuts({ enabled: false }));

    act(() => {
      fireKeyboardEvent('d', { ctrlKey: true });
    });

    expect(useAppStore.getState().currentPageId).toBe('some-page');
  });
});
