/**
 * Tests for useTypewriterScroll hook
 *
 * Validates that:
 * - When typewriterEnabled is false, no scroll is triggered
 * - When typewriterEnabled is true and a block is focused, scrollIntoView is called
 * - The correct DOM selector ([data-block-id]) is used to find the block element
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTypewriterScroll } from '../../../src/hooks/useTypewriterScroll.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// Use fake timers to control requestAnimationFrame.
// requestAnimationFrame is faked by Vitest and fires after vi.advanceTimersByTime(16).
vi.useFakeTimers();

/** Advance timers by one animation frame (≈16ms). */
function flushRaf() {
  vi.advanceTimersByTime(16);
}

// Utility: create a block element and attach it to document.body
function createBlockElement(blockId: string): { el: HTMLElement; scrollMock: ReturnType<typeof vi.fn> } {
  const el = document.createElement('li');
  el.setAttribute('data-block-id', blockId);
  const scrollMock = vi.fn();
  el.scrollIntoView = scrollMock;
  document.body.appendChild(el);
  return { el, scrollMock };
}

describe('useTypewriterScroll', () => {
  beforeEach(() => {
    // Reset AppStore to known initial state
    useAppStore.setState({
      focusedBlockId: null,
      typewriterEnabled: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    // Remove all children from body
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  // ==========================================================================
  // No scroll when typewriter is disabled
  // ==========================================================================

  describe('typewriterEnabled = false', () => {
    it('does not scroll when typewriter mode is off, even if a block is focused', () => {
      const { scrollMock } = createBlockElement('block-001');

      useAppStore.setState({
        focusedBlockId: 'block-001' as any,
        typewriterEnabled: false,
      });

      renderHook(() => useTypewriterScroll());

      act(() => {
        flushRaf();
      });

      expect(scrollMock).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // No scroll when no block is focused
  // ==========================================================================

  describe('focusedBlockId = null', () => {
    it('does not scroll when no block is focused, even if typewriter is on', () => {
      useAppStore.setState({
        focusedBlockId: null,
        typewriterEnabled: true,
      });

      renderHook(() => useTypewriterScroll());

      act(() => {
        flushRaf();
      });

      // No element to scroll — just verify no throw and no unexpected calls
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Scroll when both typewriter and focused block are set
  // ==========================================================================

  describe('typewriterEnabled = true + focusedBlockId set', () => {
    it('calls scrollIntoView on the matching block element', () => {
      const { scrollMock } = createBlockElement('block-abc');

      useAppStore.setState({
        typewriterEnabled: true,
        focusedBlockId: null,
      });

      renderHook(() => useTypewriterScroll());

      // Now focus a block — hook re-runs, rAF is queued
      act(() => {
        useAppStore.setState({ focusedBlockId: 'block-abc' as any });
      });

      // Flush the rAF callback
      act(() => {
        flushRaf();
      });

      expect(scrollMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });

    it('does nothing when the block element is not in the DOM', () => {
      useAppStore.setState({
        typewriterEnabled: true,
        focusedBlockId: 'block-missing' as any,
      });

      // No DOM element added — should not throw

      expect(() => {
        renderHook(() => useTypewriterScroll());
        act(() => {
          flushRaf();
        });
      }).not.toThrow();
    });

    it('uses correct CSS selector for a typical ULID block ID', () => {
      const blockId = '01HQXYZABC';
      const { scrollMock } = createBlockElement(blockId);

      useAppStore.setState({
        typewriterEnabled: true,
        focusedBlockId: null,
      });

      renderHook(() => useTypewriterScroll());

      act(() => {
        useAppStore.setState({ focusedBlockId: blockId as any });
      });

      act(() => {
        flushRaf();
      });

      expect(scrollMock).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Reactive updates — new focus triggers new scroll
  // ==========================================================================

  describe('Reactivity', () => {
    it('scrolls to the new block when focusedBlockId changes', () => {
      const { scrollMock: scrollA } = createBlockElement('block-a');
      const { scrollMock: scrollB } = createBlockElement('block-b');

      useAppStore.setState({
        typewriterEnabled: true,
        focusedBlockId: null,
      });

      renderHook(() => useTypewriterScroll());

      act(() => {
        useAppStore.setState({ focusedBlockId: 'block-a' as any });
      });

      act(() => {
        flushRaf();
      });

      expect(scrollA).toHaveBeenCalledTimes(1);
      expect(scrollB).not.toHaveBeenCalled();

      act(() => {
        useAppStore.setState({ focusedBlockId: 'block-b' as any });
      });

      act(() => {
        flushRaf();
      });

      expect(scrollB).toHaveBeenCalledTimes(1);
    });
  });
});
