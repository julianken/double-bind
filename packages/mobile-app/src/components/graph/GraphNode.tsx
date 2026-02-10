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
  withSpring,
  Easing,
} from 'react-native-reanimated';
import type { GraphNodeProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';
import type { LabelLayoutConfig } from './useLabelLayout';
import { truncateLabel } from './labelPositioning';

/** Double-tap detection timeout in ms */
const DOUBLE_TAP_DELAY = 300;

/**
 * Animated SVG components for smooth transitions.
 */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedSvgText = Animated.createAnimatedComponent(Text);

/** Duration for label fade animations in milliseconds */
const LABEL_FADE_DURATION = 300;

/**
 * Spring configuration for center node position animation.
 * Provides smooth, natural-feeling motion when navigating between nodes.
 */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 100,
};

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
}: GraphNodeProps & { labelLayout?: LabelLayoutConfig }) {
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

  // Animated position values for center node spring animation
  const animatedX = useSharedValue(node.x);
  const animatedY = useSharedValue(node.y);

  // Update animated position when node position changes
  // For center node: animate with spring for smooth navigation transition
  // For other nodes: update immediately (no animation overhead)
  useEffect(() => {
    if (isCenter) {
      animatedX.value = withSpring(node.x, SPRING_CONFIG);
      animatedY.value = withSpring(node.y, SPRING_CONFIG);
    } else {
      animatedX.value = node.x;
      animatedY.value = node.y;
    }
  }, [node.x, node.y, isCenter, animatedX, animatedY]);

  // Animated props for center node position
  const animatedCircleProps = useAnimatedProps(() => ({
    cx: animatedX.value,
    cy: animatedY.value,
  }));

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
  const labelOpacityValue = useSharedValue(labelVisible ? 1 : 0);

  // Update opacity when visibility changes
  useEffect(() => {
    labelOpacityValue.value = withTiming(labelVisible ? 1 : 0, {
      duration: LABEL_FADE_DURATION,
      easing: Easing.inOut(Easing.ease),
    });
  }, [labelVisible, labelOpacityValue]);

  // Animated props for label - combines opacity and position for center node
  // For center node: animate both position and opacity
  // For non-center nodes: only animate opacity
  const labelLayoutX = labelLayout?.x;
  const labelLayoutY = labelLayout?.y;
  const labelAnimatedProps = useAnimatedProps(() => {
    if (isCenter) {
      // Center node: animate label position along with node
      const x = labelLayoutX ?? animatedX.value;
      const y = labelLayoutY ?? animatedY.value + GRAPH_CONSTANTS.LABEL_OFFSET;
      return {
        x,
        y,
        opacity: labelOpacityValue.value,
      };
    }
    // Non-center: static position, animated opacity only
    return {
      opacity: labelOpacityValue.value,
    };
  });

  // Animated props for touch target (follows node position for center)
  const animatedTouchProps = useAnimatedProps(() => ({
    cx: animatedX.value,
    cy: animatedY.value,
  }));

  // For center node: use animated components with spring position
  if (isCenter) {
    return (
      <G onPress={handlePress}>
        {/* Node circle with animated spring position */}
        <AnimatedCircle
          animatedProps={animatedCircleProps}
          r={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        {/* Larger invisible touch target - minimum 44px diameter per WCAG guidelines */}
        <AnimatedCircle
          animatedProps={animatedTouchProps}
          r={Math.max(22, radius + 10)}
          fill="transparent"
          onPress={handlePress}
        />
        {/* Label with animated position and opacity */}
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
  }

  // For non-center nodes: use static SVG elements (no position animation overhead)
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
      {/* Label with animated opacity for smooth fade transitions */}
      <AnimatedSvgText
        x={labelX}
        y={labelY}
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
