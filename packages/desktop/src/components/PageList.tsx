/**
 * PageList - Displays all pages in the sidebar sorted by updated_at descending.
 *
 * Features:
 * - Fetches pages using useCozoQuery with ['pages'] key
 * - Displays title and relative timestamp for each page
 * - Highlights the currently active page
 * - Navigation via Zustand's navigateToPage action
 * - Updates automatically when ['pages'] query is invalidated
 */

import { useCallback, memo } from 'react';
import type { Page } from '@double-bind/types';
import { useServices } from '../providers/ServiceProvider.js';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Types
// ============================================================================

export interface PageListProps {
  /**
   * Maximum number of pages to display.
   * Defaults to 100.
   */
  limit?: number;

  /**
   * Custom class name for the container.
   */
  className?: string;
}

export interface PageListItemProps {
  /**
   * The page to display.
   */
  page: Page;

  /**
   * Whether this page is currently active.
   */
  isActive: boolean;

  /**
   * Callback when the page is clicked.
   */
  onClick: () => void;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Formats a timestamp as a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "Jan 15"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than 1 minute
  if (diff < 60_000) {
    return 'just now';
  }

  // Less than 1 hour
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days}d ago`;
  }

  // More than 7 days - show date
  const date = new Date(timestamp);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

// ============================================================================
// PageListItem Component
// ============================================================================

/**
 * Individual page item in the list.
 * Memoized to prevent unnecessary re-renders when other pages change.
 */
export const PageListItem = memo(function PageListItem({
  page,
  isActive,
  onClick,
}: PageListItemProps) {
  return (
    <li
      role="option"
      aria-selected={isActive}
      data-testid={`page-list-item-${page.pageId}`}
      className={`page-list-item ${isActive ? 'page-list-item--active' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: isActive ? 'var(--color-bg-active, #e3e3e3)' : 'transparent',
        borderRadius: '4px',
        listStyle: 'none',
      }}
    >
      <span
        className="page-list-item__title"
        style={{
          fontWeight: isActive ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: '8px',
        }}
      >
        {page.title || 'Untitled'}
      </span>
      <span
        className="page-list-item__timestamp"
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted, #666)',
          flexShrink: 0,
        }}
      >
        {formatRelativeTime(page.updatedAt)}
      </span>
    </li>
  );
});

// ============================================================================
// PageList Component
// ============================================================================

/**
 * PageList component - displays all pages sorted by updated_at descending.
 *
 * Usage:
 * ```tsx
 * <PageList />
 * ```
 *
 * The component:
 * 1. Fetches pages via PageService.getAllPages()
 * 2. Subscribes to currentPageId from AppStore for highlighting
 * 3. Handles click events to navigate via navigateToPage()
 * 4. Re-fetches when ['pages'] query key is invalidated
 */
export function PageList({ limit = 100, className }: PageListProps) {
  const { pageService } = useServices();
  const currentPageId = useAppStore((state) => state.currentPageId);
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  // Fetch pages sorted by updated_at descending
  const queryFn = useCallback(() => pageService.getAllPages({ limit }), [pageService, limit]);

  const { data: pages, isLoading, error } = useCozoQuery(['pages'], queryFn);

  // Handle page click
  const handlePageClick = useCallback(
    (pageId: string) => {
      navigateToPage(pageId);
    },
    [navigateToPage]
  );

  // Loading state
  if (isLoading && !pages) {
    return (
      <div
        className={`page-list page-list--loading ${className || ''}`}
        data-testid="page-list-loading"
        role="status"
        aria-label="Loading pages"
      >
        <span style={{ padding: '12px', color: 'var(--color-text-muted, #666)' }}>Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`page-list page-list--error ${className || ''}`}
        data-testid="page-list-error"
        role="alert"
      >
        <span style={{ padding: '12px', color: 'var(--color-error, #d32f2f)' }}>
          Failed to load pages
        </span>
      </div>
    );
  }

  // Empty state
  if (!pages || pages.length === 0) {
    return (
      <div
        className={`page-list page-list--empty ${className || ''}`}
        data-testid="page-list-empty"
      >
        <span style={{ padding: '12px', color: 'var(--color-text-muted, #666)' }}>
          No pages yet
        </span>
      </div>
    );
  }

  // Render page list
  return (
    <ul
      className={`page-list ${className || ''}`}
      data-testid="page-list"
      role="listbox"
      aria-label="Pages"
      style={{
        padding: 0,
        margin: 0,
        listStyle: 'none',
      }}
    >
      {pages.map((page) => (
        <PageListItem
          key={page.pageId}
          page={page}
          isActive={currentPageId === page.pageId}
          onClick={() => handlePageClick(page.pageId)}
        />
      ))}
    </ul>
  );
}
