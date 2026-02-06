/**
 * Sidebar - Main navigation sidebar component
 *
 * Contains page list, search bar, quick capture, "New Page" button, and page neighborhood graph.
 * Collapsible via Ctrl+\ keyboard shortcut.
 * Width is resizable and persisted to localStorage.
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/frontend/keyboard-first.md for keyboard shortcuts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MiniGraph } from '@double-bind/ui-primitives';
import type { PageId } from '@double-bind/types';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { SearchBar } from '../components/SearchBar.js';
import { useAppStore } from '../stores/ui-store.js';
import { useNeighborhood } from '../hooks/useNeighborhood.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIDEBAR_WIDTH = 250;
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 500;
const LOCAL_STORAGE_KEY = 'sidebar-width';

// ============================================================================
// Stub Components
// ============================================================================

/**
 * QuickCapture placeholder - rapid note capture.
 * TODO: Implement quick capture functionality in separate issue.
 */
export function QuickCapture() {
  return (
    <div className="sidebar-quick-capture">
      <textarea placeholder="Quick capture..." aria-label="Quick capture" disabled rows={2} />
    </div>
  );
}

/**
 * PageList placeholder - displays all pages.
 * TODO: Implement full page list with virtual scrolling in separate issue.
 */
export function PageList() {
  return (
    <nav className="sidebar-page-list" aria-label="Page navigation">
      <ul role="list">
        <li>No pages yet</li>
      </ul>
    </nav>
  );
}

/**
 * SidebarFooter placeholder - displays app info and settings link.
 * TODO: Implement footer with version and settings in separate issue.
 */
export function SidebarFooter() {
  return (
    <footer className="sidebar-footer">
      <small>Double Bind</small>
    </footer>
  );
}

// ============================================================================
// Sidebar Error Fallback
// ============================================================================

function SidebarErrorFallback(_error: Error, reset: () => void) {
  return (
    <aside className="sidebar sidebar-error" role="complementary">
      <div className="sidebar-error-content">
        <h2>Sidebar unavailable</h2>
        <p>An error occurred loading the sidebar.</p>
        <button onClick={reset} type="button">
          Try Again
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface SidebarProps {
  /**
   * Optional callback when a new page is requested.
   * If not provided, button will be disabled.
   */
  onNewPage?: () => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Custom hook to persist sidebar width to localStorage.
 * Reads initial value on mount and saves on width changes.
 */
function useSidebarWidthPersistence() {
  const { sidebarWidth, setSidebarWidth } = useAppStore();
  const isInitialized = useRef(false);

  // Load persisted width on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(parsed);
        }
      } else {
        // Set default width if nothing stored
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
      }
    } catch {
      // localStorage unavailable, use default
      setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    }
  }, [setSidebarWidth]);

  // Persist width changes to localStorage
  useEffect(() => {
    if (!isInitialized.current) return;

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // localStorage unavailable, ignore
    }
  }, [sidebarWidth]);

  return { sidebarWidth, setSidebarWidth };
}

/**
 * Custom hook to register keyboard shortcuts for the sidebar.
 * Ctrl+\ toggles sidebar visibility.
 */
function useSidebarKeyboard() {
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ctrl+\ (backslash) toggles sidebar
      // Note: event.key for backslash is '\\'
      if (event.ctrlKey && event.key === '\\') {
        event.preventDefault();
        toggleSidebar();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);
}

// ============================================================================
// Sidebar Graph Section
// ============================================================================

const GRAPH_SECTION_STORAGE_KEY = 'sidebar-graph-collapsed';
const GRAPH_HOPS = 2;
const GRAPH_WIDTH = 220;
const GRAPH_HEIGHT = 180;

interface SidebarGraphSectionProps {
  /** Callback when a node is clicked for navigation */
  onNavigate: (pageId: PageId) => void;
}

/**
 * Collapsible graph section showing current page's neighborhood.
 * Uses MiniGraph to visualize connected pages within N hops.
 */
function SidebarGraphSection({ onNavigate }: SidebarGraphSectionProps) {
  const currentPageId = useAppStore((state) => state.currentPageId);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(GRAPH_SECTION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const { nodes, edges, isLoading } = useNeighborhood(currentPageId, GRAPH_HOPS);

  // Persist collapsed state
  const handleToggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(GRAPH_SECTION_STORAGE_KEY, String(newValue));
      } catch {
        // localStorage unavailable, ignore
      }
      return newValue;
    });
  }, []);

  // Render loading state
  const renderContent = () => {
    if (!currentPageId) {
      return (
        <div
          className="sidebar-graph-empty"
          data-testid="sidebar-graph-empty"
          style={{
            padding: '12px',
            color: '#6b7280',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          No page selected
        </div>
      );
    }

    if (isLoading) {
      return (
        <div
          className="sidebar-graph-loading"
          data-testid="sidebar-graph-loading"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: GRAPH_HEIGHT,
            color: '#6b7280',
            fontSize: '12px',
          }}
        >
          Loading graph...
        </div>
      );
    }

    // Empty state: no connections (only the current page)
    if (nodes.length <= 1) {
      return (
        <div
          className="sidebar-graph-isolated"
          data-testid="sidebar-graph-isolated"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: GRAPH_HEIGHT,
            color: '#6b7280',
            fontSize: '12px',
            textAlign: 'center',
            padding: '12px',
          }}
        >
          No connections
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <MiniGraph
          centerNodeId={currentPageId}
          nodes={nodes}
          edges={edges}
          width={GRAPH_WIDTH}
          height={GRAPH_HEIGHT}
          onNodeClick={onNavigate}
        />
      </div>
    );
  };

  return (
    <section
      className="sidebar-graph-section"
      data-testid="sidebar-graph-section"
      style={{
        borderTop: '1px solid #e5e7eb',
        marginTop: '8px',
      }}
    >
      <button
        type="button"
        className="sidebar-graph-toggle"
        onClick={handleToggle}
        aria-expanded={!isCollapsed}
        aria-controls="sidebar-graph-content"
        data-testid="sidebar-graph-toggle"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: '#374151',
          textAlign: 'left',
        }}
      >
        <span>Graph</span>
        <span
          style={{
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          {/* Down chevron */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </button>
      {!isCollapsed && (
        <div id="sidebar-graph-content" data-testid="sidebar-graph-content">
          {renderContent()}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Resize Handle
// ============================================================================

interface ResizeHandleProps {
  onResize: (width: number) => void;
  sidebarRef: React.RefObject<HTMLElement | null>;
}

function ResizeHandle({ onResize, sidebarRef }: ResizeHandleProps) {
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDragging.current = true;

      const startX = event.clientX;
      const startWidth = sidebarRef.current?.offsetWidth ?? DEFAULT_SIDEBAR_WIDTH;

      function handleMouseMove(e: MouseEvent) {
        if (!isDragging.current) return;

        const delta = e.clientX - startX;
        const newWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta)
        );
        onResize(newWidth);
      }

      function handleMouseUp() {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, sidebarRef]
  );

  return (
    <div
      className="sidebar-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={handleMouseDown}
      style={{
        width: '4px',
        cursor: 'col-resize',
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
      }}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

function SidebarContent({ onNewPage }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const { sidebarWidth, setSidebarWidth } = useSidebarWidthPersistence();

  // Register keyboard shortcuts
  useSidebarKeyboard();

  const handleResize = useCallback(
    (width: number) => {
      setSidebarWidth(width);
    },
    [setSidebarWidth]
  );

  const handleGraphNavigate = useCallback(
    (pageId: PageId) => {
      navigateToPage(pageId);
    },
    [navigateToPage]
  );

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      ref={sidebarRef}
      className="sidebar"
      data-testid="sidebar"
      role="complementary"
      aria-label="Application sidebar"
      style={{
        width: `${sidebarWidth}px`,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div className="sidebar-content">
        <SearchBar />
        <QuickCapture />

        <button
          type="button"
          className="sidebar-new-page-button"
          onClick={onNewPage}
          disabled={!onNewPage}
          aria-label="Create new page"
        >
          + New Page
        </button>

        <button
          type="button"
          className="sidebar-graph-view-button"
          onClick={() => navigateToPage('graph')}
          aria-label="Graph View"
        >
          Graph View
        </button>

        <PageList />
        <SidebarGraphSection onNavigate={handleGraphNavigate} />
        <SidebarFooter />
      </div>

      <ResizeHandle onResize={handleResize} sidebarRef={sidebarRef} />
    </aside>
  );
}

/**
 * Sidebar component wrapped in ErrorBoundary for isolated error handling.
 *
 * @example
 * ```tsx
 * <Sidebar onNewPage={() => createNewPage()} />
 * ```
 */
export function Sidebar(props: SidebarProps) {
  return (
    <ErrorBoundary fallback={SidebarErrorFallback}>
      <SidebarContent {...props} />
    </ErrorBoundary>
  );
}
