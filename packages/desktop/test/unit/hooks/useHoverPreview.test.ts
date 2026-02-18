/**
 * Tests for useHoverPreview hook
 *
 * Validates the hover preview state machine:
 * - 150ms debounce before showing preview
 * - Immediate close on hover-preview-close event
 * - Event listener lifecycle (add on mount, remove on unmount)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useHoverPreview,
  dispatchHoverPreviewOpen,
  dispatchHoverPreviewClose,
} from '../../../src/hooks/useHoverPreview.js';
import type { PageId } from '@double-bind/types';

// Use fake timers so we can control the 150ms debounce
vi.useFakeTimers();

describe('useHoverPreview', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  // ==========================================================================
  // Initial state
  // ==========================================================================

  describe('Initial State', () => {
    it('starts with isVisible false', () => {
      const { result } = renderHook(() => useHoverPreview());
      expect(result.current.isVisible).toBe(false);
    });

    it('starts with pageId null', () => {
      const { result } = renderHook(() => useHoverPreview());
      expect(result.current.pageId).toBe(null);
    });

    it('starts with position at origin', () => {
      const { result } = renderHook(() => useHoverPreview());
      expect(result.current.position).toEqual({ x: 0, y: 0 });
    });

    it('exposes a close function', () => {
      const { result } = renderHook(() => useHoverPreview());
      expect(typeof result.current.close).toBe('function');
    });
  });

  // ==========================================================================
  // Open event debounce
  // ==========================================================================

  describe('hover-preview-open debounce', () => {
    it('does not show preview before the 150ms debounce', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        // Advance only 100ms — not yet past the 150ms threshold
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.pageId).toBe(null);
    });

    it('shows preview after 150ms debounce', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        vi.advanceTimersByTime(150);
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.pageId).toBe('page-001');
      expect(result.current.position).toEqual({ x: 100, y: 200 });
    });

    it('resets the debounce timer if a new open event fires before 150ms', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 10, 20);
        vi.advanceTimersByTime(100); // 100ms in — not yet visible
        dispatchHoverPreviewOpen('page-002' as PageId, 30, 40); // second event resets timer
        vi.advanceTimersByTime(100); // only 100ms since second event
      });

      // Still within new debounce window — should not be visible yet
      expect(result.current.isVisible).toBe(false);

      act(() => {
        vi.advanceTimersByTime(60); // total 160ms since second event → now visible
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.pageId).toBe('page-002');
    });
  });

  // ==========================================================================
  // Close event
  // ==========================================================================

  describe('hover-preview-close', () => {
    it('closes immediately without waiting for timers', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        vi.advanceTimersByTime(150); // become visible
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        dispatchHoverPreviewClose('page-001' as PageId);
        // Do NOT advance timers — should be already closed
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.pageId).toBe(null);
    });

    it('cancels a pending open debounce when close fires', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        // Close fires before the 150ms debounce completes
        dispatchHoverPreviewClose('page-001' as PageId);
        vi.advanceTimersByTime(300); // advance past the debounce
      });

      // Should never have become visible
      expect(result.current.isVisible).toBe(false);
      expect(result.current.pageId).toBe(null);
    });
  });

  // ==========================================================================
  // Manual close() function
  // ==========================================================================

  describe('close() function', () => {
    it('closes when close() is called directly', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        vi.advanceTimersByTime(150);
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.close();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.pageId).toBe(null);
    });

    it('cancels pending open timer when close() is called', () => {
      const { result } = renderHook(() => useHoverPreview());

      act(() => {
        dispatchHoverPreviewOpen('page-001' as PageId, 100, 200);
        result.current.close(); // close before debounce fires
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isVisible).toBe(false);
    });
  });

  // ==========================================================================
  // Event listener lifecycle
  // ==========================================================================

  describe('Event Listener Lifecycle', () => {
    it('registers event listeners on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useHoverPreview());

      expect(addSpy).toHaveBeenCalledWith('hover-preview-open', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('hover-preview-close', expect.any(Function));
    });

    it('removes event listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useHoverPreview());
      unmount();

      expect(removeSpy).toHaveBeenCalledWith('hover-preview-open', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('hover-preview-close', expect.any(Function));
    });
  });
});
