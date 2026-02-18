/**
 * AppToolbar - Navigation toolbar stub
 *
 * THIS FILE IS A TEMPORARY STUB created for DBB-443.
 * The real implementation lives in DBB-442 (feature/ui-redesign branch).
 * This stub will be replaced when DBB-442 merges before DBB-443.
 *
 * Renders a functional nav toolbar with back/forward buttons so that
 * App.test.tsx and other integration tests continue to pass while waiting
 * for DBB-442 to merge.
 */

import { useCallback } from 'react';
import { useAppStore } from '../stores/index.js';
import { openSettingsWindow } from '../utils/settings-window.js';
import styles from './AppToolbar.module.css';

/** Props for AppToolbar (stub — no props yet) */
export type AppToolbarProps = Record<string, never>;

export function AppToolbar() {
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
      className={styles.navToolbar}
      data-testid="navigation-bar"
      aria-label="Navigation"
      data-tauri-drag-region
    >
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
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className={styles.navButton}
        onClick={() => openSettingsWindow()}
        aria-label="Preferences"
        data-testid="settings-button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3a5.52 5.52 0 0 1 1.37.57l.21-.21a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1 0 1.06l-.21.21c.24.43.43.89.57 1.37h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3a5.52 5.52 0 0 1-.57 1.37l.21.21a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0l-.21-.21c-.43.24-.89.43-1.37.57v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3a5.52 5.52 0 0 1-1.37-.57l-.21.21a.75.75 0 0 1-1.06 0L2.8 11.86a.75.75 0 0 1 0-1.06l.21-.21a5.52 5.52 0 0 1-.57-1.37h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.14-.48.33-.94.57-1.37l-.21-.21a.75.75 0 0 1 0-1.06L3.86 2.8a.75.75 0 0 1 1.06 0l.21.21c.43-.24.89-.43 1.37-.57v-.3ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </nav>
  );
}
