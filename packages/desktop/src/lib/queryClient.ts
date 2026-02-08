/**
 * TanStack Query Client Configuration
 *
 * Provides a configured QueryClient instance for the desktop application.
 * Optimized for local-first architecture where data is already on disk:
 * - No network retries (local DB - no transient failures)
 * - No refetch on window focus (no server to sync with)
 * - Reasonable stale time to batch rapid navigation
 * - GC time to support back/forward navigation
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Pre-configured QueryClient for the desktop application.
 *
 * Configuration rationale:
 * - staleTime (30s): Prevents rapid re-fetches during navigation.
 *   Since data is local, "stale" really means "might have been mutated elsewhere".
 * - gcTime (5min): Keeps data in cache for back/forward navigation.
 *   Users can revisit recent pages without re-fetching.
 * - retry: false: Local database queries don't have transient failures.
 *   If a query fails, retrying won't help.
 * - refetchOnWindowFocus: false: No server to sync with.
 *   We invalidate queries explicitly after mutations.
 * - refetchOnReconnect: false: Local-first means no network dependency.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - batch rapid navigation
      gcTime: 5 * 60 * 1000, // 5 minutes - keep for back/forward
      retry: false, // Local DB - no retry needed
      refetchOnWindowFocus: false, // Local-first - no network sync
      refetchOnReconnect: false, // Local-first - no network dependency
    },
    mutations: {
      retry: false, // Local DB - no retry needed
    },
  },
});

/**
 * Get the query client instance.
 * Useful for imperative access (e.g., in event handlers, tests).
 */
export function getQueryClient(): QueryClient {
  return queryClient;
}
