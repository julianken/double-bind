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
import styles from './AppToolbar.module.css';

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
    </nav>
  );
}
