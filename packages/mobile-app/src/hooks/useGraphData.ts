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
            `?[page_id, title] := *pages{page_id, title, is_deleted}, is_deleted == false`
          );

          const linksResult = await db.query(
            `?[source_id, target_id] := *links{source_id, target_id}`
          );

          if (!isMounted) return;

          // Transform to graph format
          const graphNodes: MobileGraphNode[] = pagesResult.rows
            .filter((row): row is [string, string] => {
              return Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string';
            })
            .map((row) => {
              const [page_id, title] = row;
              return {
                id: page_id,
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
          // Local graph: query direct neighbors of center page
          // Get the center page first
          const centerQuery = `
?[page_id, title] :=
  *pages{page_id, title, is_deleted},
  page_id == $centerPageId,
  is_deleted == false
`;
          const centerResult = await db.query(centerQuery, { centerPageId });

          // Get pages linked FROM center (outgoing)
          const outgoingQuery = `
?[page_id, title] :=
  *links{source_id, target_id: page_id},
  source_id == $centerPageId,
  *pages{page_id, title, is_deleted},
  is_deleted == false
`;
          const outgoingResult = await db.query(outgoingQuery, { centerPageId });

          // Get pages linked TO center (incoming)
          const incomingQuery = `
?[page_id, title] :=
  *links{source_id: page_id, target_id},
  target_id == $centerPageId,
  *pages{page_id, title, is_deleted},
  is_deleted == false
`;
          const incomingResult = await db.query(incomingQuery, { centerPageId });

          // Combine all pages (center + outgoing + incoming), deduplicated
          const allPageRows = [
            ...centerResult.rows,
            ...outgoingResult.rows,
            ...incomingResult.rows,
          ];
          const seenIds = new Set<string>();
          const pagesResult = {
            rows: allPageRows.filter((row) => {
              if (!Array.isArray(row) || typeof row[0] !== 'string') return false;
              if (seenIds.has(row[0])) return false;
              seenIds.add(row[0]);
              return true;
            }),
          };

          // Query links between visible pages
          const visiblePageIds = pagesResult.rows
            .filter(
              (row): row is [string, string] => Array.isArray(row) && typeof row[0] === 'string'
            )
            .map((row) => row[0]);

          // Only query links if we have pages
          let linksResult = { rows: [] as unknown[][] };
          if (visiblePageIds.length > 0) {
            const linksQuery = `
?[source_id, target_id] :=
  *links{source_id, target_id},
  source_id in $visiblePageIds,
  target_id in $visiblePageIds
`;
            linksResult = await db.query(linksQuery, { visiblePageIds });
          }

          if (!isMounted) return;

          // Transform to graph format
          const graphNodes: MobileGraphNode[] = pagesResult.rows
            .filter((row): row is [string, string] => {
              return Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string';
            })
            .map((row) => {
              const [page_id, title] = row;
              return {
                id: page_id,
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
    // Always include centerPageId to keep dependency array size constant
    // (React requires stable array size between renders)
  }, [db, status, mode, centerPageId, depth, refreshKey]);

  return {
    nodes,
    edges,
    loading,
    error: error || dbError || null,
    refresh,
  };
}
