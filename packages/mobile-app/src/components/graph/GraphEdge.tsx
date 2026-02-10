/**
 * GraphEdge - Edge rendering for mobile graph visualization.
 *
 * Renders a single edge as an SVG line with an optional arrow.
 * Supports bidirectional edges with curved paths.
 */

import { memo, useMemo } from 'react';
import { Line, Path, G } from 'react-native-svg';
import type { GraphEdgeProps } from './types';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from './types';

/**
 * Calculate the arrow path for a directed edge.
 * Returns an SVG path string for a triangle arrow head.
 */
function calculateArrowPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  nodeRadius: number,
  arrowSize: number
): string {
  // Calculate angle from source to target
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Arrow tip position (offset from node center by radius)
  const tipX = toX - Math.cos(angle) * nodeRadius;
  const tipY = toY - Math.sin(angle) * nodeRadius;

  // Arrow base corners
  const baseAngle1 = angle + (2.5 * Math.PI) / 3;
  const baseAngle2 = angle - (2.5 * Math.PI) / 3;

  const base1X = tipX + Math.cos(baseAngle1) * arrowSize;
  const base1Y = tipY + Math.sin(baseAngle1) * arrowSize;
  const base2X = tipX + Math.cos(baseAngle2) * arrowSize;
  const base2Y = tipY + Math.sin(baseAngle2) * arrowSize;

  return `M ${tipX} ${tipY} L ${base1X} ${base1Y} L ${base2X} ${base2Y} Z`;
}

/**
 * Calculate a curved path for bidirectional edges.
 * Returns an SVG path string for a quadratic bezier curve.
 */
function calculateCurvedPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  nodeRadius: number,
  curvature: number = 0.15
): string {
  // Calculate the midpoint
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // Calculate perpendicular offset for control point
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const offset = len * curvature;

  // Control point perpendicular to the line
  const controlX = midX - (dy / len) * offset;
  const controlY = midY + (dx / len) * offset;

  // Adjust start and end points to account for node radius
  const startAngle = Math.atan2(controlY - fromY, controlX - fromX);
  const endAngle = Math.atan2(controlY - toY, controlX - toX);

  const startX = fromX + Math.cos(startAngle) * nodeRadius;
  const startY = fromY + Math.sin(startAngle) * nodeRadius;
  const endX = toX + Math.cos(endAngle) * nodeRadius;
  const endY = toY + Math.sin(endAngle) * nodeRadius;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

/**
 * GraphEdge component renders a single edge between two nodes.
 *
 * Features:
 * - Straight line for unidirectional edges
 * - Curved line for bidirectional edges (to show both directions)
 * - Arrow head indicating direction (optional based on LOD)
 * - Scale-aware stroke width
 */
export const GraphEdge = memo(function GraphEdge({
  source,
  target,
  isBidirectional,
  scale,
  showArrow = true,
}: GraphEdgeProps) {
  const strokeWidth = GRAPH_CONSTANTS.EDGE_WIDTH / scale;
  const arrowSize = GRAPH_CONSTANTS.ARROW_SIZE / scale;
  const nodeRadius = GRAPH_CONSTANTS.NODE_RADIUS;

  // Calculate the arrow path
  const arrowPath = useMemo(
    () => calculateArrowPath(source.x, source.y, target.x, target.y, nodeRadius, arrowSize),
    [source.x, source.y, target.x, target.y, nodeRadius, arrowSize]
  );

  // For bidirectional edges, use a curved path
  if (isBidirectional) {
    const curvedPath = useMemo(
      () => calculateCurvedPath(source.x, source.y, target.x, target.y, nodeRadius),
      [source.x, source.y, target.x, target.y, nodeRadius]
    );

    return (
      <G>
        <Path d={curvedPath} stroke={GRAPH_COLORS.edge} strokeWidth={strokeWidth} fill="none" />
        {/* Arrow at the end of the curve (conditionally rendered based on LOD) */}
        {showArrow && <Path d={arrowPath} fill={GRAPH_COLORS.edge} />}
      </G>
    );
  }

  // For unidirectional edges, use a straight line
  // Calculate start/end points accounting for node radius
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const startX = source.x + Math.cos(angle) * nodeRadius;
  const startY = source.y + Math.sin(angle) * nodeRadius;
  const endX = target.x - Math.cos(angle) * (nodeRadius + arrowSize);
  const endY = target.y - Math.sin(angle) * (nodeRadius + arrowSize);

  return (
    <G>
      <Line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={GRAPH_COLORS.edge}
        strokeWidth={strokeWidth}
      />
      {/* Arrow (conditionally rendered based on LOD) */}
      {showArrow && <Path d={arrowPath} fill={GRAPH_COLORS.edge} />}
    </G>
  );
});
