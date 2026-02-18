/**
 * RightPanel - Right-side layout container
 *
 * Reads open/closed state, content type, and width from the Zustand store.
 * Renders a close button header with a content-type label, followed by
 * whatever children are passed in.
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import type { ReactNode } from 'react';
import { useAppStore } from '../stores/index.js';
import type { RightPanelContent } from '../stores/index.js';
import styles from './RightPanel.module.css';

// ============================================================================
// Types
// ============================================================================

export interface RightPanelProps {
  children?: ReactNode;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const CONTENT_LABELS: Record<NonNullable<RightPanelContent>, string> = {
  backlinks: 'Backlinks',
  properties: 'Properties',
  graph: 'Graph',
};

// ============================================================================
// Component
// ============================================================================

/**
 * RightPanel wraps the optional right-side panel area.
 *
 * When `rightPanelOpen` is false the panel collapses to zero width via CSS.
 * Width is driven by `rightPanelWidth` from the store and applied inline so
 * it can be resized at runtime without a CSS rebuild.
 */
export function RightPanel({ children, className }: RightPanelProps): ReactNode {
  const rightPanelOpen = useAppStore((state) => state.rightPanelOpen);
  const rightPanelContent = useAppStore((state) => state.rightPanelContent);
  const rightPanelWidth = useAppStore((state) => state.rightPanelWidth);
  const closeRightPanel = useAppStore((state) => state.closeRightPanel);

  const contentLabel =
    rightPanelContent !== null ? (CONTENT_LABELS[rightPanelContent] ?? null) : null;

  const panelStyle = rightPanelOpen
    ? { width: `${rightPanelWidth}px`, minWidth: `${rightPanelWidth}px`, maxWidth: `${rightPanelWidth}px` }
    : undefined;

  return (
    <aside
      className={[
        styles.rightPanel,
        !rightPanelOpen ? styles['rightPanel--closed'] : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={panelStyle}
      data-testid="app-shell-right-panel"
      aria-label="Right panel"
      aria-hidden={!rightPanelOpen}
    >
      <div className={styles.header}>
        {contentLabel !== null && (
          <span className={styles.headerLabel}>{contentLabel}</span>
        )}
        <button
          type="button"
          className={styles.closeButton}
          onClick={closeRightPanel}
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </aside>
  );
}
