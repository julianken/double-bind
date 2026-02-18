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

// ---------------------------------------------------------------------------
// OKLCH community color helpers (inline)
// ---------------------------------------------------------------------------

function readCssToken(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const MINI_COMMUNITY_TOKENS = [
  '--graph-c0', '--graph-c1', '--graph-c2', '--graph-c3',
  '--graph-c4', '--graph-c5', '--graph-c6', '--graph-c7',
] as const;

const MINI_FALLBACK: readonly string[] = [
  'oklch(62% 0.14 283)', 'oklch(62% 0.15 30)',  'oklch(62% 0.15 145)',
  'oklch(62% 0.14 330)', 'oklch(62% 0.14 80)',  'oklch(62% 0.14 200)',
  'oklch(62% 0.14 250)', 'oklch(62% 0.15 10)',
];

function resolveOklchMiniColor(communityId: number): string {
  const idx = Math.abs(communityId) % MINI_COMMUNITY_TOKENS.length;
  const live = readCssToken(MINI_COMMUNITY_TOKENS[idx]!);
  return live !== '' ? live : (MINI_FALLBACK[idx] ?? MINI_FALLBACK[0]!);
}

// ============================================================================
// Constants (defined before hooks that use them)
// ============================================================================

const COLORS = {
  centerNode: '#3b82f6', // Blue-500
  normalNode: '#6b7280', // Gray-500
  link: '#94a3b8', // Slate-400 (matches GraphView EDGE_COLOR)
  textLight: '#1e293b', // Slate-800 for light mode
  textDark: '#e2e8f0', // Slate-200 for dark mode
  textLightSecondary: 'rgba(30, 41, 59, 0.75)', // Slate-800 at 75% opacity (WCAG AA compliant)
  textDarkSecondary: 'rgba(226, 232, 240, 0.75)', // Slate-200 at 75% opacity (WCAG AA compliant)
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate a label to a maximum length, preferring word boundaries.
 * @param text - The text to truncate
 * @param maxLength - Maximum length in characters
 * @returns Truncated text with ellipsis if needed
 */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.6) {
    // If we found a space in the latter 40% of the string, use it
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Otherwise just hard truncate
  return truncated + '...';
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
    textColorSecondary: isDark ? COLORS.textDarkSecondary : COLORS.textLightSecondary,
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
  /** Optional community id for OKLCH color encoding */
  community?: number;
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

  /**
   * When true, use a radial layout (center node at origin, rings by BFS distance).
   * When false (default), use force-directed layout.
   */
  useRadialLayout?: boolean;

  /**
   * When true, color nodes by their community using OKLCH tokens.
   * Requires `community` property on MiniGraphNode.
   */
  colorByCommunity?: boolean;
}

// Internal node type with computed properties
interface GraphNode extends NodeObject {
  id: PageId;
  title: string;
  isCenter: boolean;
  community?: number;
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
  nodeRadius: 5, // Same size for all nodes
  linkWidth: 1,
  fontSize: 10, // Consistent font size
  labelOffset: 8, // Distance from node center to label
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
  useRadialLayout = false,
  colorByCommunity = false,
}: MiniGraphProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const hasPerformedInitialCenter = useRef(false);
  const { textColor, textColorSecondary, linkColor, themeKey } = useThemeColors();

  // Transform nodes to include isCenter flag and community
  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((node) => ({
      id: node.id,
      title: node.title,
      isCenter: node.id === centerNodeId,
      community: node.community,
    }));

    const graphLinks: GraphLink[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      isBidirectional: edge.isBidirectional,
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, centerNodeId]);


  // Apply radial positions when useRadialLayout is enabled
  const radialGraphData = useMemo(() => {
    if (!useRadialLayout) return graphData;

    const radius = Math.min(width, height) / 2 * 0.7;

    // Inline BFS-based radial layout (mirrors radialLayout.ts from desktop)
    const adj = new Map<string, string[]>();
    for (const link of graphData.links) {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      const a = adj.get(src) ?? []; a.push(tgt); adj.set(src, a);
      const b = adj.get(tgt) ?? []; b.push(src); adj.set(tgt, b);
    }

    // BFS distances from centerNodeId.
    // Use a head pointer instead of Array.shift() to keep BFS O(V+E).
    const dist = new Map<string, number>();
    dist.set(centerNodeId, 0);
    let head = 0;
    const queue = [centerNodeId];
    while (head < queue.length) {
      const cur = queue[head++]!;
      const curDist = dist.get(cur) ?? 0;
      for (const nb of adj.get(cur) ?? []) {
        if (!dist.has(nb)) { dist.set(nb, curDist + 1); queue.push(nb); }
      }
    }

    // Group by ring
    const rings = new Map<number, string[]>();
    for (const node of graphData.nodes) {
      if (node.id === centerNodeId) continue;
      const d = dist.get(node.id) ?? Infinity;
      const ringIdx = isFinite(d) ? d : 99;
      const r = rings.get(ringIdx) ?? []; r.push(node.id); rings.set(ringIdx, r);
    }

    const RING_SCALE = [0, 0.45, 0.80, 1.0];
    const getRingRadius = (i: number) => {
      if (i === 0) return 0;
      return radius * (RING_SCALE[Math.min(i, RING_SCALE.length - 1)] ?? 1.0);
    };

    const positions = new Map<string, { x: number; y: number }>();
    positions.set(centerNodeId, { x: 0, y: 0 });
    for (const [ringIdx, ringNodes] of rings.entries()) {
      const r = getRingRadius(ringIdx);
      const angleStep = (2 * Math.PI) / ringNodes.length;
      ringNodes.forEach((id, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        positions.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      });
    }

    // Apply positions as fixed (fx, fy) so the force sim doesn't move them
    const pinnedNodes = graphData.nodes.map((node) => {
      const pos = positions.get(node.id);
      if (pos) {
        return { ...node, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y };
      }
      return node;
    });

    return { nodes: pinnedNodes, links: graphData.links };
  }, [useRadialLayout, graphData, centerNodeId, width, height]);

  // Handle engine stop - center selected node and set zoom
  const handleEngineStop = useCallback(() => {
    if (!graphRef.current) return;
    const centerNode = radialGraphData.nodes.find(n => n.id === centerNodeId);
    const animationMs = hasPerformedInitialCenter.current ? 400 : 0;

    if (centerNode?.x !== undefined && centerNode?.y !== undefined) {
      graphRef.current.centerAt(centerNode.x, centerNode.y, animationMs);
    }

    // On initial load, set zoom to 1.5x after 500ms
    if (!hasPerformedInitialCenter.current) {
      setTimeout(() => {
        graphRef.current?.zoom(1.5, 400);
      }, 500);
    }

    hasPerformedInitialCenter.current = true;
  }, [centerNodeId, radialGraphData.nodes]);

  // Re-center when center node changes (after initial render)
  useEffect(() => {
    if (!graphRef.current || !hasPerformedInitialCenter.current) return;
    const centerNode = radialGraphData.nodes.find(n => n.id === centerNodeId);
    if (!centerNode?.x || !centerNode?.y) return;
    graphRef.current.centerAt(centerNode.x, centerNode.y, 400);
  }, [centerNodeId, radialGraphData.nodes]);

  // Configure d3 forces to keep nodes clustered toward center
  useEffect(() => {
    if (!graphRef.current) return;
    if (useRadialLayout) {
      // For radial layout, disable force simulation (positions are fixed)
      graphRef.current.d3Force('charge')?.strength?.(0);
      graphRef.current.d3Force('link')?.strength?.(0);
      graphRef.current.d3Force('center')?.strength?.(0);
    } else {
      // Strengthen the center force to pull nodes toward viewport center
      graphRef.current.d3Force('center')?.strength?.(1);
      // Reduce charge repulsion to keep nodes closer together
      graphRef.current.d3Force('charge')?.strength?.(-30);
    }
  }, [useRadialLayout]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  // Custom node rendering — supports OKLCH community colors
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Determine node color
      let color: string;
      if (node.isCenter) {
        color = readCssToken('--graph-node-center') || COLORS.centerNode;
      } else if (colorByCommunity && node.community !== undefined) {
        color = resolveOklchMiniColor(node.community);
      } else {
        color = COLORS.normalNode;
      }

      // Draw node circle (same size for all)
      ctx.beginPath();
      ctx.arc(x, y, SIZES.nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw label below node (consistent positioning for all)
      const label = truncateLabel(node.title, 15);
      const fontSize = SIZES.fontSize / globalScale;

      ctx.font = node.isCenter ? `bold ${fontSize}px sans-serif` : `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = node.isCenter ? textColor : textColorSecondary;

      const labelY = y + SIZES.labelOffset;
      ctx.fillText(label, x, labelY);
    },
    [textColor, textColorSecondary, colorByCommunity]
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
        graphData={radialGraphData}
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
          ctx.beginPath();
          ctx.arc(x, y, SIZES.nodeRadius + 2, 0, 2 * Math.PI);
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
