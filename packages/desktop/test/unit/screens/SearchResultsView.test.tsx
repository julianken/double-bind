/**
 * Tests for SearchResultsView screen component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SearchResultsView, HighlightedText } from '../../../src/screens/SearchResultsView.js';
import { useSearch } from '../../../src/hooks/useSearch.js';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/hooks/useSearch.js', () => ({
  useSearch: vi.fn(),
}));

// Mock Zustand store
const mockNavigateToPage = vi.fn();
const mockSetFocusedBlock = vi.fn();

vi.mock('../../../src/stores/ui-store.js', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      navigateToPage: mockNavigateToPage,
      setFocusedBlock: mockSetFocusedBlock,
    };
    return selector(state);
  }),
}));

// ============================================================================
// Mock Data
// ============================================================================

const mockPageResults = [
  {
    id: 'page-1',
    type: 'page' as const,
    title: 'Project Meeting Notes',
    pageId: 'page-1',
    score: 0.95,
  },
  {
    id: 'page-2',
    type: 'page' as const,
    title: 'Meeting Agenda Template',
    pageId: 'page-2',
    score: 0.88,
  },
];

const mockBlockResults = [
  {
    id: 'block-1',
    type: 'block' as const,
    title: 'Had a great meeting with the team today',
    pageId: 'page-3',
    score: 0.82,
  },
  {
    id: 'block-2',
    type: 'block' as const,
    title: 'Schedule a meeting to discuss the project roadmap',
    pageId: 'page-4',
    score: 0.75,
  },
];

const mockAllResults = [...mockPageResults, ...mockBlockResults];

// ============================================================================
// Test Utilities
// ============================================================================

function mockUseSearch(overrides = {}) {
  const defaults = {
    query: 'meeting',
    results: mockAllResults,
    isLoading: false,
    error: null,
    hasResults: true,
    setQuery: vi.fn(),
    clearSearch: vi.fn(),
    search: vi.fn(),
  };
  (useSearch as ReturnType<typeof vi.fn>).mockReturnValue({ ...defaults, ...overrides });
}

// ============================================================================
// Tests: HighlightedText Component
// ============================================================================

describe('HighlightedText', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders text without highlighting when query is empty', () => {
    render(<HighlightedText text="Hello World" query="" />);

    expect(screen.getByTestId('highlighted-text').textContent).toBe('Hello World');
    expect(screen.queryByTestId('search-highlight')).toBeNull();
  });

  it('renders text without highlighting when query is whitespace', () => {
    render(<HighlightedText text="Hello World" query="   " />);

    expect(screen.getByTestId('highlighted-text').textContent).toBe('Hello World');
    expect(screen.queryByTestId('search-highlight')).toBeNull();
  });

  it('highlights matching text case-insensitively', () => {
    render(<HighlightedText text="Hello World" query="wor" />);

    const highlights = screen.getAllByTestId('search-highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.textContent).toBe('Wor');
  });

  it('highlights multiple occurrences', () => {
    render(<HighlightedText text="meeting about meeting" query="meeting" />);

    const highlights = screen.getAllByTestId('search-highlight');
    expect(highlights).toHaveLength(2);
    expect(highlights[0]!.textContent).toBe('meeting');
    expect(highlights[1]!.textContent).toBe('meeting');
  });

  it('preserves original case in highlighted text', () => {
    render(<HighlightedText text="MEETING and Meeting" query="meeting" />);

    const highlights = screen.getAllByTestId('search-highlight');
    expect(highlights).toHaveLength(2);
    expect(highlights[0]!.textContent).toBe('MEETING');
    expect(highlights[1]!.textContent).toBe('Meeting');
  });

  it('handles special regex characters in query', () => {
    render(<HighlightedText text="test (with) special [chars]" query="(with)" />);

    const highlights = screen.getAllByTestId('search-highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.textContent).toBe('(with)');
  });

  it('applies custom className', () => {
    render(<HighlightedText text="Hello" query="" className="custom-class" />);

    expect(screen.getByTestId('highlighted-text').className).toContain('custom-class');
  });

  it('uses mark element for highlights', () => {
    render(<HighlightedText text="Hello World" query="World" />);

    const highlight = screen.getByTestId('search-highlight');
    expect(highlight.tagName).toBe('MARK');
  });
});

// ============================================================================
// Tests: SearchResultsView Component
// ============================================================================

describe('SearchResultsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearch();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('shows loading state when searching', () => {
      mockUseSearch({ isLoading: true, results: [] });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-loading')).toBeDefined();
      expect(screen.getByText('Searching...')).toBeDefined();
    });

    it('has correct ARIA attributes for loading state', () => {
      mockUseSearch({ isLoading: true, results: [] });

      render(<SearchResultsView params={{}} />);

      const loadingEl = screen.getByTestId('search-results-loading');
      expect(loadingEl.getAttribute('role')).toBe('status');
      expect(loadingEl.getAttribute('aria-busy')).toBe('true');
    });
  });

  // ==========================================================================
  // Error State
  // ==========================================================================

  describe('Error State', () => {
    it('shows error state when search fails', () => {
      const error = new Error('Network error');
      mockUseSearch({ error, results: [] });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-error')).toBeDefined();
      expect(screen.getByText('Search failed')).toBeDefined();
      expect(screen.getByText('Network error')).toBeDefined();
    });

    it('has correct ARIA role for error state', () => {
      mockUseSearch({ error: new Error('Test error'), results: [] });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  // ==========================================================================
  // Empty State
  // ==========================================================================

  describe('Empty State', () => {
    it('shows empty state when no results', () => {
      mockUseSearch({ results: [], hasResults: false });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-empty')).toBeDefined();
      expect(screen.getByText(/No results for/)).toBeDefined();
    });

    it('displays the query in empty state message', () => {
      mockUseSearch({ query: 'nonexistent', results: [], hasResults: false });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByText(/No results for "nonexistent"/)).toBeDefined();
    });

    it('shows empty state when query is empty', () => {
      mockUseSearch({ query: '', results: [], hasResults: false });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-empty')).toBeDefined();
    });
  });

  // ==========================================================================
  // Results Display
  // ==========================================================================

  describe('Results Display', () => {
    it('renders the results view container', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-view')).toBeDefined();
      expect(screen.getByRole('main')).toBeDefined();
    });

    it('displays the total result count', () => {
      render(<SearchResultsView params={{}} />);

      const countEl = screen.getByTestId('search-results-count');
      expect(countEl.textContent).toBe('4');
    });

    it('displays the search query in header', () => {
      render(<SearchResultsView params={{}} />);

      const queryEl = screen.getByTestId('search-results-query');
      expect(queryEl.textContent).toBe('meeting');
    });

    it('shows singular "result" for single result', () => {
      mockUseSearch({ results: [mockPageResults[0]] });

      render(<SearchResultsView params={{}} />);

      const header = screen.getByTestId('search-results-header');
      expect(header.textContent).toContain('1');
      expect(header.textContent).toContain('result');
      // Should not contain 'results' (plural)
      expect(header.textContent).not.toContain('results');
    });

    it('shows plural "results" for multiple results', () => {
      render(<SearchResultsView params={{}} />);

      const header = screen.getByTestId('search-results-header');
      expect(header.textContent).toContain('4');
      expect(header.textContent).toContain('results');
    });
  });

  // ==========================================================================
  // Results Grouping
  // ==========================================================================

  describe('Results Grouping', () => {
    it('groups page results first', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-group-pages')).toBeDefined();
    });

    it('groups block results second', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-group-blocks')).toBeDefined();
    });

    it('shows group counts', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByText('Pages (2)')).toBeDefined();
      expect(screen.getByText('Blocks (2)')).toBeDefined();
    });

    it('hides empty groups', () => {
      mockUseSearch({ results: mockPageResults });

      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-group-pages')).toBeDefined();
      expect(screen.queryByTestId('search-results-group-blocks')).toBeNull();
    });

    it('renders page results with correct data-testid', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-result-page-1')).toBeDefined();
      expect(screen.getByTestId('search-result-page-2')).toBeDefined();
    });

    it('renders block results with correct data-testid', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-result-block-1')).toBeDefined();
      expect(screen.getByTestId('search-result-block-2')).toBeDefined();
    });

    it('shows result type as data attribute', () => {
      render(<SearchResultsView params={{}} />);

      const pageResult = screen.getByTestId('search-result-page-1');
      const blockResult = screen.getByTestId('search-result-block-1');

      expect(pageResult.getAttribute('data-result-type')).toBe('page');
      expect(blockResult.getAttribute('data-result-type')).toBe('block');
    });
  });

  // ==========================================================================
  // Result Items
  // ==========================================================================

  describe('Result Items', () => {
    it('highlights matching text in page results', () => {
      render(<SearchResultsView params={{}} />);

      // Should have highlights in the page results
      const highlights = screen.getAllByTestId('search-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('highlights matching text in block results', () => {
      render(<SearchResultsView params={{}} />);

      // Block results should have highlighted text
      const blockResult = screen.getByTestId('search-result-block-1');
      expect(blockResult.querySelector('mark')).toBeDefined();
    });

    it('shows parent page context for block results', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-result-parent-block-1')).toBeDefined();
      expect(screen.getByText('in page page-3')).toBeDefined();
    });

    it('does not show parent for page results', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.queryByTestId('search-result-parent-page-1')).toBeNull();
    });
  });

  // ==========================================================================
  // Navigation
  // ==========================================================================

  describe('Navigation', () => {
    it('navigates to page when page result is clicked', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.click(screen.getByTestId('search-result-page-1'));

      expect(mockNavigateToPage).toHaveBeenCalledWith('page/page-1');
    });

    it('navigates to page and sets focused block when block result is clicked', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.click(screen.getByTestId('search-result-block-1'));

      expect(mockNavigateToPage).toHaveBeenCalledWith('page/page-3');
      // For block results, the id is used as the focused block ID
      expect(mockSetFocusedBlock).toHaveBeenCalledWith('block-1');
    });
  });

  // ==========================================================================
  // Keyboard Navigation
  // ==========================================================================

  describe('Keyboard Navigation', () => {
    it('first item is selected by default', () => {
      render(<SearchResultsView params={{}} />);

      const firstItem = screen.getByTestId('search-result-page-1');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowDown moves selection to next item', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.keyDown(window, { key: 'ArrowDown' });

      const firstItem = screen.getByTestId('search-result-page-1');
      const secondItem = screen.getByTestId('search-result-page-2');

      expect(firstItem.getAttribute('aria-selected')).toBe('false');
      expect(secondItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowUp moves selection to previous item', () => {
      render(<SearchResultsView params={{}} />);

      // Move down first
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      // Then move up
      fireEvent.keyDown(window, { key: 'ArrowUp' });

      const firstItem = screen.getByTestId('search-result-page-1');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowUp at first item stays at first item', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.keyDown(window, { key: 'ArrowUp' });

      const firstItem = screen.getByTestId('search-result-page-1');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowDown at last item stays at last item', () => {
      render(<SearchResultsView params={{}} />);

      // Move to last item (4 results, so 3 arrow downs)
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      const lastItem = screen.getByTestId('search-result-block-2');
      expect(lastItem.getAttribute('aria-selected')).toBe('true');
    });

    it('Enter navigates to selected page result', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockNavigateToPage).toHaveBeenCalledWith('page/page-1');
    });

    it('Enter navigates to selected block result', () => {
      render(<SearchResultsView params={{}} />);

      // Move to first block result (after 2 page results)
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockNavigateToPage).toHaveBeenCalledWith('page/page-3');
      expect(mockSetFocusedBlock).toHaveBeenCalledWith('block-1');
    });

    it('Home moves to first item', () => {
      render(<SearchResultsView params={{}} />);

      // Move down first
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      // Press Home
      fireEvent.keyDown(window, { key: 'Home' });

      const firstItem = screen.getByTestId('search-result-page-1');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('End moves to last item', () => {
      render(<SearchResultsView params={{}} />);

      fireEvent.keyDown(window, { key: 'End' });

      const lastItem = screen.getByTestId('search-result-block-2');
      expect(lastItem.getAttribute('aria-selected')).toBe('true');
    });

    it('keyboard navigation crosses group boundaries', () => {
      render(<SearchResultsView params={{}} />);

      // Move through all page results to blocks
      fireEvent.keyDown(window, { key: 'ArrowDown' }); // page-2
      fireEvent.keyDown(window, { key: 'ArrowDown' }); // block-1

      const firstBlockItem = screen.getByTestId('search-result-block-1');
      expect(firstBlockItem.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ==========================================================================
  // Keyboard Hints Footer
  // ==========================================================================

  describe('Keyboard Hints Footer', () => {
    it('shows keyboard navigation hints', () => {
      render(<SearchResultsView params={{}} />);

      expect(screen.getByTestId('search-results-footer')).toBeDefined();
      expect(screen.getByText(/Up\/Down/)).toBeDefined();
      expect(screen.getByText(/Enter/)).toBeDefined();
    });
  });

  // ==========================================================================
  // Selection Reset
  // ==========================================================================

  describe('Selection Reset', () => {
    it('resets selection to first item when results change', async () => {
      const { rerender } = render(<SearchResultsView params={{}} />);

      // Move selection down
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      const secondItem = screen.getByTestId('search-result-page-2');
      expect(secondItem.getAttribute('aria-selected')).toBe('true');

      // Change results
      mockUseSearch({ results: [mockPageResults[0]] });
      rerender(<SearchResultsView params={{}} />);

      // Selection should reset to first item
      const firstItem = screen.getByTestId('search-result-page-1');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });
  });
});
