/**
 * MobileGraph - Mobile graph visualization component.
 *
 * Renders an interactive graph with:
 * - Pinch-to-zoom
 * - Pan gesture for navigation
 * - Tap to select nodes
 *
 * Uses react-native-gesture-handler for gestures and react-native-svg for rendering.
 * Performance optimized with node limiting and transform-based zoom/pan.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { G } from 'react-native-svg';
import type { PageId } from '@double-bind/types';
import type { MobileGraphProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';
import { useForceLayout, useNodeMap } from './useForceLayout';
import { useAnimatedLayout } from './useAnimatedLayout';
import { useOptimizedGraph } from './useOptimizedGraph';
import { useLabelLayout } from './useLabelLayout';

/**
 * MobileGraph component for interactive graph visualization.
 *
 * @example
 * ```tsx
 * <MobileGraph
 *   centerNodeId="page-1"
 *   nodes={[
 *     { id: 'page-1', title: 'Current Page' },
 *     { id: 'page-2', title: 'Linked Page' },
 *   ]}
 *   edges={[{ source: 'page-1', target: 'page-2' }]}
 *   width={300}
 *   height={400}
 *   onNodePress={(id) => navigateToPage(id)}
 * />
 * ```
 */
export const MobileGraph = memo(function MobileGraph({
  centerNodeId,
  nodes,
  edges,
  width,
  height,
  onCenterChange,
  onNodePress,
  maxNodes = GRAPH_CONSTANTS.DEFAULT_MAX_NODES,
  testID,
}: MobileGraphProps) {
  // Track selected node and interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<PageId | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // Zoom hint state - shown once per session in ultra-minimal mode
  const hasShownZoomHint = useRef(false);
  const [showZoomHint, setShowZoomHint] = useState(false);

  // Limit nodes for performance
  const limitedNodes = useMemo(() => {
    if (nodes.length <= maxNodes) return nodes;
    // Prioritize center node and its connections
    const connectedIds = new Set<string>();
    edges.forEach((e) => {
      if (e.source === centerNodeId) connectedIds.add(e.target);
      if (e.target === centerNodeId) connectedIds.add(e.source);
    });

    const prioritized = nodes.filter((n) => n.id === centerNodeId || connectedIds.has(n.id));
    const rest = nodes.filter((n) => n.id !== centerNodeId && !connectedIds.has(n.id));

    return [...prioritized, ...rest].slice(0, maxNodes);
  }, [nodes, edges, centerNodeId, maxNodes]);

  // Filter edges to only include visible nodes
  const visibleNodeIds = useMemo(() => new Set(limitedNodes.map((n) => n.id)), [limitedNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [edges, visibleNodeIds]
  );

  // Compute force layout
  const layoutNodes = useForceLayout(limitedNodes, visibleEdges, width, height, centerNodeId);

  // Animate layout transitions when center node changes
  // Returns nodes with interpolated positions and animation phase for label coordination
  const { nodes: animatedNodes, phase: animationPhase } = useAnimatedLayout(
    layoutNodes,
    centerNodeId
  );

  // Gesture state - shared values for animations
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Apply rendering optimizations (LOD, culling, clustering)
  const optimized = useOptimizedGraph({
    nodes: animatedNodes,
    edges: visibleEdges,
    centerNodeId,
    width,
    height,
    scale: scale.value,
    translateX: translateX.value,
    translateY: translateY.value,
    isInteracting,
    enableMetrics: true,
  });

  // Update node map with optimized visible nodes
  const optimizedNodeMap = useNodeMap(optimized.visibleNodes);

  // Calculate adaptive label positioning
  const labelLayouts = useLabelLayout({
    visibleNodes: optimized.visibleNodes,
    edges: visibleEdges,
    centerNodeId,
    selectedNodeId,
    lodMode: optimized.lodMode,
    scale: scale.value || 1,
  });

  // Show zoom hint when entering ultra-minimal mode (once per session)
  useEffect(() => {
    if (optimized.lodMode === 'ultra-minimal' && !hasShownZoomHint.current) {
      hasShownZoomHint.current = true;
      setShowZoomHint(true);
      const timer = setTimeout(() => setShowZoomHint(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [optimized.lodMode]);

  // Hide zoom hint on any interaction
  useEffect(() => {
    if (isInteracting && showZoomHint) {
      setShowZoomHint(false);
    }
  }, [isInteracting, showZoomHint]);

  // Pan gesture for navigation
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        .onStart(() => {
          runOnJS(setIsInteracting)(true);
        })
        .onUpdate((e) => {
          translateX.value = savedTranslateX.value + e.translationX;
          translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
          runOnJS(setIsInteracting)(false);
        }),
    []
  );

  // Pinch gesture for zoom
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          runOnJS(setIsInteracting)(true);
        })
        .onUpdate((e) => {
          const newScale = savedScale.value * e.scale;
          // Clamp scale to min/max
          scale.value = Math.min(
            Math.max(newScale, GRAPH_CONSTANTS.MIN_SCALE),
            GRAPH_CONSTANTS.MAX_SCALE
          );
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          runOnJS(setIsInteracting)(false);
        }),
    []
  );

  // Double tap to reset zoom
  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          scale.value = withSpring(1);
          savedScale.value = 1;
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
        }),
    []
  );

  // Combine gestures - pan and pinch can happen simultaneously
  const composedGesture = useMemo(
    () => Gesture.Exclusive(doubleTapGesture, Gesture.Simultaneous(panGesture, pinchGesture)),
    [panGesture, pinchGesture, doubleTapGesture]
  );

  // Animated style for transform
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Handle node single tap - change center node, or show detail if already center
  const handleNodeSelect = useCallback(
    (nodeId: PageId) => {
      setSelectedNodeId(nodeId);
      if (nodeId === centerNodeId) {
        // Already the center - show detail panel instead
        onNodePress?.(nodeId);
      } else {
        // Change to new center
        onCenterChange?.(nodeId);
      }
    },
    [centerNodeId, onCenterChange, onNodePress]
  );

  // Handle node double tap - trigger navigation callback
  const handleNodeDoubleTap = useCallback(
    (nodeId: PageId) => {
      onNodePress?.(nodeId);
    },
    [onNodePress]
  );

  // Empty state
  if (nodes.length === 0) {
    return (
      <View
        style={[styles.container, { width, height }]}
        testID={testID ? `${testID}-empty` : undefined}
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No connections</Text>
        </View>
      </View>
    );
  }

  // Get current scale for child components (for stroke/font sizing)
  const currentScale = scale.value || 1;

  return (
    <View
      style={[styles.container, { width, height }]}
      testID={testID}
      accessibilityLabel="Knowledge graph visualization"
      accessibilityRole="image"
    >
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.graphContainer, animatedStyle]}>
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Render edges first (below nodes) - use optimized visible edges */}
            <G>
              {optimized.visibleEdges.map((edge) => {
                const source = optimizedNodeMap.get(edge.source);
                const target = optimizedNodeMap.get(edge.target);
                if (!source || !target) return null;

                return (
                  <GraphEdge
                    key={`${edge.source}-${edge.target}`}
                    source={source}
                    target={target}
                    isBidirectional={edge.isBidirectional}
                    scale={currentScale}
                    showArrow={optimized.showEdgeArrows}
                  />
                );
              })}
            </G>

            {/* Render nodes on top - use optimized visible nodes */}
            <G>
              {optimized.visibleNodes.map((node) => (
                <GraphNode
                  key={node.id}
                  node={node}
                  isCenter={node.id === centerNodeId}
                  isSelected={node.id === selectedNodeId}
                  onPress={handleNodeSelect}
                  onDoubleTap={handleNodeDoubleTap}
                  scale={currentScale}
                  showLabel={
                    optimized.showLabels && (optimized.showAllLabels || node.id === centerNodeId)
                  }
                  labelLayout={labelLayouts.get(node.id)}
                  animationPhase={animationPhase}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Zoom hint overlay - shown once when in ultra-minimal mode */}
      {showZoomHint && (
        <View style={styles.zoomHint} pointerEvents="none">
          <Text style={styles.zoomHintText}>Pinch to zoom in for labels</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: GRAPH_COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  graphContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: GRAPH_COLORS.normalNode,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomHintText: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
  },
});
