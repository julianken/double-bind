/**
 * AppShell - Top-level layout component
 *
 * Arranges the three-column layout:
 * - AppToolbar (top): window drag region, nav buttons (rendered by AppToolbar)
 * - Sidebar (left): width controlled by sidebarMode/sidebarWidth state
 * - MainContent (center): takes remaining horizontal space (flex-grow)
 * - RightPanel (right): visibility/width controlled by Zustand rightPanel state
 * - StatusBar (bottom): save state + block count
 *
 * ErrorBoundaries wrap Sidebar and MainContent independently for fault isolation.
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { useAppStore } from '../stores/index.js';
// AppToolbar is created in DBB-442 and will resolve when that branch merges
import { AppToolbar } from './AppToolbar.js';
import { StatusBar } from './StatusBar.js';
import { RightPanel } from './RightPanel.js';
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
 * <AppShell sidebar={<Sidebar />}>
 *   <MainContent />
 * </AppShell>
 * ```
 */
export function AppShell({
  sidebar,
  children,
  sidebarFallback,
  mainContentFallback,
}: AppShellProps) {
  const sidebarMode = useAppStore((state) => state.sidebarMode);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const rightPanelWidth = useAppStore((state) => state.rightPanelWidth);
  const focusModeActive = useAppStore((state) => state.focusModeActive);
  const typewriterEnabled = useAppStore((state) => state.typewriterEnabled);
  const blockDimmingEnabled = useAppStore((state) => state.blockDimmingEnabled);
  const windowFocused = useAppStore((state) => state.windowFocused);

  // Sidebar width depends on mode
  const sidebarStyle =
    sidebarMode === 'closed'
      ? undefined
      : sidebarMode === 'rail'
        ? { width: '48px', minWidth: '48px', maxWidth: '48px' }
        : { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` };

  // focus-mode data attribute bundles multiple flags into a space-separated string
  const focusModeAttr =
    [
      focusModeActive ? 'active' : null,
      typewriterEnabled ? 'typewriter' : null,
      blockDimmingEnabled ? 'dim' : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  // RightPanel consumes rightPanelWidth but its own component manages open/closed
  void rightPanelWidth;

  return (
    <div
      className={styles.container}
      data-testid="app-shell"
      data-window-focused={windowFocused ? 'true' : 'false'}
    >
      {/* Navigation toolbar - rendered by AppToolbar (DBB-442) */}
      <AppToolbar />

      {/* Main content area with three-column layout */}
      <div className={styles.contentArea}>
        {/* Sidebar - left column */}
        <aside
          className={[
            styles.sidebar,
            sidebarMode === 'closed' ? styles['sidebar--closed'] : '',
            sidebarMode === 'rail' ? styles['sidebar--rail'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={sidebarStyle}
          data-testid="app-shell-sidebar"
          data-sidebar-mode={sidebarMode}
          aria-label="Sidebar"
        >
          <ErrorBoundary
            fallback={(_error, reset) => sidebarFallback ?? <SidebarErrorFallback reset={reset} />}
          >
            {sidebar}
          </ErrorBoundary>
        </aside>

        {/* Main content - center column */}
        <main
          className={styles.mainContent}
          data-testid="app-shell-main"
          aria-label="Main content"
          data-focus-mode={focusModeAttr}
        >
          <ErrorBoundary
            fallback={(_error, reset) =>
              mainContentFallback ?? <MainContentErrorFallback reset={reset} />
            }
          >
            {children}
          </ErrorBoundary>
        </main>

        {/* Right panel - right column (internal, driven by store) */}
        <RightPanel />
      </div>

      {/* Status bar - bottom (internal) */}
      <StatusBar />
    </div>
  );
}
