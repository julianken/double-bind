/**
 * GraphViewScreen - Full-screen graph visualization of the knowledge base
 *
 * Displays the entire knowledge graph using the GraphView component from ui-primitives.
 * Supports:
 * - OKLCH community color encoding
 * - Lasso selection (draw polygon to select nodes)
 * - Path highlighting (click source → shift+click target → show shortest path)
 * - Encoding mode toggle (community / orphan / recency)
 * - Hop-count neighborhood filtering
 * - Hover preview popover
 * - Node right-click context menu
 * - Loading and empty states
 *
 * Accessible via Ctrl+G keyboard shortcut.
 */

import { type ReactElement, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type { PageId, Page, Link } from '@double-bind/types';
import { GraphView, type GraphNode, type GraphEdge, type GraphViewRef } from '@double-bind/ui-primitives';
import { useServices } from '../providers/index.js';
import { useCozoQuery } from '../hooks/index.js';
import { useAppStore } from '../stores/index.js';
import { useGraphStore } from '../stores/graph-store.js';
import type { RouteComponentProps } from '../components/Router.js';
import type { GraphResult } from '@double-bind/core';
import { findShortestPath, pathToEdgeSet } from '../graph/shortestPath.js';
import { GraphViewToolbar } from '../components/graph/GraphViewToolbar.js';
import { LassoSelectionOverlay, type Point, pointInPolygon } from '../components/graph/LassoSelectionOverlay.js';
import { PathHighlightControls } from '../components/graph/PathHighlightControls.js';
import { HopSelector, type HopCount } from '../components/graph/HopSelector.js';
import { HoverPreviewPopover } from '../components/graph/HoverPreviewPopover.js';
import { ContextMenu } from '../components/graph/ContextMenu.js';
import { useGraphNodeContextMenu } from '../hooks/useGraphNodeContextMenu.js';

// ============================================================================
// Types
// ============================================================================

export type GraphViewScreenProps = RouteComponentProps;

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

// ============================================================================
// Hooks
// ============================================================================

function useGraphData(): {
  data: GraphData | undefined;
  isLoading: boolean;
  error: Error | null;
  pageRankMap: Map<PageId, number> | undefined;
  communityMap: Map<PageId, number> | undefined;
} {
  const { graphService } = useServices();

  const graphQueryFn = useCallback(() => graphService.getFullGraph(), [graphService]);
  const { data: graphResult, isLoading: graphLoading, error: graphError } =
    useCozoQuery<GraphResult>(['graph', 'full'], graphQueryFn);

  const pageRankQueryFn = useCallback(() => graphService.getPageRank(), [graphService]);
  const { data: pageRankMap } = useCozoQuery<Map<PageId, number>>(
    ['graph', 'pageRank'],
    pageRankQueryFn
  );

  const communityQueryFn = useCallback(() => graphService.getCommunities(), [graphService]);
  const { data: communityMap } = useCozoQuery<Map<PageId, number>>(
    ['graph', 'communities'],
    communityQueryFn
  );

  const data = useMemo((): GraphData | undefined => {
    if (!graphResult) return undefined;

    const nodes: GraphNode[] = graphResult.nodes.map((page: Page) => ({
      id: page.pageId,
      title: page.title,
      pageRank: pageRankMap?.get(page.pageId),
      community: communityMap?.get(page.pageId),
    }));

    const edgeSet = new Set<string>();
    for (const link of graphResult.edges) {
      edgeSet.add(`${link.sourceId}->${link.targetId}`);
    }

    const edges: GraphEdge[] = graphResult.edges.map((link: Link) => {
      const reverseKey = `${link.targetId}->${link.sourceId}`;
      return {
        source: link.sourceId,
        target: link.targetId,
        isBidirectional: edgeSet.has(reverseKey),
      };
    });

    return { nodes, edges };
  }, [graphResult, pageRankMap, communityMap]);

  return {
    data,
    isLoading: graphLoading,
    error: graphError ?? null,
    pageRankMap,
    communityMap,
  };
}

// ============================================================================
// Sub-Components: States
// ============================================================================

function LoadingState() {
  return (
    <div
      className="graph-view-screen graph-view-screen--loading"
      data-testid="graph-view-loading"
      role="main"
      aria-busy="true"
      aria-label="Loading graph"
    >
      <div className="graph-view-screen__loading-indicator">Loading graph...</div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div
      className="graph-view-screen graph-view-screen--error"
      data-testid="graph-view-error"
      role="main"
      aria-label="Error loading graph"
    >
      <div className="graph-view-screen__error">
        <h1>Failed to load graph</h1>
        <p>{error.message}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="graph-view-screen graph-view-screen--empty"
      data-testid="graph-view-empty"
      role="main"
      aria-label="Empty graph"
    >
      <div className="graph-view-screen__empty">
        <h1>No pages yet</h1>
        <p>Create some pages to see them in the graph view.</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphViewScreen(_props: GraphViewScreenProps): ReactElement {
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const openRightPanel = useAppStore((state) => state.openRightPanel);

  // Graph data fetching
  const { data, isLoading, error } = useGraphData();

  // Graph store (encoding mode, path state, etc.)
  const encodingMode = useGraphStore((s) => s.encodingMode);
  const rawSetEncodingMode = useGraphStore((s) => s.setEncodingMode);

  const [colorByCommunity, setColorByCommunity] = useState(true);
  const [sizeByPageRank, setSizeByPageRank] = useState(true);

  // Link encoding mode to colorByCommunity: selecting "community" enables it
  const setEncodingMode = useCallback((mode: typeof encodingMode) => {
    rawSetEncodingMode(mode);
    if (mode === 'community') {
      setColorByCommunity(true);
    }
  }, [rawSetEncodingMode]);
  const pathSourceId = useGraphStore((s) => s.pathSourceId);
  const activePath = useGraphStore((s) => s.activePath);
  const setPathSource = useGraphStore((s) => s.setPathSource);
  const setActivePath = useGraphStore((s) => s.setActivePath);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectNode = useGraphStore((s) => s.selectNode);
  const clearNodeSelection = useGraphStore((s) => s.clearNodeSelection);
  const hoveredNode = useGraphStore((s) => s.hoveredNode);
  const setHoveredNode = useGraphStore((s) => s.setHoveredNode);
  const pinnedNodes = useGraphStore((s) => s.pinnedNodes);
  const pinNode = useGraphStore((s) => s.pinNode);
  const unpinNode = useGraphStore((s) => s.unpinNode);

  // Hop count for neighborhood filtering
  const [hopCount, setHopCount] = useState<HopCount>('all');

  // Lasso mode toggle
  const [lassoEnabled, setLassoEnabled] = useState(false);

  // Container dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref to the ForceGraph2D instance — used for coordinate conversion in lasso selection
  const graphViewRef = useRef<GraphViewRef>(undefined);

  // Track last known mouse position so HoverPreviewPopover can be positioned correctly.
  // onNodeHover only receives pageId — not mouse coordinates — so we capture position
  // via a mousemove listener on the graph container div.
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || DEFAULT_WIDTH,
          height: rect.height || DEFAULT_HEIGHT,
        });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ============================================================================
  // Derived Data
  // ============================================================================

  // Node title lookup map
  const nodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of data?.nodes ?? []) {
      map.set(node.id, node.title);
    }
    return map;
  }, [data?.nodes]);

  const getNodeTitle = useCallback(
    (nodeId: string) => nodeTitleMap.get(nodeId) ?? nodeId,
    [nodeTitleMap]
  );

  // Degree map for orphan encoding
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of data?.edges ?? []) {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1);
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
    }
    return map;
  }, [data?.edges]);

  // Path node + edge sets for rendering
  const pathNodeIds = useMemo(
    () => (activePath ? new Set(activePath) : undefined),
    [activePath]
  );

  const pathEdgeKeys = useMemo(
    () => (activePath ? pathToEdgeSet(activePath) : undefined),
    [activePath]
  );

  // Filtered nodes based on hop count (when a node is selected)
  const visibleData = useMemo(() => {
    if (!data || hopCount === 'all' || selectedNodeIds.size === 0) return data;

    // Build adjacency for hop filtering
    const adj = new Map<string, Set<string>>();
    for (const edge of data.edges) {
      const a = adj.get(edge.source) ?? new Set<string>();
      a.add(edge.target);
      adj.set(edge.source, a);
      const b = adj.get(edge.target) ?? new Set<string>();
      b.add(edge.source);
      adj.set(edge.target, b);
    }

    // BFS up to hopCount hops from all selected nodes
    const visible = new Set<string>(selectedNodeIds);
    let frontier = [...selectedNodeIds];
    for (let hop = 0; hop < hopCount; hop++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const nb of adj.get(id) ?? new Set()) {
          if (!visible.has(nb)) { visible.add(nb); next.push(nb); }
        }
      }
      frontier = next;
    }

    const filteredNodes = data.nodes.filter((n) => visible.has(n.id));
    const filteredEdges = data.edges.filter((e) => visible.has(e.source) && visible.has(e.target));
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [data, hopCount, selectedNodeIds]);

  // ============================================================================
  // Interaction Handlers
  // ============================================================================

  const handleNodeClick = useCallback(
    (pageId: PageId, event: MouseEvent) => {
      if (event.shiftKey) {
        // Shift+click: path-highlighting flow
        if (pathSourceId !== null) {
          // Source is already set — compute shortest path to this target node
          const path = findShortestPath(pathSourceId, pageId, data?.edges ?? []);
          setActivePath(path.length > 0 ? path : []);
          setPathSource(null);
        } else {
          // No source yet — set this node as the path source
          setPathSource(pageId);
        }
      } else {
        // Normal click: navigate to the page
        navigateToPage('page/' + pageId);
      }
    },
    [navigateToPage, pathSourceId, data?.edges, setActivePath, setPathSource]
  );

  const handleNodeHover = useCallback(
    (pageId: PageId | null) => {
      if (pageId === null) {
        setHoveredNode(null);
        return;
      }
      // Use the last known mouse position captured by the mousemove listener
      // on the graph container div — onNodeHover does not provide coordinates.
      setHoveredNode({ pageId, screenX: mousePos.current.x, screenY: mousePos.current.y });
    },
    [setHoveredNode]
  );

  const handleClearPath = useCallback(() => {
    setPathSource(null);
    setActivePath(null);
  }, [setPathSource, setActivePath]);

  // Lasso selection
  const handleLassoSelection = useCallback(
    (polygon: Point[]) => {
      if (!data) return;
      clearNodeSelection();

      const fg = graphViewRef.current;

      // Select nodes whose screen-space positions fall within the lasso polygon.
      // react-force-graph-2d stores node positions in graph-internal coordinates;
      // the lasso polygon is drawn in screen (canvas-element-relative) coordinates.
      // We use graph2ScreenCoords to convert each node's position to screen space
      // before the pointInPolygon test.
      for (const node of data.nodes) {
        const rawX = (node as unknown as { x?: number }).x ?? 0;
        const rawY = (node as unknown as { y?: number }).y ?? 0;

        let screenPos: Point;
        if (fg) {
          // Convert graph-internal coords to screen-space coords
          const converted = fg.graph2ScreenCoords(rawX, rawY);
          screenPos = { x: converted.x, y: converted.y };
        } else {
          // Fallback when ref is not yet populated (e.g. tests)
          screenPos = { x: rawX, y: rawY };
        }

        if (pointInPolygon(screenPos, polygon)) {
          selectNode(node.id);
        }
      }
    },
    [data, clearNodeSelection, selectNode]
  );

  // Context menu — right-click menu with path-finding option
  const contextMenu = useGraphNodeContextMenu({
    onOpenPage: (nodeId) => navigateToPage('page/' + nodeId),
    onOpenInSidebar: (_nodeId) => openRightPanel('backlinks'),
    onPinNode: (nodeId) => {
      if (pinnedNodes.has(nodeId)) {
        unpinNode(nodeId);
      } else {
        // Pin at last known position (0,0 fallback)
        pinNode(nodeId, { x: 0, y: 0 });
      }
    },
    onFindPath: (nodeId) => {
      // When a path source is set, right-clicking a target computes the path
      if (pathSourceId !== null) {
        const path = findShortestPath(pathSourceId, nodeId, data?.edges ?? []);
        setActivePath(path.length > 0 ? path : []);
      } else {
        // Set as path source (user can then right-click another node as target)
        setPathSource(nodeId);
      }
    },
    isPinned: (nodeId) => pinnedNodes.has(nodeId),
  });

  const handleNodeRightClick = useCallback(
    (pageId: PageId, x: number, y: number) => {
      contextMenu.open(pageId, x, y);
    },
    [contextMenu]
  );

  // ============================================================================
  // Render: Loading / Error / Empty States
  // ============================================================================

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!visibleData || visibleData.nodes.length === 0) return <EmptyState />;

  // ============================================================================
  // Render: Graph View
  // ============================================================================

  return (
    <div
      className="graph-view-screen"
      data-testid="graph-view-screen"
      role="main"
      aria-label="Graph view"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Primary toolbar: encoding mode (new) + legacy checkbox controls */}
      <div className="graph-view-screen__toolbar" data-testid="graph-toolbar">
        {/* New: encoding mode toggle */}
        <GraphViewToolbar
          encodingMode={encodingMode}
          onEncodingModeChange={setEncodingMode}
        />

      </div>

      {/* Secondary controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '6px 16px',
          background: 'var(--surface-base)',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <HopSelector value={hopCount} onChange={setHopCount} disabled={selectedNodeIds.size === 0} />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'var(--border-default)', opacity: 0.5, flexShrink: 0 }} />

        {/* View modifier toggle */}
        <button
          type="button"
          onClick={() => setSizeByPageRank((v) => !v)}
          aria-pressed={sizeByPageRank}
          data-testid="size-by-pagerank-toggle"
          style={{
            padding: '4px 12px',
            border: `1px solid ${sizeByPageRank ? 'color-mix(in oklch, var(--accent-interactive) 40%, transparent)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            background: sizeByPageRank ? 'color-mix(in oklch, var(--accent-interactive) 15%, transparent)' : 'transparent',
            color: sizeByPageRank ? 'var(--accent-interactive)' : 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
          }}
        >
          PageRank
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'var(--border-default)', opacity: 0.5, flexShrink: 0 }} />

        <button
          type="button"
          onClick={() => setLassoEnabled((v) => !v)}
          aria-pressed={lassoEnabled}
          title={lassoEnabled ? 'Disable lasso selection' : 'Enable lasso selection'}
          data-testid="lasso-toggle"
          style={{
            padding: '4px 12px',
            border: `1px solid ${lassoEnabled ? 'color-mix(in oklch, var(--accent-interactive) 40%, transparent)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            background: lassoEnabled ? 'color-mix(in oklch, var(--accent-interactive) 15%, transparent)' : 'transparent',
            color: lassoEnabled ? 'var(--accent-interactive)' : 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
          }}
        >
          Lasso
        </button>
        {selectedNodeIds.size > 0 && (
          <button
            type="button"
            onClick={clearNodeSelection}
            style={{
              padding: '4px 12px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear selection ({selectedNodeIds.size})
          </button>
        )}
      </div>

      {/* Main graph area */}
      <div
        ref={containerRef}
        className="graph-view-screen__container"
        data-testid="graph-container"
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onMouseMove={(e) => { mousePos.current = { x: e.clientX, y: e.clientY }; }}
      >
        <GraphView
          ref={graphViewRef}
          nodes={visibleData.nodes}
          edges={visibleData.edges}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onNodeRightClick={handleNodeRightClick}
          colorByCommunity={colorByCommunity}
          sizeByPageRank={sizeByPageRank}
          encodingMode={encodingMode}
          degreeMap={degreeMap}
          pathNodeIds={pathNodeIds}
          pathEdgeKeys={pathEdgeKeys}
          selectedNodeIds={selectedNodeIds}
          width={dimensions.width}
          height={dimensions.height}
        />

        {/* Lasso overlay sits on top of the canvas */}
        <LassoSelectionOverlay
          width={dimensions.width}
          height={dimensions.height}
          enabled={lassoEnabled}
          onSelectionComplete={handleLassoSelection}
        />
      </div>

      {/* Floating panels */}
      {(pathSourceId !== null || activePath !== null) && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            zIndex: 100,
          }}
        >
          <PathHighlightControls
            pathSourceId={pathSourceId}
            activePath={activePath}
            nodeTitle={getNodeTitle}
            onClear={handleClearPath}
          />
        </div>
      )}

      {/* Hover popover */}
      <HoverPreviewPopover
        visible={hoveredNode !== null}
        x={hoveredNode?.screenX ?? 0}
        y={hoveredNode?.screenY ?? 0}
        title={hoveredNode ? getNodeTitle(hoveredNode.pageId) : ''}
        blockCount={0}
        connectionCount={hoveredNode ? (degreeMap.get(hoveredNode.pageId) ?? 0) : 0}
      />

      {/* Context menu */}
      <ContextMenu
        visible={contextMenu.isVisible}
        x={contextMenu.x}
        y={contextMenu.y}
        nodeId={contextMenu.nodeId}
        items={contextMenu.menuItems}
        onClose={contextMenu.close}
      />
    </div>
  );
}

export default GraphViewScreen;
