/**
 * DailyNotesView - Screen component for displaying today's daily note
 *
 * Auto-creates today's daily note on mount using pageService.getTodaysDailyNote().
 * Displays the daily note using the same block tree structure as PageView.
 * This screen is shown when currentPageId is null in the Zustand router.
 *
 * Date format: ISO 8601 (YYYY-MM-DD) stored in page.dailyNoteDate
 * Display format: Human-readable (e.g., "Thursday, February 6, 2025")
 */

import { useEffect, useCallback, useState } from 'react';
import type { Page, Block } from '@double-bind/types';
import { useServices } from '../providers/index.js';
import { useCozoQuery } from '../hooks/index.js';
import type { RouteComponentProps } from '../components/Router.js';
import styles from './DailyNotesView.module.css';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for DailyNotesView (implements RouteComponentProps for Router compatibility)
 */
export type DailyNotesViewProps = RouteComponentProps;

/**
 * Loading state for the daily note
 */
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format an ISO date string (YYYY-MM-DD) for human-readable display
 *
 * @param isoDate - ISO 8601 date string (e.g., "2025-02-06")
 * @returns Formatted date string (e.g., "Thursday, February 6, 2025")
 */
export function formatDailyNoteDate(isoDate: string): string {
  // Parse the ISO date string - add time component to avoid timezone issues
  const date = new Date(`${isoDate}T12:00:00`);

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return isoDate; // Fallback to raw date if parsing fails
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0]!;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DailyNotesView screen component
 *
 * Features:
 * - Auto-creates today's daily note on mount
 * - Displays formatted date as page title
 * - Shows loading/error states
 * - Renders block tree (placeholder until BlockEditor is implemented)
 */
export function DailyNotesView(_props: DailyNotesViewProps): React.ReactElement {
  const { pageService } = useServices();

  // Track the daily note page once loaded/created
  const [dailyNote, setDailyNote] = useState<Page | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Fetch/create today's daily note on mount
  useEffect(() => {
    let cancelled = false;

    async function loadDailyNote() {
      setLoadingState('loading');
      setError(null);

      try {
        const page = await pageService.getTodaysDailyNote();
        if (!cancelled) {
          setDailyNote(page);
          setLoadingState('success');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoadingState('error');
        }
      }
    }

    loadDailyNote();

    return () => {
      cancelled = true;
    };
  }, [pageService]);

  // Query function for fetching blocks (only when we have a daily note)
  const blocksQueryFn = useCallback(async (): Promise<Block[]> => {
    if (!dailyNote) {
      return [];
    }
    const { blocks } = await pageService.getPageWithBlocks(dailyNote.pageId);
    return blocks;
  }, [pageService, dailyNote]);

  // Fetch blocks for the daily note
  const {
    data: blocks,
    isLoading: blocksLoading,
    error: blocksError,
  } = useCozoQuery<Block[]>(['blocks', 'byPage', dailyNote?.pageId ?? ''], blocksQueryFn, {
    enabled: !!dailyNote,
  });

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (loadingState === 'loading' || loadingState === 'idle') {
    return (
      <div
        className={`${styles.container} ${styles['container--loading']}`}
        data-testid="daily-notes-loading"
        role="main"
        aria-busy="true"
        aria-label="Loading today's daily note"
      >
        <div className={styles.loadingIndicator}>
          Loading today&apos;s daily note...
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (loadingState === 'error' || error) {
    return (
      <div
        className={`${styles.container} ${styles['container--error']}`}
        data-testid="daily-notes-error"
        role="main"
        aria-label="Error loading daily note"
      >
        <div className={styles.error}>
          <h1>Failed to load daily note</h1>
          <p>{error?.message ?? 'An unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Success State
  // ============================================================================

  // Format the date for display
  const displayDate = dailyNote?.dailyNoteDate
    ? formatDailyNoteDate(dailyNote.dailyNoteDate)
    : getTodayISODate();

  return (
    <div
      className={styles.container}
      data-testid="daily-notes-view"
      role="main"
      aria-label={`Daily note for ${displayDate}`}
    >
      {/* Page Title */}
      <header className={styles.header}>
        <h1 className={styles.title} data-testid="daily-notes-title">
          {displayDate}
        </h1>
        {dailyNote?.dailyNoteDate && (
          <time
            className={styles.dateIso}
            dateTime={dailyNote.dailyNoteDate}
            data-testid="daily-notes-date-iso"
          >
            {dailyNote.dailyNoteDate}
          </time>
        )}
      </header>

      {/* Block Tree Content */}
      <section
        className={styles.content}
        data-testid="daily-notes-content"
        aria-label="Daily note content"
      >
        {blocksLoading ? (
          <div className={styles.blocksLoading}>Loading blocks...</div>
        ) : blocksError ? (
          <div className={styles.blocksError}>
            Failed to load blocks: {blocksError.message}
          </div>
        ) : blocks && blocks.length > 0 ? (
          <ul className={styles.blockTree} role="tree" aria-label="Block tree">
            {blocks
              .filter((block) => block.parentId === null)
              .sort((a, b) => a.order.localeCompare(b.order))
              .map((block) => (
                <li
                  key={block.blockId}
                  className={styles.block}
                  role="treeitem"
                  data-testid={`block-${block.blockId}`}
                >
                  <div className={styles.blockContent}>
                    {block.content || '(empty block)'}
                  </div>
                  {/* Child blocks would be rendered recursively here */}
                  {/* This is a placeholder - full BlockNode component will handle this */}
                </li>
              ))}
          </ul>
        ) : (
          <div className={styles.empty} data-testid="daily-notes-empty">
            <p>Start writing in today&apos;s daily note...</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default DailyNotesView;
