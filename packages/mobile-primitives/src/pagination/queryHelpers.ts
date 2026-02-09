/**
 * Query helpers for CozoDB cursor-based pagination.
 *
 * Provides utilities to build paginated Datalog queries with LIMIT and cursor support.
 */

import type { PaginatedResult, PaginationOptions } from '@double-bind/types';

/**
 * Default page size for queries.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum page size to prevent memory issues.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Options for building paginated queries.
 */
export interface BuildPaginatedQueryOptions extends PaginationOptions {
  /** Base Datalog query (without pagination) */
  baseQuery: string;

  /** Column name to use for cursor (typically an ID or timestamp) */
  cursorColumn: string;

  /** Sort order: 'asc' or 'desc' (default: 'desc' for newest first) */
  sortOrder?: 'asc' | 'desc';

  /** Additional parameters for the query */
  params?: Record<string, unknown>;
}

/**
 * Build a paginated Datalog query with cursor support.
 *
 * @param options - Query building options
 * @returns Complete Datalog script with pagination
 *
 * @example
 * ```ts
 * const query = buildPaginatedQuery({
 *   baseQuery: `
 *     ?[page_id, title, created_at, updated_at] :=
 *       *pages{ page_id, title, created_at, updated_at, is_deleted },
 *       is_deleted == false
 *   `,
 *   cursorColumn: 'updated_at',
 *   sortOrder: 'desc',
 *   pageSize: 20,
 *   cursor: '1234567890'
 * });
 * ```
 */
export function buildPaginatedQuery(options: BuildPaginatedQueryOptions): string {
  const {
    baseQuery,
    cursorColumn,
    sortOrder = 'desc',
    pageSize = DEFAULT_PAGE_SIZE,
    cursor,
  } = options;

  // Validate cursorColumn to prevent injection
  if (!/^[a-z_][a-z0-9_]*$/i.test(cursorColumn)) {
    throw new Error(
      `Invalid cursorColumn: "${cursorColumn}". Must match pattern /^[a-z_][a-z0-9_]*$/i`
    );
  }

  // Clamp page size
  const clampedPageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

  // Fetch one extra item to determine if there are more pages
  const fetchSize = clampedPageSize + 1;

  // Build the query with cursor condition if provided
  let query = baseQuery.trim();

  // Add cursor filter
  if (cursor) {
    const cursorOperator = sortOrder === 'desc' ? '<' : '>';
    query += `,\n    ${cursorColumn} ${cursorOperator} $cursor`;
  }

  // Add ordering
  const orderPrefix = sortOrder === 'desc' ? '-' : '';
  query += `\n:order ${orderPrefix}${cursorColumn}`;

  // Add limit
  query += `\n:limit ${fetchSize}`;

  return query;
}

/**
 * Extract pagination result from query rows.
 *
 * Determines if there are more pages by checking if we fetched more items
 * than requested. The last item becomes the cursor for the next page.
 *
 * @param rows - Query result rows
 * @param cursorColumnIndex - Index of cursor column in results
 * @param pageSize - Requested page size
 * @returns Paginated result with cursor information
 *
 * @example
 * ```ts
 * const result = await db.query(query, { cursor });
 * const paginated = extractPaginatedResult(
 *   result.rows,
 *   3, // cursor column index
 *   20 // page size
 * );
 * ```
 */
export function extractPaginatedResult<T>(
  rows: unknown[][],
  cursorColumnIndex: number,
  pageSize: number
): PaginatedResult<T> {
  // Validate cursorColumnIndex
  if (cursorColumnIndex < 0) {
    throw new Error(`cursorColumnIndex must be non-negative, got: ${cursorColumnIndex}`);
  }

  const hasMore = rows.length > pageSize;
  const items = (hasMore ? rows.slice(0, pageSize) : rows) as T[];

  // Extract cursor from last item if there are more pages
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = rows[pageSize] as unknown[];

    // Validate cursorColumnIndex is within bounds
    if (cursorColumnIndex >= lastItem.length) {
      throw new Error(
        `cursorColumnIndex ${cursorColumnIndex} is out of bounds for row with ${lastItem.length} columns`
      );
    }

    const cursorValue = lastItem[cursorColumnIndex];

    // Convert cursor to string
    if (typeof cursorValue === 'string') {
      nextCursor = cursorValue;
    } else if (typeof cursorValue === 'number') {
      nextCursor = cursorValue.toString();
    } else if (cursorValue !== null && cursorValue !== undefined) {
      nextCursor = String(cursorValue);
    }
  }

  return {
    items,
    totalCount: null, // Cursor-based pagination doesn't provide total count
    nextCursor,
    hasMore,
    pageSize,
  };
}

/**
 * Build query parameters including cursor.
 *
 * @param cursor - Pagination cursor
 * @param additionalParams - Additional query parameters
 * @returns Complete parameter object for query
 */
export function buildQueryParams(
  cursor: string | undefined,
  additionalParams: Record<string, unknown> = {}
): Record<string, unknown> {
  const params: Record<string, unknown> = { ...additionalParams };

  if (cursor) {
    params.cursor = cursor;
  }

  return params;
}

/**
 * Create a page fetcher function for a specific query.
 *
 * @param queryBuilder - Function that builds the query string
 * @param queryExecutor - Function that executes queries
 * @param cursorColumnIndex - Index of cursor column in results
 * @returns Page fetcher function for use with usePaginatedQuery
 *
 * @example
 * ```ts
 * const fetcher = createPageFetcher(
 *   (options) => buildPaginatedQuery({
 *     baseQuery: '...',
 *     cursorColumn: 'updated_at',
 *     ...options
 *   }),
 *   (query, params) => db.query(query, params),
 *   3 // cursor column index
 * );
 *
 * const query = usePaginatedQuery(fetcher);
 * ```
 */
export function createPageFetcher<T>(
  queryBuilder: (options: PaginationOptions) => string,
  queryExecutor: (query: string, params: Record<string, unknown>) => Promise<{ rows: unknown[][] }>,
  cursorColumnIndex: number
): (options: PaginationOptions) => Promise<PaginatedResult<T>> {
  return async (options: PaginationOptions): Promise<PaginatedResult<T>> => {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const query = queryBuilder(options);
    const params = buildQueryParams(options.cursor);

    const result = await queryExecutor(query, params);

    return extractPaginatedResult<T>(result.rows, cursorColumnIndex, pageSize);
  };
}
