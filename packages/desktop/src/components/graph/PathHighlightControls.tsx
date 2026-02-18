/**
 * PathHighlightControls — UI panel for shortest-path highlighting.
 *
 * Displays the current path-finding state:
 * - "Click a node to set source" when no source is selected
 * - "Shift+click a target node to show path" once source is selected
 * - Path length and intermediate nodes when a path is active
 *
 * A "Clear" button resets the path state.
 */

import styles from './PathHighlightControls.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathHighlightControlsProps {
  /** The source node ID (first node clicked for path-finding) */
  pathSourceId: string | null;
  /** The computed shortest path (array of node IDs, includes source and target) */
  activePath: string[] | null;
  /** Map from nodeId → page title for display */
  nodeTitle: (nodeId: string) => string;
  /** Called when user clicks the Clear button */
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Small informational panel showing path-finding state.
 *
 * @example
 * ```tsx
 * <PathHighlightControls
 *   pathSourceId={pathSourceId}
 *   activePath={activePath}
 *   nodeTitle={(id) => pageMap.get(id)?.title ?? id}
 *   onClear={() => { clearPath(); clearSource(); }}
 * />
 * ```
 */
export function PathHighlightControls({
  pathSourceId,
  activePath,
  nodeTitle,
  onClear,
}: PathHighlightControlsProps) {
  const hasSource = pathSourceId !== null;
  const hasPath = activePath !== null && activePath.length > 0;
  const pathLength = hasPath ? activePath!.length - 1 : 0;
  const intermediates = hasPath ? activePath!.slice(1, -1) : [];

  return (
    <div
      className={styles.panel}
      data-testid="path-highlight-controls"
      aria-label="Path highlighting controls"
    >
      <div className={styles.header}>
        <span className={styles.title}>Path Highlight</span>
        {(hasSource || hasPath) && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
            aria-label="Clear path selection"
            data-testid="path-clear-button"
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.body}>
        {!hasSource && !hasPath && (
          <p className={styles.hint}>Click a node to set the path source.</p>
        )}

        {hasSource && !hasPath && (
          <div className={styles.sourceInfo}>
            <span className={styles.label}>Source:</span>
            <span className={styles.nodeChip} data-testid="path-source-label">
              {nodeTitle(pathSourceId!)}
            </span>
            <p className={styles.hint}>Shift+click another node to find the shortest path.</p>
          </div>
        )}

        {hasPath && (
          <div className={styles.pathInfo} data-testid="path-result">
            <div className={styles.pathRow}>
              <span className={styles.label}>Source:</span>
              <span className={styles.nodeChip}>{nodeTitle(activePath![0]!)}</span>
            </div>
            <div className={styles.pathRow}>
              <span className={styles.label}>Target:</span>
              <span className={styles.nodeChip}>{nodeTitle(activePath![activePath!.length - 1]!)}</span>
            </div>
            <div className={styles.pathRow}>
              <span className={styles.label}>Hops:</span>
              <span className={styles.hopCount} data-testid="path-hop-count">{pathLength}</span>
            </div>
            {intermediates.length > 0 && (
              <div className={styles.intermediates}>
                <span className={styles.label}>Via:</span>
                <span className={styles.hint}>
                  {intermediates.map((id) => nodeTitle(id)).join(' → ')}
                </span>
              </div>
            )}
          </div>
        )}

        {hasPath && activePath!.length === 0 && (
          <p className={styles.noPath} data-testid="path-no-path">
            No path found between these nodes.
          </p>
        )}
      </div>
    </div>
  );
}
