/**
 * Type-safe Query Key Factory for TanStack Query
 *
 * Provides structured, hierarchical query keys for cache management.
 * Keys follow the pattern: [domain, scope?, ...params]
 *
 * Benefits:
 * - Type safety: TypeScript ensures correct key structure
 * - Hierarchical invalidation: Invalidate `['pages']` to clear all page queries
 * - Predictable caching: Same inputs = same cache entry
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */

import type { PageId, BlockId } from '@double-bind/types';

/**
 * Query keys for page-related queries.
 */
export const pageKeys = {
  /** All page queries - use for broad invalidation */
  all: ['pages'] as const,

  /** List of all pages (for sidebar) */
  lists: () => [...pageKeys.all, 'list'] as const,

  /** Single page detail */
  detail: (pageId: PageId) => [...pageKeys.all, 'detail', pageId] as const,

  /** Page with all its blocks (for PageView) */
  withBlocks: (pageId: PageId) => [...pageKeys.all, 'withBlocks', pageId] as const,

  /** Backlinks for a specific page */
  backlinks: (pageId: PageId) => [...pageKeys.all, 'backlinks', pageId] as const,
} as const;

/**
 * Query keys for block-related queries.
 */
export const blockKeys = {
  /** All block queries - use for broad invalidation */
  all: ['blocks'] as const,

  /** Single block detail */
  detail: (blockId: BlockId) => [...blockKeys.all, 'detail', blockId] as const,

  /** Children of a specific block */
  children: (blockId: BlockId) => [...blockKeys.all, 'children', blockId] as const,

  /** All blocks for a page (flat list) */
  byPage: (pageId: PageId) => [...blockKeys.all, 'byPage', pageId] as const,
} as const;

/**
 * Query keys for daily note queries.
 *
 * CRITICAL: These use date strings (YYYY-MM-DD) instead of pageId.
 * This provides stability during initial render before the daily note
 * page is created/loaded, avoiding the key instability that caused
 * the infinite loop bug.
 */
export const dailyNoteKeys = {
  /** All daily note queries */
  all: ['dailyNote'] as const,

  /** Daily note with blocks for a specific date */
  withBlocks: (dateString: string) => [...dailyNoteKeys.all, 'withBlocks', dateString] as const,
} as const;

/**
 * Query keys for graph-related queries.
 */
export const graphKeys = {
  /** All graph queries */
  all: ['graph'] as const,

  /** Full graph (all nodes and edges) */
  full: () => [...graphKeys.all, 'full'] as const,

  /** PageRank scores */
  pageRank: () => [...graphKeys.all, 'pageRank'] as const,

  /** Community detection results */
  communities: () => [...graphKeys.all, 'communities'] as const,

  /** Neighborhood around a page */
  neighborhood: (pageId: PageId, hops: number) =>
    [...graphKeys.all, 'neighborhood', pageId, hops] as const,
} as const;

/**
 * Query keys for saved queries.
 */
export const savedQueryKeys = {
  /** All saved query queries */
  all: ['savedQueries'] as const,

  /** List of saved queries */
  list: () => [...savedQueryKeys.all, 'list'] as const,

  /** Single saved query detail */
  detail: (queryId: string) => [...savedQueryKeys.all, 'detail', queryId] as const,
} as const;

/**
 * Query keys for search queries.
 */
export const searchKeys = {
  /** All search queries */
  all: ['search'] as const,

  /** Search results for a query string */
  results: (query: string) => [...searchKeys.all, 'results', query] as const,
} as const;

/**
 * Query keys for link-related queries.
 * Used for the links relation in the graph.
 */
export const linkKeys = {
  /** All link queries */
  all: ['links'] as const,
} as const;

/**
 * Combined query keys export for convenience.
 */
export const queryKeys = {
  pages: pageKeys,
  blocks: blockKeys,
  dailyNote: dailyNoteKeys,
  graph: graphKeys,
  savedQueries: savedQueryKeys,
  search: searchKeys,
  links: linkKeys,
} as const;
