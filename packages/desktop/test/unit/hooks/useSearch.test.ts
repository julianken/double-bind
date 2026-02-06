/**
 * Unit tests for useSearch hook
 *
 * Tests cover:
 * - Initial state
 * - Query management (setQuery, clearSearch)
 * - Debouncing (300ms default)
 * - Minimum query length validation (2 chars default)
 * - AbortController for cancelling in-flight requests
 * - Race condition prevention
 * - Callbacks (onResults, onSearchStart, onError)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import {
  useSearch,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_MIN_QUERY_LENGTH,
} from '../../../src/hooks/useSearch.js';

// ============================================================================
// Tests
// ============================================================================

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ============================================================================
  // Constants
  // ============================================================================

  describe('Constants', () => {
    it('exports DEFAULT_DEBOUNCE_MS as 300', () => {
      expect(DEFAULT_DEBOUNCE_MS).toBe(300);
    });

    it('exports DEFAULT_MIN_QUERY_LENGTH as 2', () => {
      expect(DEFAULT_MIN_QUERY_LENGTH).toBe(2);
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('returns empty query initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe('');
    });

    it('returns empty debouncedQuery initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.debouncedQuery).toBe('');
    });

    it('returns empty results initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
    });

    it('returns not loading initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.isLoading).toBe(false);
    });

    it('returns no error initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.error).toBeNull();
    });

    it('returns showMinLengthHint as false initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.showMinLengthHint).toBe(false);
    });
  });

  // ============================================================================
  // setQuery
  // ============================================================================

  describe('setQuery', () => {
    it('updates query state immediately', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.query).toBe('test');
    });

    it('does not update debouncedQuery immediately', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      // debouncedQuery should not be updated yet (before debounce)
      expect(result.current.debouncedQuery).toBe('');
    });

    it('updates debouncedQuery after debounce delay', async () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      // Advance timers by debounce delay
      await act(async () => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });

    it('sets isLoading to true immediately for valid queries', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      // Loading should be true immediately (before debounce completes)
      expect(result.current.isLoading).toBe(true);
    });

    it('does not trigger search when query is too short', () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 3 }));

      act(() => {
        result.current.setQuery('ab');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('clears results when query becomes too short', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch({ minQueryLength: 2 }));

      // Set a valid query and wait for results
      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.hasResults).toBe(true);
      });

      // Now set a short query
      act(() => {
        result.current.setQuery('a');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
    });
  });

  // ============================================================================
  // Debouncing
  // ============================================================================

  describe('Debouncing', () => {
    it('does not fire search before debounce delay', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
      });

      // Advance by less than debounce delay
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS - 1);
      });

      // onSearchStart should not be called yet
      expect(onSearchStart).not.toHaveBeenCalled();
    });

    it('fires search after debounce delay', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
      });

      // Advance by debounce delay
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      });

      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });

    it('resets debounce timer on each keystroke', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      // First keystroke
      act(() => {
        result.current.setQuery('t');
      });

      // Wait less than debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Second keystroke (resets timer)
      act(() => {
        result.current.setQuery('te');
      });

      // Wait less than debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Third keystroke (resets timer)
      act(() => {
        result.current.setQuery('tes');
      });

      // Wait less than debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should still not have fired (300ms hasn't passed since last keystroke)
      expect(onSearchStart).not.toHaveBeenCalled();

      // Now wait for remaining debounce time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });

    it('uses custom debounce delay', () => {
      const onSearchStart = vi.fn();
      const customDebounceMs = 500;
      const { result } = renderHook(() =>
        useSearch({ debounceMs: customDebounceMs, onSearchStart })
      );

      act(() => {
        result.current.setQuery('test');
      });

      // Advance by default debounce (300ms)
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      });

      // Should not have fired yet
      expect(onSearchStart).not.toHaveBeenCalled();

      // Advance remaining time
      act(() => {
        vi.advanceTimersByTime(customDebounceMs - DEFAULT_DEBOUNCE_MS);
      });

      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });

    it('only fires search once after rapid typing stops', async () => {
      vi.useRealTimers();

      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      // Simulate rapid typing
      act(() => {
        result.current.setQuery('t');
      });
      act(() => {
        result.current.setQuery('te');
      });
      act(() => {
        result.current.setQuery('tes');
      });
      act(() => {
        result.current.setQuery('test');
      });

      // Wait for debounce
      await waitFor(
        () => {
          expect(onSearchStart).toHaveBeenCalledTimes(1);
        },
        { timeout: 1000 }
      );

      // Should only have fired once
      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Minimum Query Length
  // ============================================================================

  describe('Minimum Query Length', () => {
    it('defaults to 2 characters', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('a');
      });

      // Should not trigger search with 1 character
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setQuery('ab');
      });

      // Should trigger search with 2 characters (loading starts immediately)
      expect(result.current.isLoading).toBe(true);
    });

    it('respects custom minQueryLength', () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 4 }));

      act(() => {
        result.current.setQuery('abc');
      });

      // Should not trigger search with 3 characters
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setQuery('abcd');
      });

      // Should trigger search with 4 characters
      expect(result.current.isLoading).toBe(true);
    });

    it('clears results immediately when query becomes too short (no debounce)', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      // Set valid query
      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.hasResults).toBe(true);
      });

      // Delete to 1 character
      act(() => {
        result.current.setQuery('t');
      });

      // Results should be cleared immediately (no debounce)
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // showMinLengthHint
  // ============================================================================

  describe('showMinLengthHint', () => {
    it('is false when query is empty', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.showMinLengthHint).toBe(false);
    });

    it('is true when query is 1 character (default minQueryLength=2)', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('a');
      });

      expect(result.current.showMinLengthHint).toBe(true);
    });

    it('is false when query meets minQueryLength', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('ab');
      });

      expect(result.current.showMinLengthHint).toBe(false);
    });

    it('is false when query exceeds minQueryLength', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('abc');
      });

      expect(result.current.showMinLengthHint).toBe(false);
    });

    it('respects custom minQueryLength', () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 4 }));

      act(() => {
        result.current.setQuery('a');
      });
      expect(result.current.showMinLengthHint).toBe(true);

      act(() => {
        result.current.setQuery('ab');
      });
      expect(result.current.showMinLengthHint).toBe(true);

      act(() => {
        result.current.setQuery('abc');
      });
      expect(result.current.showMinLengthHint).toBe(true);

      act(() => {
        result.current.setQuery('abcd');
      });
      expect(result.current.showMinLengthHint).toBe(false);
    });
  });

  // ============================================================================
  // Request Cancellation
  // ============================================================================

  describe('Request Cancellation', () => {
    it('cancels previous search when new keystroke arrives', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result } = renderHook(() => useSearch({ onResults }));

      // Fire first query
      act(() => {
        result.current.setQuery('first');
      });

      // Immediately fire second query (should cancel first)
      act(() => {
        result.current.setQuery('second');
      });

      // Wait for search to complete
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 1000 }
      );

      // Should have results from second query, not first
      expect(result.current.results.some((r) => r.title.includes('second'))).toBe(true);
    });

    it('cancels in-flight request when query becomes too short', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result } = renderHook(() => useSearch({ onResults }));

      // Start a search
      act(() => {
        result.current.setQuery('test');
      });

      // Immediately clear to 1 character
      act(() => {
        result.current.setQuery('t');
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // onResults should not have been called (search was cancelled)
      expect(onResults).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
    });

    it('cancels in-flight request on clearSearch', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result } = renderHook(() => useSearch({ onResults }));

      // Start a search
      act(() => {
        result.current.setQuery('test');
      });

      // Clear immediately
      act(() => {
        result.current.clearSearch();
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // onResults should not have been called
      expect(onResults).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Race Conditions
  // ============================================================================

  describe('Race Conditions', () => {
    it('only uses results from the latest query', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      // Fire multiple queries rapidly
      act(() => {
        result.current.setQuery('first');
      });

      act(() => {
        result.current.setQuery('second');
      });

      act(() => {
        result.current.setQuery('third');
      });

      // Wait for all searches to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have results from the last query
      expect(result.current.query).toBe('third');
      expect(result.current.results.some((r) => r.title.includes('third'))).toBe(true);
    });

    it('ignores results from stale queries', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result } = renderHook(() => useSearch({ onResults }));

      // Fire query and immediately clear
      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        result.current.clearSearch();
      });

      // Wait a bit for any pending searches
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Results callback should not have been called with stale results
      // (It might be called during the brief search, but results should be empty after clear)
      expect(result.current.results).toEqual([]);
    });

    it('handles rapid clear/search cycles without race conditions', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      // Rapid search/clear cycles
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.setQuery(`query${i}`);
        });
        act(() => {
          result.current.clearSearch();
        });
      }

      // Final search
      act(() => {
        result.current.setQuery('final');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have results from final query
      expect(result.current.results.some((r) => r.title.includes('final'))).toBe(true);
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('sets isLoading to true immediately when typing valid query', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('keeps isLoading true during debounce period', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.isLoading).toBe(true);

      // Advance by less than debounce delay
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS - 1);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('sets isLoading to false when search completes', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('sets isLoading to false when query becomes too short', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setQuery('t');
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // Search Results
  // ============================================================================

  describe('Search Results', () => {
    it('populates results after search completes', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
        expect(result.current.hasResults).toBe(true);
      });
    });

    it('returns results with expected shape', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.hasResults).toBe(true);
      });

      const firstResult = result.current.results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('type');
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('pageId');
      expect(firstResult).toHaveProperty('score');
    });
  });

  // ============================================================================
  // Callbacks
  // ============================================================================

  describe('Callbacks', () => {
    it('calls onSearchStart when search begins (after debounce)', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
      });

      // Should not be called yet (debouncing)
      expect(onSearchStart).not.toHaveBeenCalled();

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      });

      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });

    it('calls onResults when search completes', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result } = renderHook(() => useSearch({ onResults }));

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(onResults).toHaveBeenCalledTimes(1);
      });

      expect(onResults).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  // ============================================================================
  // clearSearch
  // ============================================================================

  describe('clearSearch', () => {
    it('clears the query', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.hasResults).toBe(true);
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe('');
    });

    it('clears the debouncedQuery', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.debouncedQuery).toBe('test');
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.debouncedQuery).toBe('');
    });

    it('clears the results', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.hasResults).toBe(true);
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.hasResults).toBe(false);
    });

    it('clears the loading state', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('clears any error', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      // Trigger search
      act(() => {
        result.current.setQuery('test');
      });

      // Clear should reset error (if any)
      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.error).toBeNull();
    });

    it('cancels pending debounce timer', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
      });

      // Clear before debounce completes
      act(() => {
        result.current.clearSearch();
      });

      // Advance past debounce time
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 2);
      });

      // Search should not have started
      expect(onSearchStart).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // search function (manual trigger)
  // ============================================================================

  describe('search function', () => {
    it('allows manual search trigger (bypasses debounce)', async () => {
      vi.useRealTimers();

      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      await act(async () => {
        await result.current.search('manual search');
      });

      // Should have called immediately (no debounce)
      expect(onSearchStart).toHaveBeenCalledTimes(1);
      expect(result.current.hasResults).toBe(true);
    });

    it('does not update query state on manual search', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('manual search');
      });

      expect(result.current.query).toBe('');
    });

    it('updates debouncedQuery on manual search', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('manual search');
      });

      expect(result.current.debouncedQuery).toBe('manual search');
    });

    it('cancels any pending debounce timer', async () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      // Start typing (triggers debounce)
      act(() => {
        result.current.setQuery('test');
      });

      // Manual search should cancel debounce and search immediately
      vi.useRealTimers();
      await act(async () => {
        await result.current.search('manual');
      });

      // Should have fired only once (the manual search)
      expect(onSearchStart).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('cancels debounce timer on unmount', () => {
      const onSearchStart = vi.fn();
      const { result, unmount } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
      });

      // Unmount before debounce completes
      unmount();

      // Advance past debounce time
      act(() => {
        vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 2);
      });

      // Search should not have started
      expect(onSearchStart).not.toHaveBeenCalled();
    });

    it('cancels in-flight request on unmount', async () => {
      vi.useRealTimers();

      const onResults = vi.fn();
      const { result, unmount } = renderHook(() => useSearch({ onResults }));

      // Start search
      act(() => {
        result.current.setQuery('test');
      });

      // Unmount immediately
      unmount();

      // Wait for potential search to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Results callback should not be called after unmount
      expect(onResults).not.toHaveBeenCalled();
    });
  });
});
