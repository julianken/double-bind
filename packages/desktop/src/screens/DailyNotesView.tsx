/**
 * DailyNotesView - Screen component for displaying today's daily note
 *
 * Auto-creates today's daily note on mount using pageService.getTodaysDailyNote().
 * Displays the daily note using the same block tree structure as PageView.
 * This screen is shown when currentPageId is null in the Zustand router.
 *
 * Date format: ISO 8601 (YYYY-MM-DD) stored in page.dailyNoteDate
 * Display format: Human-readable (e.g., "Thursday, February 6, 2025")
 *
 * FIXED (DBB-341): Uses date-based query key instead of pageId-based key for stability.
 * The old implementation caused infinite re-render loops because:
 * 1. Initial render used key ['blocks', 'byPage', ''] (empty pageId)
 * 2. After page load, key changed to ['blocks', 'byPage', actualId]
 * 3. This triggered query re-execution, which triggered state changes, which triggered re-renders
 *
 * The new implementation uses a single useDailyNoteWithBlocks() hook with a date-based key
 * ['dailyNote', 'withBlocks', '2025-02-08'] that's stable from first render.
 */

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useServices } from '../providers/index.js';
import { useDailyNoteWithBlocks, getTodayISODate } from '../hooks/useTanStackQuery.js';
import { invalidateQueries } from '../hooks/useCozoQuery.js';
import type { RouteComponentProps } from '../components/Router.js';
import { BlockNode } from '../components/BlockNode.js';
import { createDragEndHandler } from '../utils/createDragEndHandler.js';
import styles from './DailyNotesView.module.css';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for DailyNotesView (implements RouteComponentProps for Router compatibility)
 */
export type DailyNotesViewProps = RouteComponentProps;

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

// Re-export for external use
export { getTodayISODate };

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
 * - Renders block tree with editable BlockNode components
 *
 * FIXED (DBB-341): Uses useDailyNoteWithBlocks() which has a date-based query key
 * that's stable from first render, preventing the infinite re-render loop.
 */
export function DailyNotesView(_props: DailyNotesViewProps): React.ReactElement {
  const { blockService } = useServices();

  // DnD sensors: pointer (mouse/touch) + keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // FIXED (DBB-341): Use the new stable hook with date-based query key.
  // This replaces the old pattern of:
  // 1. useState(dailyNote) + useEffect(loadDailyNote)
  // 2. useCozoQuery(['blocks', 'byPage', dailyNote?.pageId ?? ''])
  //
  // The old pattern caused key instability ('' -> real ID) which triggered
  // cascading re-renders. The new hook uses a date-based key that's stable.
  const { page: dailyNote, blocks, isLoading, error } = useDailyNoteWithBlocks();

  // Get root-level blocks (parentId === null) - the BlockNode component handles children
  const rootBlocks = useMemo(() => {
    if (!blocks) return [];
    return blocks
      .filter((block) => block.parentId === null)
      .sort((a, b) => a.order.localeCompare(b.order));
  }, [blocks]);

  // Handle drag-and-drop reordering of root-level blocks
  const handleDragEnd = useMemo(
    () => createDragEndHandler(rootBlocks, blockService),
    [rootBlocks, blockService]
  );

  // Create first block when clicking empty state
  const handleCreateFirstBlock = useCallback(async () => {
    if (!dailyNote) return;

    try {
      await blockService.createBlock(
        dailyNote.pageId,
        null, // parentId - root level block
        '', // content - empty block
        undefined // afterBlockId - first block (undefined = insert at beginning)
      );
      // Trigger refetch to show the new block
      // Use the date-based key for proper invalidation
      invalidateQueries(['dailyNote']);
    } catch (err) {
      // eslint-disable-next-line no-console -- Error logging for debugging
      console.error('Failed to create first block:', err);
    }
  }, [dailyNote, blockService]);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <div
        className={`${styles.container} ${styles['container--loading']}`}
        data-testid="daily-notes-loading"
        role="main"
        aria-busy="true"
        aria-label="Loading today's daily note"
      >
        <div className={styles.loadingIndicator}>Loading today&apos;s daily note...</div>
      </div>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (error) {
    return (
      <div
        className={`${styles.container} ${styles['container--error']}`}
        data-testid="daily-notes-error"
        role="main"
        aria-label="Error loading daily note"
      >
        <div className={styles.error}>
          <h1>Failed to load daily note</h1>
          <p>{error.message ?? 'An unknown error occurred'}</p>
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
    : formatDailyNoteDate(getTodayISODate());

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
        {rootBlocks.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rootBlocks.map((b) => b.blockId)}
              strategy={verticalListSortingStrategy}
            >
              <ul role="tree" className={styles.blockTree} data-testid="block-tree">
                {rootBlocks.map((block, index) => (
                  <BlockNode
                    key={block.blockId}
                    blockId={block.blockId}
                    depth={0}
                    previousBlockId={index > 0 ? rootBlocks[index - 1]!.blockId : null}
                    nextBlockId={
                      index < rootBlocks.length - 1 ? rootBlocks[index + 1]!.blockId : null
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <button
            type="button"
            className={styles.empty}
            data-testid="daily-notes-empty"
            onClick={handleCreateFirstBlock}
            aria-label="Create first block in daily note"
          >
            <p>Click here to start writing...</p>
          </button>
        )}
      </section>
    </div>
  );
}

export default DailyNotesView;
