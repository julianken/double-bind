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

import { memo, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { G } from 'react-native-svg';
import type { PageId } from '@double-bind/types';
import type { MobileGraphProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';
import { useForceLayout, useNodeMap } from './useForceLayout';

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
  onNodePress,
  maxNodes = GRAPH_CONSTANTS.DEFAULT_MAX_NODES,
  testID,
}: MobileGraphProps) {
  // Track selected node
  const [selectedNodeId, setSelectedNodeId] = useState<PageId | null>(null);

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
  const nodeMap = useNodeMap(layoutNodes);

  // Gesture state - shared values for animations
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pan gesture for navigation
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
          translateX.value = savedTranslateX.value + e.translationX;
          translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    []
  );

  // Pinch gesture for zoom
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
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

  // Handle node press
  const handleNodePress = useCallback(
    (nodeId: PageId) => {
      setSelectedNodeId(nodeId);
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
            {/* Render edges first (below nodes) */}
            <G>
              {visibleEdges.map((edge) => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (!source || !target) return null;

                return (
                  <GraphEdge
                    key={`${edge.source}-${edge.target}`}
                    source={source}
                    target={target}
                    isBidirectional={edge.isBidirectional}
                    scale={currentScale}
                  />
                );
              })}
            </G>

            {/* Render nodes on top */}
            <G>
              {layoutNodes.map((node) => (
                <GraphNode
                  key={node.id}
                  node={node}
                  isCenter={node.id === centerNodeId}
                  isSelected={node.id === selectedNodeId}
                  onPress={handleNodePress}
                  scale={currentScale}
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>
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
});
