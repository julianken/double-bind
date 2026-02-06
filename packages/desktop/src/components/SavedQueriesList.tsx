/**
 * SavedQueriesList - Displays all saved queries with search/filter functionality.
 *
 * Features:
 * - Fetches saved queries using useCozoQuery with ['savedQueries'] key
 * - Displays query name, type badge, and relative timestamp
 * - Search bar filters queries by name (client-side)
 * - Filter by query type (template, visual, raw)
 * - Click to select a query for viewing/editing
 * - Updates automatically when ['savedQueries'] query is invalidated
 */

import { useState, useCallback, memo, useMemo } from 'react';
import type { SavedQuery } from '@double-bind/types';
import { SavedQueryType } from '@double-bind/types';
import { useServices } from '../providers/ServiceProvider.js';
import { useCozoQuery } from '../hooks/useCozoQuery.js';

// ============================================================================
// Types
// ============================================================================

export interface SavedQueriesListProps {
  /**
   * Maximum number of queries to display.
   * Defaults to 100.
   */
  limit?: number;

  /**
   * Called when a saved query is selected.
   */
  onSelect?: (query: SavedQuery) => void;

  /**
   * Currently selected query ID (for highlighting).
   */
  selectedId?: string;

  /**
   * Custom class name for the container.
   */
  className?: string;
}

export interface SavedQueryListItemProps {
  /**
   * The saved query to display.
   */
  query: SavedQuery;

  /**
   * Whether this query is currently selected.
   */
  isSelected: boolean;

  /**
   * Callback when the query is clicked.
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

/**
 * Get display label for query type.
 */
function getTypeLabel(type: SavedQueryType): string {
  switch (type) {
    case SavedQueryType.TEMPLATE:
      return 'Template';
    case SavedQueryType.VISUAL:
      return 'Visual';
    case SavedQueryType.RAW:
      return 'Raw';
    default:
      return type;
  }
}

/**
 * Get color for query type badge.
 */
function getTypeBadgeColor(type: SavedQueryType): string {
  switch (type) {
    case SavedQueryType.TEMPLATE:
      return '#6366f1'; // Indigo
    case SavedQueryType.VISUAL:
      return '#22c55e'; // Green
    case SavedQueryType.RAW:
      return '#f59e0b'; // Amber
    default:
      return '#64748b'; // Slate
  }
}

// ============================================================================
// SavedQueryListItem Component
// ============================================================================

/**
 * Individual saved query item in the list.
 * Memoized to prevent unnecessary re-renders when other queries change.
 */
export const SavedQueryListItem = memo(function SavedQueryListItem({
  query,
  isSelected,
  onClick,
}: SavedQueryListItemProps) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      data-testid={`saved-query-item-${query.id}`}
      className={`saved-query-item ${isSelected ? 'saved-query-item--selected' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backgroundColor: isSelected ? 'var(--color-bg-active, #e3e3e3)' : 'transparent',
        borderRadius: '4px',
        listStyle: 'none',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          className="saved-query-item__name"
          style={{
            fontWeight: isSelected ? 600 : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: '8px',
          }}
        >
          {query.name}
        </span>
        <span
          className="saved-query-item__type"
          style={{
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: getTypeBadgeColor(query.type),
            color: 'white',
            flexShrink: 0,
          }}
        >
          {getTypeLabel(query.type)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {query.description ? (
          <span
            className="saved-query-item__description"
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted, #666)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              marginRight: '8px',
            }}
          >
            {query.description}
          </span>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <span
          className="saved-query-item__timestamp"
          style={{
            fontSize: '0.7rem',
            color: 'var(--color-text-muted, #999)',
            flexShrink: 0,
          }}
        >
          {formatRelativeTime(query.updatedAt)}
        </span>
      </div>
    </li>
  );
});

// ============================================================================
// SavedQueriesList Component
// ============================================================================

/**
 * SavedQueriesList component - displays all saved queries with search and filter.
 *
 * Usage:
 * ```tsx
 * <SavedQueriesList
 *   onSelect={(query) => handleQuerySelect(query)}
 *   selectedId={currentQueryId}
 * />
 * ```
 */
export function SavedQueriesList({
  limit = 100,
  onSelect,
  selectedId,
  className,
}: SavedQueriesListProps) {
  const { savedQueryService } = useServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SavedQueryType | 'all'>('all');

  // Fetch saved queries
  const queryFn = useCallback(() => savedQueryService.list({ limit }), [savedQueryService, limit]);

  const { data: queries, isLoading, error } = useCozoQuery(['savedQueries'], queryFn);

  // Filter queries based on search and type
  const filteredQueries = useMemo(() => {
    if (!queries) return [];

    return queries.filter((q) => {
      // Type filter
      if (typeFilter !== 'all' && q.type !== typeFilter) {
        return false;
      }

      // Search filter (case-insensitive)
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase().trim();
        const nameMatch = q.name.toLowerCase().includes(search);
        const descMatch = q.description?.toLowerCase().includes(search) ?? false;
        if (!nameMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [queries, searchQuery, typeFilter]);

  // Handle query click
  const handleQueryClick = useCallback(
    (query: SavedQuery) => {
      onSelect?.(query);
    },
    [onSelect]
  );

  // Loading state
  if (isLoading && !queries) {
    return (
      <div
        className={`saved-queries-list saved-queries-list--loading ${className || ''}`}
        data-testid="saved-queries-list-loading"
        role="status"
        aria-label="Loading saved queries"
      >
        <span style={{ padding: '12px', color: 'var(--color-text-muted, #666)' }}>Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`saved-queries-list saved-queries-list--error ${className || ''}`}
        data-testid="saved-queries-list-error"
        role="alert"
      >
        <span style={{ padding: '12px', color: 'var(--color-error, #d32f2f)' }}>
          Failed to load saved queries
        </span>
      </div>
    );
  }

  return (
    <div
      className={`saved-queries-list ${className || ''}`}
      data-testid="saved-queries-list"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Search and filter controls */}
      <div
        className="saved-queries-list__controls"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Search input */}
        <input
          type="text"
          placeholder="Search saved queries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="saved-queries-search"
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid var(--color-border, #d1d5db)',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        />

        {/* Type filter */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
          }}
        >
          {(['all', SavedQueryType.TEMPLATE, SavedQueryType.VISUAL, SavedQueryType.RAW] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                data-testid={`filter-${type}`}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-border, #d1d5db)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor:
                    typeFilter === type
                      ? 'var(--color-primary, #3b82f6)'
                      : 'var(--color-bg, white)',
                  color: typeFilter === type ? 'white' : 'inherit',
                  fontWeight: typeFilter === type ? 600 : 400,
                }}
              >
                {type === 'all' ? 'All' : getTypeLabel(type)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Query list */}
      {filteredQueries.length === 0 ? (
        <div
          className="saved-queries-list__empty"
          data-testid="saved-queries-list-empty"
          style={{ padding: '12px', color: 'var(--color-text-muted, #666)' }}
        >
          {queries && queries.length > 0
            ? 'No queries match your search'
            : 'No saved queries yet'}
        </div>
      ) : (
        <ul
          className="saved-queries-list__items"
          role="listbox"
          aria-label="Saved queries"
          style={{
            padding: 0,
            margin: 0,
            listStyle: 'none',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {filteredQueries.map((query) => (
            <SavedQueryListItem
              key={query.id}
              query={query}
              isSelected={selectedId === query.id}
              onClick={() => handleQueryClick(query)}
            />
          ))}
        </ul>
      )}

      {/* Footer with count */}
      <div
        className="saved-queries-list__footer"
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--color-border, #e5e7eb)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted, #666)',
        }}
      >
        {filteredQueries.length} of {queries?.length || 0} queries
      </div>
    </div>
  );
}
