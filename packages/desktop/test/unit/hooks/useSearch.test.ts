/**
 * Unit tests for useSearch hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useSearch } from '../../../src/hooks/useSearch.js';

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
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('returns empty query initially', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe('');
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
  });

  // ============================================================================
  // setQuery
  // ============================================================================

  describe('setQuery', () => {
    it('updates query state', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.query).toBe('test');
    });

    it('triggers search when query is long enough', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('does not trigger search when query is too short', () => {
      const { result } = renderHook(() => useSearch({ minQueryLength: 3 }));

      act(() => {
        result.current.setQuery('ab');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('clears results when query is too short', async () => {
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
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('sets isLoading to true when search starts', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
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
    it('calls onSearchStart when search begins', () => {
      const onSearchStart = vi.fn();
      const { result } = renderHook(() => useSearch({ onSearchStart }));

      act(() => {
        result.current.setQuery('test');
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
  });

  // ============================================================================
  // search function
  // ============================================================================

  describe('search function', () => {
    it('allows manual search trigger', async () => {
      vi.useRealTimers();

      const { result } = renderHook(() => useSearch());

      await act(async () => {
        await result.current.search('manual search');
      });

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
  });

  // ============================================================================
  // minQueryLength option
  // ============================================================================

  describe('minQueryLength option', () => {
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

      // Should trigger search with 2 characters
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
  });
});
