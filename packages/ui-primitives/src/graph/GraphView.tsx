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
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from 'react-force-graph-2d';

// ---------------------------------------------------------------------------
// OKLCH community color helpers (inline — avoids cross-package import)
// ---------------------------------------------------------------------------

/** Read a CSS custom property from the document root. Returns '' if unavailable. */
function readCssToken(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const COMMUNITY_CSS_TOKENS = [
  '--graph-c0', '--graph-c1', '--graph-c2', '--graph-c3',
  '--graph-c4', '--graph-c5', '--graph-c6', '--graph-c7',
] as const;

const COMMUNITY_FALLBACK: readonly string[] = [
  'oklch(62% 0.14 283)', 'oklch(62% 0.15 30)',  'oklch(62% 0.15 145)',
  'oklch(62% 0.14 330)', 'oklch(62% 0.14 80)',  'oklch(62% 0.14 200)',
  'oklch(62% 0.14 250)', 'oklch(62% 0.15 10)',
];

function resolveOklchCommunityColor(communityId: number): string {
  const idx = Math.abs(communityId) % COMMUNITY_CSS_TOKENS.length;
  const live = readCssToken(COMMUNITY_CSS_TOKENS[idx]!);
  return live !== '' ? live : (COMMUNITY_FALLBACK[idx] ?? COMMUNITY_FALLBACK[0]!);
}

// ============================================================================
// Theme Reactivity
// ============================================================================

/**
 * Returns a `themeKey` string ('dark' | 'light') that updates whenever the
 * `data-theme` attribute on `document.documentElement` changes.
 *
 * Passing `themeKey` as the `key` prop on ForceGraph2D forces a full canvas
 * remount on theme change, ensuring OKLCH CSS tokens are re-read at paint time.
 */
function useGraphThemeKey(): string {
  const [themeKey, setThemeKey] = useState<string>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') ?? 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          const next = document.documentElement.getAttribute('data-theme') ?? 'light';
          setThemeKey(next);
          break;
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return themeKey;
}

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
   * Receives the pageId and the originating MouseEvent.
   * Check event.shiftKey to detect shift+click for path highlighting.
   */
  onNodeClick: (pageId: PageId, event: MouseEvent) => void;

  /**
   * Callback fired when a node is hovered.
   * Receives null when the mouse leaves a node.
   */
  onNodeHover?: (pageId: PageId | null) => void;

  /**
   * Callback fired when a node is right-clicked.
   * Receives the pageId and mouse event coordinates.
   */
  onNodeRightClick?: (pageId: PageId, x: number, y: number) => void;

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

  /**
   * Set of node IDs that are part of the active path highlight.
   * These nodes are rendered with a distinct style.
   */
  pathNodeIds?: Set<PageId>;

  /**
   * Set of edge keys ("source->target") that are part of the active path.
   * These edges are rendered thicker with a glow.
   */
  pathEdgeKeys?: Set<string>;

  /**
   * Set of node IDs that have been lasso-selected.
   * These nodes are rendered with a selection ring.
   */
  selectedNodeIds?: Set<PageId>;

  /**
   * Encoding mode that determines the coloring strategy.
   * - 'primary'  — community OKLCH colors (default)
   * - 'orphan'   — highlight disconnected nodes
   * - 'recency'  — color by last-modified (requires lastModifiedAt on nodes)
   */
  encodingMode?: 'primary' | 'orphan' | 'recency';

  /**
   * Degree map: node ID → number of connections.
   * Required for 'orphan' encoding mode.
   */
  degreeMap?: Map<PageId, number>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default node color (OKLCH indigo) */
const DEFAULT_NODE_COLOR = 'oklch(62% 0.14 283)';

/** Highlighted node color (OKLCH amber) */
const HIGHLIGHT_NODE_COLOR = 'oklch(68% 0.20 55)';

/** Path node glow color */
const PATH_NODE_COLOR = 'oklch(65% 0.22 145)'; // emerald

/** Orphan node color (isolated nodes) */
const ORPHAN_NODE_COLOR = 'oklch(62% 0.18 25)';

/** Edge color */
const EDGE_COLOR = 'oklch(55% 0.04 265 / 60%)';

/** Path edge color (highlighted) */
const PATH_EDGE_COLOR = 'oklch(65% 0.22 145)';

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
      onNodeRightClick,
      highlightedNodeId,
      colorByCommunity = false,
      sizeByPageRank = false,
      labelColor = LABEL_COLOR,
      width = 800,
      height = 600,
      className,
      pathNodeIds,
      pathEdgeKeys,
      selectedNodeIds,
      encodingMode = 'primary',
      degreeMap,
    },
    ref
  ) {
    const graphRef = useRef<ForceGraphMethods<InternalNode, InternalLink>>(undefined);

    // Expose graph methods via ref
    useImperativeHandle(ref, () => graphRef.current);

    // Force canvas remount when the theme changes so OKLCH CSS tokens are
    // re-read at paint time (canvas rendering bypasses React reconciliation).
    const themeKey = useGraphThemeKey();

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

    // Get node color based on encoding mode, community, highlight, and path status
    const getNodeColor = useCallback(
      (node: InternalNode): string => {
        const nodeId = node.id as string;

        // Highlighted node takes precedence over everything
        if (highlightedNodeId && nodeId === highlightedNodeId) {
          return HIGHLIGHT_NODE_COLOR;
        }

        // Path-highlighted node (secondary emphasis)
        if (pathNodeIds?.has(nodeId)) {
          return PATH_NODE_COLOR;
        }

        // Encoding mode: orphan — highlight disconnected nodes
        if (encodingMode === 'orphan') {
          const degree = degreeMap?.get(nodeId) ?? 0;
          if (degree === 0) return ORPHAN_NODE_COLOR;
          return degree <= 2
            ? readCssToken('--graph-low-connect') || 'oklch(64% 0.15 55)'
            : readCssToken('--graph-well-connect') || 'oklch(60% 0.14 145)';
        }

        // Encoding mode: recency — use warm/cold gradient based on community
        // (Full recency requires lastModifiedAt data; use community as proxy here)
        if (encodingMode === 'recency') {
          if (node.community !== undefined) {
            return resolveOklchCommunityColor(node.community);
          }
          return readCssToken('--graph-recency-cold') || 'oklch(60% 0.10 230)';
        }

        // Primary mode: color by community (OKLCH)
        if (colorByCommunity && node.community !== undefined) {
          return resolveOklchCommunityColor(node.community);
        }

        return DEFAULT_NODE_COLOR;
      },
      [highlightedNodeId, colorByCommunity, pathNodeIds, encodingMode, degreeMap]
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

    // Handle node click — forward the native MouseEvent so callers can inspect
    // event.shiftKey for path-highlighting interactions.
    const handleNodeClick = useCallback(
      (node: InternalNode, event: MouseEvent) => {
        const nodeId = node.id;
        if (typeof nodeId === 'string') {
          onNodeClick(nodeId as PageId, event);
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

    // Handle node right-click
    const handleNodeRightClick = useCallback(
      (node: InternalNode, event: MouseEvent) => {
        if (!onNodeRightClick) return;
        const nodeId = node.id;
        if (typeof nodeId === 'string') {
          onNodeRightClick(nodeId as PageId, event.clientX, event.clientY);
        }
      },
      [onNodeRightClick]
    );

    // Custom node canvas rendering — supports path glow, selection ring, OKLCH colors
    const nodeCanvasObject = useCallback(
      (node: InternalNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x = 0, y = 0, title } = node;
        const nodeId = node.id as string;

        const radius = getNodeRadius(node);
        const color = getNodeColor(node);
        const isSelected = selectedNodeIds?.has(nodeId) ?? false;
        const isOnPath = pathNodeIds?.has(nodeId) ?? false;

        // Draw path glow (drawn first, behind the node)
        if (isOnPath) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'oklch(65% 0.22 145 / 30%)';
          ctx.fill();
          ctx.restore();
        }

        // Draw selection ring
        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
          ctx.strokeStyle = 'oklch(60% 0.18 250 / 80%)';
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
          ctx.restore();
        }

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
      [getNodeColor, getNodeRadius, labelColor, selectedNodeIds, pathNodeIds]
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

    // Determine edge color — highlighted path edges get a distinct color
    const getLinkColor = useCallback(
      (link: InternalLink): string => {
        if (pathEdgeKeys && pathEdgeKeys.size > 0) {
          const source = typeof link.source === 'object' ? (link.source as InternalNode).id : link.source;
          const target = typeof link.target === 'object' ? (link.target as InternalNode).id : link.target;
          if (
            pathEdgeKeys.has(`${source as string}->${target as string}`) ||
            pathEdgeKeys.has(`${target as string}->${source as string}`)
          ) {
            return PATH_EDGE_COLOR;
          }
        }
        return EDGE_COLOR;
      },
      [pathEdgeKeys]
    );

    // Determine edge width — path edges are thicker
    const getLinkWidth = useCallback(
      (link: InternalLink): number => {
        if (pathEdgeKeys && pathEdgeKeys.size > 0) {
          const source = typeof link.source === 'object' ? (link.source as InternalNode).id : link.source;
          const target = typeof link.target === 'object' ? (link.target as InternalNode).id : link.target;
          if (
            pathEdgeKeys.has(`${source as string}->${target as string}`) ||
            pathEdgeKeys.has(`${target as string}->${source as string}`)
          ) {
            return 2.5;
          }
        }
        return 1;
      },
      [pathEdgeKeys]
    );

    return (
      <div
        className={className}
        style={{ ...styles.container, width, height }}
        data-testid="graph-view"
      >
        <ForceGraph2D
          key={themeKey}
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
          onNodeRightClick={handleNodeRightClick}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkDirectionalArrowLength={ARROW_LENGTH}
          linkDirectionalArrowRelPos={(link: InternalLink) =>
            calculateArrowPosition(link, getNodeRadius)
          }
          linkDirectionalArrowColor={getLinkColor}
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
