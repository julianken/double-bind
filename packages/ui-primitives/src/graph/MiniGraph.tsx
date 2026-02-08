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
// Theme Detection
// ============================================================================

/**
 * Get computed CSS variable value from the document.
 * Falls back to provided default if unavailable.
 */
function getCSSVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Hook to get theme-aware colors for canvas rendering.
 * Listens for theme changes via data-theme attribute mutations.
 */
function useThemeColors() {
  const [textColor, setTextColor] = useState(() =>
    getCSSVariable('--text-primary', '#1f2937')
  );
  const [linkColor, setLinkColor] = useState(() =>
    getCSSVariable('--border-default', '#d1d5db')
  );

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const updateColors = () => {
      setTextColor(getCSSVariable('--text-primary', '#1f2937'));
      setLinkColor(getCSSVariable('--border-default', '#d1d5db'));
    };

    // Initial update
    updateColors();

    // Watch for theme changes on document element
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          updateColors();
          break;
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return { textColor, linkColor };
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
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;

const COLORS = {
  centerNode: '#3b82f6', // Blue-500
  normalNode: '#6b7280', // Gray-500
  link: '#d1d5db', // Gray-300
  text: '#1f2937', // Gray-800
  background: 'transparent',
} as const;

const SIZES = {
  centerNodeRadius: 8,
  normalNodeRadius: 5,
  linkWidth: 1,
  fontSize: 10,
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
  const { textColor, linkColor } = useThemeColors();

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
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, centerNodeId]);

  // Center the graph after simulation settles
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    // Wait for simulation to settle, then fit to view
    const timer = setTimeout(() => {
      // zoomToFit maintains readable size by fitting all nodes with padding
      fg.zoomToFit(300, 20);
    }, 500);

    return () => clearTimeout(timer);
  }, [centerNodeId]);

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

      // Draw label for center node or when zoomed in
      if (node.isCenter || globalScale > 1.5) {
        const label = node.title.length > 15 ? node.title.substring(0, 15) + '...' : node.title;
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

  // Custom link rendering
  const paintLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const sourceNode = link.source as GraphNode;
      const targetNode = link.target as GraphNode;

      if (!sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.strokeStyle = linkColor; // Theme-aware link color
      ctx.lineWidth = SIZES.linkWidth;
      ctx.stroke();
    },
    [linkColor]
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
        // Link configuration
        linkCanvasObject={paintLink}
        // Disable zoom/pan for compact view
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
