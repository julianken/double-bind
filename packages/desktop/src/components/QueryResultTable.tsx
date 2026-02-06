/**
 * QueryResultTable - Displays query results in a sortable, virtualized table.
 *
 * Features:
 * - Sortable columns (click header to toggle asc/desc)
 * - Auto-detects column types: string, number, date, page_id, block_id
 * - Clickable page_id/block_id cells for navigation
 * - Virtualized scrolling for large datasets using react-window
 * - Empty and loading states
 * - Full accessibility support (table roles, aria-sort)
 */

import { useCallback, useMemo, useState, memo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { List } from 'react-window';
import type { PageId, BlockId } from '@double-bind/types';

// ============================================================================
// Types
// ============================================================================

/** Column data types that can be auto-detected */
export type ColumnType = 'string' | 'number' | 'date' | 'page_id' | 'block_id';

/** Sort direction */
export type SortDirection = 'asc' | 'desc' | null;

/** Sort state for a column */
export interface SortState {
  column: string;
  direction: SortDirection;
}

/** Navigation target for clickable cells */
export interface NavigationTarget {
  type: 'page' | 'block';
  id: PageId | BlockId;
}

export interface QueryResultTableProps {
  /** Array of row objects (each row is a record with column keys) */
  data: Record<string, unknown>[];

  /** Column names to display (in order) */
  headers: string[];

  /** Callback when a page_id or block_id cell is clicked */
  onNavigate?: (target: NavigationTarget) => void;

  /** Whether the table is in a loading state */
  isLoading?: boolean;

  /** Custom class name for the container */
  className?: string;

  /** Height of each row in pixels (default: 36) */
  rowHeight?: number;

  /** Maximum height of the table in pixels (default: 400) */
  maxHeight?: number;

  /** Number of rows after which virtualization kicks in (default: 50) */
  virtualizationThreshold?: number;
}

// ============================================================================
// Type Detection
// ============================================================================

/** ULID pattern: 26 characters, base32 encoded */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** ISO 8601 date patterns */
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601 datetime
];

/**
 * Detects the type of a single value.
 */
function detectValueType(value: unknown): ColumnType {
  if (value === null || value === undefined) {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'string') {
    // Check for date patterns
    if (DATE_PATTERNS.some((pattern) => pattern.test(value))) {
      return 'date';
    }

    // Check for ULID (potential page_id or block_id)
    if (ULID_PATTERN.test(value)) {
      // We'll determine page_id vs block_id based on column name
      return 'string'; // Will be refined by column name
    }
  }

  // Unix timestamp (milliseconds or seconds)
  if (typeof value === 'number' && value > 1000000000) {
    return 'date';
  }

  return 'string';
}

/**
 * Detects column type based on column name and sample values.
 * Uses column name heuristics for page_id/block_id detection.
 */
export function detectColumnType(columnName: string, values: unknown[]): ColumnType {
  const lowerName = columnName.toLowerCase();

  // Check column name patterns for IDs
  if (
    lowerName === 'page_id' ||
    lowerName === 'pageid' ||
    lowerName === 'source_id' ||
    lowerName === 'target_id' ||
    lowerName.endsWith('_page_id')
  ) {
    return 'page_id';
  }

  if (
    lowerName === 'block_id' ||
    lowerName === 'blockid' ||
    lowerName === 'parent_id' ||
    lowerName === 'context_block_id' ||
    lowerName.endsWith('_block_id')
  ) {
    return 'block_id';
  }

  // Sample non-null values for type detection
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);
  if (nonNullValues.length === 0) {
    return 'string';
  }

  // Check if all values are numbers
  if (nonNullValues.every((v) => typeof v === 'number')) {
    // Check if looks like timestamps (Unix ms or seconds)
    const firstNum = nonNullValues[0] as number;
    if (
      firstNum > 1000000000 &&
      (lowerName.includes('at') || lowerName.includes('date') || lowerName.includes('time'))
    ) {
      return 'date';
    }
    return 'number';
  }

  // Check for date strings
  if (
    nonNullValues.every(
      (v) => typeof v === 'string' && DATE_PATTERNS.some((pattern) => pattern.test(v))
    )
  ) {
    return 'date';
  }

  // Check value types of sample
  const sampleType = detectValueType(nonNullValues[0]);
  return sampleType;
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Compares two values for sorting.
 */
function compareValues(a: unknown, b: unknown, type: ColumnType, direction: SortDirection): number {
  if (direction === null) return 0;

  const multiplier = direction === 'asc' ? 1 : -1;

  // Handle null/undefined
  if (a === null || a === undefined) return multiplier;
  if (b === null || b === undefined) return -multiplier;

  switch (type) {
    case 'number':
      return multiplier * (Number(a) - Number(b));

    case 'date': {
      const dateA = typeof a === 'number' ? a : new Date(String(a)).getTime();
      const dateB = typeof b === 'number' ? b : new Date(String(b)).getTime();
      return multiplier * (dateA - dateB);
    }

    case 'string':
    case 'page_id':
    case 'block_id':
    default:
      return multiplier * String(a).localeCompare(String(b));
  }
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formats a value for display based on its column type.
 */
export function formatValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined) {
    return '-';
  }

  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);

    case 'date': {
      if (typeof value === 'number') {
        // Unix timestamp (assume milliseconds if > 10 billion)
        const timestamp = value > 10_000_000_000 ? value : value * 1000;
        return new Date(timestamp).toLocaleString();
      }
      if (typeof value === 'string') {
        return new Date(value).toLocaleString();
      }
      return String(value);
    }

    case 'page_id':
    case 'block_id': {
      // Show truncated ID for readability
      const id = String(value);
      return id.length > 12 ? `${id.slice(0, 8)}...` : id;
    }

    case 'string':
    default:
      return String(value);
  }
}

// ============================================================================
// Row Component (Virtualized)
// ============================================================================

interface RowProps {
  rows: Record<string, unknown>[];
  headers: string[];
  columnTypes: Map<string, ColumnType>;
  onNavigate?: (target: NavigationTarget) => void;
}

interface VirtualRowProps extends RowProps {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
}

function VirtualRow({ index, style, rows, headers, columnTypes, onNavigate }: VirtualRowProps) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div
      role="row"
      data-testid={`result-row-${index}`}
      style={{
        ...style,
        display: 'flex',
        borderBottom: '1px solid var(--color-border, #e0e0e0)',
      }}
    >
      {headers.map((header) => {
        const type = columnTypes.get(header) || 'string';
        const value = row[header];
        const isNavigable =
          (type === 'page_id' || type === 'block_id') && value !== null && value !== undefined;

        return (
          <div
            key={header}
            role="cell"
            data-testid={`result-cell-${index}-${header}`}
            data-column-type={type}
            style={{
              flex: 1,
              padding: '8px 12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: isNavigable ? 'pointer' : 'default',
              color: isNavigable ? 'var(--color-link, #0066cc)' : 'inherit',
              textDecoration: isNavigable ? 'underline' : 'none',
            }}
            onClick={
              isNavigable && onNavigate
                ? () =>
                    onNavigate({
                      type: type === 'page_id' ? 'page' : 'block',
                      id: String(value),
                    })
                : undefined
            }
            onKeyDown={
              isNavigable && onNavigate
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate({
                        type: type === 'page_id' ? 'page' : 'block',
                        id: String(value),
                      });
                    }
                  }
                : undefined
            }
            tabIndex={isNavigable ? 0 : undefined}
            title={String(value ?? '')}
          >
            {formatValue(value, type)}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Standard Row Component (Non-Virtualized)
// ============================================================================

interface StandardRowProps {
  row: Record<string, unknown>;
  index: number;
  headers: string[];
  columnTypes: Map<string, ColumnType>;
  onNavigate?: (target: NavigationTarget) => void;
}

const StandardRow = memo(function StandardRow({
  row,
  index,
  headers,
  columnTypes,
  onNavigate,
}: StandardRowProps) {
  return (
    <tr data-testid={`result-row-${index}`}>
      {headers.map((header) => {
        const type = columnTypes.get(header) || 'string';
        const value = row[header];
        const isNavigable =
          (type === 'page_id' || type === 'block_id') && value !== null && value !== undefined;

        return (
          <td
            key={header}
            data-testid={`result-cell-${index}-${header}`}
            data-column-type={type}
            style={{
              padding: '8px 12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
              cursor: isNavigable ? 'pointer' : 'default',
              color: isNavigable ? 'var(--color-link, #0066cc)' : 'inherit',
              textDecoration: isNavigable ? 'underline' : 'none',
              borderBottom: '1px solid var(--color-border, #e0e0e0)',
            }}
            onClick={
              isNavigable && onNavigate
                ? () =>
                    onNavigate({
                      type: type === 'page_id' ? 'page' : 'block',
                      id: String(value),
                    })
                : undefined
            }
            onKeyDown={
              isNavigable && onNavigate
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigate({
                        type: type === 'page_id' ? 'page' : 'block',
                        id: String(value),
                      });
                    }
                  }
                : undefined
            }
            tabIndex={isNavigable ? 0 : undefined}
            title={String(value ?? '')}
          >
            {formatValue(value, type)}
          </td>
        );
      })}
    </tr>
  );
});

// ============================================================================
// QueryResultTable Component
// ============================================================================

/**
 * QueryResultTable - Displays query results with sorting and virtualization.
 *
 * Usage:
 * ```tsx
 * <QueryResultTable
 *   data={[{ page_id: 'abc123', title: 'My Page', created_at: 1704067200000 }]}
 *   headers={['page_id', 'title', 'created_at']}
 *   onNavigate={(target) => navigateToPage(target.id)}
 * />
 * ```
 */
export function QueryResultTable({
  data,
  headers,
  onNavigate,
  isLoading = false,
  className,
  rowHeight = 36,
  maxHeight = 400,
  virtualizationThreshold = 50,
}: QueryResultTableProps) {
  const [sortState, setSortState] = useState<SortState>({
    column: '',
    direction: null,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect column types
  const columnTypes = useMemo(() => {
    const types = new Map<string, ColumnType>();
    for (const header of headers) {
      const values = data.map((row) => row[header]);
      types.set(header, detectColumnType(header, values));
    }
    return types;
  }, [headers, data]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.column || sortState.direction === null) {
      return data;
    }

    const type = columnTypes.get(sortState.column) || 'string';
    return [...data].sort((a, b) =>
      compareValues(a[sortState.column], b[sortState.column], type, sortState.direction)
    );
  }, [data, sortState, columnTypes]);

  // Handle header click for sorting
  const handleHeaderClick = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return { column: '', direction: null };
    });
  }, []);

  // Determine if virtualization is needed
  const useVirtualization = data.length > virtualizationThreshold;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`query-result-table query-result-table--loading ${className || ''}`}
        data-testid="query-result-table-loading"
        role="status"
        aria-label="Loading query results"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-text-muted, #666)',
        }}
      >
        Loading...
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div
        className={`query-result-table query-result-table--empty ${className || ''}`}
        data-testid="query-result-table-empty"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-text-muted, #666)',
        }}
      >
        No results
      </div>
    );
  }

  // Virtualized table
  if (useVirtualization) {
    const headerHeight = 40;
    const listHeight = Math.min(maxHeight - headerHeight, data.length * rowHeight);

    return (
      <div
        ref={containerRef}
        className={`query-result-table query-result-table--virtualized ${className || ''}`}
        data-testid="query-result-table"
        role="table"
        aria-label="Query results"
        aria-rowcount={data.length + 1}
        style={{
          border: '1px solid var(--color-border, #e0e0e0)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          role="rowgroup"
          style={{
            backgroundColor: 'var(--color-bg-header, #f5f5f5)',
            borderBottom: '2px solid var(--color-border, #e0e0e0)',
          }}
        >
          <div
            role="row"
            data-testid="result-header-row"
            style={{
              display: 'flex',
              height: `${headerHeight}px`,
            }}
          >
            {headers.map((header) => {
              const isSorted = sortState.column === header;
              const ariaSortValue =
                isSorted && sortState.direction
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

              return (
                <div
                  key={header}
                  role="columnheader"
                  data-testid={`result-header-${header}`}
                  aria-sort={ariaSortValue}
                  tabIndex={0}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    userSelect: 'none',
                  }}
                  onClick={() => handleHeaderClick(header)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleHeaderClick(header);
                    }
                  }}
                >
                  {header}
                  {isSorted && sortState.direction && (
                    <span aria-hidden="true">
                      {sortState.direction === 'asc' ? ' \u25B2' : ' \u25BC'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtualized body */}
        <div role="rowgroup">
          <List<RowProps>
            defaultHeight={listHeight}
            rowCount={sortedData.length}
            rowHeight={rowHeight}
            rowComponent={VirtualRow}
            rowProps={{
              rows: sortedData,
              headers,
              columnTypes,
              onNavigate,
            }}
          />
        </div>
      </div>
    );
  }

  // Standard table (non-virtualized)
  return (
    <div
      ref={containerRef}
      className={`query-result-table ${className || ''}`}
      data-testid="query-result-table"
      style={{
        maxHeight: `${maxHeight}px`,
        overflow: 'auto',
        border: '1px solid var(--color-border, #e0e0e0)',
        borderRadius: '4px',
      }}
    >
      <table
        role="table"
        aria-label="Query results"
        aria-rowcount={data.length + 1}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}
      >
        <thead
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--color-bg-header, #f5f5f5)',
          }}
        >
          <tr role="row" data-testid="result-header-row">
            {headers.map((header) => {
              const isSorted = sortState.column === header;
              const ariaSortValue =
                isSorted && sortState.direction
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

              return (
                <th
                  key={header}
                  role="columnheader"
                  data-testid={`result-header-${header}`}
                  aria-sort={ariaSortValue}
                  tabIndex={0}
                  style={{
                    padding: '8px 12px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '2px solid var(--color-border, #e0e0e0)',
                  }}
                  onClick={() => handleHeaderClick(header)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleHeaderClick(header);
                    }
                  }}
                >
                  {header}
                  {isSorted && sortState.direction && (
                    <span aria-hidden="true">
                      {sortState.direction === 'asc' ? ' \u25B2' : ' \u25BC'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <StandardRow
              key={index}
              row={row}
              index={index}
              headers={headers}
              columnTypes={columnTypes}
              onNavigate={onNavigate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default QueryResultTable;
