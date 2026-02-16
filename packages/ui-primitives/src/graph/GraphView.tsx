/**
 * GraphView - Force-directed graph visualization component
 *
 * Renders an interactive graph of pages and their links using react-force-graph-2d.
 * Supports node highlighting, community coloring, and PageRank-based sizing.
 *
 * Features:
 * - Force-directed layout (d3-force under the hood)
 * - Canvas rendering for performance
 * - Zoom and pan built-in
 * - Node labels on hover
 * - Click to navigate
 */

import {
  type CSSProperties,
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
} from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from 'react-force-graph-2d';

// PageId is a string type, define locally to avoid build dependency issues
type PageId = string;

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: PageId;
  title: string;
  pageRank?: number;
  community?: number;
}

export interface GraphEdge {
  source: PageId;
  target: PageId;
  /** When true, indicates a bidirectional link (A→B and B→A both exist) */
  isBidirectional?: boolean;
}

export interface GraphViewProps {
  /**
   * Array of nodes to render in the graph.
   * Each node represents a page with optional PageRank and community data.
   */
  nodes: GraphNode[];

  /**
   * Array of edges (links) connecting nodes.
   * Each edge connects a source page to a target page.
   */
  edges: GraphEdge[];

  /**
   * Callback fired when a node is clicked.
   * Typically used for navigation.
   */
  onNodeClick: (pageId: PageId) => void;

  /**
   * Callback fired when a node is hovered.
   * Receives null when the mouse leaves a node.
   */
  onNodeHover?: (pageId: PageId | null) => void;

  /**
   * ID of the node to highlight (e.g., currently focused page).
   * Highlighted nodes render with a different color and size.
   */
  highlightedNodeId?: PageId;

  /**
   * When true, nodes are colored based on their community property.
   * Uses a categorical color palette.
   */
  colorByCommunity?: boolean;

  /**
   * When true, node sizes are scaled based on their pageRank value.
   * Higher PageRank = larger node.
   */
  sizeByPageRank?: boolean;

  /**
   * Width of the graph canvas in pixels.
   * Defaults to 800.
   */
  width?: number;

  /**
   * Height of the graph canvas in pixels.
   * Defaults to 600.
   */
  height?: number;

  /**
   * Color for node labels. Should contrast with the canvas background.
   * Defaults to slate-800 (#1e293b) for light backgrounds.
   */
  labelColor?: string;

  /**
   * Optional CSS class name for the container.
   */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default node color */
const DEFAULT_NODE_COLOR = '#6366f1'; // indigo-500

/** Highlighted node color */
const HIGHLIGHT_NODE_COLOR = '#f59e0b'; // amber-500

/** Edge color */
const EDGE_COLOR = '#475569'; // slate-600

/** Node label color */
const LABEL_COLOR = '#94a3b8'; // slate-400

/** Default node radius */
const DEFAULT_NODE_RADIUS = 5;

/** Minimum node radius when sizing by PageRank */
const MIN_NODE_RADIUS = 3;

/** Maximum node radius when sizing by PageRank */
const MAX_NODE_RADIUS = 15;

/** Highlighted node radius multiplier */
const HIGHLIGHT_RADIUS_MULTIPLIER = 1.5;

/** Arrow head length in pixels */
const ARROW_LENGTH = 4.5;

/** Curvature for bidirectional links to separate arrows */
const BIDIRECTIONAL_CURVATURE = 0.15;

/** Community color palette (categorical) */
const COMMUNITY_COLORS: readonly string[] = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#a855f7', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates the relative position (0-1) where an arrow should end along a link.
 * Adjusts arrow position to stop at the edge of the target node, accounting for
 * variable node sizes (PageRank-based sizing, highlighted nodes).
 *
 * @param link - The link object containing source and target nodes
 * @param getNodeRadius - Function to get the radius of a node
 * @returns A value between 0 (at source) and 1 (at target center), representing
 *          where the arrow should end. Returns a value < 1 to stop at the target's edge.
 *
 * @example
 * // For a link where target has 15px radius and nodes are 100px apart:
 * // Arrow will stop at position 0.85 (100-15)/100
 * calculateArrowPosition(link, getNodeRadius)
 */
function calculateArrowPosition(
  link: InternalLink,
  getNodeRadius: (node: InternalNode) => number
): number {
  const targetNode = typeof link.target === 'object' ? link.target : null;
  const sourceNode = typeof link.source === 'object' ? link.source : null;

  // Fallback if nodes aren't resolved objects yet
  if (!targetNode || !sourceNode) return 1;

  const targetRadius = getNodeRadius(targetNode);

  // Calculate distance between source and target
  const dx = (targetNode.x ?? 0) - (sourceNode.x ?? 0);
  const dy = (targetNode.y ?? 0) - (sourceNode.y ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Avoid division by zero for overlapping nodes
  if (distance < 0.001) return 1;

  // Calculate position where arrow should stop (at edge of target node)
  // Position = 1 - (radius / distance)
  const relPos = 1 - (targetRadius / distance);

  // Clamp to valid range [0, 1]
  return Math.min(1, Math.max(0, relPos));
}

// ============================================================================
// Internal Types
// ============================================================================

interface InternalNodeData {
  title: string;
  pageRank?: number;
  community?: number;
}

type InternalNode = NodeObject<InternalNodeData>;

// Internal link type with bidirectional flag
interface InternalLinkData {
  isBidirectional?: boolean;
}
type InternalLink = LinkObject<InternalNodeData, InternalLinkData>;

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: 'relative',
    overflow: 'hidden',
  } satisfies CSSProperties,
};

// ============================================================================
// Component
// ============================================================================

/**
 * GraphView component for visualizing page relationships.
 *
 * @example
 * ```tsx
 * const nodes = [
 *   { id: '01HQ...', title: 'Home', pageRank: 0.15, community: 0 },
 *   { id: '01HR...', title: 'Projects', pageRank: 0.08, community: 1 },
 * ];
 *
 * const edges = [
 *   { source: '01HQ...', target: '01HR...' },
 * ];
 *
 * <GraphView
 *   nodes={nodes}
 *   edges={edges}
 *   onNodeClick={(id) => navigate(`/page/${id}`)}
 *   highlightedNodeId="01HQ..."
 *   colorByCommunity
 *   sizeByPageRank
 * />
 * ```
 */

// Type for ref
export type GraphViewRef = ForceGraphMethods<InternalNode, InternalLink> | undefined;

export const GraphView = memo(
  forwardRef<GraphViewRef, GraphViewProps>(function GraphView(
    {
      nodes,
      edges,
      onNodeClick,
      onNodeHover,
      highlightedNodeId,
      colorByCommunity = false,
      sizeByPageRank = false,
      labelColor = LABEL_COLOR,
      width = 800,
      height = 600,
      className,
    },
    ref
  ) {
    const graphRef = useRef<ForceGraphMethods<InternalNode, InternalLink>>(undefined);

    // Expose graph methods via ref
    useImperativeHandle(ref, () => graphRef.current);

    // Transform nodes to internal format
    const graphData = useMemo(() => {
      const internalNodes: InternalNode[] = nodes.map((node) => ({
        id: node.id,
        title: node.title,
        pageRank: node.pageRank,
        community: node.community,
      }));

      const internalLinks: InternalLink[] = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        isBidirectional: edge.isBidirectional,
      }));

      return { nodes: internalNodes, links: internalLinks };
    }, [nodes, edges]);

    // Calculate PageRank range for normalization
    const pageRankRange = useMemo(() => {
      if (!sizeByPageRank) return { min: 0, max: 1 };

      const ranks = nodes.map((n) => n.pageRank).filter((r): r is number => r !== undefined);

      if (ranks.length === 0) return { min: 0, max: 1 };

      return {
        min: Math.min(...ranks),
        max: Math.max(...ranks),
      };
    }, [nodes, sizeByPageRank]);

    // Get node color based on community or highlight status
    const getNodeColor = useCallback(
      (node: InternalNode): string => {
        const nodeId = node.id;
        // Highlighted node takes precedence
        if (highlightedNodeId && nodeId === highlightedNodeId) {
          return HIGHLIGHT_NODE_COLOR;
        }

        // Color by community if enabled
        if (colorByCommunity && node.community !== undefined) {
          const colorIndex = node.community % COMMUNITY_COLORS.length;
          return COMMUNITY_COLORS[colorIndex] ?? DEFAULT_NODE_COLOR;
        }

        return DEFAULT_NODE_COLOR;
      },
      [highlightedNodeId, colorByCommunity]
    );

    // Get node radius based on PageRank or highlight status
    const getNodeRadius = useCallback(
      (node: InternalNode): number => {
        let radius = DEFAULT_NODE_RADIUS;

        // Size by PageRank if enabled
        if (sizeByPageRank && node.pageRank !== undefined) {
          const { min, max } = pageRankRange;
          const range = max - min || 1; // Avoid division by zero
          const normalized = (node.pageRank - min) / range;
          radius = MIN_NODE_RADIUS + normalized * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
        }

        // Scale up highlighted node
        const nodeId = node.id;
        if (highlightedNodeId && nodeId === highlightedNodeId) {
          radius *= HIGHLIGHT_RADIUS_MULTIPLIER;
        }

        return radius;
      },
      [highlightedNodeId, sizeByPageRank, pageRankRange]
    );

    // Handle node click
    const handleNodeClick = useCallback(
      (node: InternalNode) => {
        const nodeId = node.id;
        if (typeof nodeId === 'string') {
          onNodeClick(nodeId as PageId);
        }
      },
      [onNodeClick]
    );

    // Handle node hover
    const handleNodeHover = useCallback(
      (node: InternalNode | null) => {
        if (!onNodeHover) return;

        if (node) {
          const nodeId = node.id;
          if (typeof nodeId === 'string') {
            onNodeHover(nodeId as PageId);
          }
        } else {
          onNodeHover(null);
        }
      },
      [onNodeHover]
    );

    // Custom node canvas rendering
    const nodeCanvasObject = useCallback(
      (node: InternalNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x = 0, y = 0, title } = node;

        const radius = getNodeRadius(node);
        const color = getNodeColor(node);

        // Draw node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw label when zoomed in enough
        const fontSize = 12 / globalScale;
        if (fontSize >= 2 && fontSize <= 8) {
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = labelColor;
          ctx.fillText(title, x, y + radius + fontSize);
        }
      },
      [getNodeColor, getNodeRadius, labelColor]
    );

    // Custom node pointer area (for click/hover detection)
    const nodePointerAreaPaint = useCallback(
      (node: InternalNode, color: string, ctx: CanvasRenderingContext2D) => {
        const { x = 0, y = 0 } = node;
        const radius = getNodeRadius(node);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      },
      [getNodeRadius]
    );

    // Get node label for tooltip
    const getNodeLabel = useCallback((node: InternalNode): string => {
      return node.title;
    }, []);

    return (
      <div
        className={className}
        style={{ ...styles.container, width, height }}
        data-testid="graph-view"
      >
        <ForceGraph2D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeId="id"
          nodeLabel={getNodeLabel}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          linkColor={() => EDGE_COLOR}
          linkWidth={1}
          linkDirectionalArrowLength={ARROW_LENGTH}
          linkDirectionalArrowRelPos={(link: InternalLink) =>
            calculateArrowPosition(link, getNodeRadius)
          }
          linkDirectionalArrowColor={() => EDGE_COLOR}
          linkCurvature={(link: InternalLink) => {
            // For bidirectional links, curve slightly to separate the arrows
            return link.isBidirectional ? BIDIRECTIONAL_CURVATURE : 0;
          }}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={100}
          onEngineStop={() => {
            // Graph layout has stabilized
          }}
        />
      </div>
    );
  })
);

// Re-export types for convenience
export type { ForceGraphMethods };
