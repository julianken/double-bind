/**
 * GraphViewScreen - Full-screen graph visualization of the knowledge base
 *
 * Displays the entire knowledge graph using the GraphView component from ui-primitives.
 * Supports:
 * - Node click to navigate to page
 * - Color by community toggle
 * - Size by PageRank toggle
 * - Loading and empty states
 *
 * Accessible via Ctrl+G keyboard shortcut.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { PageId, Page, Link } from '@double-bind/types';
import { GraphView, type GraphNode, type GraphEdge } from '@double-bind/ui-primitives';
import { useServices } from '../providers/index.js';
import { useCozoQuery } from '../hooks/index.js';
import { useAppStore } from '../stores/index.js';
import type { RouteComponentProps } from '../components/Router.js';
import type { GraphResult } from '@double-bind/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for GraphViewScreen (implements RouteComponentProps for Router compatibility)
 */
export type GraphViewScreenProps = RouteComponentProps;

/**
 * Combined graph data including PageRank and community information
 */
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default dimensions for the graph view */
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Custom hook to fetch and transform graph data for visualization.
 *
 * Fetches:
 * 1. Full graph (nodes and edges) from GraphService
 * 2. PageRank scores (optional, for node sizing)
 * 3. Community assignments (optional, for node coloring)
 *
 * Returns the data in the format expected by GraphView component.
 */
function useGraphData(): {
  data: GraphData | undefined;
  isLoading: boolean;
  error: Error | null;
  pageRankMap: Map<PageId, number> | undefined;
  communityMap: Map<PageId, number> | undefined;
} {
  const { graphService } = useServices();

  // Fetch full graph
  const graphQueryFn = useCallback(() => graphService.getFullGraph(), [graphService]);

  const {
    data: graphResult,
    isLoading: graphLoading,
    error: graphError,
  } = useCozoQuery<GraphResult>(['graph', 'full'], graphQueryFn);

  // Fetch PageRank scores (optional enhancement data)
  const pageRankQueryFn = useCallback(() => graphService.getPageRank(), [graphService]);

  const { data: pageRankMap } = useCozoQuery<Map<PageId, number>>(
    ['graph', 'pageRank'],
    pageRankQueryFn
  );

  // Fetch community assignments (optional enhancement data)
  const communityQueryFn = useCallback(() => graphService.getCommunities(), [graphService]);

  const { data: communityMap } = useCozoQuery<Map<PageId, number>>(
    ['graph', 'communities'],
    communityQueryFn
  );

  // Transform graph data to GraphView format
  const data = useMemo((): GraphData | undefined => {
    if (!graphResult) return undefined;

    const nodes: GraphNode[] = graphResult.nodes.map((page: Page) => ({
      id: page.pageId,
      title: page.title,
      pageRank: pageRankMap?.get(page.pageId),
      community: communityMap?.get(page.pageId),
    }));

    const edges: GraphEdge[] = graphResult.edges.map((link: Link) => ({
      source: link.sourceId,
      target: link.targetId,
    }));

    return { nodes, edges };
  }, [graphResult, pageRankMap, communityMap]);

  // Combine loading states - only wait for main graph data
  // PageRank and community are enhancement data
  const isLoading = graphLoading;

  // Only show error if main graph fetch fails
  // PageRank and community errors are non-fatal (enhancement data)
  const error = graphError ?? null;

  return { data, isLoading, error, pageRankMap, communityMap };
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Toolbar with graph visualization controls
 */
interface ToolbarProps {
  colorByCommunity: boolean;
  sizeByPageRank: boolean;
  onColorByCommunityChange: (value: boolean) => void;
  onSizeByPageRankChange: (value: boolean) => void;
  onClose: () => void;
}

function Toolbar({
  colorByCommunity,
  sizeByPageRank,
  onColorByCommunityChange,
  onSizeByPageRankChange,
  onClose,
}: ToolbarProps) {
  return (
    <div className="graph-view-screen__toolbar" data-testid="graph-toolbar">
      <div className="graph-view-screen__toolbar-controls">
        <label className="graph-view-screen__control">
          <input
            type="checkbox"
            checked={colorByCommunity}
            onChange={(e) => onColorByCommunityChange(e.target.checked)}
            data-testid="color-by-community-toggle"
          />
          <span>Color by Community</span>
        </label>
        <label className="graph-view-screen__control">
          <input
            type="checkbox"
            checked={sizeByPageRank}
            onChange={(e) => onSizeByPageRankChange(e.target.checked)}
            data-testid="size-by-pagerank-toggle"
          />
          <span>Size by PageRank</span>
        </label>
      </div>
      <button
        className="graph-view-screen__close-button"
        onClick={onClose}
        data-testid="graph-close-button"
        aria-label="Close graph view"
      >
        Close
      </button>
    </div>
  );
}

/**
 * Loading state component
 */
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

/**
 * Error state component
 */
interface ErrorStateProps {
  error: Error;
}

function ErrorState({ error }: ErrorStateProps) {
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

/**
 * Empty state component when no pages exist
 */
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

/**
 * GraphViewScreen - Full-screen graph visualization
 *
 * Features:
 * - Interactive force-directed graph layout
 * - Click node to navigate to page
 * - Color by community toggle
 * - Size by PageRank toggle
 * - Loading, error, and empty states
 */
export function GraphViewScreen(_props: GraphViewScreenProps): React.ReactElement {
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  // Graph data fetching
  const { data, isLoading, error } = useGraphData();

  // Toolbar state
  const [colorByCommunity, setColorByCommunity] = useState(false);
  const [sizeByPageRank, setSizeByPageRank] = useState(false);

  // Container dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  // Update dimensions on resize
  useEffect(() => {
    function updateDimensions() {
      const container = document.querySelector('.graph-view-screen__container');
      if (container) {
        const rect = container.getBoundingClientRect();
        setDimensions({
          width: rect.width || DEFAULT_WIDTH,
          height: rect.height || DEFAULT_HEIGHT,
        });
      }
    }

    // Initial measurement
    updateDimensions();

    // Listen for resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle node click - navigate to page
  const handleNodeClick = useCallback(
    (pageId: PageId) => {
      navigateToPage(pageId);
    },
    [navigateToPage]
  );

  // Handle close - return to previous page or daily notes
  const handleClose = useCallback(() => {
    // Set currentPageId to null to go back to daily notes
    useAppStore.setState({ currentPageId: null });
  }, []);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoading) {
    return <LoadingState />;
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (error) {
    return <ErrorState error={error} />;
  }

  // ============================================================================
  // Render: Empty State
  // ============================================================================

  if (!data || data.nodes.length === 0) {
    return <EmptyState />;
  }

  // ============================================================================
  // Render: Graph View
  // ============================================================================

  return (
    <div
      className="graph-view-screen"
      data-testid="graph-view-screen"
      role="main"
      aria-label="Graph view"
    >
      <Toolbar
        colorByCommunity={colorByCommunity}
        sizeByPageRank={sizeByPageRank}
        onColorByCommunityChange={setColorByCommunity}
        onSizeByPageRankChange={setSizeByPageRank}
        onClose={handleClose}
      />
      <div className="graph-view-screen__container" data-testid="graph-container">
        <GraphView
          nodes={data.nodes}
          edges={data.edges}
          onNodeClick={handleNodeClick}
          colorByCommunity={colorByCommunity}
          sizeByPageRank={sizeByPageRank}
          width={dimensions.width}
          height={dimensions.height}
        />
      </div>
    </div>
  );
}

export default GraphViewScreen;
