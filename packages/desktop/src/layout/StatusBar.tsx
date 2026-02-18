/**
 * StatusBar - Bottom application status bar
 *
 * Displays save state indicator on the left and block count on the right.
 * Reads directly from Zustand store to avoid prop-drilling.
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import type { ReactNode } from 'react';
import { useAppStore } from '../stores/index.js';
import styles from './StatusBar.module.css';

// ============================================================================
// Types
// ============================================================================

export interface StatusBarProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * StatusBar renders at the bottom of AppShell.
 *
 * - Left side: save state ("Saved" | "Saving..." | empty)
 * - Right side: block count ("42 blocks" | empty)
 */
export function StatusBar({ className }: StatusBarProps): ReactNode {
  const saveState = useAppStore((state) => state.saveState);
  const blockCount = useAppStore((state) => state.blockCount);

  const saveLabel =
    saveState === 'saved'
      ? 'Saved'
      : saveState === 'saving'
        ? 'Saving...'
        : null;

  const blockLabel = blockCount !== null ? `${blockCount} blocks` : null;

  return (
    <footer
      className={`${styles.statusBar}${className ? ` ${className}` : ''}`}
      data-testid="app-shell-status-bar"
    >
      <span className={styles.left}>
        {saveLabel}
      </span>
      <span className={styles.right}>
        {blockLabel}
      </span>
    </footer>
  );
}
