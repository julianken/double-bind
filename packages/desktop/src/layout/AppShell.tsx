/**
 * AppShell - Top-level layout component
 *
 * Arranges the three-column layout:
 * - Sidebar (left): width controlled by Zustand sidebarWidth state
 * - MainContent (center): takes remaining horizontal space (flex-grow)
 * - RightPanel (right, optional): visibility controlled by Zustand rightPanelOpen state
 *
 * StatusBar is rendered at the bottom.
 * ErrorBoundaries wrap Sidebar and MainContent independently for fault isolation.
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { useAppStore } from '../stores/index.js';
import styles from './AppShell.module.css';

// ============================================================================
// Types
// ============================================================================

export interface AppShellProps {
  /**
   * Sidebar content. Wrapped in its own ErrorBoundary.
   */
  sidebar: ReactNode;

  /**
   * Main content area. Wrapped in its own ErrorBoundary.
   */
  children: ReactNode;

  /**
   * Right panel content. Only rendered when rightPanelOpen is true.
   */
  rightPanel?: ReactNode;

  /**
   * Status bar content.
   */
  statusBar?: ReactNode;

  /**
   * Custom fallback for sidebar errors.
   */
  sidebarFallback?: ReactNode;

  /**
   * Custom fallback for main content errors.
   */
  mainContentFallback?: ReactNode;
}

// ============================================================================
// Fallback Components
// ============================================================================

/**
 * Default fallback UI for sidebar errors.
 */
function SidebarErrorFallback({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      aria-labelledby="sidebar-error-title"
      className={styles.errorFallback}
    >
      <p id="sidebar-error-title" className={styles.errorFallback__title}>
        Sidebar unavailable
      </p>
      <button
        onClick={reset}
        className={`${styles.errorFallback__button} ${styles['errorFallback__button--secondary']}`}
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Default fallback UI for main content errors.
 */
function MainContentErrorFallback({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      aria-labelledby="main-error-title"
      className={styles.errorFallback}
    >
      <h2 id="main-error-title" className={styles.errorFallback__title}>
        Failed to load page
      </h2>
      <p className={styles.errorFallback__description}>
        Something went wrong while loading this content.
      </p>
      <button onClick={reset} className={styles.errorFallback__button}>
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * AppShell provides the main application layout structure.
 *
 * @example
 * ```tsx
 * <AppShell
 *   sidebar={<Sidebar />}
 *   rightPanel={<BacklinksPanel />}
 *   statusBar={<StatusBar />}
 * >
 *   <MainContent />
 * </AppShell>
 * ```
 */
export function AppShell({
  sidebar,
  children,
  rightPanel,
  statusBar,
  sidebarFallback,
  mainContentFallback,
}: AppShellProps) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const goBack = useAppStore((state) => state.goBack);
  const goForward = useAppStore((state) => state.goForward);
  const pageHistory = useAppStore((state) => state.pageHistory);
  const historyIndex = useAppStore((state) => state.historyIndex);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < pageHistory.length - 1;

  const handleGoBack = useCallback(() => {
    if (canGoBack) goBack();
  }, [canGoBack, goBack]);

  const handleGoForward = useCallback(() => {
    if (canGoForward) goForward();
  }, [canGoForward, goForward]);

  // Dynamic styles for sidebar width (CSS custom property approach)
  const sidebarStyle = sidebarOpen
    ? { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }
    : undefined;

  // Dynamic styles for right panel width
  const rightPanelStyle = rightPanelOpen
    ? { width: '300px', minWidth: '300px', maxWidth: '300px' }
    : undefined;

  return (
    <div className={styles.container} data-testid="app-shell">
      {/* Navigation toolbar */}
      <nav className={styles.navToolbar} data-testid="nav-toolbar" aria-label="Navigation">
        <button
          type="button"
          className={styles.navButton}
          onClick={handleGoBack}
          disabled={!canGoBack}
          aria-label="Go back"
          data-testid="nav-back"
        >
          &#8592;
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleGoForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          data-testid="nav-forward"
        >
          &#8594;
        </button>
      </nav>

      {/* Main content area with three-column layout */}
      <div className={styles.contentArea}>
        {/* Sidebar - left column */}
        <aside
          className={`${styles.sidebar} ${!sidebarOpen ? styles['sidebar--closed'] : ''}`}
          style={sidebarStyle}
          data-testid="app-shell-sidebar"
          aria-label="Sidebar"
        >
          <ErrorBoundary
            fallback={(_error, reset) => sidebarFallback ?? <SidebarErrorFallback reset={reset} />}
          >
            {sidebar}
          </ErrorBoundary>
        </aside>

        {/* Main content - center column */}
        <main className={styles.mainContent} data-testid="app-shell-main" aria-label="Main content">
          <ErrorBoundary
            fallback={(_error, reset) =>
              mainContentFallback ?? <MainContentErrorFallback reset={reset} />
            }
          >
            {children}
          </ErrorBoundary>
        </main>

        {/* Right panel - right column (optional) */}
        {rightPanel && (
          <aside
            className={`${styles.rightPanel} ${!rightPanelOpen ? styles['rightPanel--closed'] : ''}`}
            style={rightPanelStyle}
            data-testid="app-shell-right-panel"
            aria-label="Right panel"
            aria-hidden={!rightPanelOpen}
          >
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Status bar - bottom */}
      <footer className={styles.statusBar} data-testid="app-shell-status-bar">
        {statusBar}
      </footer>
    </div>
  );
}
