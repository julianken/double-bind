/**
 * AppToolbar - Application toolbar with drag region and navigation
 *
 * Split toolbar with:
 * - Left zone: back/forward navigation buttons
 * - Center zone: breadcrumb showing current page context
 * - Right zone: spacer for future toolbar actions
 *
 * The toolbar container has `data-tauri-drag-region` to serve as a window
 * drag handle. All interactive elements use `data-tauri-no-drag` so they
 * receive click events correctly.
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import { useCallback } from 'react';
import { Breadcrumb } from './Breadcrumb.js';
import { useAppStore } from '../stores/index.js';
import styles from './AppToolbar.module.css';

// ============================================================================
// Types
// ============================================================================

export interface AppToolbarProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AppToolbar provides the top navigation bar with back/forward buttons
 * and breadcrumb navigation.
 *
 * @example
 * ```tsx
 * <AppToolbar />
 * ```
 */
export function AppToolbar({ className }: AppToolbarProps) {
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
    <nav
      className={`${styles.toolbar}${className ? ` ${className}` : ''}`}
      data-testid="app-toolbar"
      aria-label="Application toolbar"
      data-tauri-drag-region
    >
      {/* Left zone: navigation buttons */}
      <div className={styles.leftZone} data-tauri-no-drag>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleGoBack}
          disabled={!canGoBack}
          aria-label="Go back"
          data-testid="toolbar-nav-back"
          data-tauri-no-drag
        >
          &#8592;
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleGoForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          data-testid="toolbar-nav-forward"
          data-tauri-no-drag
        >
          &#8594;
        </button>
      </div>

      {/* Center zone: breadcrumb */}
      <div className={styles.centerZone}>
        <Breadcrumb />
      </div>

      {/* Right zone: spacer for future toolbar actions */}
      <div className={styles.rightZone} data-tauri-no-drag />
    </nav>
  );
}
