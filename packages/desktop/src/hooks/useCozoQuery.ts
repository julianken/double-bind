/**
 * useCozoQuery - Reactive hook for CozoDB queries
 *
 * Now backed by TanStack Query instead of Zustand for better stability.
 * This migration fixes the infinite re-render loop bug (DBB-341) caused
 * by Zustand selector reference instability.
 *
 * The API is preserved for backward compatibility with existing code.
 * New code should use the specific hooks from useTanStackQuery.ts instead.
 *
 * @example
 * ```tsx
 * // Old pattern (still works)
 * function usePageBlocks(pageId: string) {
 *   const queryFn = useCallback(
 *     () => blockService.getByPage(pageId),
 *     [pageId]
 *   );
 *   return useCozoQuery(['blocks', 'byPage', pageId], queryFn);
 * }
 *
 * // New pattern (preferred)
 * import { usePageBlocks } from './useTanStackQuery.js';
 * const { data: blocks, isLoading } = usePageBlocks(pageId);
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { queryClient } from '../lib/queryClient.js';

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
 * Clear all query cache entries.
 * Exported for testing purposes.
 * @internal
 */
export const clearQueryCache = (): void => {
  queryClient.clear();
};

/**
 * Invalidate queries by key prefix.
 * Exported for use in mutation functions.
 *
 * Now uses TanStack Query's queryClient.invalidateQueries() under the hood.
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
export const invalidateQueries = (keyPrefix: string[]): void => {
  queryClient.invalidateQueries({ queryKey: keyPrefix });
};

/**
 * React hook for executing CozoDB queries with automatic caching and invalidation.
 *
 * Now powered by TanStack Query for stable identity guarantees.
 * This fixes the infinite re-render loop bug caused by Zustand selectors.
 *
 * Features:
 * - Automatic caching based on query key
 * - Loading, error, and data states
 * - Re-execution on invalidation
 * - Conditional execution via enabled option
 * - Stable reference identity (no cascading re-renders)
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
  const enabled = options?.enabled ?? true;

  // Store queryFn in a ref to maintain stable reference for TanStack Query.
  // This prevents unnecessary re-fetches when queryFn identity changes
  // (e.g., when a parent component re-renders).
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  // Use TanStack Query's useQuery hook
  const result = useQuery({
    queryKey: key,
    queryFn: () => queryFnRef.current(),
    enabled,
  });

  // Return in the same format as the old Zustand-based implementation
  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error as Error | null,
  };
}
