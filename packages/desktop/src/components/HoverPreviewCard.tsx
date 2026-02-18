/**
 * HoverPreviewCard - Floating page preview card component.
 *
 * Renders a floating card with page preview data:
 * - Page title (bold)
 * - Excerpt (first ~120 chars of first block content)
 * - Block count
 * - Last updated relative timestamp
 *
 * Positioned absolutely via fixed coordinates provided by the caller.
 * Uses CSS Modules with smooth opacity/translate transition.
 *
 * @see packages/desktop/src/components/HoverPreview.tsx for the singleton wrapper
 * @see packages/desktop/src/hooks/usePagePreview.ts for the data fetching hook
 */

import { memo } from 'react';
import type { PageId } from '@double-bind/types';
import { usePagePreview } from '../hooks/usePagePreview.js';
import styles from './HoverPreviewCard.module.css';

// ============================================================================
// Types
// ============================================================================

export interface HoverPreviewCardProps {
  /** The page to preview */
  pageId: PageId;
  /** Screen-space X coordinate (left edge of card) */
  x: number;
  /** Screen-space Y coordinate (top edge of card) */
  y: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a Unix ms timestamp as a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "Jan 15"
 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// HoverPreviewCard Component
// ============================================================================

/**
 * HoverPreviewCard renders a floating preview panel for a page.
 *
 * The component fetches preview data via usePagePreview (session-cached)
 * and positions itself at the given fixed coordinates. Dismiss is handled
 * by the parent HoverPreview singleton.
 */
export const HoverPreviewCard = memo(function HoverPreviewCard({
  pageId,
  x,
  y,
}: HoverPreviewCardProps) {
  const { data, isLoading } = usePagePreview(pageId);

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
  };

  return (
    <div
      className={styles.card}
      style={cardStyle}
      role="tooltip"
      aria-label={data ? `Preview: ${data.title}` : 'Loading preview'}
      data-testid="hover-preview-card"
    >
      {isLoading && !data ? (
        <div className={styles.skeleton} data-testid="hover-preview-card-loading">
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLine} />
        </div>
      ) : data ? (
        <>
          <div className={styles.title} data-testid="hover-preview-card-title">
            {data.title || 'Untitled'}
          </div>
          {data.excerpt && (
            <div className={styles.excerpt} data-testid="hover-preview-card-excerpt">
              {data.excerpt}
            </div>
          )}
          <div className={styles.meta} data-testid="hover-preview-card-meta">
            <span className={styles.blockCount}>
              {data.blockCount === 1 ? '1 block' : `${data.blockCount} blocks`}
            </span>
            <span className={styles.separator} aria-hidden="true">·</span>
            <span className={styles.updatedAt}>
              {formatRelativeTime(data.updatedAt)}
            </span>
          </div>
        </>
      ) : (
        <div className={styles.empty} data-testid="hover-preview-card-empty">
          Page not found
        </div>
      )}
    </div>
  );
});

HoverPreviewCard.displayName = 'HoverPreviewCard';
