/**
 * useGraphData - Hook for fetching graph data (full or neighborhood view)
 *
 * Provides two modes:
 * - Full graph: All pages and links
 * - Local graph: Pages within N hops of a center page
 *
 * @example
 * ```tsx
 * const { nodes, edges, loading, error } = useGraphData({
 *   mode: 'local',
 *   centerPageId: 'page-123',
 *   depth: 1,
 * });
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import type { PageId } from '@double-bind/types';
import type { MobileGraphNode, MobileGraphEdge } from '../components/graph';
import { useDatabase } from './useDatabase';

/**
 * Options for graph data fetching.
 */
export interface UseGraphDataOptions {
  /** Graph mode: 'full' shows all pages, 'local' shows neighborhood */
  mode: 'full' | 'local';
  /** Center page ID (required for 'local' mode) */
  centerPageId?: PageId;
  /** Depth of neighborhood for 'local' mode (default: 1) */
  depth?: number;
}

/**
 * Result from useGraphData hook.
 */
export interface UseGraphDataResult {
  /** Array of graph nodes */
  nodes: MobileGraphNode[];
  /** Array of graph edges */
  edges: MobileGraphEdge[];
  /** Loading state */
  loading: boolean;
  /** Error message if query failed */
  error: string | null;
  /** Refresh the graph data */
  refresh: () => void;
}

/**
 * Hook to fetch and manage graph data.
 *
 * @param options - Configuration for graph data fetching
 * @returns Graph data, loading state, and error state
 */
export function useGraphData(options: UseGraphDataOptions): UseGraphDataResult {
  const { db, status, error: dbError } = useDatabase();
  const { mode, centerPageId, depth = 1 } = options;

  const [nodes, setNodes] = useState<MobileGraphNode[]>([]);
  const [edges, setEdges] = useState<MobileGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh callback
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Load graph data
  useEffect(() => {
    let isMounted = true;

    async function loadGraphData() {
      if (!db || status !== 'ready') return;

      // Validate requirements for local mode
      if (mode === 'local' && !centerPageId) {
        if (isMounted) {
          setError('centerPageId is required for local graph mode');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (mode === 'full') {
          // Full graph: query all pages and links
          const pagesResult = await db.query(
            `?[pageId, title] := *page{pageId, title, isDeleted}, isDeleted = false`
          );

          const linksResult = await db.query(`?[sourceId, targetId] := *link{sourceId, targetId}`);

          if (!isMounted) return;

          // Transform to graph format
          const graphNodes: MobileGraphNode[] = pagesResult.rows
            .filter((row): row is [string, string] => {
              return Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string';
            })
            .map((row) => {
              const [pageId, title] = row;
              return {
                id: pageId,
                title: title || 'Untitled',
              };
            });

          // Create edge map to detect bidirectional links
          const edgeSet = new Set<string>();
          const graphEdges: MobileGraphEdge[] = [];

          for (const row of linksResult.rows) {
            if (
              !Array.isArray(row) ||
              row.length < 2 ||
              typeof row[0] !== 'string' ||
              typeof row[1] !== 'string'
            ) {
              continue;
            }
            const [sourceId, targetId] = row;
            const key = `${sourceId}-${targetId}`;
            const reverseKey = `${targetId}-${sourceId}`;

            if (edgeSet.has(reverseKey)) {
              // Mark existing edge as bidirectional
              const existingEdge = graphEdges.find(
                (e) => e.source === targetId && e.target === sourceId
              );
              if (existingEdge) {
                existingEdge.isBidirectional = true;
              }
            } else {
              edgeSet.add(key);
              graphEdges.push({
                source: sourceId,
                target: targetId,
              });
            }
          }

          if (isMounted) {
            setNodes(graphNodes);
            setEdges(graphEdges);
          }
        } else {
          // Local graph: query neighborhood within depth hops
          // This uses recursive Datalog to find connected pages
          const neighborQuery = `
            ?[pageId, title] :=
              *page{pageId, title, isDeleted},
              isDeleted = false,
              reachable[pageId, ${depth}]

            reachable[pageId, 0] :=
              pageId = "${centerPageId}"

            reachable[pageId, depth] :=
              reachable[fromId, prevDepth],
              prevDepth < ${depth},
              depth = prevDepth + 1,
              (*link{sourceId: fromId, targetId: pageId} ; *link{sourceId: pageId, targetId: fromId})
          `;

          const pagesResult = await db.query(neighborQuery);

          // Query links between visible pages
          const pageIds = pagesResult.rows
            .filter((row): row is [string, string] => Array.isArray(row) && typeof row[0] === 'string')
            .map((row) => row[0]);

          const linksQuery = `
            ?[sourceId, targetId] :=
              *link{sourceId, targetId},
              sourceId in $pageIds,
              targetId in $pageIds
          `;

          const linksResult = await db.query(linksQuery, { pageIds });

          if (!isMounted) return;

          // Transform to graph format
          const graphNodes: MobileGraphNode[] = pagesResult.rows
            .filter((row): row is [string, string] => {
              return Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string';
            })
            .map((row) => {
              const [pageId, title] = row;
              return {
                id: pageId,
                title: title || 'Untitled',
              };
            });

          // Create edges
          const edgeSet = new Set<string>();
          const graphEdges: MobileGraphEdge[] = [];

          for (const row of linksResult.rows) {
            if (
              !Array.isArray(row) ||
              row.length < 2 ||
              typeof row[0] !== 'string' ||
              typeof row[1] !== 'string'
            ) {
              continue;
            }
            const [sourceId, targetId] = row;
            const key = `${sourceId}-${targetId}`;
            const reverseKey = `${targetId}-${sourceId}`;

            if (edgeSet.has(reverseKey)) {
              const existingEdge = graphEdges.find(
                (e) => e.source === targetId && e.target === sourceId
              );
              if (existingEdge) {
                existingEdge.isBidirectional = true;
              }
            } else {
              edgeSet.add(key);
              graphEdges.push({
                source: sourceId,
                target: targetId,
              });
            }
          }

          if (isMounted) {
            setNodes(graphNodes);
            setEdges(graphEdges);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadGraphData();

    return () => {
      isMounted = false;
    };
  }, [db, status, mode, centerPageId, depth, refreshKey]);

  return {
    nodes,
    edges,
    loading,
    error: error || dbError || null,
    refresh,
  };
}
