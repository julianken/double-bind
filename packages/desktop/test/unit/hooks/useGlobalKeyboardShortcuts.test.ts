/**
 * Unit tests for useGlobalKeyboardShortcuts hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import {
  useGlobalKeyboardShortcuts,
  useNewPageShortcut,
  type KeyboardShortcutActions,
} from '../../../src/hooks/useGlobalKeyboardShortcuts.js';
import type { UseCreatePageResult } from '../../../src/hooks/useCreatePage.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Simulate a keyboard event on the window.
 */
function simulateKeyDown(key: string, modifiers: { ctrl?: boolean; meta?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    metaKey: modifiers.meta ?? false,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(event);

  return event;
}

// ============================================================================
// Tests
// ============================================================================

describe('useGlobalKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // Ctrl+N Shortcut
  // ============================================================================

  describe('Ctrl+N Shortcut', () => {
    it('triggers onCreateNewPage when Ctrl+N is pressed', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      simulateKeyDown('n', { ctrl: true });

      expect(onCreateNewPage).toHaveBeenCalledTimes(1);
    });

    it('triggers onCreateNewPage when Cmd+N is pressed (Mac)', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      simulateKeyDown('n', { meta: true });

      expect(onCreateNewPage).toHaveBeenCalledTimes(1);
    });

    it('handles uppercase N key', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      simulateKeyDown('N', { ctrl: true });

      expect(onCreateNewPage).toHaveBeenCalledTimes(1);
    });

    it('does not trigger without modifier key', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      simulateKeyDown('n');

      expect(onCreateNewPage).not.toHaveBeenCalled();
    });

    it('does not trigger for other keys with Ctrl', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      simulateKeyDown('a', { ctrl: true });
      simulateKeyDown('b', { ctrl: true });
      simulateKeyDown('c', { ctrl: true });

      expect(onCreateNewPage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Enabled Option
  // ============================================================================

  describe('Enabled Option', () => {
    it('does not trigger shortcuts when disabled', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts(
          {
            onCreateNewPage,
          },
          { enabled: false }
        )
      );

      simulateKeyDown('n', { ctrl: true });

      expect(onCreateNewPage).not.toHaveBeenCalled();
    });

    it('triggers shortcuts when enabled explicitly', () => {
      const onCreateNewPage = vi.fn();

      renderHook(() =>
        useGlobalKeyboardShortcuts(
          {
            onCreateNewPage,
          },
          { enabled: true }
        )
      );

      simulateKeyDown('n', { ctrl: true });

      expect(onCreateNewPage).toHaveBeenCalledTimes(1);
    });

    it('responds to enabled changes', () => {
      const onCreateNewPage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) =>
          useGlobalKeyboardShortcuts(
            {
              onCreateNewPage,
            },
            { enabled }
          ),
        { initialProps: { enabled: false } }
      );

      // Should not trigger when disabled
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).not.toHaveBeenCalled();

      // Enable shortcuts
      rerender({ enabled: true });

      // Should trigger when enabled
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Action Updates
  // ============================================================================

  describe('Action Updates', () => {
    it('uses updated action callbacks', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      const { rerender } = renderHook(
        ({ actions }: { actions: KeyboardShortcutActions }) => useGlobalKeyboardShortcuts(actions),
        { initialProps: { actions: { onCreateNewPage: firstCallback } } }
      );

      // Trigger with first callback
      simulateKeyDown('n', { ctrl: true });
      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(secondCallback).not.toHaveBeenCalled();

      // Update callback
      rerender({ actions: { onCreateNewPage: secondCallback } });

      // Trigger with second callback
      simulateKeyDown('n', { ctrl: true });
      expect(firstCallback).toHaveBeenCalledTimes(1); // Still 1
      expect(secondCallback).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('removes event listener on unmount', () => {
      const onCreateNewPage = vi.fn();

      const { unmount } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage,
        })
      );

      // Should work before unmount
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Should not trigger after unmount
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).toHaveBeenCalledTimes(1); // Still 1
    });

    it('removes event listener when disabled', () => {
      const onCreateNewPage = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) =>
          useGlobalKeyboardShortcuts(
            {
              onCreateNewPage,
            },
            { enabled }
          ),
        { initialProps: { enabled: true } }
      );

      // Works when enabled
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });

      // Should not trigger when disabled
      simulateKeyDown('n', { ctrl: true });
      expect(onCreateNewPage).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  // ============================================================================
  // Empty Actions
  // ============================================================================

  describe('Empty Actions', () => {
    it('handles empty actions object gracefully', () => {
      // Should not throw
      renderHook(() => useGlobalKeyboardShortcuts({}));

      // Should not throw when pressing keys
      expect(() => {
        simulateKeyDown('n', { ctrl: true });
      }).not.toThrow();
    });

    it('handles undefined action callback', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onCreateNewPage: undefined,
        })
      );

      // Should not throw
      expect(() => {
        simulateKeyDown('n', { ctrl: true });
      }).not.toThrow();
    });
  });
});

// ============================================================================
// useNewPageShortcut Tests
// ============================================================================

describe('useNewPageShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('triggers createPage on Ctrl+N', () => {
    const createPage = vi.fn().mockResolvedValue({ page: { pageId: 'test' }, error: null });
    const mockResult: UseCreatePageResult = {
      createPage,
      isCreating: false,
      error: null,
    };

    renderHook(() => useNewPageShortcut(mockResult));

    simulateKeyDown('n', { ctrl: true });

    expect(createPage).toHaveBeenCalledTimes(1);
  });

  it('does not trigger createPage when isCreating is true', () => {
    const createPage = vi.fn().mockResolvedValue({ page: { pageId: 'test' }, error: null });
    const mockResult: UseCreatePageResult = {
      createPage,
      isCreating: true, // Already creating
      error: null,
    };

    renderHook(() => useNewPageShortcut(mockResult));

    simulateKeyDown('n', { ctrl: true });

    expect(createPage).not.toHaveBeenCalled();
  });

  it('respects enabled option', () => {
    const createPage = vi.fn().mockResolvedValue({ page: { pageId: 'test' }, error: null });
    const mockResult: UseCreatePageResult = {
      createPage,
      isCreating: false,
      error: null,
    };

    renderHook(() => useNewPageShortcut(mockResult, { enabled: false }));

    simulateKeyDown('n', { ctrl: true });

    expect(createPage).not.toHaveBeenCalled();
  });

  it('updates when isCreating changes', () => {
    const createPage = vi.fn().mockResolvedValue({ page: { pageId: 'test' }, error: null });

    const { rerender } = renderHook(
      ({ isCreating }: { isCreating: boolean }) =>
        useNewPageShortcut({
          createPage,
          isCreating,
          error: null,
        }),
      { initialProps: { isCreating: false } }
    );

    // Should trigger when not creating
    simulateKeyDown('n', { ctrl: true });
    expect(createPage).toHaveBeenCalledTimes(1);

    // Set to creating
    rerender({ isCreating: true });

    // Should not trigger when creating
    simulateKeyDown('n', { ctrl: true });
    expect(createPage).toHaveBeenCalledTimes(1); // Still 1

    // Set back to not creating
    rerender({ isCreating: false });

    // Should trigger again
    simulateKeyDown('n', { ctrl: true });
    expect(createPage).toHaveBeenCalledTimes(2);
  });
});
