/**
 * useLabelLayout - Combines visibility and positioning for optimal label rendering.
 */

import { useMemo } from 'react';
import type { PageId } from '@double-bind/types';
import type { LayoutNode, MobileGraphEdge } from './types';
import { GRAPH_CONSTANTS } from './types';
import { useLabelVisibility, type LODMode } from './useLabelVisibility';
import {
  selectLabelPosition,
  calculateLabelBounds,
  getLabelCoordinates,
  type LabelPosition,
  type LabelBounds,
} from './labelPositioning';

export interface LabelLayoutConfig {
  visible: boolean;
  position: LabelPosition;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  /** Density score 0-1 indicating how crowded the area is around this node */
  density: number;
}

interface UseLabelLayoutOptions {
  visibleNodes: LayoutNode[];
  edges: MobileGraphEdge[];
  centerNodeId: PageId | null;
  selectedNodeId: PageId | null;
  lodMode: LODMode;
  scale: number;
}

/**
 * Calculate local density around a node (0-1 scale).
 * Higher values indicate more crowded areas.
 */
function calculateNodeDensity(
  node: LayoutNode,
  allNodes: LayoutNode[],
  radius: number = 100
): number {
  // Count nodes within radius
  let nearbyCount = 0;
  for (const other of allNodes) {
    if (other.id === node.id) continue;
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= radius) {
      nearbyCount++;
    }
  }

  // Normalize to 0-1 range (5+ nearby nodes = max density)
  return Math.min(nearbyCount / 5, 1);
}

export function useLabelLayout(options: UseLabelLayoutOptions): Map<PageId, LabelLayoutConfig> {
  const { visibleNodes, edges, centerNodeId, selectedNodeId, lodMode, scale } = options;

  // Get visibility configs from Phase 3A hook
  const visibilityConfigs = useLabelVisibility({
    visibleNodes,
    edges,
    centerNodeId,
    selectedNodeId,
    lodMode,
  });

  return useMemo(() => {
    const layouts = new Map<PageId, LabelLayoutConfig>();
    const placedLabels = new Map<PageId, LabelBounds>();
    const fontSize = GRAPH_CONSTANTS.LABEL_FONT_SIZE / scale;

    // Sort by priority (place high-priority labels first to get best positions)
    const sortedNodes = [...visibleNodes].sort((a, b) => {
      const aConfig = visibilityConfigs.get(a.id);
      const bConfig = visibilityConfigs.get(b.id);
      const priorityOrder = { always: 0, high: 1, medium: 2, low: 3 };
      const aPriority = aConfig?.priority ?? 'low';
      const bPriority = bConfig?.priority ?? 'low';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });

    for (const node of sortedNodes) {
      const visConfig = visibilityConfigs.get(node.id);
      const density = calculateNodeDensity(node, visibleNodes);

      if (!visConfig || !visConfig.visible) {
        // Hidden label - use default position
        const coords = getLabelCoordinates(node, 'below');
        layouts.set(node.id, {
          visible: false,
          position: 'below',
          density,
          ...coords,
        });
        continue;
      }

      // Use a reasonable default for position selection (actual truncation happens in GraphNode)
      const labelText = node.title.slice(0, GRAPH_CONSTANTS.MAX_LABEL_LENGTH);
      const isHighPriority = visConfig.priority === 'always' || visConfig.priority === 'high';

      const position = selectLabelPosition(
        node,
        labelText,
        fontSize,
        visibleNodes,
        placedLabels,
        isHighPriority
      );

      const bounds = calculateLabelBounds(node, labelText, position, fontSize);
      placedLabels.set(node.id, bounds);

      const coords = getLabelCoordinates(node, position);
      layouts.set(node.id, {
        visible: true,
        position,
        density,
        ...coords,
      });
    }

    return layouts;
  }, [visibleNodes, visibilityConfigs, scale]);
}
