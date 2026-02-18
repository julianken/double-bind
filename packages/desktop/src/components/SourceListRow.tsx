/**
 * SourceListRow - Single page item in the sidebar source list.
 *
 * Features:
 * - Displays page icon, title, and hover action buttons
 * - Star toggle and delete actions revealed on hover
 * - Active state with surface-overlay background
 * - Title truncation with ellipsis
 * - Context menu support via usePageContextMenu
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 */

import { memo, useCallback } from 'react';
import type { PageId } from '@double-bind/types';
import { usePageContextMenu } from '../hooks/usePageContextMenu.js';
import {
  dispatchHoverPreviewOpen,
  dispatchHoverPreviewClose,
} from '../hooks/useHoverPreview.js';
import styles from './SourceListRow.module.css';

// ============================================================================
// Types
// ============================================================================

export interface SourceListRowProps {
  /** The page identifier */
  pageId: string;
  /** The page title to display */
  title: string;
  /** Whether this page is the currently active page */
  isActive?: boolean;
  /** Whether this page is starred */
  isStarred?: boolean;
  /** Callback when the row is clicked */
  onClick: () => void;
  /** Callback when the star toggle button is clicked */
  onStar?: () => void;
  /** Callback when the delete button is clicked */
  onDelete?: () => void;
  /**
   * Whether to show a hover preview card when mousing over this row.
   * Defaults to true. Set false in contexts where preview isn't meaningful.
   */
  enableHoverPreview?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

function PageIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M5 5h6M5 8h6M5 11h4" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1l1.9 3.9 4.1.6-3 2.9.7 4.1L8 10.4l-3.7 2.1.7-4.1-3-2.9 4.1-.6z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * SourceListRow renders a single page entry in the sidebar source list.
 * Memoized to prevent re-renders when sibling rows update.
 */
export const SourceListRow = memo(function SourceListRow({
  pageId,
  title,
  isActive = false,
  isStarred = false,
  onClick,
  onStar,
  onDelete,
  enableHoverPreview = true,
}: SourceListRowProps) {
  const { showContextMenu } = usePageContextMenu(pageId);

  // Hover preview: dispatch events so the HoverPreview singleton picks them up.
  // We dispatch on the window so the singleton (mounted elsewhere in the tree)
  // can respond regardless of component hierarchy.
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableHoverPreview) return;
      const rect = e.currentTarget.getBoundingClientRect();
      // Position the preview card to the right of the row, aligned to its top
      dispatchHoverPreviewOpen(
        pageId as PageId,
        rect.right + 8,
        rect.top
      );
    },
    [pageId, enableHoverPreview]
  );

  const handleMouseLeave = useCallback(() => {
    if (!enableHoverPreview) return;
    dispatchHoverPreviewClose(pageId as PageId);
  }, [pageId, enableHoverPreview]);

  const handleStar = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onStar?.();
    },
    [onStar]
  );

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  const rowClasses = [styles.row, isActive ? styles['row--active'] : ''].filter(Boolean).join(' ');

  return (
    <div
      role="option"
      aria-selected={isActive}
      data-testid="source-list-row"
      className={rowClasses}
      onClick={onClick}
      onContextMenu={showContextMenu}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      <span className={styles.icon} aria-hidden="true">
        <PageIcon />
      </span>

      <span className={styles.title}>{title || 'Untitled'}</span>

      <div className={styles.actions} aria-label="Page actions">
        {onStar && (
          <button
            type="button"
            className={`${styles.actionButton} ${isStarred ? styles['actionButton--starred'] : ''}`}
            onClick={handleStar}
            aria-label={isStarred ? 'Unstar page' : 'Star page'}
            title={isStarred ? 'Unstar' : 'Star'}
          >
            <StarIcon filled={isStarred} />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleDelete}
            aria-label="Delete page"
            title="Delete"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
});
