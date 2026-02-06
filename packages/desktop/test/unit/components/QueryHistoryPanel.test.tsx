/**
 * Tests for QueryHistoryPanel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  QueryHistoryPanel,
  QueryHistoryItem,
  QUERY_HISTORY_CSS_CLASSES,
} from '../../../src/components/QueryHistoryPanel.js';
import {
  useQueryHistoryStore,
  type QueryHistoryEntry,
} from '../../../src/stores/query-history-store.js';

// ============================================================================
// Mock Data
// ============================================================================

const createMockEntry = (
  id: string,
  script: string,
  durationMs: number,
  rowCount: number,
  minutesAgo = 0
): QueryHistoryEntry => ({
  id,
  script,
  executedAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
  durationMs,
  result: { success: true, rowCount },
});

const createMockErrorEntry = (
  id: string,
  script: string,
  error: string,
  minutesAgo = 0
): QueryHistoryEntry => ({
  id,
  script,
  executedAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
  durationMs: 5,
  result: { success: false, error },
});

// ============================================================================
// Tests
// ============================================================================

describe('QueryHistoryPanel', () => {
  const mockOnSelectQuery = vi.fn();

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset store to initial state
    useQueryHistoryStore.setState({ entries: [] });

    // Clear mock calls
    mockOnSelectQuery.mockClear();
  });

  // ============================================================================
  // Empty State
  // ============================================================================

  describe('Empty State', () => {
    it('renders empty message when no queries', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByTestId('query-history-panel-empty')).toBeDefined();
      expect(screen.getByTestId('query-history-empty-message').textContent).toContain(
        'No queries executed yet'
      );
    });

    it('renders header in empty state', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('Query History')).toBeDefined();
    });

    it('does not render clear button in empty state', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.queryByTestId('query-history-clear-button')).toBeNull();
    });
  });

  // ============================================================================
  // With Entries
  // ============================================================================

  describe('With Entries', () => {
    beforeEach(() => {
      useQueryHistoryStore.setState({
        entries: [
          createMockEntry('qh-1', '?[x] <- [[1]]', 50, 1, 0),
          createMockEntry('qh-2', '?[y] <- [[2], [3]]', 100, 2, 5),
          createMockErrorEntry('qh-3', 'invalid', 'Syntax error', 10),
        ],
      });
    });

    it('renders the list of entries', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByTestId('query-history-panel')).toBeDefined();
      expect(screen.getByTestId('query-history-list')).toBeDefined();
      expect(screen.getByTestId('query-history-item-qh-1')).toBeDefined();
      expect(screen.getByTestId('query-history-item-qh-2')).toBeDefined();
      expect(screen.getByTestId('query-history-item-qh-3')).toBeDefined();
    });

    it('shows entry count in header', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('Query History (3)')).toBeDefined();
    });

    it('renders clear button when entries exist', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByTestId('query-history-clear-button')).toBeDefined();
    });

    it('displays script preview for each entry', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('?[x] <- [[1]]')).toBeDefined();
      expect(screen.getByText('?[y] <- [[2], [3]]')).toBeDefined();
      expect(screen.getByText('invalid')).toBeDefined();
    });

    it('displays duration for each entry', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('50ms')).toBeDefined();
      expect(screen.getByText('100ms')).toBeDefined();
    });

    it('displays row count for successful entries', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('1 row')).toBeDefined();
      expect(screen.getByText('2 rows')).toBeDefined();
    });

    it('displays error message for failed entries', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('Syntax error')).toBeDefined();
    });

    it('displays relative timestamps', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('just now')).toBeDefined();
      expect(screen.getByText('5m ago')).toBeDefined();
      expect(screen.getByText('10m ago')).toBeDefined();
    });
  });

  // ============================================================================
  // Interactions
  // ============================================================================

  describe('Interactions', () => {
    beforeEach(() => {
      useQueryHistoryStore.setState({
        entries: [
          createMockEntry('qh-1', '?[x] <- [[1]]', 50, 1),
          createMockEntry('qh-2', '?[y] <- [[2]]', 100, 2),
        ],
      });
    });

    it('calls onSelectQuery when entry is clicked', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      fireEvent.click(screen.getByTestId('query-history-item-qh-1'));

      expect(mockOnSelectQuery).toHaveBeenCalledWith('?[x] <- [[1]]');
    });

    it('calls onSelectQuery when Enter is pressed on entry', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const item = screen.getByTestId('query-history-item-qh-2');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(mockOnSelectQuery).toHaveBeenCalledWith('?[y] <- [[2]]');
    });

    it('calls onSelectQuery when Space is pressed on entry', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const item = screen.getByTestId('query-history-item-qh-1');
      fireEvent.keyDown(item, { key: ' ' });

      expect(mockOnSelectQuery).toHaveBeenCalledWith('?[x] <- [[1]]');
    });

    it('clears all history when clear button is clicked', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByTestId('query-history-list')).toBeDefined();

      fireEvent.click(screen.getByTestId('query-history-clear-button'));

      expect(useQueryHistoryStore.getState().entries).toEqual([]);
      expect(screen.getByTestId('query-history-panel-empty')).toBeDefined();
    });

    it('removes individual entry when remove button is clicked', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      // Find the remove button within the first entry
      const firstItem = screen.getByTestId('query-history-item-qh-1');
      const removeButton = within(firstItem).getByRole('button', { name: 'Remove from history' });

      fireEvent.click(removeButton);

      expect(useQueryHistoryStore.getState().entries).toHaveLength(1);
      expect(screen.queryByTestId('query-history-item-qh-1')).toBeNull();
      expect(screen.getByTestId('query-history-item-qh-2')).toBeDefined();
    });

    it('remove button click does not trigger onSelectQuery', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const firstItem = screen.getByTestId('query-history-item-qh-1');
      const removeButton = within(firstItem).getByRole('button', { name: 'Remove from history' });

      fireEvent.click(removeButton);

      expect(mockOnSelectQuery).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Script Truncation
  // ============================================================================

  describe('Script Truncation', () => {
    it('truncates long scripts with ellipsis', () => {
      const longScript = 'a'.repeat(150);
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-long', longScript, 50, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      // Default maxPreviewLength is 100
      const preview = screen.getByText('a'.repeat(97) + '...');
      expect(preview).toBeDefined();
    });

    it('uses custom maxPreviewLength', () => {
      const longScript = 'b'.repeat(100);
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-long', longScript, 50, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} maxPreviewLength={50} />);

      const preview = screen.getByText('b'.repeat(47) + '...');
      expect(preview).toBeDefined();
    });

    it('does not truncate short scripts', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-short', '?[x] <- [[1]]', 50, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('?[x] <- [[1]]')).toBeDefined();
    });

    it('normalizes whitespace in preview', () => {
      const multilineScript = '?[x] <- \n  [[1],\n   [2]]';
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-multi', multilineScript, 50, 2)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      // Whitespace should be normalized to single spaces
      expect(screen.getByText('?[x] <- [[1], [2]]')).toBeDefined();
    });
  });

  // ============================================================================
  // Duration Formatting
  // ============================================================================

  describe('Duration Formatting', () => {
    it('formats sub-millisecond duration', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-fast', 'fast', 0.5, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('<1ms')).toBeDefined();
    });

    it('formats milliseconds', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-ms', 'ms', 500, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('500ms')).toBeDefined();
    });

    it('formats seconds', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-sec', 'sec', 2500, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('2.50s')).toBeDefined();
    });

    it('formats minutes and seconds', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-min', 'min', 125000, 1)], // 2m 5s
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('2m 5s')).toBeDefined();
    });
  });

  // ============================================================================
  // Relative Time Formatting
  // ============================================================================

  describe('Relative Time Formatting', () => {
    it('shows "just now" for very recent queries', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-now', 'now', 50, 1, 0)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('just now')).toBeDefined();
    });

    it('shows hours ago', () => {
      useQueryHistoryStore.setState({
        entries: [
          {
            ...createMockEntry('qh-hours', 'hours', 50, 1),
            executedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          },
        ],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('2h ago')).toBeDefined();
    });

    it('shows days ago', () => {
      useQueryHistoryStore.setState({
        entries: [
          {
            ...createMockEntry('qh-days', 'days', 50, 1),
            executedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          },
        ],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      expect(screen.getByText('3d ago')).toBeDefined();
    });
  });

  // ============================================================================
  // Custom className
  // ============================================================================

  describe('Custom className', () => {
    it('applies custom className to empty panel', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} className="custom-class" />);

      const panel = screen.getByTestId('query-history-panel-empty');
      expect(panel.className).toContain('custom-class');
    });

    it('applies custom className to panel with entries', () => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-1', 'test', 50, 1)],
      });

      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} className="custom-class" />);

      const panel = screen.getByTestId('query-history-panel');
      expect(panel.className).toContain('custom-class');
    });
  });

  // ============================================================================
  // CSS Classes
  // ============================================================================

  describe('CSS Classes', () => {
    it('exports CSS class constants', () => {
      expect(QUERY_HISTORY_CSS_CLASSES.panel).toBe('query-history-panel');
      expect(QUERY_HISTORY_CSS_CLASSES.panelEmpty).toBe('query-history-panel--empty');
      expect(QUERY_HISTORY_CSS_CLASSES.header).toBe('query-history-panel__header');
      expect(QUERY_HISTORY_CSS_CLASSES.list).toBe('query-history-panel__list');
      expect(QUERY_HISTORY_CSS_CLASSES.item).toBe('query-history-panel__item');
      expect(QUERY_HISTORY_CSS_CLASSES.itemSuccess).toBe('query-history-panel__item--success');
      expect(QUERY_HISTORY_CSS_CLASSES.itemError).toBe('query-history-panel__item--error');
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    beforeEach(() => {
      useQueryHistoryStore.setState({
        entries: [createMockEntry('qh-1', 'test', 50, 1)],
      });
    });

    it('uses listbox role for the list', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const list = screen.getByRole('listbox');
      expect(list.getAttribute('aria-label')).toBe('Query history');
    });

    it('uses option role for list items', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const item = screen.getByRole('option');
      expect(item).toBeDefined();
    });

    it('items are focusable', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const item = screen.getByTestId('query-history-item-qh-1');
      expect(item.getAttribute('tabIndex')).toBe('0');
    });

    it('remove button has aria-label', () => {
      render(<QueryHistoryPanel onSelectQuery={mockOnSelectQuery} />);

      const removeButton = screen.getByRole('button', { name: 'Remove from history' });
      expect(removeButton).toBeDefined();
    });
  });
});

// ============================================================================
// QueryHistoryItem Tests
// ============================================================================

describe('QueryHistoryItem', () => {
  const mockOnSelect = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnRemove.mockClear();
  });

  it('renders success entry with correct styling', () => {
    const entry = createMockEntry('qh-1', 'test', 50, 5);

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={100}
      />
    );

    const item = screen.getByRole('option');
    expect(item.className).toContain(QUERY_HISTORY_CSS_CLASSES.itemSuccess);
  });

  it('renders error entry with correct styling', () => {
    const entry = createMockErrorEntry('qh-1', 'bad', 'Error occurred');

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={100}
      />
    );

    const item = screen.getByRole('option');
    expect(item.className).toContain(QUERY_HISTORY_CSS_CLASSES.itemError);
  });

  it('shows full script in title attribute for truncated scripts', () => {
    const longScript = 'x'.repeat(200);
    const entry = createMockEntry('qh-1', longScript, 50, 1);

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={50}
      />
    );

    const scriptElement = screen.getByTitle(longScript);
    expect(scriptElement).toBeDefined();
  });

  it('handles singular "row" text correctly', () => {
    const entry = createMockEntry('qh-1', 'test', 50, 1);

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={100}
      />
    );

    expect(screen.getByText('1 row')).toBeDefined();
  });

  it('handles plural "rows" text correctly', () => {
    const entry = createMockEntry('qh-1', 'test', 50, 5);

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={100}
      />
    );

    expect(screen.getByText('5 rows')).toBeDefined();
  });

  it('handles zero rows correctly', () => {
    const entry = createMockEntry('qh-1', 'test', 50, 0);

    render(
      <QueryHistoryItem
        entry={entry}
        onSelect={mockOnSelect}
        onRemove={mockOnRemove}
        maxPreviewLength={100}
      />
    );

    expect(screen.getByText('0 rows')).toBeDefined();
  });
});
