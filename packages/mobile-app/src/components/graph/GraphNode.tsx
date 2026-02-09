/**
 * GraphNode - Individual node rendering for mobile graph visualization.
 *
 * Renders a single node as an SVG circle with a text label.
 * Handles tap interactions for node selection.
 */

import { memo, useCallback } from 'react';
import { Circle, Text, G } from 'react-native-svg';
import type { GraphNodeProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';

/**
 * Truncate a label to a maximum length, preferring word boundaries.
 */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * GraphNode component renders a single node in the graph.
 *
 * Features:
 * - Circle representation with fill color based on center/selection state
 * - Text label below the node
 * - Tap handling for node selection
 * - Scale-aware rendering for zoom support
 */
export const GraphNode = memo(function GraphNode({
  node,
  isCenter,
  isSelected,
  onPress,
  scale,
}: GraphNodeProps) {
  const handlePress = useCallback(() => {
    onPress?.(node.id);
  }, [node.id, onPress]);

  // Calculate sizes based on node type and scale
  const radius = isCenter ? GRAPH_CONSTANTS.CENTER_NODE_RADIUS : GRAPH_CONSTANTS.NODE_RADIUS;
  const fillColor = isCenter ? GRAPH_COLORS.centerNode : GRAPH_COLORS.normalNode;
  const strokeColor = isSelected ? GRAPH_COLORS.selectedBorder : 'transparent';
  const strokeWidth = isSelected ? 2 / scale : 0;

  // Label styling
  const fontSize = GRAPH_CONSTANTS.LABEL_FONT_SIZE / scale;
  const labelY = node.y + GRAPH_CONSTANTS.LABEL_OFFSET;
  const labelText = truncateLabel(node.title, GRAPH_CONSTANTS.MAX_LABEL_LENGTH);
  const labelColor = isCenter ? GRAPH_COLORS.labelText : GRAPH_COLORS.labelTextSecondary;
  const fontWeight = isCenter ? 'bold' : 'normal';

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
      {/* Larger invisible touch target */}
      <Circle cx={node.x} cy={node.y} r={radius + 10} fill="transparent" onPress={handlePress} />
      {/* Label */}
      <Text
        x={node.x}
        y={labelY}
        fontSize={fontSize}
        fill={labelColor}
        fontWeight={fontWeight}
        textAnchor="middle"
        alignmentBaseline="hanging"
      >
        {labelText}
      </Text>
    </G>
  );
});
