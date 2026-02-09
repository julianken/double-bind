/**
 * Shared test utilities for TanStack Query
 *
 * Usage in tests:
 * - Import createTestQueryClient for creating a properly-configured QueryClient
 * - Import cleanupTestQueries in afterEach for proper cleanup
 */
import { QueryClient } from '@tanstack/react-query';
import { clearQueryCache } from '../../src/hooks/useCozoQuery.js';

/**
 * Creates a QueryClient configured for testing.
 * Uses gcTime: 0 to ensure queries are garbage collected immediately,
 * preventing memory accumulation across tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0, // Immediate GC to prevent memory accumulation
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Cleans up test queries. Call in afterEach.
 * @param queryClient - Optional specific QueryClient to clear
 */
export function cleanupTestQueries(queryClient?: QueryClient): void {
  if (queryClient) {
    queryClient.clear();
  }
  clearQueryCache(); // Also clear the global cache
}
