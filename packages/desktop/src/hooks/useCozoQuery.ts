/**
 * useCozoQuery - Reactive hook for CozoDB queries
 *
 * A thin hook that queries CozoDB and re-runs on invalidation.
 * Backed by a Zustand query cache with automatic re-fetching.
 *
 * @example
 * ```tsx
 * function usePageBlocks(pageId: string) {
 *   const queryFn = useCallback(
 *     () => blockService.getByPage(pageId),
 *     [pageId]
 *   );
 *   return useCozoQuery(['blocks', 'byPage', pageId], queryFn);
 * }
 * ```
 */

import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

/**
 * Entry in the query cache.
 * Each entry tracks data, loading/error states, and an invalidation counter.
 */
interface QueryEntry<T = unknown> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  /** Monotonically increasing version; bump to trigger re-fetch */
  invalidationCount: number;
}

/**
 * Zustand store for query cache.
 */
interface QueryStore {
  entries: Map<string, QueryEntry>;
  /** Invalidate all queries whose serialized key starts with the given prefix */
  invalidateQueries: (keyPrefix: string[]) => void;
}

/**
 * Global query cache store.
 * Manages all query entries and provides invalidation.
 */
const useQueryStore = create<QueryStore>((set, get) => ({
  entries: new Map(),
  invalidateQueries: (keyPrefix) => {
    const prefix = JSON.stringify(keyPrefix).slice(0, -1); // match prefix
    const entries = new Map(get().entries);
    for (const [key, entry] of entries) {
      if (key.startsWith(prefix)) {
        entries.set(key, { ...entry, invalidationCount: entry.invalidationCount + 1 });
      }
    }
    set({ entries });
  },
}));

/**
 * Clear all query cache entries.
 * Exported for testing purposes.
 * @internal
 */
export const clearQueryCache = () => {
  useQueryStore.setState({ entries: new Map() });
};

/**
 * Invalidate queries by key prefix.
 * Exported for use in mutation functions.
 *
 * @param keyPrefix - Array of key segments to match (e.g., ['blocks'], ['backlinks'])
 *
 * @example
 * ```typescript
 * async function updateBlock(blockId: string, content: string) {
 *   await blockService.updateContent(blockId, content);
 *   invalidateQueries(['blocks']);  // Invalidate all block queries
 * }
 * ```
 */
export const invalidateQueries = (keyPrefix: string[]) =>
  useQueryStore.getState().invalidateQueries(keyPrefix);

/**
 * Options for useCozoQuery hook.
 */
export interface UseCozoQueryOptions {
  /** Whether the query should execute. Defaults to true. */
  enabled?: boolean;
}

/**
 * Result returned by useCozoQuery hook.
 */
export interface UseCozoQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * React hook for executing CozoDB queries with automatic caching and invalidation.
 *
 * Features:
 * - Automatic caching based on query key
 * - Loading, error, and data states
 * - Re-execution on invalidation
 * - Conditional execution via enabled option
 * - Automatic cleanup on unmount
 *
 * @param key - Unique identifier for the query (must be JSON-serializable)
 * @param queryFn - Async function that executes the query
 * @param options - Optional configuration
 * @returns Query result with data, loading, and error states
 *
 * @example
 * ```tsx
 * function PageView({ pageId }: { pageId: string }) {
 *   const { pageService } = useServices();
 *   const queryFn = useCallback(
 *     () => pageService.getById(pageId),
 *     [pageService, pageId]
 *   );
 *   const { data: page, isLoading, error } = useCozoQuery(
 *     ['page', pageId],
 *     queryFn,
 *     { enabled: !!pageId }
 *   );
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!page) return <div>Page not found</div>;
 *   return <div>{page.title}</div>;
 * }
 * ```
 */
export function useCozoQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: UseCozoQueryOptions
): UseCozoQueryResult<T> {
  const serializedKey = JSON.stringify(key);
  const enabled = options?.enabled ?? true;

  // Stable reference: queryFn identity must not change on every render.
  // Callers must wrap queryFn with useCallback if it captures changing deps.
  const stableQueryFn = useCallback(queryFn, [serializedKey]);

  const entry = useQueryStore(useCallback((s) => s.entries.get(serializedKey), [serializedKey]));
  const invalidationCount = entry?.invalidationCount ?? 0;

  useEffect(() => {
    if (!enabled) return;

    // Set loading state
    useQueryStore.setState((s) => {
      const entries = new Map(s.entries);
      const existing = entries.get(serializedKey);
      entries.set(serializedKey, {
        data: existing?.data,
        error: null,
        isLoading: true,
        invalidationCount,
      });
      return { entries };
    });

    let cancelled = false;
    stableQueryFn().then(
      (data) => {
        if (!cancelled) {
          useQueryStore.setState((s) => {
            const entries = new Map(s.entries);
            entries.set(serializedKey, { data, error: null, isLoading: false, invalidationCount });
            return { entries };
          });
        }
      },
      (error) => {
        if (!cancelled) {
          useQueryStore.setState((s) => {
            const entries = new Map(s.entries);
            entries.set(serializedKey, {
              data: undefined,
              error,
              isLoading: false,
              invalidationCount,
            });
            return { entries };
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [serializedKey, enabled, invalidationCount, stableQueryFn]);

  return {
    data: entry?.data as T | undefined,
    isLoading: entry?.isLoading ?? (enabled ? true : false),
    error: entry?.error ?? null,
  };
}
