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

import { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import type { PageId } from '@double-bind/types';
import type { GraphStackScreenProps } from '../navigation/types';
import { MobileGraph, GraphDetailPanel } from '../components/graph';
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
// Layout constants
const HEADER_HEIGHT = 44;
const CONTROLS_HEIGHT = 56; // paddingVertical(12*2) + button height(~32)
const TAB_BAR_HEIGHT = 49;
const GRAPH_PADDING = 16;

export function GraphScreen({ navigation }: Props): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Graph view mode and center page
  const [viewMode, setViewMode] = useState<'full' | 'local'>('full');
  const [centerPageId, setCenterPageId] = useState<PageId | null>(null);

  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState<{
    pageId: PageId;
    pageTitle: string;
  } | null>(null);

  // Track screen focus state
  const isFocused = useIsFocused();

  // Fetch graph data based on current mode
  const { nodes, edges, loading, error, refresh } = useGraphData({
    mode: viewMode,
    centerPageId: centerPageId || undefined,
    depth: 1,
  });

  // Refresh graph data when screen comes into focus
  // This ensures new pages appear after switching from Pages tab
  useEffect(() => {
    if (isFocused) {
      refresh();
    }
  }, [isFocused, refresh]);

  // Calculate graph dimensions using safe area insets for pixel-perfect layout
  // The gap between controls and graph should equal the gap between graph and tab bar
  const VERTICAL_GAP = 24; // Symmetric gap above and below graph
  const graphWidth = width - GRAPH_PADDING * 2;

  // Available height for the graph container (between controls and tab bar)
  const availableHeight =
    height -
    insets.top - // Status bar safe area
    HEADER_HEIGHT - // Navigation header
    CONTROLS_HEIGHT - // Segmented control section
    insets.bottom - // Home indicator safe area
    TAB_BAR_HEIGHT; // Tab bar

  // Graph height with symmetric padding removed - centering will distribute the gap
  const graphHeight = availableHeight - VERTICAL_GAP * 2;

  // Set initial center node when nodes are loaded
  const effectiveCenterNodeId = centerPageId || (nodes.length > 0 ? nodes[0].id : null);

  // Handle center change - single tap makes node the new center
  const handleCenterChange = useCallback((nodeId: PageId) => {
    setCenterPageId(nodeId);
  }, []);

  // Handle node double-tap - show detail panel for navigation
  const handleNodePress = useCallback(
    (nodeId: PageId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode({ pageId: nodeId, pageTitle: node.title });
      }
    },
    [nodes]
  );

  // Handle "Open Page" from detail panel
  const handleOpenPage = useCallback(
    (pageId: PageId) => {
      // Close detail panel
      setSelectedNode(null);
      // Navigate to page view (through PagesTab stack)
      // Using initial: false preserves the tab's existing stack so back button works
      navigation.navigate('MainTabs', {
        screen: 'PagesTab',
        params: {
          screen: 'Page',
          params: { pageId },
          initial: false,
        },
      });
    },
    [navigation]
  );

  // Handle detail panel dismiss
  const handleDismissDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Loading state - only show spinner on initial load, not when changing center
  // This keeps the graph visible during transitions
  if (loading && nodes.length === 0) {
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
      {/* View mode toggle - segmented control */}
      <View style={styles.controls}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'full' && styles.segmentButtonActive]}
            onPress={() => {
              setViewMode('full');
              // Don't reset centerPageId - preserve current center when switching modes
            }}
            accessibilityRole="button"
            accessibilityLabel="Show full graph"
            accessibilityState={{ selected: viewMode === 'full' }}
            testID="graph-view-full"
          >
            <Text style={[styles.segmentText, viewMode === 'full' && styles.segmentTextActive]}>
              All Pages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'local' && styles.segmentButtonActive]}
            onPress={() => {
              if (effectiveCenterNodeId) {
                setCenterPageId(effectiveCenterNodeId);
                setViewMode('local');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Show local neighborhood"
            accessibilityState={{ selected: viewMode === 'local' }}
            testID="graph-view-local"
          >
            <Text style={[styles.segmentText, viewMode === 'local' && styles.segmentTextActive]}>
              Focus View
            </Text>
          </TouchableOpacity>
        </View>
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
            onCenterChange={handleCenterChange}
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#000000',
  },
  viewModeHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
  },
  graphWrapper: {
    flex: 1,
    paddingHorizontal: GRAPH_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
