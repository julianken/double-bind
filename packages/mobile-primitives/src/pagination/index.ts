/**
 * @double-bind/mobile-primitives/pagination
 *
 * Cursor-based pagination utilities for efficient query result handling.
 */

// React hooks
export { usePaginatedQuery } from './usePaginatedQuery';
export { useInfiniteScroll, useScrollMonitor } from './useInfiniteScroll';

// Query helpers
export {
  buildPaginatedQuery,
  extractPaginatedResult,
  buildQueryParams,
  createPageFetcher,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type BuildPaginatedQueryOptions,
} from './queryHelpers';
