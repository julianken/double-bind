/**
 * Tests for useGlobalShortcuts hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useGlobalShortcuts } from '../../../src/hooks/useGlobalShortcuts.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Event Listener Management
  // ==========================================================================

  describe('Event Listener Management', () => {
    it('registers keydown event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useGlobalShortcuts());

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keydown event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useGlobalShortcuts());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // ==========================================================================
  // Ctrl+[ - Navigate Back
  // ==========================================================================

  describe('Ctrl+[ - Navigate Back', () => {
    it('calls goBack when Ctrl+[ is pressed', () => {
      // Set up history
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-1');
      expect(state.historyIndex).toBe(0);
    });

    it('calls goBack when Cmd+[ is pressed (Mac)', () => {
      // Set up history
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '[',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-1');
      expect(state.historyIndex).toBe(0);
    });

    it('prevents default behavior when Ctrl+[ is pressed', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not navigate back if at start of history', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1'],
        historyIndex: 0,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-1');
      expect(state.historyIndex).toBe(0);
    });
  });

  // ==========================================================================
  // Ctrl+] - Navigate Forward
  // ==========================================================================

  describe('Ctrl+] - Navigate Forward', () => {
    it('calls goForward when Ctrl+] is pressed', () => {
      // Set up history with ability to go forward
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ']',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-2');
      expect(state.historyIndex).toBe(1);
    });

    it('calls goForward when Cmd+] is pressed (Mac)', () => {
      // Set up history with ability to go forward
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ']',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-2');
      expect(state.historyIndex).toBe(1);
    });

    it('prevents default behavior when Ctrl+] is pressed', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ']',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not navigate forward if at end of history', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ']',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-2');
      expect(state.historyIndex).toBe(1);
    });
  });

  // ==========================================================================
  // Non-Matching Keys
  // ==========================================================================

  describe('Non-Matching Keys', () => {
    it('does not trigger navigation on plain [ key without modifier', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '[',
        bubbles: true,
      });
      window.dispatchEvent(event);

      // State should not change
      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-2');
      expect(state.historyIndex).toBe(1);
    });

    it('does not trigger navigation on plain ] key without modifier', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ']',
        bubbles: true,
      });
      window.dispatchEvent(event);

      // State should not change
      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-1');
      expect(state.historyIndex).toBe(0);
    });

    it('does not trigger navigation on other Ctrl key combinations', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      renderHook(() => useGlobalShortcuts());

      // Ctrl+A
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // State should not change
      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-2');
      expect(state.historyIndex).toBe(1);
    });

    it('does not prevent default for non-matching keys', () => {
      renderHook(() => useGlobalShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Integration with Navigation
  // ==========================================================================

  describe('Integration with Navigation', () => {
    it('handles multiple back/forward navigations', () => {
      // Set up history with 3 pages
      useAppStore.setState({
        currentPageId: 'page-3',
        pageHistory: ['page-1', 'page-2', 'page-3'],
        historyIndex: 2,
      });

      renderHook(() => useGlobalShortcuts());

      // Go back twice
      const backEvent = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(backEvent);
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      window.dispatchEvent(backEvent);
      expect(useAppStore.getState().currentPageId).toBe('page-1');

      // Go forward once
      const forwardEvent = new KeyboardEvent('keydown', {
        key: ']',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(forwardEvent);
      expect(useAppStore.getState().currentPageId).toBe('page-2');
    });

    it('handles navigation from empty history', () => {
      // Start with no history
      useAppStore.setState({
        currentPageId: null,
        pageHistory: [],
        historyIndex: -1,
      });

      renderHook(() => useGlobalShortcuts());

      const backEvent = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
      });

      // Should not crash or change state
      window.dispatchEvent(backEvent);

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe(null);
      expect(state.historyIndex).toBe(-1);
    });
  });
});
