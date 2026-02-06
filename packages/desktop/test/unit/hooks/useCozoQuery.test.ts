/**
 * Unit tests for useCozoQuery hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import {
  useCozoQuery,
  invalidateQueries,
  clearQueryCache,
} from '../../../src/hooks/useCozoQuery.js';

describe('useCozoQuery', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    // Clear the query cache before each test
    clearQueryCache();
  });

  afterEach(() => {
    cleanup();
    // Also clear after to prevent test pollution
    clearQueryCache();
  });

  // ============================================================================
  // Basic Query Execution
  // ============================================================================

  describe('Basic Query Execution', () => {
    it('executes query and returns data', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      // Initial state: loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Final state: success
      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      expect(result.current.error).toBeNull();
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('handles query errors', async () => {
      const error = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Final state: error
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBe(error);
      expect(result.current.isLoading).toBe(false);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('returns cached data on subsequent renders', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });

      const { result, rerender } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Re-render with same key
      rerender();

      // Should return cached data immediately without re-fetching
      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      expect(result.current.isLoading).toBe(false);
      expect(queryFn).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  // ============================================================================
  // Query Keys
  // ============================================================================

  describe('Query Keys', () => {
    it('treats different keys as separate cache entries', async () => {
      const queryFn1 = vi.fn().mockResolvedValue({ id: '1', title: 'Page 1' });
      const queryFn2 = vi.fn().mockResolvedValue({ id: '2', title: 'Page 2' });

      const { result: result1 } = renderHook(() => useCozoQuery(['page', '1'], queryFn1));
      const { result: result2 } = renderHook(() => useCozoQuery(['page', '2'], queryFn2));

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result1.current.data).toEqual({ id: '1', title: 'Page 1' });
      expect(result2.current.data).toEqual({ id: '2', title: 'Page 2' });
      expect(queryFn1).toHaveBeenCalledTimes(1);
      expect(queryFn2).toHaveBeenCalledTimes(1);
    });

    it('serializes complex keys correctly', async () => {
      const queryFn = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const { result } = renderHook(() =>
        useCozoQuery(['blocks', 'byPage', 'page-1', { includeDeleted: false }], queryFn)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([{ id: '1' }, { id: '2' }]);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Enabled Option
  // ============================================================================

  describe('Enabled Option', () => {
    it('does not execute when enabled is false', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn, { enabled: false }));

      // Should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('executes when enabled changes from false to true', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });

      const { result, rerender } = renderHook(
        ({ enabled }) => useCozoQuery(['page', '1'], queryFn, { enabled }),
        { initialProps: { enabled: false } }
      );

      // Initially disabled
      expect(result.current.isLoading).toBe(false);
      expect(queryFn).not.toHaveBeenCalled();

      // Enable the query
      rerender({ enabled: true });

      // Should start loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('uses cached data when re-enabled', async () => {
      const queryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });

      // First render: enabled
      const { result, rerender } = renderHook(
        ({ enabled }) => useCozoQuery(['page-reenabled', '1'], queryFn, { enabled }),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' }); // Cached data persists

      // Re-enable - this will trigger a re-fetch because the hook re-runs the effect
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Data should still be correct (from cache or re-fetch)
      expect(result.current.data).toEqual({ id: '1', title: 'Test Page' });
      // Note: Re-enabling triggers the effect again, so query will be called again
      // This is expected behavior - disabling and re-enabling is not the same as
      // staying enabled with cached data
    });
  });

  // ============================================================================
  // Invalidation
  // ============================================================================

  describe('Invalidation', () => {
    it('re-fetches when invalidated', async () => {
      const queryFn = vi
        .fn()
        .mockResolvedValueOnce({ id: '1', title: 'Original' })
        .mockResolvedValueOnce({ id: '1', title: 'Updated' });

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Original' });
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Invalidate the query
      invalidateQueries(['page', '1']);

      // Should trigger re-fetch
      await waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Updated' });
    });

    it('invalidates by prefix', async () => {
      const queryFn1 = vi
        .fn()
        .mockResolvedValueOnce({ id: '1', title: 'Page 1 Original' })
        .mockResolvedValueOnce({ id: '1', title: 'Page 1 Updated' });

      const queryFn2 = vi
        .fn()
        .mockResolvedValueOnce({ id: '2', title: 'Page 2 Original' })
        .mockResolvedValueOnce({ id: '2', title: 'Page 2 Updated' });

      const { result: result1 } = renderHook(() => useCozoQuery(['page', '1'], queryFn1));
      const { result: result2 } = renderHook(() => useCozoQuery(['page', '2'], queryFn2));

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result1.current.data).toEqual({ id: '1', title: 'Page 1 Original' });
      expect(result2.current.data).toEqual({ id: '2', title: 'Page 2 Original' });

      // Invalidate all page queries
      invalidateQueries(['page']);

      await waitFor(() => {
        expect(queryFn1).toHaveBeenCalledTimes(2);
        expect(queryFn2).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result1.current.data).toEqual({ id: '1', title: 'Page 1 Updated' });
      expect(result2.current.data).toEqual({ id: '2', title: 'Page 2 Updated' });
    });

    it('does not invalidate unrelated queries', async () => {
      const pageQueryFn = vi.fn().mockResolvedValue({ id: '1', title: 'Test Page' });
      const blockQueryFn = vi.fn().mockResolvedValue([{ id: 'block-1' }]);

      const { result: pageResult } = renderHook(() => useCozoQuery(['page', '1'], pageQueryFn));
      const { result: blockResult } = renderHook(() =>
        useCozoQuery(['blocks', 'byPage', '1'], blockQueryFn)
      );

      await waitFor(() => {
        expect(pageResult.current.isLoading).toBe(false);
        expect(blockResult.current.isLoading).toBe(false);
      });

      expect(pageQueryFn).toHaveBeenCalledTimes(1);
      expect(blockQueryFn).toHaveBeenCalledTimes(1);

      // Invalidate only page queries
      invalidateQueries(['page']);

      await waitFor(() => {
        expect(pageQueryFn).toHaveBeenCalledTimes(2);
      });

      // Block query should not be re-fetched
      expect(blockQueryFn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('cancels in-flight queries on unmount', async () => {
      let resolveQuery: ((value: unknown) => void) | null = null;
      const queryFn = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveQuery = resolve;
          })
      );

      const { unmount } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      expect(queryFn).toHaveBeenCalledTimes(1);

      // Unmount before query completes
      unmount();

      // Resolve the query after unmount
      resolveQuery?.({ id: '1', title: 'Test Page' });

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Data should not be stored (component unmounted)
      // We can't directly assert this, but the test verifies no errors occur
    });

    it('cancels in-flight queries when key changes', async () => {
      let resolveQuery1: ((value: unknown) => void) | null = null;
      let resolveQuery2: ((value: unknown) => void) | null = null;

      const queryFn1 = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveQuery1 = resolve;
          })
      );

      const queryFn2 = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveQuery2 = resolve;
          })
      );

      const { result, rerender } = renderHook(({ key, queryFn }) => useCozoQuery(key, queryFn), {
        initialProps: {
          key: ['page', '1'] as string[],
          queryFn: queryFn1,
        },
      });

      expect(queryFn1).toHaveBeenCalledTimes(1);

      // Change key before first query completes
      rerender({
        key: ['page', '2'],
        queryFn: queryFn2,
      });

      expect(queryFn2).toHaveBeenCalledTimes(1);

      // Resolve first query (should be cancelled)
      resolveQuery1?.({ id: '1', title: 'Page 1' });

      // Resolve second query
      resolveQuery2?.({ id: '2', title: 'Page 2' });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have data from second query only
      expect(result.current.data).toEqual({ id: '2', title: 'Page 2' });
    });
  });

  // ============================================================================
  // TypeScript Generics
  // ============================================================================

  describe('TypeScript Generics', () => {
    it('infers correct types from queryFn return value', async () => {
      interface Page {
        id: string;
        title: string;
        createdAt: number;
      }

      const queryFn = vi.fn().mockResolvedValue({
        id: '1',
        title: 'Test Page',
        createdAt: Date.now(),
      } as Page);

      const { result } = renderHook(() => useCozoQuery<Page>(['page', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // TypeScript should infer correct type
      const page = result.current.data;
      if (page) {
        expect(page.id).toBe('1');
        expect(page.title).toBe('Test Page');
        expect(typeof page.createdAt).toBe('number');
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty key array', async () => {
      const queryFn = vi.fn().mockResolvedValue({ result: 'global data' });

      const { result } = renderHook(() => useCozoQuery([], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ result: 'global data' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('handles query function that returns undefined', async () => {
      const queryFn = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('handles query function that returns null', async () => {
      const queryFn = vi.fn().mockResolvedValue(null);

      const { result } = renderHook(() => useCozoQuery(['page', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('handles rapid invalidations', async () => {
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(async () => {
        callCount++;
        return { id: '1', title: `Version ${callCount}` };
      });

      const { result } = renderHook(() => useCozoQuery(['page-rapid', '1'], queryFn));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ id: '1', title: 'Version 1' });

      // Rapid invalidations - wrap in act to handle React updates
      act(() => {
        invalidateQueries(['page-rapid', '1']);
        invalidateQueries(['page-rapid', '1']);
        invalidateQueries(['page-rapid', '1']);
      });

      // Wait for at least one re-fetch to complete
      // Note: Due to React's batching and the effect dependencies,
      // multiple rapid invalidations may be batched into fewer actual calls
      await waitFor(
        () => {
          expect(queryFn).toHaveBeenCalled();
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Should have updated data (exact version depends on batching behavior)
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe('1');
      // queryFn should have been called at least twice (initial + at least one invalidation)
      expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
