/**
 * useNeighborhood - Hook for fetching page neighborhood data for MiniGraph visualization.
 *
 * Fetches the N-hop neighborhood of a page via GraphService and transforms the data
 * into the format expected by MiniGraph component.
 *
 * @example
 * ```tsx
 * function SidebarGraph({ pageId }: { pageId: string }) {
 *   const { nodes, edges, isLoading } = useNeighborhood(pageId, 2);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <MiniGraph
 *       centerNodeId={pageId}
 *       nodes={nodes}
 *       edges={edges}
 *       onNodeClick={(id) => navigate(id)}
 *     />
 *   );
 * }
 * ```
 */

import { useCallback } from 'react';
import type { PageId } from '@double-bind/types';
import type { MiniGraphNode, MiniGraphEdge } from '@double-bind/ui-primitives';
import { useServices } from '../providers/ServiceProvider.js';
import { useCozoQuery } from './useCozoQuery.js';

/**
 * Result type for useNeighborhood hook.
 */
export interface UseNeighborhoodResult {
  /** Nodes for MiniGraph visualization */
  nodes: MiniGraphNode[];
  /** Edges for MiniGraph visualization */
  edges: MiniGraphEdge[];
  /** Whether the data is being fetched */
  isLoading: boolean;
}

/**
 * Hook to fetch page neighborhood data for MiniGraph visualization.
 *
 * @param pageId - The center page ID (null when no page is selected)
 * @param hops - Number of hops to traverse (e.g., 2 for 2-hop neighborhood)
 * @returns Object with nodes, edges, and loading state
 */
export function useNeighborhood(pageId: PageId | null, hops: number): UseNeighborhoodResult {
  const { graphService } = useServices();

  const queryFn = useCallback(async () => {
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
  }, [graphService, pageId, hops]);

  const { data, isLoading } = useCozoQuery(['neighborhood', pageId ?? '', String(hops)], queryFn, {
    enabled: pageId !== null,
  });

  return {
    nodes: data?.nodes ?? [],
    edges: data?.edges ?? [],
    isLoading: pageId !== null && isLoading,
  };
}
