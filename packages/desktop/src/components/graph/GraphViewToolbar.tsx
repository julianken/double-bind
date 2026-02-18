/**
 * GraphViewToolbar — Encoding mode toggle and graph controls.
 *
 * Provides a button group to switch between:
 * - "community"  — OKLCH community colors (default)
 * - "orphan"     — highlight disconnected nodes
 * - "recency"    — color nodes by last-modified date
 */

import type { EncodingMode } from '../../stores/graph-store.js';
import styles from './GraphViewToolbar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphViewToolbarProps {
  /** Currently active encoding mode */
  encodingMode: EncodingMode;
  /** Fired when the user selects a different encoding mode */
  onEncodingModeChange: (mode: EncodingMode) => void;
  /** Whether to close the graph view; optional — omit when close is handled elsewhere */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Button definitions
// ---------------------------------------------------------------------------

const ENCODING_BUTTONS: Array<{ mode: EncodingMode; label: string; title: string }> = [
  {
    mode: 'primary',
    label: 'Community',
    title: 'Color nodes by community cluster',
  },
  {
    mode: 'orphan',
    label: 'Orphan',
    title: 'Highlight nodes with no connections',
  },
  {
    mode: 'recency',
    label: 'Recency',
    title: 'Color nodes by last-modified date',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar for the full-screen graph view.
 *
 * @example
 * ```tsx
 * <GraphViewToolbar
 *   encodingMode={encodingMode}
 *   onEncodingModeChange={setEncodingMode}
 *   onClose={() => navigate(-1)}
 * />
 * ```
 */
export function GraphViewToolbar({
  encodingMode,
  onEncodingModeChange,
  onClose,
}: GraphViewToolbarProps) {
  return (
    <div className={styles.toolbar} data-testid="graph-view-toolbar" role="toolbar" aria-label="Graph view controls">
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Encoding</span>
        <div className={styles.buttonGroup} role="group" aria-label="Encoding mode">
          {ENCODING_BUTTONS.map(({ mode, label, title }) => (
            <button
              key={mode}
              type="button"
              className={`${styles.modeButton} ${encodingMode === mode ? styles.modeButtonActive : ''}`}
              onClick={() => onEncodingModeChange(mode)}
              title={title}
              aria-pressed={encodingMode === mode}
              data-testid={`encoding-mode-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {onClose !== undefined && (
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close graph view"
          data-testid="graph-toolbar-close"
        >
          Close
        </button>
      )}
    </div>
  );
}
