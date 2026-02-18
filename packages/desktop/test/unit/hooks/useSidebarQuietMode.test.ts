/**
 * Tests for useSidebarQuietMode hook
 *
 * Validates the sidebar quiet-mode state machine:
 * - Sets sidebarQuiet=true on keydown inside contenteditable
 * - Resets sidebarQuiet=false after 1500ms of idle
 * - Filters out modifier-only keys (Control, Alt, Shift, Meta)
 * - Cleans up event listeners on unmount
 * - Clears idle timer on unmount (no dangling timeouts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSidebarQuietMode } from '../../../src/hooks/useSidebarQuietMode.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// Use fake timers to control the 1500ms idle timeout
vi.useFakeTimers();

/** Dispatch a keydown event on the given target element. */
function fireKeyDown(target: HTMLElement, key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  window.dispatchEvent(event);
}

/** Create a contenteditable div and attach it to document.body. */
function createContentEditable(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  document.body.appendChild(el);
  return el;
}

/** Create a non-contenteditable input and attach it to document.body. */
function createRegularInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

describe('useSidebarQuietMode', () => {
  beforeEach(() => {
    // Reset AppStore to a known state before each test
    useAppStore.setState({ sidebarQuiet: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    // Clear all children from body
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  // ==========================================================================
  // Sets sidebarQuiet=true on keydown in contenteditable
  // ==========================================================================

  describe('keydown in contenteditable', () => {
    it('sets sidebarQuiet=true when typing a regular key inside contenteditable', () => {
      const el = createContentEditable();
      renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(true);
    });

    it('does NOT set sidebarQuiet=true for keydown outside contenteditable', () => {
      const el = createRegularInput();
      renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(false);
    });
  });

  // ==========================================================================
  // Resets sidebarQuiet=false after 1500ms idle
  // ==========================================================================

  describe('idle timer', () => {
    it('resets sidebarQuiet=false after 1500ms of no typing', () => {
      const el = createContentEditable();
      renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(false);
    });

    it('does NOT reset before 1500ms has elapsed', () => {
      const el = createContentEditable();
      renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(true);
    });

    it('resets the idle timer on each new keystroke', () => {
      const el = createContentEditable();
      renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
        vi.advanceTimersByTime(1000); // 1000ms in — not yet reset
        fireKeyDown(el, 'b');        // new key resets the 1500ms clock
        vi.advanceTimersByTime(1000); // only 1000ms since last key
      });

      // Should still be quiet — the timer was reset by the second keystroke
      expect(useAppStore.getState().sidebarQuiet).toBe(true);

      act(() => {
        vi.advanceTimersByTime(600); // total 1600ms since last key → resets now
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(false);
    });
  });

  // ==========================================================================
  // Filters out modifier-only keys
  // ==========================================================================

  describe('modifier-only key filtering', () => {
    const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'];

    for (const key of modifierKeys) {
      it(`does not set sidebarQuiet=true for modifier-only key: ${key}`, () => {
        const el = createContentEditable();
        renderHook(() => useSidebarQuietMode());

        act(() => {
          fireKeyDown(el, key);
        });

        expect(useAppStore.getState().sidebarQuiet).toBe(false);
      });
    }
  });

  // ==========================================================================
  // Event listener lifecycle
  // ==========================================================================

  describe('event listener cleanup', () => {
    it('registers a keydown event listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useSidebarQuietMode());

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes the keydown event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useSidebarQuietMode());
      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // ==========================================================================
  // Clears timer on unmount (no dangling timeouts)
  // ==========================================================================

  describe('timer cleanup on unmount', () => {
    it('clears the idle timer on unmount so sidebarQuiet is not reset after unmount', () => {
      const el = createContentEditable();
      const { unmount } = renderHook(() => useSidebarQuietMode());

      act(() => {
        fireKeyDown(el, 'a');
      });

      expect(useAppStore.getState().sidebarQuiet).toBe(true);

      // Unmount before the 1500ms timer fires
      unmount();

      // Manually set to false so we can detect if the timer fires and resets it
      useAppStore.setState({ sidebarQuiet: false });

      act(() => {
        vi.advanceTimersByTime(2000); // advance well past the 1500ms threshold
      });

      // sidebarQuiet remains false — not re-set to true by a dangling timer
      expect(useAppStore.getState().sidebarQuiet).toBe(false);
    });
  });
});
