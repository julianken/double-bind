/**
 * MiniGraph - Compact graph component for page neighborhood visualization
 *
 * Renders a small force-directed graph showing a page and its immediate
 * connections. Designed for panels, sidebars, and compact spaces.
 * Simpler than GraphView - no zoom controls, fixed size.
 *
 * Features:
 * - Center node visually emphasized (larger, different color)
 * - Click to navigate to connected pages
 * - Works at small sizes (minimum 200x150)
 * - Fixed dimensions via props
 */

import {
  type CSSProperties,
  memo,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from 'react-force-graph-2d';
import type { PageId } from '@double-bind/types';

// ============================================================================
// Constants (defined before hooks that use them)
// ============================================================================

const COLORS = {
  centerNode: '#3b82f6', // Blue-500
  normalNode: '#6b7280', // Gray-500
  link: '#94a3b8', // Slate-400 (matches GraphView EDGE_COLOR)
  textLight: '#1e293b', // Slate-800 for light mode
  textDark: '#e2e8f0', // Slate-200 for dark mode
  background: 'transparent',
} as const;

// ============================================================================
// Theme Detection
// ============================================================================

/**
 * Detect if dark mode is active by checking the data-theme attribute.
 */
function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Hook to get theme-aware colors for canvas rendering.
 * Listens for theme changes via data-theme attribute mutations.
 * Uses static colors that match GraphView for consistency.
 * Returns a themeKey to force ForceGraph2D canvas repaint on theme change.
 */
function useThemeColors() {
  const [isDark, setIsDark] = useState(isDarkMode);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    // Watch for theme changes on document element
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          setIsDark(isDarkMode());
          break;
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return {
    textColor: isDark ? COLORS.textDark : COLORS.textLight,
    linkColor: COLORS.link,
    themeKey: isDark ? 'dark' : 'light',
  };
}

// ============================================================================
// Types
// ============================================================================

export interface MiniGraphNode {
  id: PageId;
  title: string;
}

export interface MiniGraphEdge {
  source: PageId;
  target: PageId;
  /** When true, indicates a bidirectional link (A→B and B→A both exist) */
  isBidirectional?: boolean;
}

export interface MiniGraphProps {
  /** The ID of the center node (will be emphasized) */
  centerNodeId: PageId;

  /** Array of nodes to display */
  nodes: MiniGraphNode[];

  /** Array of edges connecting nodes */
  edges: MiniGraphEdge[];

  /** Width of the graph container (default: 200) */
  width?: number;

  /** Height of the graph container (default: 150) */
  height?: number;

  /** Callback when a node is clicked */
  onNodeClick?: (pageId: PageId) => void;

  /** Optional CSS class name */
  className?: string;
}

// Internal node type with computed properties
interface GraphNode extends NodeObject {
  id: PageId;
  title: string;
  isCenter: boolean;
}

// Internal link type
interface GraphLink extends LinkObject {
  source: PageId | GraphNode;
  target: PageId | GraphNode;
  isBidirectional?: boolean;
}

// ============================================================================
// Layout Constants
// ============================================================================

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;

const SIZES = {
  centerNodeRadius: 8,
  normalNodeRadius: 5,
  linkWidth: 1,
  fontSize: 10,
  arrowSize: 4, // Arrow head size for mini graph (smaller than main graph)
} as const;

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '4px',
  } satisfies CSSProperties,
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * MiniGraph component for compact neighborhood visualization.
 *
 * @example
 * ```tsx
 * <MiniGraph
 *   centerNodeId="page-1"
 *   nodes={[
 *     { id: 'page-1', title: 'Current Page' },
 *     { id: 'page-2', title: 'Linked Page' },
 *   ]}
 *   edges={[{ source: 'page-1', target: 'page-2' }]}
 *   width={250}
 *   height={200}
 *   onNodeClick={(id) => navigateToPage(id)}
 * />
 * ```
 */
export const MiniGraph = memo(function MiniGraph({
  centerNodeId,
  nodes,
  edges,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  onNodeClick,
  className,
}: MiniGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const hasPerformedInitialCenter = useRef(false);
  const { textColor, linkColor, themeKey } = useThemeColors();

  // Transform nodes to include isCenter flag
  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((node) => ({
      id: node.id,
      title: node.title,
      isCenter: node.id === centerNodeId,
    }));

    const graphLinks: GraphLink[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      isBidirectional: edge.isBidirectional,
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, centerNodeId]);

  // Calculate optimal zoom level to fit all nodes with padding
  const calculateOptimalZoom = useCallback(
    (bbox: { x: [number, number]; y: [number, number] } | null, viewportWidth: number, viewportHeight: number, padding: number): number => {
      if (!bbox) return 1;
      const graphWidth = bbox.x[1] - bbox.x[0];
      const graphHeight = bbox.y[1] - bbox.y[0];
      if (graphWidth === 0 && graphHeight === 0) return 1.5; // Single node
      if (graphWidth === 0 || graphHeight === 0) return 1; // Linear
      const zoomX = (viewportWidth - padding * 2) / graphWidth;
      const zoomY = (viewportHeight - padding * 2) / graphHeight;
      return Math.max(0.1, Math.min(3.0, Math.min(zoomX, zoomY)));
    },
    []
  );

  // Handle engine stop - center selected node and auto-zoom to fit
  const handleEngineStop = useCallback(() => {
    if (!graphRef.current) return;
    const centerNode = graphData.nodes.find(n => n.id === centerNodeId);
    const bbox = graphRef.current.getGraphBbox();
    const animationMs = hasPerformedInitialCenter.current ? 400 : 0;

    if (centerNode?.x !== undefined && centerNode?.y !== undefined) {
      graphRef.current.centerAt(centerNode.x, centerNode.y, animationMs);
    }

    const optimalZoom = calculateOptimalZoom(bbox, width, height, 15);
    graphRef.current.zoom(optimalZoom, animationMs);
    hasPerformedInitialCenter.current = true;
  }, [centerNodeId, graphData.nodes, width, height, calculateOptimalZoom]);

  // Re-center when center node changes (after initial render)
  useEffect(() => {
    if (!graphRef.current || !hasPerformedInitialCenter.current) return;
    const centerNode = graphData.nodes.find(n => n.id === centerNodeId);
    if (!centerNode?.x || !centerNode?.y) return;
    graphRef.current.centerAt(centerNode.x, centerNode.y, 400);
  }, [centerNodeId, graphData.nodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  // Custom node rendering
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = node.isCenter ? SIZES.centerNodeRadius : SIZES.normalNodeRadius;
      const color = node.isCenter ? COLORS.centerNode : COLORS.normalNode;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Only draw label for center node to keep compact view clean
      // Other node names show on hover via tooltip
      if (node.isCenter) {
        const label = node.title.length > 12 ? node.title.substring(0, 12) + '...' : node.title;
        const fontSize = SIZES.fontSize / globalScale;

        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = textColor; // Theme-aware text color
        ctx.fillText(label, x, y + radius + 2);
      }
    },
    [textColor]
  );

  // Node tooltip (title only for simplicity)
  const nodeLabel = useCallback((node: GraphNode) => node.title, []);

  // Don't render if no nodes
  if (nodes.length === 0) {
    return (
      <div
        className={className}
        style={{
          ...styles.container,
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.normalNode,
          fontSize: '12px',
        }}
        data-testid="mini-graph-empty"
      >
        No connections
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ ...styles.container, width, height }}
      data-testid="mini-graph"
      data-center-node={centerNodeId}
    >
      <ForceGraph2D
        key={themeKey} // Force remount on theme change for canvas repaint
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor={COLORS.background}
        // Node configuration
        nodeCanvasObject={paintNode}
        nodeLabel={nodeLabel}
        onNodeClick={handleNodeClick}
        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const radius = node.isCenter ? SIZES.centerNodeRadius : SIZES.normalNodeRadius;
          ctx.beginPath();
          ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        // Link configuration - use built-in directional arrows
        linkColor={() => linkColor}
        linkWidth={SIZES.linkWidth}
        linkDirectionalArrowLength={SIZES.arrowSize}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => linkColor}
        linkCurvature={(link: GraphLink) => link.isBidirectional ? 0.15 : 0}
        // Centering and zoom
        onEngineStop={handleEngineStop}
        // Disable zoom/pan interactions for compact view
        enableZoomInteraction={false}
        enablePanInteraction={false}
        // Force simulation settings for compact layout
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
        cooldownTime={1000}
        warmupTicks={50}
      />
    </div>
  );
});
