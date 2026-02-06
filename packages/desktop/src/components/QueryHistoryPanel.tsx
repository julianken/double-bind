/**
 * QueryHistoryPanel - Displays and manages query execution history
 *
 * Features:
 * - Displays last 50 executed CozoDB queries
 * - Shows query script, timestamp, duration, and result
 * - Allows re-running queries from history
 * - Supports clearing history
 * - Supports removing individual entries
 * - Persists history across sessions via localStorage
 */

import { memo, useCallback } from 'react';
import { useQueryHistoryStore, type QueryHistoryEntry } from '../stores/query-history-store.js';

// ============================================================================
// Types
// ============================================================================

export interface QueryHistoryPanelProps {
  /**
   * Callback when a query is selected for re-execution
   */
  onSelectQuery: (script: string) => void;

  /**
   * Optional custom class name for the container
   */
  className?: string;

  /**
   * Maximum number of characters to show in query preview
   * Defaults to 100
   */
  maxPreviewLength?: number;
}

export interface QueryHistoryItemProps {
  /**
   * The history entry to display
   */
  entry: QueryHistoryEntry;

  /**
   * Callback when the entry is clicked
   */
  onSelect: () => void;

  /**
   * Callback when the remove button is clicked
   */
  onRemove: () => void;

  /**
   * Maximum characters to show in preview
   */
  maxPreviewLength: number;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Formats a timestamp as a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "Jan 15"
 */
function formatRelativeTime(isoTimestamp: string): string {
  const timestamp = new Date(isoTimestamp).getTime();
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

/**
 * Formats duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) {
    return '<1ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Truncates a string to a maximum length with ellipsis
 */
function truncateScript(script: string, maxLength: number): string {
  // Normalize whitespace for preview
  const normalized = script.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// CSS Classes
// ============================================================================

export const QUERY_HISTORY_CSS_CLASSES = {
  panel: 'query-history-panel',
  panelEmpty: 'query-history-panel--empty',
  header: 'query-history-panel__header',
  title: 'query-history-panel__title',
  clearButton: 'query-history-panel__clear-button',
  list: 'query-history-panel__list',
  item: 'query-history-panel__item',
  itemSuccess: 'query-history-panel__item--success',
  itemError: 'query-history-panel__item--error',
  itemScript: 'query-history-panel__item-script',
  itemMeta: 'query-history-panel__item-meta',
  itemTimestamp: 'query-history-panel__item-timestamp',
  itemDuration: 'query-history-panel__item-duration',
  itemResult: 'query-history-panel__item-result',
  itemRemoveButton: 'query-history-panel__item-remove',
  emptyMessage: 'query-history-panel__empty-message',
} as const;

// ============================================================================
// QueryHistoryItem Component
// ============================================================================

/**
 * Individual query history entry.
 * Memoized to prevent unnecessary re-renders.
 */
export const QueryHistoryItem = memo(function QueryHistoryItem({
  entry,
  onSelect,
  onRemove,
  maxPreviewLength,
}: QueryHistoryItemProps) {
  const isSuccess = entry.result.success;
  const resultText = isSuccess
    ? `${entry.result.rowCount} row${entry.result.rowCount !== 1 ? 's' : ''}`
    : entry.result.error;

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    },
    [onSelect]
  );

  return (
    <li
      role="option"
      data-testid={`query-history-item-${entry.id}`}
      className={`${QUERY_HISTORY_CSS_CLASSES.item} ${
        isSuccess ? QUERY_HISTORY_CSS_CLASSES.itemSuccess : QUERY_HISTORY_CSS_CLASSES.itemError
      }`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backgroundColor: 'transparent',
        borderRadius: '4px',
        borderLeft: `3px solid ${isSuccess ? 'var(--color-success, #4caf50)' : 'var(--color-error, #d32f2f)'}`,
        listStyle: 'none',
        marginBottom: '4px',
      }}
    >
      <div
        className={QUERY_HISTORY_CSS_CLASSES.itemScript}
        style={{
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          color: 'var(--color-text-primary, #333)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={entry.script}
      >
        {truncateScript(entry.script, maxPreviewLength)}
      </div>
      <div
        className={QUERY_HISTORY_CSS_CLASSES.itemMeta}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted, #666)',
        }}
      >
        <span className={QUERY_HISTORY_CSS_CLASSES.itemTimestamp}>
          {formatRelativeTime(entry.executedAt)}
        </span>
        <span className={QUERY_HISTORY_CSS_CLASSES.itemDuration}>
          {formatDuration(entry.durationMs)}
        </span>
        <span
          className={QUERY_HISTORY_CSS_CLASSES.itemResult}
          style={{
            color: isSuccess ? 'var(--color-success, #4caf50)' : 'var(--color-error, #d32f2f)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={resultText}
        >
          {resultText}
        </span>
        <button
          type="button"
          className={QUERY_HISTORY_CSS_CLASSES.itemRemoveButton}
          onClick={handleRemoveClick}
          aria-label="Remove from history"
          title="Remove from history"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
            color: 'var(--color-text-muted, #666)',
            fontSize: '0.875rem',
            borderRadius: '2px',
          }}
        >
          &times;
        </button>
      </div>
    </li>
  );
});

// ============================================================================
// QueryHistoryPanel Component
// ============================================================================

/**
 * QueryHistoryPanel - displays query history with re-run functionality.
 *
 * Usage:
 * ```tsx
 * <QueryHistoryPanel
 *   onSelectQuery={(script) => executeQuery(script)}
 * />
 * ```
 */
export function QueryHistoryPanel({
  onSelectQuery,
  className,
  maxPreviewLength = 100,
}: QueryHistoryPanelProps) {
  const entries = useQueryHistoryStore((state) => state.entries);
  const clearHistory = useQueryHistoryStore((state) => state.clearHistory);
  const removeQuery = useQueryHistoryStore((state) => state.removeQuery);

  const handleClearHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  const handleSelectQuery = useCallback(
    (script: string) => {
      onSelectQuery(script);
    },
    [onSelectQuery]
  );

  const handleRemoveQuery = useCallback(
    (id: string) => {
      removeQuery(id);
    },
    [removeQuery]
  );

  // Empty state
  if (entries.length === 0) {
    return (
      <div
        className={`${QUERY_HISTORY_CSS_CLASSES.panel} ${QUERY_HISTORY_CSS_CLASSES.panelEmpty} ${className || ''}`}
        data-testid="query-history-panel-empty"
      >
        <div
          className={QUERY_HISTORY_CSS_CLASSES.header}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            borderBottom: '1px solid var(--color-border, #e0e0e0)',
          }}
        >
          <span
            className={QUERY_HISTORY_CSS_CLASSES.title}
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Query History
          </span>
        </div>
        <div
          className={QUERY_HISTORY_CSS_CLASSES.emptyMessage}
          data-testid="query-history-empty-message"
          style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: 'var(--color-text-muted, #666)',
            fontSize: '0.875rem',
          }}
        >
          No queries executed yet
        </div>
      </div>
    );
  }

  // Render history list
  return (
    <div
      className={`${QUERY_HISTORY_CSS_CLASSES.panel} ${className || ''}`}
      data-testid="query-history-panel"
    >
      <div
        className={QUERY_HISTORY_CSS_CLASSES.header}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          borderBottom: '1px solid var(--color-border, #e0e0e0)',
        }}
      >
        <span
          className={QUERY_HISTORY_CSS_CLASSES.title}
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Query History ({entries.length})
        </span>
        <button
          type="button"
          className={QUERY_HISTORY_CSS_CLASSES.clearButton}
          onClick={handleClearHistory}
          data-testid="query-history-clear-button"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted, #666)',
            fontSize: '0.75rem',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
        >
          Clear All
        </button>
      </div>
      <ul
        className={QUERY_HISTORY_CSS_CLASSES.list}
        role="listbox"
        aria-label="Query history"
        data-testid="query-history-list"
        style={{
          padding: '8px',
          margin: 0,
          listStyle: 'none',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {entries.map((entry) => (
          <QueryHistoryItem
            key={entry.id}
            entry={entry}
            onSelect={() => handleSelectQuery(entry.script)}
            onRemove={() => handleRemoveQuery(entry.id)}
            maxPreviewLength={maxPreviewLength}
          />
        ))}
      </ul>
    </div>
  );
}
