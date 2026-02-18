/**
 * PageList - Displays pages in the sidebar grouped into three sections:
 *   1. Starred  — pages the user has starred (conditional; hidden when empty)
 *   2. Recent   — the 5 most-recently-updated pages (excluding starred)
 *   3. All Pages — remaining pages sorted by updated_at (excluding starred + recent)
 *
 * Sections are non-overlapping: each page appears in exactly one section.
 * This gives a total item count equal to pages.length.
 *
 * Features:
 * - Fetches pages via PageService.getAllPages()
 * - Starred state is managed locally per session (DB backing is future work)
 * - Each section is collapsible via SectionHeader
 * - The legacy PageListItem export is preserved for backward compatibility
 * - Highlights the currently active page
 * - Updates automatically when ['pages'] query key is invalidated
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 */

import { useCallback, useState, useMemo, memo } from 'react';
import type { Page } from '@double-bind/types';
import { useServices } from '../providers/ServiceProvider.js';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
import { useAppStore } from '../stores/ui-store.js';
import { SectionHeader } from './SectionHeader.js';
import styles from './PageList.module.css';

// ============================================================================
// Constants
// ============================================================================

/** Number of pages to show in the "Recent" section. */
const RECENT_COUNT = 5;

// ============================================================================
// Types
// ============================================================================

export interface PageListProps {
  /**
   * Maximum number of pages to fetch for the All Pages section.
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

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

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
 * Preserved for backward compatibility; rendered within sections.
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
      className={`${styles.item} ${isActive ? styles['item--active'] : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
    >
      <span className={styles.title}>{page.title || 'Untitled'}</span>
      <span className={styles.timestamp}>{formatRelativeTime(page.updatedAt)}</span>
    </li>
  );
});

// ============================================================================
// PageList Component
// ============================================================================

/**
 * PageList — three-section page list for the sidebar.
 *
 * Sections (non-overlapping; each page appears exactly once):
 * - STARRED   (hidden when no pages are starred)
 * - RECENT    (last 5 pages, excluding starred)
 * - ALL PAGES (remaining pages, excluding starred + recent)
 *
 * Starred state is managed locally within the component.
 * The starred_pages DB table (migration 002) will back this in a future issue.
 */
export function PageList({ limit = 100, className }: PageListProps) {
  const { pageService } = useServices();
  const currentPageId = useAppStore((state) => state.currentPageId);
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  // ---- Local section collapse state ----
  const [starredCollapsed, setStarredCollapsed] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);

  // ---- Local starred IDs (session-scoped; DB backing is future work — always empty for now) ----
  const starredIds = new Set<string>();

  // ---- Data fetching ----
  const queryFn = useCallback(
    () => pageService.getAllPages({ limit }),
    [pageService, limit]
  );
  const { data: pages, isLoading, error } = useCozoQuery(['pages'], queryFn);

  // ---- Derived non-overlapping sections ----
  const { starredPages, recentPages, allPages } = useMemo(() => {
    if (!pages || pages.length === 0) {
      return { starredPages: [], recentPages: [], allPages: [] };
    }

    const starred = pages.filter((p) => starredIds.has(p.pageId));
    const starredIdSet = new Set(starred.map((p) => p.pageId));

    const nonStarred = pages.filter((p) => !starredIdSet.has(p.pageId));
    const sortedNonStarred = [...nonStarred].sort((a, b) => b.updatedAt - a.updatedAt);
    const recent = sortedNonStarred.slice(0, RECENT_COUNT);
    const recentIdSet = new Set(recent.map((p) => p.pageId));

    const remaining = sortedNonStarred.filter((p) => !recentIdSet.has(p.pageId));

    return {
      starredPages: starred,
      recentPages: recent,
      allPages: remaining,
    };
  }, [pages, starredIds]);

  // ---- Handlers ----
  const handlePageClick = useCallback(
    (pageId: string) => {
      navigateToPage('page/' + pageId);
    },
    [navigateToPage]
  );

  // Determine active page ID (strip 'page/' prefix for matching)
  const activePageId = useMemo(() => {
    if (!currentPageId) return null;
    return currentPageId.startsWith('page/')
      ? currentPageId.slice(5)
      : currentPageId;
  }, [currentPageId]);

  // ---- Loading state ----
  if (isLoading && !pages) {
    return (
      <div
        className={`${styles.loading} ${className ?? ''}`}
        data-testid="page-list-loading"
        role="status"
        aria-label="Loading pages"
      >
        Loading...
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div
        className={`${styles.error} ${className ?? ''}`}
        data-testid="page-list-error"
        role="alert"
      >
        Failed to load pages
      </div>
    );
  }

  // ---- Empty state ----
  if (!pages || pages.length === 0) {
    return (
      <div
        className={`${styles.empty} ${className ?? ''}`}
        data-testid="page-list-empty"
      >
        No pages yet
      </div>
    );
  }

  // ---- Render three non-overlapping sections in a single listbox ----
  return (
    <ul
      className={`${styles.list} ${className ?? ''}`}
      data-testid="page-list"
      role="listbox"
      aria-label="Pages"
    >
      {/* Starred section — only shown when at least one page is starred */}
      {starredPages.length > 0 && (
        <>
          <li className={styles.sectionHeaderRow} aria-hidden="true">
            <SectionHeader
              label="STARRED"
              count={starredPages.length}
              collapsed={starredCollapsed}
              onToggle={() => setStarredCollapsed((v) => !v)}
            />
          </li>
          {!starredCollapsed &&
            starredPages.map((page) => (
              <PageListItem
                key={page.pageId}
                page={page}
                isActive={activePageId === page.pageId}
                onClick={() => handlePageClick(page.pageId)}
              />
            ))}
        </>
      )}

      {/* Recent section */}
      {recentPages.length > 0 && (
        <>
          <li className={styles.sectionHeaderRow} aria-hidden="true">
            <SectionHeader
              label="RECENT"
              count={recentPages.length}
              collapsed={recentCollapsed}
              onToggle={() => setRecentCollapsed((v) => !v)}
            />
          </li>
          {!recentCollapsed &&
            recentPages.map((page) => (
              <PageListItem
                key={page.pageId}
                page={page}
                isActive={activePageId === page.pageId}
                onClick={() => handlePageClick(page.pageId)}
              />
            ))}
        </>
      )}

      {/* All Pages section — remaining pages not in recent or starred */}
      {allPages.length > 0 && (
        <>
          <li className={styles.sectionHeaderRow} aria-hidden="true">
            <SectionHeader
              label="ALL PAGES"
              count={allPages.length}
              collapsed={allCollapsed}
              onToggle={() => setAllCollapsed((v) => !v)}
            />
          </li>
          {!allCollapsed &&
            allPages.map((page) => (
              <PageListItem
                key={page.pageId}
                page={page}
                isActive={activePageId === page.pageId}
                onClick={() => handlePageClick(page.pageId)}
              />
            ))}
        </>
      )}
    </ul>
  );
}
