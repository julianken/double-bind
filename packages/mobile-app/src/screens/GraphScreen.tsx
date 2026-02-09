/**
 * GraphScreen - Knowledge graph visualization screen with interactive exploration.
 *
 * Features:
 * - Toggle between full graph and local (neighborhood) view
 * - Interactive zoom (pinch) and pan gestures
 * - Tap to select nodes and view details
 * - Detail panel with connection counts
 * - Navigate from graph to page view
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import type { PageId } from '@double-bind/types';
import type { GraphStackScreenProps } from '../navigation/types';
import {
  MobileGraph,
  GraphDetailPanel,
} from '../components/graph';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components';
import { useGraphData } from '../hooks';

type Props = GraphStackScreenProps<'Graph'>;

/**
 * GraphScreen displays an interactive knowledge graph with exploration features.
 *
 * Users can:
 * - Switch between full graph (all pages) and local graph (page neighborhood)
 * - Tap nodes to view details (title, connection counts)
 * - Navigate from detail panel to page view
 * - Pinch-to-zoom and pan for exploration
 */
export function GraphScreen({ navigation }: Props): React.ReactElement {
  const { width, height } = useWindowDimensions();

  // Graph view mode and center page
  const [viewMode, setViewMode] = useState<'full' | 'local'>('full');
  const [centerPageId, setCenterPageId] = useState<PageId | null>(null);

  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState<{
    pageId: PageId;
    pageTitle: string;
  } | null>(null);

  // Fetch graph data based on current mode
  const { nodes, edges, loading, error } = useGraphData({
    mode: viewMode,
    centerPageId: centerPageId || undefined,
    depth: 1,
  });

  // Calculate graph dimensions (full screen minus header, controls, and tab bar)
  const graphWidth = width - 32; // 16px padding on each side
  const graphHeight = height - 280; // Account for header, controls, tab bar, and detail panel

  // Set initial center node when nodes are loaded
  const effectiveCenterNodeId = centerPageId || (nodes.length > 0 ? nodes[0].id : null);

  // Toggle between full and local view
  const handleToggleView = useCallback(() => {
    if (viewMode === 'full' && effectiveCenterNodeId) {
      // Switch to local view centered on first node
      setCenterPageId(effectiveCenterNodeId);
      setViewMode('local');
    } else {
      // Switch back to full view
      setViewMode('full');
      setCenterPageId(null);
    }
  }, [viewMode, effectiveCenterNodeId]);

  // Handle node press - show detail panel
  const handleNodePress = useCallback(
    (nodeId: PageId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode({ pageId: nodeId, pageTitle: node.title });

        // If in full view mode, also switch to local view centered on this node
        if (viewMode === 'full') {
          setCenterPageId(nodeId);
          setViewMode('local');
        }
      }
    },
    [nodes, viewMode]
  );

  // Handle "Open Page" from detail panel
  const handleOpenPage = useCallback(
    (pageId: PageId) => {
      // Close detail panel
      setSelectedNode(null);
      // Navigate to page view (through PagesTab stack)
      navigation.navigate('MainTabs', {
        screen: 'PagesTab',
        params: {
          screen: 'Page',
          params: { pageId },
        },
      });
    },
    [navigation]
  );

  // Handle detail panel dismiss
  const handleDismissDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error} />
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
            // Navigate to create page
            navigation.navigate('MainTabs', {
              screen: 'PagesTab',
              params: {
                screen: 'PageList',
              },
            });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* View mode toggle */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'full' && styles.toggleButtonActive]}
          onPress={handleToggleView}
          accessibilityRole="button"
          accessibilityLabel={
            viewMode === 'full' ? 'Switch to local graph view' : 'Switch to full graph view'
          }
          testID="graph-view-toggle"
        >
          <Text style={[styles.toggleText, viewMode === 'full' && styles.toggleTextActive]}>
            {viewMode === 'full' ? 'Full Graph' : 'Local View'}
          </Text>
        </TouchableOpacity>
        {viewMode === 'local' && centerPageId && (
          <Text style={styles.viewModeHint} numberOfLines={1}>
            Showing connections for: {nodes.find((n) => n.id === centerPageId)?.title || 'Unknown'}
          </Text>
        )}
      </View>

      {/* Graph visualization */}
      <View style={styles.graphWrapper}>
        {effectiveCenterNodeId && (
          <MobileGraph
            centerNodeId={effectiveCenterNodeId}
            nodes={nodes}
            edges={edges}
            width={graphWidth}
            height={graphHeight}
            onNodePress={handleNodePress}
            testID="knowledge-graph"
          />
        )}
      </View>

      {/* Detail panel */}
      {selectedNode && (
        <GraphDetailPanel
          pageId={selectedNode.pageId}
          pageTitle={selectedNode.pageTitle}
          edges={edges}
          visible={true}
          onOpenPage={handleOpenPage}
          onDismiss={handleDismissDetail}
          testID="graph-detail-panel"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignSelf: 'flex-start',
    minHeight: 44, // WCAG touch target
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C43',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  viewModeHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
  },
  graphWrapper: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
