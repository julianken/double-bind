/**
 * GraphScreen - Knowledge graph visualization screen.
 *
 * Displays the full knowledge graph showing:
 * - All pages as nodes
 * - Links between pages as edges
 * - Interactive zoom (pinch) and pan
 * - Tap to select and navigate to nodes
 */

import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import type { PageId } from '@double-bind/types';
import type { GraphStackScreenProps } from '../navigation/types';
import { useDatabase } from '../hooks/useDatabase';
import { MobileGraph, type MobileGraphNode, type MobileGraphEdge } from '../components/graph';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components';

type Props = GraphStackScreenProps<'Graph'>;

/**
 * GraphScreen displays an interactive knowledge graph.
 *
 * Features:
 * - Loads all pages and links from the database
 * - Pinch-to-zoom for exploration
 * - Pan gesture for navigation
 * - Tap nodes to view details or navigate
 */
export function GraphScreen({ navigation }: Props): React.ReactElement {
  const { db, status, error: dbError } = useDatabase();
  const { width, height } = useWindowDimensions();
  const [nodes, setNodes] = useState<MobileGraphNode[]>([]);
  const [edges, setEdges] = useState<MobileGraphEdge[]>([]);
  const [centerNodeId, setCenterNodeId] = useState<PageId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate graph dimensions (full screen minus padding)
  const graphWidth = width - 32; // 16px padding on each side
  const graphHeight = height - 200; // Account for header and tab bar

  // Load graph data from database
  useEffect(() => {
    async function loadGraphData() {
      if (!db || status !== 'ready') return;

      try {
        setLoading(true);
        setError(null);

        // Query all pages - returns [pageId, title] rows
        const pagesResult = await db.query(
          `?[pageId, title] := *page{pageId, title, isDeleted}, isDeleted = false`
        );

        // Query all links - returns [sourceId, targetId] rows
        const linksResult = await db.query(`?[sourceId, targetId] := *link{sourceId, targetId}`);

        // Transform to graph format
        const graphNodes: MobileGraphNode[] = pagesResult.rows.map((row) => {
          const [pageId, title] = row as [string, string];
          return {
            id: pageId,
            title: title || 'Untitled',
          };
        });

        // Create edge map to detect bidirectional links
        const edgeSet = new Set<string>();
        const graphEdges: MobileGraphEdge[] = [];

        for (const row of linksResult.rows) {
          const [sourceId, targetId] = row as [string, string];
          const key = `${sourceId}-${targetId}`;
          const reverseKey = `${targetId}-${sourceId}`;

          // Check if reverse edge already exists
          if (edgeSet.has(reverseKey)) {
            // Mark the existing edge as bidirectional
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

        setNodes(graphNodes);
        setEdges(graphEdges);

        // Set center node to the first page (or a specific one if available)
        if (graphNodes.length > 0) {
          setCenterNodeId(graphNodes[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadGraphData();
  }, [db, status]);

  // Handle node press - navigate to node details
  const handleNodePress = useCallback(
    (nodeId: PageId) => {
      navigation.navigate('GraphNode', { nodeId });
    },
    [navigation]
  );

  // Loading state
  if (status === 'initializing' || loading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  // Error state
  if (status === 'error' || error || dbError) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error || dbError || 'Database error'} />
      </View>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No Pages Yet"
          description="Create your first page to see it in the graph."
          actionLabel="Create Page"
          onAction={() => {
            // Navigate to create page - this would be implemented based on navigation structure
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.graphWrapper}>
        {centerNodeId && (
          <MobileGraph
            centerNodeId={centerNodeId}
            nodes={nodes}
            edges={edges}
            width={graphWidth}
            height={graphHeight}
            onNodePress={handleNodePress}
            testID="knowledge-graph"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  graphWrapper: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
