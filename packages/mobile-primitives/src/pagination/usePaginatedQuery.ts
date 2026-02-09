/**
 * usePaginatedQuery - React hook for cursor-based paginated queries
 *
 * Provides state management and actions for loading paginated data with
 * support for infinite scroll patterns on mobile devices.
 */

import { useCallback, useRef, useState } from 'react';
import type {
  PageFetcher,
  PaginatedQuery,
  PaginationCursor,
  PaginationOptions,
} from '@double-bind/types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Hook for managing paginated query state with cursor-based pagination.
 *
 * @param fetcher - Function that fetches a page of results
 * @param options - Optional pagination configuration
 * @returns Paginated query state and actions
 *
 * @example
 * ```tsx
 * const query = usePaginatedQuery(
 *   async ({ pageSize, cursor }) => {
 *     return await pageRepository.getAll({ limit: pageSize, cursor });
 *   },
 *   { pageSize: 20 }
 * );
 *
 * // Access state
 * const { items, loading, hasMore, error } = query;
 *
 * // Load more data
 * await query.fetchNextPage();
 *
 * // Reset to first page
 * query.reset();
 * ```
 */
export function usePaginatedQuery<T>(
  fetcher: PageFetcher<T>,
  options: PaginationOptions = {}
): PaginatedQuery<T> {
  const { pageSize = DEFAULT_PAGE_SIZE, cursor: initialCursor } = options;

  // State
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<PaginationCursor | null>(initialCursor ?? null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Track if a fetch is in progress to prevent concurrent fetches
  const fetchInProgressRef = useRef(false);

  // Store the last successful fetch options for retry
  const lastFetchOptionsRef = useRef<PaginationOptions | null>(null);

  /**
   * Fetch the next page of results
   */
  const fetchNextPage = useCallback(async (): Promise<void> => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current || !hasMore) {
      return;
    }

    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const fetchOptions: PaginationOptions = {
        pageSize,
        cursor: cursor ?? undefined,
      };

      lastFetchOptionsRef.current = fetchOptions;

      const result = await fetcher(fetchOptions);

      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
      setIsInitialLoad(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [fetcher, pageSize, cursor, hasMore]);

  /**
   * Reset to first page and clear all data
   */
  const reset = useCallback((): void => {
    setItems([]);
    setCursor(initialCursor ?? null);
    setHasMore(true);
    setError(null);
    setIsInitialLoad(true);
    lastFetchOptionsRef.current = null;
  }, [initialCursor]);

  /**
   * Refresh current data (re-fetch from start)
   */
  const refresh = useCallback(async (): Promise<void> => {
    reset();
    // After reset, fetch the first page
    await fetchNextPage();
  }, [reset, fetchNextPage]);

  /**
   * Retry after error
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!error) {
      return;
    }

    setError(null);
    await fetchNextPage();
  }, [error, fetchNextPage]);

  return {
    // State
    items,
    loading,
    error,
    hasMore,
    cursor,
    loadedCount: items.length,
    isInitialLoad,

    // Actions
    fetchNextPage,
    reset,
    refresh,
    retry,
  };
}
