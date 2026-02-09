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
import { PageList } from '../components/PageList.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { useAppStore } from '../stores/ui-store.js';
import { useNeighborhood } from '../hooks/useNeighborhood.js';
import styles from './Sidebar.module.css';

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
    <div className={styles.quickCapture}>
      <textarea
        className={styles.quickCaptureInput}
        placeholder="Quick capture..."
        aria-label="Quick capture"
        disabled
        rows={2}
      />
    </div>
  );
}

/**
 * SidebarFooter - displays app info and theme toggle.
 */
export function SidebarFooter() {
  return (
    <footer className={styles.footer}>
      <ThemeToggle />
      <small className={styles.footerBrand}>Double Bind</small>
    </footer>
  );
}

// ============================================================================
// Sidebar Error Fallback
// ============================================================================

function SidebarErrorFallback(_error: Error, reset: () => void) {
  return (
    <aside className={styles.error} role="complementary">
      <h2 className={styles.errorTitle}>Sidebar unavailable</h2>
      <p className={styles.errorDescription}>An error occurred loading the sidebar.</p>
      <button onClick={reset} type="button" className={styles.errorButton}>
        Try Again
      </button>
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
const MIN_GRAPH_HEIGHT = 120; // Minimum height before graph becomes unusable

interface SidebarGraphSectionProps {
  /** Callback when a node is clicked for navigation */
  onNavigate: (pageId: PageId) => void;
}

/**
 * Collapsible graph section showing current page's neighborhood.
 * Uses MiniGraph to visualize connected pages within N hops.
 */
function SidebarGraphSection({ onNavigate }: SidebarGraphSectionProps) {
  const currentPageIdRaw = useAppStore((state) => state.currentPageId);
  // Extract actual page ID from route format (e.g., "page/01KGX..." -> "01KGX...")
  const currentPageId = currentPageIdRaw?.startsWith('page/')
    ? currentPageIdRaw.slice(5)
    : currentPageIdRaw;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(GRAPH_SECTION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Dynamic sizing with ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Get initial dimensions synchronously
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height >= MIN_GRAPH_HEIGHT) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height >= MIN_GRAPH_HEIGHT) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isCollapsed]); // Re-observe when collapsed state changes

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
        <div className={styles.graphEmpty} data-testid="sidebar-graph-empty">
          No page selected
        </div>
      );
    }

    if (isLoading) {
      return (
        <div
          className={styles.graphLoading}
          data-testid="sidebar-graph-loading"
        >
          Loading graph...
        </div>
      );
    }

    return (
      <div ref={containerRef} className={styles.graphContent}>
        {dimensions && (
          <MiniGraph
            centerNodeId={currentPageId}
            nodes={nodes}
            edges={edges}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={onNavigate}
          />
        )}
      </div>
    );
  };

  return (
    <section className={styles.graphSection} data-testid="sidebar-graph-section">
      <button
        type="button"
        className={styles.graphToggle}
        onClick={handleToggle}
        aria-expanded={!isCollapsed}
        aria-controls="sidebar-graph-content"
        data-testid="sidebar-graph-toggle"
      >
        <span>Graph</span>
        <span
          className={`${styles.graphToggleIcon} ${isCollapsed ? styles['graphToggleIcon--collapsed'] : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </button>
      {!isCollapsed && (
        <div id="sidebar-graph-content" data-testid="sidebar-graph-content" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
      className={styles.resizeHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={handleMouseDown}
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
      navigateToPage('page/' + pageId);
    },
    [navigateToPage]
  );

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      ref={sidebarRef}
      className={styles.sidebar}
      data-testid="sidebar"
      role="complementary"
      aria-label="Application sidebar"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className={styles.content}>
        <SearchBar />
        <QuickCapture />

        <button
          type="button"
          className={styles.newPageButton}
          onClick={onNewPage}
          disabled={!onNewPage}
          aria-label="Create new page"
        >
          + New Page
        </button>

        <button
          type="button"
          className={styles.graphViewButton}
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
