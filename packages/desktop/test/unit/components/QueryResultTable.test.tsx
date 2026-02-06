/**
 * Tests for QueryResultTable component
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QueryResultTable,
  detectColumnType,
  formatValue,
} from '../../../src/components/QueryResultTable.js';

// ============================================================================
// Test Setup
// ============================================================================

// Mock ResizeObserver for jsdom
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Mock react-window for virtualization tests (v2 API)
vi.mock('react-window', () => ({
  List: ({
    rowComponent: RowComponent,
    rowCount,
    rowProps,
    rowHeight,
    defaultHeight,
  }: {
    rowComponent: React.ComponentType<{
      ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
      index: number;
      style: React.CSSProperties;
      [key: string]: unknown;
    }>;
    rowCount: number;
    rowProps: Record<string, unknown>;
    rowHeight: number;
    defaultHeight: number;
  }) => {
    return (
      <div data-testid="virtualized-list" style={{ height: defaultHeight }}>
        {Array.from({ length: Math.min(rowCount, 10) }, (_, index) => (
          <RowComponent
            key={index}
            index={index}
            ariaAttributes={{
              'aria-posinset': index + 1,
              'aria-setsize': rowCount,
              role: 'listitem',
            }}
            style={{ height: rowHeight, position: 'absolute', top: index * rowHeight }}
            {...rowProps}
          />
        ))}
      </div>
    );
  },
}));

// ============================================================================
// Mock Data
// ============================================================================

const mockData = [
  {
    page_id: '01HXYZ1234567890ABCDEFGHIJ',
    title: 'First Page',
    created_at: 1704067200000, // 2024-01-01
    view_count: 100,
  },
  {
    page_id: '01HXYZ1234567890ABCDEFGHIK',
    title: 'Second Page',
    created_at: 1704153600000, // 2024-01-02
    view_count: 50,
  },
  {
    page_id: '01HXYZ1234567890ABCDEFGHIL',
    title: 'Third Page',
    created_at: 1704240000000, // 2024-01-03
    view_count: 200,
  },
];

const mockHeaders = ['page_id', 'title', 'created_at', 'view_count'];

// ============================================================================
// detectColumnType Tests
// ============================================================================

describe('detectColumnType', () => {
  it('detects page_id from column name', () => {
    expect(detectColumnType('page_id', ['abc123'])).toBe('page_id');
    expect(detectColumnType('pageId', ['abc123'])).toBe('page_id');
    expect(detectColumnType('source_id', ['abc123'])).toBe('page_id');
    expect(detectColumnType('target_id', ['abc123'])).toBe('page_id');
  });

  it('detects block_id from column name', () => {
    expect(detectColumnType('block_id', ['abc123'])).toBe('block_id');
    expect(detectColumnType('blockId', ['abc123'])).toBe('block_id');
    expect(detectColumnType('parent_id', ['abc123'])).toBe('block_id');
    expect(detectColumnType('context_block_id', ['abc123'])).toBe('block_id');
  });

  it('detects number type', () => {
    expect(detectColumnType('count', [1, 2, 3])).toBe('number');
    expect(detectColumnType('value', [100, 200, 300])).toBe('number');
  });

  it('detects date type from timestamps with date-related names', () => {
    expect(detectColumnType('created_at', [1704067200000])).toBe('date');
    expect(detectColumnType('updated_at', [1704067200000])).toBe('date');
    expect(detectColumnType('timestamp', [1704067200000])).toBe('date');
  });

  it('detects date type from ISO strings', () => {
    expect(detectColumnType('date', ['2024-01-01'])).toBe('date');
    expect(detectColumnType('datetime', ['2024-01-01T00:00:00Z'])).toBe('date');
  });

  it('defaults to string for unknown types', () => {
    expect(detectColumnType('name', ['hello', 'world'])).toBe('string');
    expect(detectColumnType('description', ['text'])).toBe('string');
  });

  it('handles empty values', () => {
    expect(detectColumnType('empty', [])).toBe('string');
    expect(detectColumnType('nulls', [null, null])).toBe('string');
  });
});

// ============================================================================
// formatValue Tests
// ============================================================================

describe('formatValue', () => {
  it('formats null/undefined as dash', () => {
    expect(formatValue(null, 'string')).toBe('-');
    expect(formatValue(undefined, 'string')).toBe('-');
  });

  it('formats numbers with locale formatting', () => {
    expect(formatValue(1000, 'number')).toBe('1,000');
    expect(formatValue(1234567, 'number')).toBe('1,234,567');
  });

  it('formats dates from timestamps', () => {
    const result = formatValue(1704067200000, 'date');
    // Should be a formatted date string (locale-specific)
    expect(result).toMatch(/\d/);
    expect(result).not.toBe('1704067200000');
  });

  it('formats dates from ISO strings', () => {
    const result = formatValue('2024-01-01', 'date');
    expect(result).toMatch(/\d/);
  });

  it('truncates long IDs for page_id', () => {
    const longId = '01HXYZ1234567890ABCDEFGHIJ';
    expect(formatValue(longId, 'page_id')).toBe('01HXYZ12...');
  });

  it('truncates long IDs for block_id', () => {
    const longId = '01HXYZ1234567890ABCDEFGHIJ';
    expect(formatValue(longId, 'block_id')).toBe('01HXYZ12...');
  });

  it('formats strings as-is', () => {
    expect(formatValue('Hello World', 'string')).toBe('Hello World');
  });
});

// ============================================================================
// QueryResultTable Rendering Tests
// ============================================================================

describe('QueryResultTable', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders headers correctly', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      expect(screen.getByTestId('result-header-page_id')).toBeDefined();
      expect(screen.getByTestId('result-header-title')).toBeDefined();
      expect(screen.getByTestId('result-header-created_at')).toBeDefined();
      expect(screen.getByTestId('result-header-view_count')).toBeDefined();
    });

    it('renders all rows', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      expect(screen.getByTestId('result-row-0')).toBeDefined();
      expect(screen.getByTestId('result-row-1')).toBeDefined();
      expect(screen.getByTestId('result-row-2')).toBeDefined();
    });

    it('renders cell values correctly', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      // Title should be displayed as-is
      expect(screen.getByText('First Page')).toBeDefined();
      expect(screen.getByText('Second Page')).toBeDefined();
      expect(screen.getByText('Third Page')).toBeDefined();

      // View count should be formatted
      expect(screen.getByText('100')).toBeDefined();
      expect(screen.getByText('50')).toBeDefined();
      expect(screen.getByText('200')).toBeDefined();
    });

    it('applies custom className', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} className="custom-table" />);

      const table = screen.getByTestId('query-result-table');
      expect(table.className).toContain('custom-table');
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================

  describe('Empty State', () => {
    it('renders empty state when data is empty', () => {
      render(<QueryResultTable data={[]} headers={mockHeaders} />);

      expect(screen.getByTestId('query-result-table-empty')).toBeDefined();
      expect(screen.getByText('No results')).toBeDefined();
    });

    it('does not render table elements in empty state', () => {
      render(<QueryResultTable data={[]} headers={mockHeaders} />);

      expect(screen.queryByTestId('result-header-row')).toBeNull();
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('renders loading state when isLoading is true', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} isLoading={true} />);

      expect(screen.getByTestId('query-result-table-loading')).toBeDefined();
      expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('has correct ARIA role for loading state', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} isLoading={true} />);

      const loadingElement = screen.getByRole('status');
      expect(loadingElement.getAttribute('aria-label')).toBe('Loading query results');
    });

    it('does not render data in loading state', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} isLoading={true} />);

      expect(screen.queryByTestId('result-row-0')).toBeNull();
    });
  });

  // ============================================================================
  // Sorting Functionality
  // ============================================================================

  describe('Sorting Functionality', () => {
    it('sorts ascending on first header click', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      // Click on view_count header
      fireEvent.click(screen.getByTestId('result-header-view_count'));

      // First row should now have the smallest view_count (50)
      const firstRowCell = screen.getByTestId('result-cell-0-view_count');
      expect(firstRowCell.textContent).toBe('50');
    });

    it('sorts descending on second header click', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');

      // First click - ascending
      fireEvent.click(header);
      // Second click - descending
      fireEvent.click(header);

      // First row should now have the largest view_count (200)
      const firstRowCell = screen.getByTestId('result-cell-0-view_count');
      expect(firstRowCell.textContent).toBe('200');
    });

    it('clears sort on third header click', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');

      // Three clicks to reset
      fireEvent.click(header);
      fireEvent.click(header);
      fireEvent.click(header);

      // Should be back to original order (100 first)
      const firstRowCell = screen.getByTestId('result-cell-0-view_count');
      expect(firstRowCell.textContent).toBe('100');
    });

    it('switches column when clicking different header', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      // Click view_count first
      fireEvent.click(screen.getByTestId('result-header-view_count'));
      // Then click title
      fireEvent.click(screen.getByTestId('result-header-title'));

      // Should sort by title ascending (First, Second, Third)
      const firstRowTitleCell = screen.getByTestId('result-cell-0-title');
      expect(firstRowTitleCell.textContent).toBe('First Page');
    });

    it('sorts strings alphabetically', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      fireEvent.click(screen.getByTestId('result-header-title'));

      const cells = ['0', '1', '2'].map(
        (i) => screen.getByTestId(`result-cell-${i}-title`).textContent
      );

      expect(cells).toEqual(['First Page', 'Second Page', 'Third Page']);
    });

    it('handles keyboard activation for sorting', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');

      // Press Enter to sort
      fireEvent.keyDown(header, { key: 'Enter' });

      const firstRowCell = screen.getByTestId('result-cell-0-view_count');
      expect(firstRowCell.textContent).toBe('50');
    });

    it('handles space key for sorting', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');

      fireEvent.keyDown(header, { key: ' ' });

      const firstRowCell = screen.getByTestId('result-cell-0-view_count');
      expect(firstRowCell.textContent).toBe('50');
    });
  });

  // ============================================================================
  // Type Detection
  // ============================================================================

  describe('Type Detection', () => {
    it('detects and marks page_id cells', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const cell = screen.getByTestId('result-cell-0-page_id');
      expect(cell.getAttribute('data-column-type')).toBe('page_id');
    });

    it('detects number columns', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const cell = screen.getByTestId('result-cell-0-view_count');
      expect(cell.getAttribute('data-column-type')).toBe('number');
    });

    it('detects date columns from timestamp names', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const cell = screen.getByTestId('result-cell-0-created_at');
      expect(cell.getAttribute('data-column-type')).toBe('date');
    });
  });

  // ============================================================================
  // Navigation Callbacks
  // ============================================================================

  describe('Navigation Callbacks', () => {
    it('calls onNavigate with page type when clicking page_id cell', () => {
      const onNavigate = vi.fn();

      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByTestId('result-cell-0-page_id'));

      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        id: '01HXYZ1234567890ABCDEFGHIJ',
      });
    });

    it('calls onNavigate with block type when clicking block_id cell', () => {
      const onNavigate = vi.fn();
      const dataWithBlockId = [
        {
          block_id: '01HXYZ1234567890BLOCKID01',
          content: 'Block content',
        },
      ];

      render(
        <QueryResultTable
          data={dataWithBlockId}
          headers={['block_id', 'content']}
          onNavigate={onNavigate}
        />
      );

      fireEvent.click(screen.getByTestId('result-cell-0-block_id'));

      expect(onNavigate).toHaveBeenCalledWith({
        type: 'block',
        id: '01HXYZ1234567890BLOCKID01',
      });
    });

    it('does not call onNavigate when clicking non-ID cells', () => {
      const onNavigate = vi.fn();

      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByTestId('result-cell-0-title'));

      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation for ID cells', () => {
      const onNavigate = vi.fn();

      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={onNavigate} />);

      const cell = screen.getByTestId('result-cell-0-page_id');
      fireEvent.keyDown(cell, { key: 'Enter' });

      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        id: '01HXYZ1234567890ABCDEFGHIJ',
      });
    });

    it('handles space key for navigation', () => {
      const onNavigate = vi.fn();

      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={onNavigate} />);

      const cell = screen.getByTestId('result-cell-0-page_id');
      fireEvent.keyDown(cell, { key: ' ' });

      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        id: '01HXYZ1234567890ABCDEFGHIJ',
      });
    });

    it('does not call onNavigate for null ID values', () => {
      const onNavigate = vi.fn();
      const dataWithNull = [{ page_id: null, title: 'Test' }];

      render(
        <QueryResultTable
          data={dataWithNull}
          headers={['page_id', 'title']}
          onNavigate={onNavigate}
        />
      );

      fireEvent.click(screen.getByTestId('result-cell-0-page_id'));

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has correct table role', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      expect(screen.getByRole('table')).toBeDefined();
    });

    it('has correct row roles', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      // Header row + 3 data rows
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(4);
    });

    it('has correct columnheader roles', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(4);
    });

    it('has aria-sort attribute on headers', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');
      expect(header.getAttribute('aria-sort')).toBe('none');
    });

    it('updates aria-sort to ascending when sorted', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');
      fireEvent.click(header);

      expect(header.getAttribute('aria-sort')).toBe('ascending');
    });

    it('updates aria-sort to descending on second click', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-view_count');
      fireEvent.click(header);
      fireEvent.click(header);

      expect(header.getAttribute('aria-sort')).toBe('descending');
    });

    it('headers are focusable', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const header = screen.getByTestId('result-header-title');
      expect(header.getAttribute('tabindex')).toBe('0');
    });

    it('navigable cells are focusable', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={() => {}} />);

      const cell = screen.getByTestId('result-cell-0-page_id');
      expect(cell.getAttribute('tabindex')).toBe('0');
    });

    it('non-navigable cells are not focusable', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} onNavigate={() => {}} />);

      const cell = screen.getByTestId('result-cell-0-title');
      expect(cell.getAttribute('tabindex')).toBeNull();
    });

    it('has aria-label on the table', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const table = screen.getByRole('table');
      expect(table.getAttribute('aria-label')).toBe('Query results');
    });

    it('has aria-rowcount attribute', () => {
      render(<QueryResultTable data={mockData} headers={mockHeaders} />);

      const table = screen.getByRole('table');
      expect(table.getAttribute('aria-rowcount')).toBe('4'); // 3 data rows + 1 header
    });
  });

  // ============================================================================
  // Virtualization
  // ============================================================================

  describe('Virtualization', () => {
    it('uses standard table for small datasets', () => {
      render(
        <QueryResultTable data={mockData} headers={mockHeaders} virtualizationThreshold={50} />
      );

      // Should use regular table element
      expect(screen.getByRole('table').tagName).toBe('TABLE');
    });

    it('uses virtualized rendering for large datasets', () => {
      // Generate 100 rows
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        page_id: `01HXYZ${String(i).padStart(20, '0')}`,
        title: `Page ${i}`,
        view_count: i * 10,
      }));

      render(
        <QueryResultTable
          data={largeData}
          headers={['page_id', 'title', 'view_count']}
          virtualizationThreshold={50}
        />
      );

      // Should have virtualized class
      const table = screen.getByTestId('query-result-table');
      expect(table.className).toContain('virtualized');
    });

    it('respects custom virtualization threshold', () => {
      render(
        <QueryResultTable data={mockData} headers={mockHeaders} virtualizationThreshold={2} />
      );

      // 3 rows > threshold of 2, should virtualize
      const table = screen.getByTestId('query-result-table');
      expect(table.className).toContain('virtualized');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles null values in data', () => {
      const dataWithNulls = [{ page_id: null, title: null, count: null }];

      render(<QueryResultTable data={dataWithNulls} headers={['page_id', 'title', 'count']} />);

      // Should render dashes for null values
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('handles undefined values in data', () => {
      const dataWithUndefined = [{ page_id: undefined, title: 'Test' }];

      render(<QueryResultTable data={dataWithUndefined} headers={['page_id', 'title']} />);

      const cell = screen.getByTestId('result-cell-0-page_id');
      expect(cell.textContent).toBe('-');
    });

    it('handles empty strings', () => {
      const dataWithEmpty = [{ title: '' }];

      render(<QueryResultTable data={dataWithEmpty} headers={['title']} />);

      const cell = screen.getByTestId('result-cell-0-title');
      expect(cell.textContent).toBe('');
    });

    it('handles very long strings', () => {
      const longString = 'A'.repeat(1000);
      const dataWithLong = [{ content: longString }];

      render(<QueryResultTable data={dataWithLong} headers={['content']} />);

      // Should render (text-overflow: ellipsis handles display)
      const cell = screen.getByTestId('result-cell-0-content');
      expect(cell.textContent).toBe(longString);
    });

    it('handles special characters in values', () => {
      const dataWithSpecial = [{ title: '<script>alert("xss")</script>' }];

      render(<QueryResultTable data={dataWithSpecial} headers={['title']} />);

      // React handles escaping automatically
      expect(screen.getByText('<script>alert("xss")</script>')).toBeDefined();
    });

    it('handles headers with special characters', () => {
      const dataWithSpecialHeaders = [{ 'column-with-dash': 'value' }];

      render(<QueryResultTable data={dataWithSpecialHeaders} headers={['column-with-dash']} />);

      expect(screen.getByTestId('result-header-column-with-dash')).toBeDefined();
    });

    it('handles single row data', () => {
      const singleRow = [{ title: 'Only Row' }];

      render(<QueryResultTable data={singleRow} headers={['title']} />);

      expect(screen.getByTestId('result-row-0')).toBeDefined();
      expect(screen.queryByTestId('result-row-1')).toBeNull();
    });

    it('handles single column data', () => {
      const singleColumn = [{ title: 'Row 1' }, { title: 'Row 2' }];

      render(<QueryResultTable data={singleColumn} headers={['title']} />);

      expect(screen.getByTestId('result-header-title')).toBeDefined();
      expect(screen.getByTestId('result-cell-0-title')).toBeDefined();
      expect(screen.getByTestId('result-cell-1-title')).toBeDefined();
    });
  });
});
