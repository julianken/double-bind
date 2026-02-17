/**
 * McpApp — Root component for the Double-Bind MCP App.
 *
 * Connects to the host (Claude/ChatGPT) via the ext-apps SDK,
 * receives graph data from tool results, and renders an interactive
 * force-directed graph using the shared GraphView component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { App, applyHostStyleVariables, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { GraphView, type GraphNode, type GraphEdge } from '@double-bind/ui-primitives';

// ============================================================================
// Types
// ============================================================================

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusedPageId: string | null;
}

interface SearchResult {
  type: 'page' | 'block';
  id: string;
  title: string;
  content: string;
  pageId: string;
  score: number;
}

interface PageData {
  page: { id: string; title: string };
  blocks: { id: string; content: string }[];
}

type ViewMode = 'graph' | 'page' | 'search';

const HEADER_HEIGHT = 48;

// ============================================================================
// Component
// ============================================================================

export function McpApp() {
  const appRef = useRef<App | null>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [status, setStatus] = useState('Connecting...');

  // Track window size — in an iframe, this IS the available space
  useEffect(() => {
    const onResize = () => {
      setContainerSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Graph canvas = container minus header
  const graphWidth = containerSize.width;
  const graphHeight = containerSize.height - HEADER_HEIGHT;

  // Apply host context (theme + styles)
  const applyHostContext = useCallback((ctx: McpUiHostContext | undefined) => {
    if (!ctx) return;
    if (ctx.theme) applyDocumentTheme(ctx.theme);
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  }, []);

  // Connect to host
  useEffect(() => {
    const app = new App({ name: 'Double-Bind', version: '0.1.0' });
    appRef.current = app;

    app.ontoolresult = (result) => {
      processToolResult(result.content);
    };

    app.onhostcontextchanged = (params) => {
      // params is a partial McpUiHostContext with changed fields
      applyHostContext(params as McpUiHostContext);
    };

    app.connect().then(() => {
      setStatus('Connected');
      const ctx = app.getHostContext();
      applyHostContext(ctx);
      // Request fullscreen — host provides containerDimensions
      if (ctx?.availableDisplayModes?.includes('fullscreen')) {
        app.requestDisplayMode({ mode: 'fullscreen' }).catch(() => {});
      }
    }).catch(() => {
      setStatus('Standalone mode');
    });

    return () => {
      appRef.current = null;
    };
  }, [applyHostContext]);

  // Parse the structured data from tool result content
  const processToolResult = useCallback((content: Array<{ type: string; text?: string }>) => {
    if (!content?.length) return;

    // The second text content item is always the JSON payload
    const jsonItem = content.length > 1 ? content[1] : content[0];
    if (jsonItem?.type !== 'text' || !jsonItem.text) return;

    try {
      const data = JSON.parse(jsonItem.text);

      if (data.nodes && data.edges) {
        // Graph data
        setGraphData(data as GraphData);
        setViewMode('graph');
        setStatus(`${data.nodes.length} pages, ${data.edges.length} links`);
      } else if (data.searchResults) {
        // Search results
        setSearchResults(data.searchResults);
        setViewMode('search');
        setStatus(`${data.searchResults.length} results`);
      } else if (data.page) {
        // Page data
        setPageData(data as PageData);
        setViewMode('page');
        setStatus(data.page.title);
      } else if (data.created) {
        // Page created — refresh graph
        setStatus(`Created "${data.created.title}"`);
        refreshGraph();
      } else if (data.pages) {
        // List pages — show as search-like results
        setSearchResults(
          data.pages.map((p: { id: string; title: string }) => ({
            type: 'page' as const,
            id: p.id,
            title: p.title,
            content: p.title,
            pageId: p.id,
            score: 1,
          })),
        );
        setViewMode('search');
        setStatus(`${data.pages.length} pages`);
      }
    } catch {
      // Not JSON — ignore
    }
  }, []);

  const refreshGraph = useCallback(async () => {
    const app = appRef.current;
    if (!app) return;
    setStatus('Loading graph...');
    const result = await app.callServerTool({ name: 'explore-graph', arguments: {} });
    processToolResult(result.content as Array<{ type: string; text?: string }>);
  }, [processToolResult]);

  const listPages = useCallback(async () => {
    const app = appRef.current;
    if (!app) return;
    setStatus('Loading pages...');
    const result = await app.callServerTool({ name: 'list-pages', arguments: {} });
    processToolResult(result.content as Array<{ type: string; text?: string }>);
  }, [processToolResult]);

  const handleNodeClick = useCallback(
    async (pageId: string) => {
      const app = appRef.current;
      if (!app) return;

      setHighlightedNode(pageId);
      setStatus('Loading neighborhood...');

      const result = await app.callServerTool({
        name: 'explore-graph',
        arguments: { pageId, hops: 2 },
      });
      processToolResult(result.content as Array<{ type: string; text?: string }>);
    },
    [processToolResult],
  );

  const handleViewPage = useCallback(
    async (pageId: string) => {
      const app = appRef.current;
      if (!app) return;

      setStatus('Loading page...');
      const result = await app.callServerTool({
        name: 'get-page',
        arguments: { pageId },
      });
      processToolResult(result.content as Array<{ type: string; text?: string }>);
    },
    [processToolResult],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-background-primary, #0a0a0a)',
        color: 'var(--color-text-primary, #e0e0e0)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border-primary, #222)',
          flexShrink: 0,
          height: HEADER_HEIGHT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary, #fff)' }}>double-bind</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary, #666)' }}>{status}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={refreshGraph}
            style={viewMode === 'graph' ? activeTabStyle : tabStyle}
          >
            Graph
          </button>
          <button
            onClick={listPages}
            style={viewMode === 'search' ? activeTabStyle : tabStyle}
          >
            Pages
          </button>
          {viewMode === 'page' && pageData && (
            <button style={activeTabStyle}>
              {pageData.page.title.slice(0, 20)}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'graph' && graphData && (
          <GraphView
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={handleNodeClick}
            onNodeHover={setHighlightedNode}
            highlightedNodeId={highlightedNode ?? undefined}
            labelColor="#94a3b8"
            colorByCommunity
            sizeByPageRank
            width={graphWidth}
            height={graphHeight}
          />
        )}

        {viewMode === 'search' && (
          <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
            {searchResults.map((r) => (
              <div
                key={r.id}
                onClick={() => handleViewPage(r.pageId)}
                style={resultItemStyle}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary, #fff)' }}>
                  {r.title}
                </div>
                {r.type === 'block' && r.content !== r.title && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #888)', marginTop: 4 }}>
                    {r.content.slice(0, 200)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #555)', marginTop: 4 }}>
                  {r.type} &middot; score: {r.score.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'page' && pageData && (
          <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary, #fff)', marginBottom: 16 }}>
              {pageData.page.title}
            </h2>
            {pageData.blocks.map((block) => (
              <div key={block.id} style={blockStyle}>
                {block.content}
              </div>
            ))}
          </div>
        )}

        {!graphData && viewMode === 'graph' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-text-tertiary, #666)',
            }}
          >
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const tabStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-text-secondary, #888)',
  border: '1px solid var(--color-border-secondary, #333)',
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#6366f1',
  color: '#fff',
  border: '1px solid #6366f1',
  fontWeight: 600,
};

const resultItemStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-primary, #222)',
  cursor: 'pointer',
};

const blockStyle: React.CSSProperties = {
  padding: '8px 0',
  fontSize: 14,
  lineHeight: 1.6,
  borderBottom: '1px solid var(--color-border-secondary, #1a1a1a)',
  color: 'var(--color-text-secondary, #d4d4d4)',
};
