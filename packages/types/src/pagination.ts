/**
 * Pagination types for query result handling.
 *
 * Provides cursor-based pagination for efficient memory usage
 * when dealing with large result sets.
 */

/**
 * Cursor for pagination position.
 * Can be a ULID, timestamp, or composite key.
 */
export type PaginationCursor = string;

/**
 * Page size for query results.
 */
export type PageSize = number;

/**
 * Configuration for paginated queries.
 */
export interface PaginationOptions {
  /** Number of items per page (default: 20) */
  pageSize?: PageSize;

  /** Cursor for next page (omit for first page) */
  cursor?: PaginationCursor;
}

/**
 * Result of a paginated query.
 */
export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];

  /** Total count of items (if known, null for cursor-based pagination) */
  totalCount: number | null;

  /** Cursor for the next page (null if no more pages) */
  nextCursor: PaginationCursor | null;

  /** Whether there are more pages available */
  hasMore: boolean;

  /** Current page size */
  pageSize: PageSize;
}

/**
 * Paginated query state for React hooks.
 */
export interface PaginatedQueryState<T> {
  /** All loaded items (accumulated across pages) */
  items: T[];

  /** Whether currently fetching a page */
  loading: boolean;

  /** Error from last fetch (null if no error) */
  error: Error | null;

  /** Whether there are more pages to fetch */
  hasMore: boolean;

  /** Current cursor position */
  cursor: PaginationCursor | null;

  /** Total items loaded so far */
  loadedCount: number;

  /** Whether this is the initial load */
  isInitialLoad: boolean;
}

/**
 * Actions for managing paginated query state.
 */
export interface PaginatedQueryActions {
  /** Fetch the next page of results */
  fetchNextPage: () => Promise<void>;

  /** Reset to first page and clear all data */
  reset: () => void;

  /** Refresh current data (re-fetch from start) */
  refresh: () => Promise<void>;

  /** Retry after error */
  retry: () => Promise<void>;
}

/**
 * Complete paginated query interface.
 */
export interface PaginatedQuery<T> extends PaginatedQueryState<T>, PaginatedQueryActions {}

/**
 * Function that fetches a page of results.
 */
export type PageFetcher<T> = (options: PaginationOptions) => Promise<PaginatedResult<T>>;

/**
 * Options for infinite scroll behavior.
 */
export interface InfiniteScrollOptions {
  /** Trigger threshold (0-1, where 0 is top, 1 is bottom) */
  threshold?: number;

  /** Whether scroll is enabled */
  enabled?: boolean;

  /** Root margin for intersection observer (CSS string) */
  rootMargin?: string;
}
