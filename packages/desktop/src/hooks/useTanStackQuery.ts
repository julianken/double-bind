/**
 * TanStack Query Hooks for CozoDB
 *
 * This module provides TanStack Query-based hooks that replace the custom
 * Zustand-backed useCozoQuery hook. The migration fixes the infinite re-render
 * loop bug caused by Zustand selector reference instability.
 *
 * Key differences from useCozoQuery:
 * - Uses TanStack Query's stable identity guarantees
 * - Query keys are structured and hierarchical
 * - Invalidation uses queryClient.invalidateQueries()
 * - No custom Zustand store for query cache
 *
 * @see /docs/decisions/014-tanstack-query-migration.md (to be created)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Block, Page, PageId, BlockId } from '@double-bind/types';
import type { PageBacklink } from '@double-bind/core';
import type { LinkedRef, UnlinkedRef, MiniGraphNode, MiniGraphEdge } from '@double-bind/ui-primitives';
import { useServices } from '../providers/ServiceProvider.js';
import { queryKeys, pageKeys, blockKeys, dailyNoteKeys, graphKeys, savedQueryKeys } from '../lib/queryKeys.js';
import { queryClient } from '../lib/queryClient.js';

// ============================================================================
// Page Hooks
// ============================================================================

/**
 * Hook to fetch all pages (for sidebar page list).
 *
 * @param options - Query options
 * @returns Query result with array of pages
 */
export function usePages(options?: { limit?: number }) {
  const { pageService } = useServices();
  const limit = options?.limit ?? 100;

  return useQuery({
    queryKey: pageKeys.lists(),
    queryFn: () => pageService.getAllPages({ limit }),
  });
}

/**
 * Hook to fetch a page with all its blocks.
 *
 * @param pageId - The page ID to fetch
 * @returns Query result with PageWithBlocks
 */
export function usePageWithBlocks(pageId: PageId) {
  const { pageService } = useServices();

  return useQuery({
    queryKey: pageKeys.withBlocks(pageId),
    queryFn: () => pageService.getPageWithBlocks(pageId),
    enabled: !!pageId,
    // Always refetch on mount to ensure fresh data after navigation.
    // This fixes the race condition where blur-triggered saves complete
    // after navigation, leaving stale data in the cache.
    refetchOnMount: 'always',
  });
}

/**
 * Hook to fetch backlinks for a page.
 *
 * @param pageId - The page ID to fetch backlinks for
 * @returns Object containing linkedRefs, unlinkedRefs, and loading state
 */
export function useBacklinks(pageId: PageId): {
  linkedRefs: LinkedRef[];
  unlinkedRefs: UnlinkedRef[];
  isLoading: boolean;
} {
  const { pageService } = useServices();

  const { data, isLoading } = useQuery({
    queryKey: pageKeys.backlinks(pageId),
    queryFn: () => pageService.getPageBacklinks(pageId),
    enabled: !!pageId,
  });

  // Transform the PageBacklink[] into LinkedRef[] format
  const linkedRefs: LinkedRef[] = data
    ? data.map((backlink: PageBacklink) => ({
        block: backlink.block,
        page: backlink.page,
      }))
    : [];

  // Unlinked references are not yet implemented
  const unlinkedRefs: UnlinkedRef[] = [];

  return {
    linkedRefs,
    unlinkedRefs,
    isLoading,
  };
}

// ============================================================================
// Block Hooks
// ============================================================================

/**
 * Hook to fetch a single block by ID.
 *
 * @param blockId - The block ID to fetch
 * @returns Query result with block data
 */
export function useBlock(blockId: BlockId) {
  const { blockService } = useServices();

  return useQuery({
    queryKey: blockKeys.detail(blockId),
    queryFn: () => blockService.getById(blockId),
    enabled: !!blockId,
  });
}

/**
 * Hook to fetch children of a block.
 *
 * @param blockId - The parent block ID
 * @param pageId - The page ID (required for query)
 * @returns Query result with array of child blocks
 */
export function useBlockChildren(blockId: BlockId, pageId: PageId | undefined) {
  const { blockService } = useServices();

  return useQuery({
    queryKey: blockKeys.children(blockId),
    queryFn: () => blockService.getChildren(blockId, pageId!),
    enabled: !!blockId && !!pageId,
  });
}

/**
 * Hook to fetch all blocks for a page (flat list).
 *
 * @param pageId - The page ID
 * @returns Query result with array of blocks
 */
export function usePageBlocks(pageId: PageId) {
  const { pageService } = useServices();

  return useQuery({
    queryKey: blockKeys.byPage(pageId),
    queryFn: async (): Promise<Block[]> => {
      const { blocks } = await pageService.getPageWithBlocks(pageId);
      return blocks;
    },
    enabled: !!pageId,
  });
}

// ============================================================================
// Daily Note Hooks
// ============================================================================

/**
 * Get today's date in ISO format (YYYY-MM-DD).
 */
export function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Hook to fetch today's daily note with all its blocks.
 *
 * CRITICAL: This hook uses a date-based query key instead of pageId-based key.
 * This provides stability during initial render:
 * - Old approach: Key changed from ['blocks', 'byPage', ''] to ['blocks', 'byPage', actualId]
 *   during mount, causing query re-execution and cascading re-renders.
 * - New approach: Key is ['dailyNote', 'withBlocks', '2025-02-08'] from first render,
 *   stable throughout the component lifecycle.
 *
 * @param dateString - Optional date string (defaults to today)
 * @returns Query result with page and blocks
 */
export function useDailyNoteWithBlocks(dateString?: string): {
  page: Page | null;
  blocks: Block[];
  isLoading: boolean;
  error: Error | null;
} {
  const { pageService } = useServices();
  const date = dateString ?? getTodayISODate();

  const { data, isLoading, error } = useQuery({
    queryKey: dailyNoteKeys.withBlocks(date),
    queryFn: async () => {
      // Get or create today's daily note
      const page = await pageService.getTodaysDailyNote();
      // Fetch blocks for the page
      const { blocks } = await pageService.getPageWithBlocks(page.pageId);
      return { page, blocks };
    },
    // Always refetch on mount to ensure fresh data after navigation.
    // This fixes the race condition where blur-triggered saves complete
    // after navigation, leaving stale data in the cache.
    refetchOnMount: 'always',
  });

  return {
    page: data?.page ?? null,
    blocks: data?.blocks ?? [],
    isLoading,
    error: error as Error | null,
  };
}

// ============================================================================
// Graph Hooks
// ============================================================================

/**
 * Hook to fetch the full graph (all nodes and edges).
 *
 * @returns Query result with nodes and edges
 */
export function useFullGraph() {
  const { graphService } = useServices();

  return useQuery({
    queryKey: graphKeys.full(),
    queryFn: () => graphService.getFullGraph(),
  });
}

/**
 * Hook to fetch PageRank scores.
 *
 * @returns Query result with PageRank map
 */
export function usePageRank() {
  const { graphService } = useServices();

  return useQuery({
    queryKey: graphKeys.pageRank(),
    queryFn: () => graphService.getPageRank(),
  });
}

/**
 * Hook to fetch community assignments.
 *
 * @returns Query result with community map
 */
export function useCommunities() {
  const { graphService } = useServices();

  return useQuery({
    queryKey: graphKeys.communities(),
    queryFn: () => graphService.getCommunities(),
  });
}

/**
 * Hook to fetch page neighborhood data for MiniGraph visualization.
 *
 * @param pageId - The center page ID (null when no page is selected)
 * @param hops - Number of hops to traverse
 * @returns Object with nodes, edges, and loading state
 */
export function useNeighborhood(
  pageId: PageId | null,
  hops: number
): {
  nodes: MiniGraphNode[];
  edges: MiniGraphEdge[];
  isLoading: boolean;
} {
  const { graphService } = useServices();

  const { data, isLoading } = useQuery({
    queryKey: graphKeys.neighborhood(pageId ?? '', hops),
    queryFn: async () => {
      if (!pageId) {
        return { nodes: [], edges: [] };
      }

      const result = await graphService.getNeighborhood(pageId, hops);

      // Transform Page[] to MiniGraphNode[]
      const nodes: MiniGraphNode[] = result.nodes.map((page) => ({
        id: page.pageId,
        title: page.title,
      }));

      // Transform Link[] to MiniGraphEdge[]
      const edges: MiniGraphEdge[] = result.edges.map((link) => ({
        source: link.sourceId,
        target: link.targetId,
      }));

      return { nodes, edges };
    },
    enabled: pageId !== null,
  });

  return {
    nodes: data?.nodes ?? [],
    edges: data?.edges ?? [],
    isLoading: pageId !== null && isLoading,
  };
}

// ============================================================================
// Saved Queries Hooks
// ============================================================================

/**
 * Hook to fetch saved queries list.
 *
 * @param options - Query options
 * @returns Query result with array of saved queries
 */
export function useSavedQueries(options?: { limit?: number }) {
  const { savedQueryService } = useServices();
  const limit = options?.limit ?? 100;

  return useQuery({
    queryKey: savedQueryKeys.list(),
    queryFn: () => savedQueryService.list({ limit }),
  });
}

// ============================================================================
// Invalidation Utilities
// ============================================================================

/**
 * Invalidate queries by key pattern.
 * This is the TanStack Query replacement for the old invalidateQueries function.
 *
 * @param keyPrefix - Array of key segments to match
 *
 * @example
 * ```typescript
 * // Invalidate all page queries
 * invalidateQueries(['pages']);
 *
 * // Invalidate specific page
 * invalidateQueries(['pages', 'withBlocks', pageId]);
 *
 * // Invalidate all block queries
 * invalidateQueries(['blocks']);
 * ```
 */
export function invalidateQueries(keyPrefix: readonly string[]): void {
  queryClient.invalidateQueries({ queryKey: keyPrefix as string[] });
}

/**
 * Hook to get query invalidation functions.
 * Useful for components that need to invalidate queries after mutations.
 *
 * @returns Object with invalidation functions
 */
export function useQueryInvalidation() {
  const qc = useQueryClient();

  return useMemo(
    () => ({
      /** Invalidate all page-related queries */
      invalidatePages: () => qc.invalidateQueries({ queryKey: pageKeys.all }),

      /** Invalidate a specific page's data */
      invalidatePage: (pageId: PageId) => {
        qc.invalidateQueries({ queryKey: pageKeys.withBlocks(pageId) });
        qc.invalidateQueries({ queryKey: pageKeys.backlinks(pageId) });
      },

      /** Invalidate all block-related queries */
      invalidateBlocks: () => qc.invalidateQueries({ queryKey: blockKeys.all }),

      /** Invalidate blocks for a specific page */
      invalidatePageBlocks: (pageId: PageId) => {
        qc.invalidateQueries({ queryKey: blockKeys.byPage(pageId) });
        qc.invalidateQueries({ queryKey: pageKeys.withBlocks(pageId) });
      },

      /** Invalidate daily note queries */
      invalidateDailyNotes: () => qc.invalidateQueries({ queryKey: dailyNoteKeys.all }),

      /** Invalidate graph-related queries */
      invalidateGraph: () => qc.invalidateQueries({ queryKey: graphKeys.all }),

      /** Invalidate saved queries list */
      invalidateSavedQueries: () => qc.invalidateQueries({ queryKey: savedQueryKeys.all }),

      /** Invalidate search results */
      invalidateSearch: () => qc.invalidateQueries({ queryKey: queryKeys.search.all }),

      /** Invalidate links (for backlinks recalculation) */
      invalidateLinks: () => qc.invalidateQueries({ queryKey: queryKeys.links.all }),

      /** Invalidate everything - use sparingly */
      invalidateAll: () => qc.invalidateQueries(),
    }),
    [qc]
  );
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Shim for the old useCozoQuery hook signature.
 * This allows gradual migration by keeping the same API.
 *
 * @deprecated Use the specific hooks (usePageWithBlocks, useBlock, etc.) instead.
 *
 * @param key - Query key array
 * @param queryFn - Query function
 * @param options - Query options
 * @returns Query result matching old useCozoQuery signature
 */
export function useCozoQueryShim<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean }
): { data: T | undefined; isLoading: boolean; error: Error | null } {
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn,
    enabled: options?.enabled ?? true,
  });

  return {
    data,
    isLoading,
    error: error as Error | null,
  };
}
