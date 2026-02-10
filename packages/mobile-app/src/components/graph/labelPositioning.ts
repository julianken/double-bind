/**
 * Label positioning utilities for adaptive label placement.
 */

import type { LayoutNode } from './types';
import type { PageId } from '@double-bind/types';
import { GRAPH_CONSTANTS } from './types';

export type LabelPosition =
  | 'below'
  | 'below-right'
  | 'right'
  | 'above-right'
  | 'above'
  | 'above-left'
  | 'left'
  | 'below-left';

export interface LabelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface PositionOffset {
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
}

export const LABEL_POSITIONS: Record<LabelPosition, PositionOffset> = {
  below: { dx: 0, dy: 1, anchor: 'middle' },
  'below-right': { dx: 0.7, dy: 0.7, anchor: 'start' },
  right: { dx: 1, dy: 0, anchor: 'start' },
  'above-right': { dx: 0.7, dy: -0.7, anchor: 'start' },
  above: { dx: 0, dy: -1, anchor: 'middle' },
  'above-left': { dx: -0.7, dy: -0.7, anchor: 'end' },
  left: { dx: -1, dy: 0, anchor: 'end' },
  'below-left': { dx: -0.7, dy: 0.7, anchor: 'end' },
};

/**
 * Estimate label bounds for overlap detection.
 */
export function calculateLabelBounds(
  node: LayoutNode,
  labelText: string,
  position: LabelPosition,
  fontSize: number
): LabelBounds {
  const offset = GRAPH_CONSTANTS.LABEL_OFFSET;
  const estimatedWidth = labelText.length * fontSize * 0.6;
  const estimatedHeight = fontSize * 1.2;

  const { dx, dy, anchor } = LABEL_POSITIONS[position];
  const labelX = node.x + dx * offset;
  const labelY = node.y + dy * offset;

  let minX: number, maxX: number;
  if (anchor === 'middle') {
    minX = labelX - estimatedWidth / 2;
    maxX = labelX + estimatedWidth / 2;
  } else if (anchor === 'start') {
    minX = labelX;
    maxX = labelX + estimatedWidth;
  } else {
    minX = labelX - estimatedWidth;
    maxX = labelX;
  }

  const minY = dy < 0 ? labelY - estimatedHeight : labelY;
  const maxY = dy < 0 ? labelY : labelY + estimatedHeight;

  return { minX, maxX, minY, maxY };
}

/**
 * Check if two label bounds overlap.
 */
export function boundsOverlap(a: LabelBounds, b: LabelBounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Select optimal label position to minimize overlaps.
 */
export function selectLabelPosition(
  node: LayoutNode,
  labelText: string,
  fontSize: number,
  allNodes: LayoutNode[],
  placedLabels: Map<PageId, LabelBounds>,
  isHighPriority: boolean
): LabelPosition {
  // High-priority nodes prefer standard positions
  const positionsToTry: LabelPosition[] = isHighPriority
    ? ['below', 'above', 'right', 'left', 'below-right', 'above-right', 'below-left', 'above-left']
    : ['below', 'below-right', 'below-left', 'right', 'left', 'above', 'above-right', 'above-left'];

  let bestPosition: LabelPosition = 'below';
  let bestScore = Infinity;

  for (const position of positionsToTry) {
    const bounds = calculateLabelBounds(node, labelText, position, fontSize);
    let score = 0;

    // Check overlaps with placed labels
    placedLabels.forEach((otherBounds) => {
      if (boundsOverlap(bounds, otherBounds)) {
        score += 10;
      }
    });

    // Check proximity to other nodes (avoid covering nodes)
    for (const other of allNodes) {
      if (other.id === node.id) continue;

      const nodeRadius = GRAPH_CONSTANTS.NODE_RADIUS;
      if (
        other.x >= bounds.minX - nodeRadius &&
        other.x <= bounds.maxX + nodeRadius &&
        other.y >= bounds.minY - nodeRadius &&
        other.y <= bounds.maxY + nodeRadius
      ) {
        score += 5;
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestPosition = position;
    }

    // Early exit if perfect position found
    if (score === 0) break;
  }

  return bestPosition;
}

/**
 * Get label coordinates for a position.
 */
export function getLabelCoordinates(
  node: LayoutNode,
  position: LabelPosition
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const { dx, dy, anchor } = LABEL_POSITIONS[position];
  const offset = GRAPH_CONSTANTS.LABEL_OFFSET;

  return {
    x: node.x + dx * offset,
    y: node.y + dy * offset,
    anchor,
  };
}

// ============================================================================
// Label Truncation
// ============================================================================

/**
 * Configuration for intelligent label truncation.
 */
export interface TruncationConfig {
  /** Current zoom scale (affects how many characters to show) */
  scale: number;
  /** Label position (diagonal positions get less space) */
  position: LabelPosition;
  /** Density score 0-1, higher = more crowded area */
  density: number;
}

/**
 * Truncate a label intelligently based on scale, position, and density.
 *
 * Scale-based: Show more characters at higher zoom levels
 * Position-aware: Truncate more aggressively for diagonal positions
 * Density-aware: Truncate more in crowded areas
 * Always preserve first meaningful word when possible
 */
export function truncateLabel(text: string, config: TruncationConfig): string {
  // Base max length varies with scale
  // scale < 0.5: 8 chars, scale 0.5-1: 12 chars, scale 1-1.5: 20 chars, scale > 1.5: full
  let maxLength: number;
  if (config.scale < 0.5) {
    maxLength = 8;
  } else if (config.scale < 1) {
    maxLength = 12;
  } else if (config.scale < 1.5) {
    maxLength = 20;
  } else {
    maxLength = text.length;
  }

  // Diagonal positions get 20% less space
  const isDiagonal = config.position.includes('-');
  if (isDiagonal) {
    maxLength = Math.floor(maxLength * 0.8);
  }

  // High density reduces by additional 20%
  if (config.density > 0.7) {
    maxLength = Math.floor(maxLength * 0.8);
  }

  // No truncation needed
  if (text.length <= maxLength) {
    return text;
  }

  // Truncate, trying to break at word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // Only break at word boundary if we keep at least 50% of allowed length
  if (lastSpace > maxLength * 0.5) {
    return truncated.slice(0, lastSpace) + '…';
  }

  return truncated.slice(0, -1) + '…';
}
