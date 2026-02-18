/**
 * DragHandle - Six-dot grip icon for block drag-and-drop reordering
 *
 * Appears on block hover (left side, opacity transition).
 * Provides a visual affordance for dragging blocks to reorder them.
 *
 * This component is positioned absolutely to the left of the block row.
 * Opacity transitions from 0 to 1 when the parent block is hovered.
 * The parent block must set position: relative and use the .blockRow hover
 * selector to reveal this handle.
 */

import { memo } from 'react';
import styles from './DragHandle.module.css';

// ============================================================================
// Types
// ============================================================================

export interface DragHandleProps {
  /**
   * Whether drag is currently in progress for this block.
   * Applies the active/grabbing cursor state.
   */
  isDragging?: boolean;

  /**
   * Props to spread on the handle element for drag functionality.
   * Provided by @dnd-kit/sortable's useSortable hook listeners/attributes.
   */
  dragProps?: Record<string, unknown>;

  /**
   * Accessible label for screen readers.
   */
  ariaLabel?: string;
}

// ============================================================================
// DragHandle Component
// ============================================================================

/**
 * DragHandle - The six-dot grip icon for block reordering.
 *
 * Renders three rows of two dots arranged as a 2x3 grid.
 * Used as a visual drag affordance in BlockNode. Parent block hover
 * triggers opacity transition via CSS sibling/descendant selectors.
 *
 * @example
 * ```tsx
 * <DragHandle
 *   isDragging={isDragging}
 *   dragProps={{ ...attributes, ...listeners }}
 * />
 * ```
 */
export const DragHandle = memo(function DragHandle({
  isDragging = false,
  dragProps,
  ariaLabel = 'Drag to reorder block',
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={[styles.dragHandle, isDragging ? styles['dragHandle--dragging'] : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel}
      tabIndex={-1}
      data-drag-handle=""
      {...dragProps}
    >
      <svg
        className={styles.gripIcon}
        width="10"
        height="14"
        viewBox="0 0 10 14"
        aria-hidden="true"
        focusable="false"
      >
        {/* Row 1 */}
        <circle cx="2" cy="2" r="1.5" fill="currentColor" />
        <circle cx="8" cy="2" r="1.5" fill="currentColor" />
        {/* Row 2 */}
        <circle cx="2" cy="7" r="1.5" fill="currentColor" />
        <circle cx="8" cy="7" r="1.5" fill="currentColor" />
        {/* Row 3 */}
        <circle cx="2" cy="12" r="1.5" fill="currentColor" />
        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      </svg>
    </button>
  );
});

DragHandle.displayName = 'DragHandle';
