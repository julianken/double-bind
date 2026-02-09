/**
 * Type definitions for mobile graph visualization.
 *
 * These types mirror the desktop MiniGraph types for consistency
 * while providing mobile-specific extensions.
 */

import type { PageId } from '@double-bind/types';

// ============================================================================
// Node Types
// ============================================================================

/**
 * Data for a single graph node.
 */
export interface MobileGraphNode {
  /** Unique identifier for the node (PageId) */
  id: PageId;
  /** Display title for the node */
  title: string;
  /** Optional position - if not provided, force layout will calculate */
  x?: number;
  /** Optional position - if not provided, force layout will calculate */
  y?: number;
}

/**
 * Internal node state with computed layout positions.
 */
export interface LayoutNode extends MobileGraphNode {
  /** Computed x position from force layout */
  x: number;
  /** Computed y position from force layout */
  y: number;
  /** Velocity x for force simulation */
  vx: number;
  /** Velocity y for force simulation */
  vy: number;
}

// ============================================================================
// Edge Types
// ============================================================================

/**
 * Data for a single graph edge connecting two nodes.
 */
export interface MobileGraphEdge {
  /** Source node ID */
  source: PageId;
  /** Target node ID */
  target: PageId;
  /** When true, indicates a bidirectional link (A<->B both exist) */
  isBidirectional?: boolean;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the GraphNode component.
 */
export interface GraphNodeProps {
  /** Node data */
  node: LayoutNode;
  /** Whether this is the center/selected node */
  isCenter: boolean;
  /** Whether this node is currently selected */
  isSelected: boolean;
  /** Callback when node is tapped */
  onPress?: (nodeId: PageId) => void;
  /** Current scale for text sizing */
  scale: number;
  /** Whether to show label (LOD optimization) */
  showLabel?: boolean;
}

/**
 * Props for the GraphEdge component.
 */
export interface GraphEdgeProps {
  /** Source node with position */
  source: LayoutNode;
  /** Target node with position */
  target: LayoutNode;
  /** Whether this is a bidirectional edge */
  isBidirectional?: boolean;
  /** Current scale for stroke width */
  scale: number;
  /** Whether to show arrow head (LOD optimization) */
  showArrow?: boolean;
}

/**
 * Props for the MobileGraph component.
 */
export interface MobileGraphProps {
  /** The ID of the center node (will be emphasized) */
  centerNodeId: PageId;
  /** Array of nodes to display */
  nodes: MobileGraphNode[];
  /** Array of edges connecting nodes */
  edges: MobileGraphEdge[];
  /** Width of the graph container */
  width: number;
  /** Height of the graph container */
  height: number;
  /** Callback when a node is tapped */
  onNodePress?: (nodeId: PageId) => void;
  /** Maximum number of nodes to display (for performance) */
  maxNodes?: number;
  /** Test ID for accessibility */
  testID?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Graph visualization constants.
 */
export const GRAPH_CONSTANTS = {
  /** Base node radius in pixels */
  NODE_RADIUS: 8,
  /** Center node radius (slightly larger) */
  CENTER_NODE_RADIUS: 10,
  /** Edge stroke width */
  EDGE_WIDTH: 1.5,
  /** Arrow size for directed edges */
  ARROW_SIZE: 6,
  /** Font size for labels */
  LABEL_FONT_SIZE: 12,
  /** Distance from node to label */
  LABEL_OFFSET: 14,
  /** Maximum label length in characters */
  MAX_LABEL_LENGTH: 15,
  /** Minimum scale allowed */
  MIN_SCALE: 0.5,
  /** Maximum scale allowed */
  MAX_SCALE: 3.0,
  /** Default maximum nodes to render */
  DEFAULT_MAX_NODES: 50,
} as const;

/**
 * Graph color palette.
 */
export const GRAPH_COLORS = {
  /** Center node color (blue) */
  centerNode: '#3b82f6',
  /** Normal node color (gray) */
  normalNode: '#6b7280',
  /** Selected node border color */
  selectedBorder: '#3b82f6',
  /** Edge color (slate) */
  edge: '#94a3b8',
  /** Label text color */
  labelText: '#1e293b',
  /** Label text secondary (for non-center nodes) */
  labelTextSecondary: 'rgba(30, 41, 59, 0.75)',
  /** Background color */
  background: '#f8fafc',
} as const;
