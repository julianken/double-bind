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
import type { ReactNode, CSSProperties } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { useAppStore } from '../stores/index.js';

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
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#fef2f2',
        color: '#991b1b',
      }}
    >
      <p id="sidebar-error-title" style={{ margin: '0 0 12px 0', fontWeight: 500 }}>
        Sidebar unavailable
      </p>
      <button
        onClick={reset}
        style={{
          padding: '6px 12px',
          backgroundColor: '#fff',
          border: '1px solid #991b1b',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#991b1b',
        }}
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
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#fef2f2',
      }}
    >
      <h2 id="main-error-title" style={{ margin: '0 0 8px 0', color: '#991b1b' }}>
        Failed to load page
      </h2>
      <p style={{ margin: '0 0 16px 0', color: '#7f1d1d' }}>
        Something went wrong while loading this content.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 16px',
          backgroundColor: '#991b1b',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  } satisfies CSSProperties,

  contentArea: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
  } satisfies CSSProperties,

  sidebar: (width: number, isOpen: boolean): CSSProperties => ({
    width: isOpen ? `${width}px` : '0px',
    minWidth: isOpen ? `${width}px` : '0px',
    maxWidth: isOpen ? `${width}px` : '0px',
    height: '100%',
    overflow: 'hidden',
    transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out, max-width 0.2s ease-in-out',
    flexShrink: 0,
  }),

  mainContent: {
    flex: 1,
    height: '100%',
    overflow: 'auto',
    minWidth: 0, // Prevent flex item from overflowing
  } satisfies CSSProperties,

  rightPanel: (isOpen: boolean): CSSProperties => ({
    width: isOpen ? '300px' : '0px',
    minWidth: isOpen ? '300px' : '0px',
    maxWidth: isOpen ? '300px' : '0px',
    height: '100%',
    overflow: 'hidden',
    transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out, max-width 0.2s ease-in-out',
    flexShrink: 0,
    borderLeft: isOpen ? '1px solid #e5e7eb' : 'none',
  }),

  navToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    height: '32px',
    minHeight: '32px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    flexShrink: 0,
  } satisfies CSSProperties,

  navButton: (disabled: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '14px',
  }),

  statusBar: {
    height: '24px',
    minHeight: '24px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: '12px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    flexShrink: 0,
  } satisfies CSSProperties,
};

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

  return (
    <div style={styles.container} data-testid="app-shell">
      {/* Navigation toolbar */}
      <nav style={styles.navToolbar} data-testid="nav-toolbar" aria-label="Navigation">
        <button
          type="button"
          style={styles.navButton(!canGoBack)}
          onClick={handleGoBack}
          disabled={!canGoBack}
          aria-label="Go back"
          data-testid="nav-back"
        >
          &#8592;
        </button>
        <button
          type="button"
          style={styles.navButton(!canGoForward)}
          onClick={handleGoForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          data-testid="nav-forward"
        >
          &#8594;
        </button>
      </nav>

      {/* Main content area with three-column layout */}
      <div style={styles.contentArea}>
        {/* Sidebar - left column */}
        <aside
          style={styles.sidebar(sidebarWidth, sidebarOpen)}
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
        <main style={styles.mainContent} data-testid="app-shell-main" aria-label="Main content">
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
            style={styles.rightPanel(rightPanelOpen)}
            data-testid="app-shell-right-panel"
            aria-label="Right panel"
            aria-hidden={!rightPanelOpen}
          >
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Status bar - bottom */}
      <footer style={styles.statusBar} data-testid="app-shell-status-bar">
        {statusBar}
      </footer>
    </div>
  );
}
