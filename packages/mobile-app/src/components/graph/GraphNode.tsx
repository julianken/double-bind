/**
 * GraphNode - Individual node rendering for mobile graph visualization.
 *
 * Renders a single node as an SVG circle with a text label.
 * Handles tap interactions:
 * - Single tap: Select node (visual feedback)
 * - Double tap: Navigate to node (opens detail panel)
 * Labels feature smooth opacity fade transitions.
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Circle, Text, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { GraphNodeProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';
import type { LabelLayoutConfig } from './useLabelLayout';
import type { AnimationPhase } from './useAnimatedLayout';
import { truncateLabel } from './labelPositioning';

/** Double-tap detection timeout in ms */
const DOUBLE_TAP_DELAY = 300;

/**
 * Animated SVG Text component for smooth label transitions.
 */
const AnimatedSvgText = Animated.createAnimatedComponent(Text);

/** Duration for label fade animations in milliseconds */
const LABEL_FADE_DURATION = 300;

/**
 * GraphNode component renders a single node in the graph.
 *
 * Features:
 * - Circle representation with fill color based on center/selection state
 * - Text label with adaptive positioning (optional based on LOD)
 * - Tap handling for node selection
 * - Scale-aware rendering for zoom support
 * - Intelligent label truncation based on scale, position, and density
 * - Smooth spring position animation for center node transitions
 */
export const GraphNode = memo(function GraphNode({
  node,
  isCenter,
  isSelected,
  onPress,
  onDoubleTap,
  scale,
  showLabel = true,
  labelLayout,
  animationPhase = 'idle',
}: GraphNodeProps & { labelLayout?: LabelLayoutConfig; animationPhase?: AnimationPhase }) {
  // Track last tap time for double-tap detection
  const lastTapTime = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle tap with double-tap detection
  const handlePress = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      // Double tap detected - cancel pending single tap and trigger double tap
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      lastTapTime.current = 0;
      onDoubleTap?.(node.id);
    } else {
      // First tap - wait to see if it's a double tap
      lastTapTime.current = now;
      tapTimeout.current = setTimeout(() => {
        tapTimeout.current = null;
        onPress?.(node.id);
      }, DOUBLE_TAP_DELAY);
    }
  }, [node.id, onPress, onDoubleTap]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
      }
    };
  }, []);

  // Node positions come from useAnimatedLayout which handles all interpolation
  // No need for per-node spring animation - just use node.x/y directly

  // Calculate sizes based on node type and scale
  const radius = isCenter ? GRAPH_CONSTANTS.CENTER_NODE_RADIUS : GRAPH_CONSTANTS.NODE_RADIUS;
  const fillColor = isCenter ? GRAPH_COLORS.centerNode : GRAPH_COLORS.normalNode;
  const strokeColor = isSelected ? GRAPH_COLORS.selectedBorder : 'transparent';
  const strokeWidth = isSelected ? 2 / scale : 0;

  // Label styling - use labelLayout if provided, otherwise default positioning
  const fontSize = GRAPH_CONSTANTS.LABEL_FONT_SIZE / scale;
  const labelX = labelLayout?.x ?? node.x;
  const labelY = labelLayout?.y ?? node.y + GRAPH_CONSTANTS.LABEL_OFFSET;
  const labelAnchor = labelLayout?.anchor ?? 'middle';
  const labelVisible = labelLayout?.visible ?? showLabel;

  // Intelligent label truncation based on scale, position, and density
  const labelText = useMemo(() => {
    const position = labelLayout?.position ?? 'below';
    const density = labelLayout?.density ?? 0;
    return truncateLabel(node.title, { scale, position, density });
  }, [node.title, scale, labelLayout?.position, labelLayout?.density]);

  const labelColor = isCenter ? GRAPH_COLORS.labelText : GRAPH_COLORS.labelTextSecondary;
  const fontWeight = isCenter ? 'bold' : 'normal';

  // Animated opacity for smooth label fade transitions
  // Label visibility depends on both LOD visibility AND animation phase
  // During fading-out/moving: labels should be hidden
  // During idle/fading-in: labels should follow LOD visibility
  const shouldShowLabel =
    labelVisible && (animationPhase === 'idle' || animationPhase === 'fading-in');
  const labelOpacityValue = useSharedValue(shouldShowLabel ? 1 : 0);

  // Update opacity when visibility or animation phase changes
  useEffect(() => {
    const targetOpacity = shouldShowLabel ? 1 : 0;
    // Use faster timing during animation phases for snappier transitions
    const duration = animationPhase === 'idle' ? LABEL_FADE_DURATION : 150;
    labelOpacityValue.value = withTiming(targetOpacity, {
      duration,
      easing: Easing.inOut(Easing.ease),
    });
  }, [shouldShowLabel, animationPhase, labelOpacityValue]);

  // Animated label position values - all nodes need animated positions for smooth transitions
  const animatedLabelX = useSharedValue(labelX);
  const animatedLabelY = useSharedValue(labelY);

  // Update label position when it changes
  useEffect(() => {
    // During animation phases (when labels are hidden), snap to new position immediately
    // During idle, use timing for smooth movement if position changes
    if (animationPhase === 'moving' || animationPhase === 'fading-out') {
      // Snap immediately - labels are invisible during these phases
      animatedLabelX.value = labelX;
      animatedLabelY.value = labelY;
    } else {
      // Smooth animation for visible labels
      animatedLabelX.value = withTiming(labelX, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      animatedLabelY.value = withTiming(labelY, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [labelX, labelY, animationPhase, animatedLabelX, animatedLabelY]);

  // Animated props for label - includes position and opacity for all nodes
  const labelAnimatedProps = useAnimatedProps(() => ({
    x: animatedLabelX.value,
    y: animatedLabelY.value,
    opacity: labelOpacityValue.value,
  }));

  // All nodes use static positioning - useAnimatedLayout handles interpolation
  return (
    <G onPress={handlePress}>
      {/* Node circle */}
      <Circle
        cx={node.x}
        cy={node.y}
        r={radius}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      {/* Larger invisible touch target - minimum 44px diameter per WCAG guidelines */}
      <Circle
        cx={node.x}
        cy={node.y}
        r={Math.max(22, radius + 10)}
        fill="transparent"
        onPress={handlePress}
      />
      {/* Label with animated position and opacity for smooth transitions */}
      <AnimatedSvgText
        fontSize={fontSize}
        fill={labelColor}
        fontWeight={fontWeight}
        textAnchor={labelAnchor}
        alignmentBaseline="hanging"
        animatedProps={labelAnimatedProps}
      >
        {labelText}
      </AnimatedSvgText>
    </G>
  );
});
