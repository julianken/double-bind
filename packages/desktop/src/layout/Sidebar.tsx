/**
 * Sidebar - Main navigation sidebar component with three-mode operation.
 *
 * Modes:
 * - open:   Full sidebar with QuickCapture, sectioned PageList, and footer.
 * - rail:   Narrow (48px) icon-only navigation rail via IconRail component.
 * - closed: Renders nothing; container is hidden by AppShell CSS.
 *
 * Mode cycling (Ctrl+\) is handled globally in useGlobalShortcuts.ts.
 * Width in open mode is resizable; width is persisted via Zustand persist middleware.
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/frontend/keyboard-first.md for keyboard shortcuts
 */

import { useCallback, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { QuickCapture } from '../components/QuickCapture.js';
import { IconRail } from '../components/IconRail.js';
import { PageList } from '../components/PageList.js';
import { useAppStore } from '../stores/ui-store.js';
import styles from './Sidebar.module.css';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 500;

// ============================================================================
// SidebarFooter
// ============================================================================

/**
 * SidebarFooter - displays branding. ThemeToggle has been removed per DBB-445.
 */
export function SidebarFooter() {
  return (
    <footer className={styles.footer}>
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
   * If not provided, the New Page button will be disabled.
   */
  onNewPage?: () => void;
}

// ============================================================================
// Resize Handle
// ============================================================================

interface ResizeHandleProps {
  onResize: (width: number) => void;
  sidebarRef: React.RefObject<HTMLElement | null>;
  currentStoreWidth: number;
}

function ResizeHandle({ onResize, sidebarRef, currentStoreWidth }: ResizeHandleProps) {
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDragging.current = true;

      const startX = event.clientX;
      const startWidth = sidebarRef.current?.offsetWidth || currentStoreWidth;

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
    [onResize, sidebarRef, currentStoreWidth]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? 20 : 5;
      const currentWidth = sidebarRef.current?.offsetWidth || currentStoreWidth;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onResize(Math.min(MAX_SIDEBAR_WIDTH, currentWidth + step));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onResize(Math.max(MIN_SIDEBAR_WIDTH, currentWidth - step));
      }
    },
    [onResize, sidebarRef, currentStoreWidth]
  );

  const currentWidth = sidebarRef.current?.offsetWidth || currentStoreWidth;

  return (
    <div
      className={styles.resizeHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={currentWidth}
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    />
  );
}

// ============================================================================
// Rail Mode
// ============================================================================

/**
 * SidebarRail - renders IconRail for the 48px rail mode.
 */
function SidebarRail() {
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const currentPageId = useAppStore((state) => state.currentPageId);

  const handleNavigate = useCallback(
    (route: string) => {
      navigateToPage(route);
    },
    [navigateToPage]
  );

  // Derive active route from currentPageId
  const activeRoute = currentPageId?.startsWith('page/') ? undefined : currentPageId ?? undefined;

  return (
    <div className={styles.rail} data-testid="sidebar-rail">
      <IconRail onNavigate={handleNavigate} activeRoute={activeRoute} />
    </div>
  );
}

// ============================================================================
// Open Mode Content
// ============================================================================

interface SidebarOpenProps {
  onNewPage?: () => void;
  sidebarRef: React.RefObject<HTMLElement | null>;
}

/**
 * SidebarOpen - renders the full sidebar content for open mode.
 */
function SidebarOpen({ onNewPage, sidebarRef }: SidebarOpenProps) {
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);

  const handleResize = useCallback(
    (width: number) => {
      setSidebarWidth(width);
    },
    [setSidebarWidth]
  );

  return (
    <>
      <div className={styles.content}>
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

        <div className={styles.pageListWrapper}>
          <PageList />
        </div>

        <SidebarFooter />
      </div>

      <ResizeHandle onResize={handleResize} sidebarRef={sidebarRef} currentStoreWidth={sidebarWidth} />
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function SidebarContent({ onNewPage }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarMode = useAppStore((state) => state.sidebarMode);

  // Closed mode: render nothing (AppShell hides the container)
  if (sidebarMode === 'closed') {
    return null;
  }

  // Rail mode: icon navigation only
  if (sidebarMode === 'rail') {
    return <SidebarRail />;
  }

  // Open mode: full sidebar
  return <SidebarOpen onNewPage={onNewPage} sidebarRef={sidebarRef} />;
}

/**
 * Sidebar component — three-mode operation (open/rail/closed).
 *
 * Wrapped in ErrorBoundary for isolated error handling.
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
