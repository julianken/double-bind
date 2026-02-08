/**
 * PageTitle - Inline editable page title component
 *
 * Features:
 * - Renders as an editable heading for regular pages
 * - Daily notes display formatted date and are read-only
 * - Saves on blur and on Enter key press
 * - Debounces saves to avoid excessive updates
 * - Down arrow focuses the first block (via callback)
 *
 * @example
 * ```tsx
 * <PageTitle
 *   pageId="01HXYZ..."
 *   title="My Page Title"
 *   dailyNoteDate={null}
 *   onSave={async (newTitle) => {
 *     await pageService.updateTitle(pageId, newTitle);
 *     invalidateQueries(['pages']);
 *   }}
 *   onFocusFirstBlock={() => setFocusedBlock(firstBlockId)}
 * />
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './PageTitle.module.css';

// ============================================================================
// Types
// ============================================================================

export interface PageTitleProps {
  /**
   * The page identifier
   */
  pageId: string;

  /**
   * The current page title
   */
  title: string;

  /**
   * If set (YYYY-MM-DD format), the page is a daily note
   * and the title will be displayed as a formatted date and be read-only
   */
  dailyNoteDate: string | null;

  /**
   * Callback to save the new title
   * Should handle service call and query invalidation
   */
  onSave: (newTitle: string) => Promise<void>;

  /**
   * Callback when Down arrow is pressed - should focus the first block
   */
  onFocusFirstBlock?: () => void;

  /**
   * Debounce delay in milliseconds (default: 500)
   */
  debounceMs?: number;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a date string (YYYY-MM-DD) as a human-readable date
 * e.g., "January 15, 2024"
 */
function formatDailyNoteDate(dateStr: string): string {
  // Parse as local date (avoid timezone issues)
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return dateStr;
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================================
// Component
// ============================================================================

export function PageTitle({
  pageId,
  title,
  dailyNoteDate,
  onSave,
  onFocusFirstBlock,
  debounceMs = 500,
}: PageTitleProps) {
  const isDailyNote = dailyNoteDate !== null;
  const displayTitle = isDailyNote ? formatDailyNoteDate(dailyNoteDate) : title;

  // Local state for editing
  const [localTitle, setLocalTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for debouncing and tracking pending saves
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef(title);

  // Sync local state when title prop changes (e.g., from external update)
  useEffect(() => {
    if (title !== lastSavedTitleRef.current) {
      setLocalTitle(title);
      lastSavedTitleRef.current = title;
    }
  }, [title]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Save the title (called after debounce or on blur/enter)
   */
  const saveTitle = useCallback(
    async (newTitle: string) => {
      // Skip if title hasn't changed
      if (newTitle === lastSavedTitleRef.current) {
        return;
      }

      // Skip empty titles
      if (!newTitle.trim()) {
        setLocalTitle(lastSavedTitleRef.current);
        return;
      }

      setIsSaving(true);
      try {
        await onSave(newTitle);
        lastSavedTitleRef.current = newTitle;
      } catch {
        // Revert on error - the onSave callback should handle error reporting
        setLocalTitle(lastSavedTitleRef.current);
      } finally {
        setIsSaving(false);
        pendingTitleRef.current = null;
      }
    },
    [onSave]
  );

  /**
   * Schedule a debounced save
   */
  const scheduleSave = useCallback(
    (newTitle: string) => {
      pendingTitleRef.current = newTitle;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (pendingTitleRef.current !== null) {
          void saveTitle(pendingTitleRef.current);
        }
      }, debounceMs);
    },
    [debounceMs, saveTitle]
  );

  /**
   * Flush any pending save immediately
   */
  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (pendingTitleRef.current !== null) {
      await saveTitle(pendingTitleRef.current);
    }
  }, [saveTitle]);

  /**
   * Handle input changes
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setLocalTitle(newTitle);
      scheduleSave(newTitle);
    },
    [scheduleSave]
  );

  /**
   * Handle blur - flush any pending save
   */
  const handleBlur = useCallback(() => {
    void flushPendingSave();
  }, [flushPendingSave]);

  /**
   * Handle key events
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void flushPendingSave();
        // Optionally blur to move focus away
        (e.target as HTMLInputElement).blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        void flushPendingSave();
        onFocusFirstBlock?.();
      } else if (e.key === 'Escape') {
        // Revert to last saved title
        setLocalTitle(lastSavedTitleRef.current);
        pendingTitleRef.current = null;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        (e.target as HTMLInputElement).blur();
      }
    },
    [flushPendingSave, onFocusFirstBlock]
  );

  // Daily notes are read-only
  if (isDailyNote) {
    return (
      <h1
        className={`${styles.title} ${styles['title--daily']}`}
        data-testid="page-title"
        data-page-id={pageId}
        data-daily-note="true"
      >
        {displayTitle}
      </h1>
    );
  }

  // Regular pages are editable
  return (
    <input
      type="text"
      className={styles['title--editable']}
      data-testid="page-title"
      data-page-id={pageId}
      data-saving={isSaving}
      value={localTitle}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Untitled"
      aria-label="Page title"
    />
  );
}
