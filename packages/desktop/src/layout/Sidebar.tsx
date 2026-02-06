/**
 * Sidebar - Main navigation sidebar component
 *
 * Contains page list, search bar, quick capture, and "New Page" button.
 * Collapsible via Ctrl+\ keyboard shortcut.
 * Width is resizable and persisted to localStorage.
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/frontend/keyboard-first.md for keyboard shortcuts
 */

import { useCallback, useEffect, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { useAppStore } from '../stores/ui-store.js';

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
 * SearchBar placeholder - filters pages by title.
 * TODO: Implement full search functionality in separate issue.
 */
export function SearchBar() {
  return (
    <div className="sidebar-search" role="search">
      <input type="search" placeholder="Search pages..." aria-label="Search pages" disabled />
    </div>
  );
}

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
  const { sidebarWidth, setSidebarWidth } = useSidebarWidthPersistence();

  // Register keyboard shortcuts
  useSidebarKeyboard();

  const handleResize = useCallback(
    (width: number) => {
      setSidebarWidth(width);
    },
    [setSidebarWidth]
  );

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      ref={sidebarRef}
      className="sidebar"
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

        <PageList />
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
