/**
 * useLabelVisibility - Dynamic label visibility based on local density and priority.
 */

import { useMemo } from 'react';
import type { PageId } from '@double-bind/types';
import type { LayoutNode, MobileGraphEdge } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Level-of-detail modes for graph rendering.
 */
export type LODMode = 'ultra-minimal' | 'minimal' | 'normal' | 'detailed';

/**
 * Label priority tiers for visibility decisions.
 */
export type LabelPriority = 'always' | 'high' | 'medium' | 'low';

/**
 * Density metrics for a node's local neighborhood.
 */
export interface DensityMetrics {
  /** Number of neighbors within density radius */
  neighborCount: number;
  /** Normalized density score (0-1) */
  densityScore: number;
  /** Whether this area is considered high-density */
  isHighDensity: boolean;
}

/**
 * Complete label visibility configuration for a node.
 */
export interface LabelVisibilityConfig {
  /** Whether the label should be shown */
  visible: boolean;
  /** Priority tier of this label */
  priority: LabelPriority;
  /** Local density metrics */
  density: DensityMetrics;
}

/**
 * Options for label visibility calculation.
 */
interface LabelVisibilityOptions {
  /** Nodes currently visible in viewport */
  visibleNodes: LayoutNode[];
  /** All edges in the graph */
  edges: MobileGraphEdge[];
  /** Center node ID (highest priority) */
  centerNodeId: PageId | null;
  /** Currently selected node ID (also high priority) */
  selectedNodeId: PageId | null;
  /** Current level-of-detail mode */
  lodMode: LODMode;
}

// ============================================================================
// Constants
// ============================================================================

/** Radius in pixels to calculate local density */
const DENSITY_RADIUS = 80;

/** Density score threshold for high-density classification */
const HIGH_DENSITY_THRESHOLD = 0.6;

/** Max neighbors for density normalization */
const MAX_NEIGHBORS_FOR_NORMALIZATION = 8;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate local density around a node.
 *
 * Counts neighbors within DENSITY_RADIUS and normalizes to 0-1 score.
 */
function calculateLocalDensity(
  node: LayoutNode,
  allNodes: LayoutNode[],
  densityRadius: number = DENSITY_RADIUS
): DensityMetrics {
  let neighborCount = 0;

  for (const other of allNodes) {
    if (other.id === node.id) continue;

    const dx = node.x - other.x;
    const dy = node.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= densityRadius) {
      neighborCount++;
    }
  }

  const densityScore = Math.min(neighborCount / MAX_NEIGHBORS_FOR_NORMALIZATION, 1.0);
  const isHighDensity = densityScore > HIGH_DENSITY_THRESHOLD;

  return { neighborCount, densityScore, isHighDensity };
}

/**
 * Determine label priority based on node relationships.
 *
 * Priority tiers:
 * - always: center node, selected node
 * - high: direct neighbors of center
 * - medium: hub nodes (3+ connections)
 * - low: everything else
 */
function calculateLabelPriority(
  node: LayoutNode,
  centerNodeId: PageId | null,
  selectedNodeId: PageId | null,
  edges: MobileGraphEdge[]
): LabelPriority {
  // Tier 1: Always show center and selected
  if (node.id === centerNodeId || node.id === selectedNodeId) {
    return 'always';
  }

  // Tier 2: Direct neighbors of center
  if (centerNodeId) {
    const isDirectNeighbor = edges.some(
      (e) =>
        (e.source === centerNodeId && e.target === node.id) ||
        (e.target === centerNodeId && e.source === node.id)
    );
    if (isDirectNeighbor) {
      return 'high';
    }
  }

  // Tier 3: Nodes with many connections (hub nodes)
  const connectionCount = edges.filter((e) => e.source === node.id || e.target === node.id).length;
  if (connectionCount >= 3) {
    return 'medium';
  }

  // Tier 4: Everything else
  return 'low';
}

/**
 * Determine if a label should be shown based on priority, density, and LOD.
 *
 * LOD modes:
 * - ultra-minimal: only 'always' tier
 * - minimal: 'always' + 'high' in low-density areas
 * - normal: show most, cull low-priority in high-density
 * - detailed: show all labels unless extremely dense
 */
function shouldShowLabel(
  priority: LabelPriority,
  density: DensityMetrics,
  lodMode: LODMode
): boolean {
  // Ultra-minimal: only 'always' tier
  if (lodMode === 'ultra-minimal') {
    return priority === 'always';
  }

  // Minimal: 'always' + 'high' in low-density areas
  if (lodMode === 'minimal') {
    if (priority === 'always') return true;
    if (priority === 'high' && !density.isHighDensity) return true;
    return false;
  }

  // Normal: show most, but cull low-priority in high-density
  if (lodMode === 'normal') {
    if (priority === 'always' || priority === 'high') return true;
    if (priority === 'medium' && !density.isHighDensity) return true;
    if (priority === 'low' && density.densityScore < 0.3) return true;
    return false;
  }

  // Detailed: show all labels unless extremely dense
  if (priority === 'always' || priority === 'high' || priority === 'medium') {
    return true;
  }
  return density.densityScore < 0.8;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to calculate label visibility for all visible nodes.
 *
 * Uses a two-pass algorithm:
 * 1. Calculate local density for each node
 * 2. Determine visibility based on priority, density, and LOD mode
 *
 * Returns a map of node ID -> visibility configuration.
 */
export function useLabelVisibility(
  options: LabelVisibilityOptions
): Map<PageId, LabelVisibilityConfig> {
  const { visibleNodes, edges, centerNodeId, selectedNodeId, lodMode } = options;

  return useMemo(() => {
    const configs = new Map<PageId, LabelVisibilityConfig>();

    // First pass: calculate density for all nodes
    const densityMap = new Map<PageId, DensityMetrics>();
    for (const node of visibleNodes) {
      densityMap.set(node.id, calculateLocalDensity(node, visibleNodes));
    }

    // Second pass: determine visibility
    for (const node of visibleNodes) {
      const density = densityMap.get(node.id)!;
      const priority = calculateLabelPriority(node, centerNodeId, selectedNodeId, edges);
      const visible = shouldShowLabel(priority, density, lodMode);

      configs.set(node.id, { visible, priority, density });
    }

    return configs;
  }, [visibleNodes, edges, centerNodeId, selectedNodeId, lodMode]);
}
