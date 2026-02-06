/**
 * SearchResultsView - Displays search results with highlighted matches
 *
 * Features:
 * - Results grouped by type (pages first, then blocks)
 * - Highlighted matching text using HighlightedText component
 * - Click to navigate to page/block
 * - Result count display
 * - Empty state when no results
 * - Keyboard navigation (arrow keys + Enter)
 *
 * @see docs/frontend/search.md for search architecture
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSearch, type SearchResult } from '../hooks/useSearch.js';
import { useAppStore } from '../stores/ui-store.js';
import type { RouteComponentProps } from '../components/Router.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for SearchResultsView (implements RouteComponentProps for Router compatibility)
 */
export type SearchResultsViewProps = RouteComponentProps;

/**
 * Props for the HighlightedText component
 */
export interface HighlightedTextProps {
  /** The text to display */
  text: string;
  /** The search query to highlight */
  query: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for individual search result items
 */
interface SearchResultItemProps {
  /** The search result to render */
  result: SearchResult;
  /** The search query for highlighting */
  query: string;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Callback when item is clicked */
  onClick: () => void;
  /** Reference to the DOM element for scrolling */
  itemRef?: React.RefObject<HTMLButtonElement | null>;
}

// ============================================================================
// HighlightedText Component
// ============================================================================

/**
 * Renders text with search query matches highlighted.
 *
 * Uses case-insensitive matching and wraps matches in <mark> elements.
 * Handles edge cases like empty queries and special regex characters.
 *
 * @example
 * ```tsx
 * <HighlightedText text="Hello World" query="wor" />
 * // Renders: Hello <mark>Wor</mark>ld
 * ```
 */
export function HighlightedText({
  text,
  query,
  className = '',
}: HighlightedTextProps): React.ReactElement {
  // If no query, return plain text
  if (!query.trim()) {
    return (
      <span className={`highlighted-text ${className}`.trim()} data-testid="highlighted-text">
        {text}
      </span>
    );
  }

  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Split text by the query (case-insensitive)
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={`highlighted-text ${className}`.trim()} data-testid="highlighted-text">
      {parts.map((part, index) => {
        // Check if this part matches the query (case-insensitive)
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <mark key={index} className="search-highlight" data-testid="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
}

// ============================================================================
// Icons
// ============================================================================

/**
 * Page icon for page results
 */
function PageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="search-result-icon"
    >
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M5 5h6M5 8h6M5 11h4" />
    </svg>
  );
}

/**
 * Block icon for block results
 */
function BlockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="search-result-icon"
    >
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
      <path d="M7 8h6" />
    </svg>
  );
}

// ============================================================================
// SearchResultItem Component
// ============================================================================

/**
 * Renders a single search result item.
 *
 * For page results: shows page title with highlight
 * For block results: shows block content snippet with highlight and parent page title
 */
function SearchResultItem({
  result,
  query,
  isSelected,
  onClick,
  itemRef,
}: SearchResultItemProps): React.ReactElement {
  const isPage = result.type === 'page';

  return (
    <button
      ref={itemRef}
      type="button"
      className={`search-result-item search-result-item--${result.type}${isSelected ? ' search-result-item--selected' : ''}`}
      onClick={onClick}
      data-testid={`search-result-${result.id}`}
      data-result-type={result.type}
      aria-selected={isSelected}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderRadius: '6px',
        backgroundColor: isSelected ? '#e0e7ff' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: '14px',
        color: '#111827',
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Icon */}
      <span
        style={{
          flexShrink: 0,
          marginTop: '2px',
          color: isPage ? '#4f46e5' : '#6b7280',
        }}
      >
        {isPage ? <PageIcon /> : <BlockIcon />}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Primary content - title for all results */}
        <div
          className="search-result-primary"
          style={{
            fontWeight: isPage ? 500 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <HighlightedText text={result.title} query={query} />
        </div>

        {/* Secondary content - page context for blocks (extracted from title) */}
        {!isPage && (
          <div
            className="search-result-secondary"
            data-testid={`search-result-parent-${result.id}`}
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: '#6b7280',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            in page {result.pageId}
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div
      className="search-results-view search-results-view--loading"
      data-testid="search-results-loading"
      role="status"
      aria-busy="true"
      aria-label="Searching"
    >
      <div className="search-results-loading-indicator">Searching...</div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  query: string;
}

function EmptyState({ query }: EmptyStateProps) {
  return (
    <div
      className="search-results-view search-results-view--empty"
      data-testid="search-results-empty"
      role="status"
      aria-label="No results found"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        color: '#6b7280',
        textAlign: 'center',
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ opacity: 0.5, marginBottom: '16px' }}
      >
        <circle cx="20" cy="20" r="14" />
        <path d="M30 30L42 42" />
      </svg>
      <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
        No results for &quot;{query}&quot;
      </p>
      <p style={{ fontSize: '14px' }}>Try a different search term</p>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: Error;
}

function ErrorState({ error }: ErrorStateProps) {
  return (
    <div
      className="search-results-view search-results-view--error"
      data-testid="search-results-error"
      role="alert"
      aria-label="Search error"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        color: '#dc2626',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Search failed</p>
      <p style={{ fontSize: '14px' }}>{error.message}</p>
    </div>
  );
}

// ============================================================================
// ResultsGroup Component
// ============================================================================

interface ResultsGroupProps {
  title: string;
  results: SearchResult[];
  query: string;
  selectedIndex: number;
  globalStartIndex: number;
  onItemClick: (result: SearchResult) => void;
  selectedItemRef: React.RefObject<HTMLButtonElement | null>;
}

function ResultsGroup({
  title,
  results,
  query,
  selectedIndex,
  globalStartIndex,
  onItemClick,
  selectedItemRef,
}: ResultsGroupProps) {
  if (results.length === 0) return null;

  return (
    <div
      className="search-results-group"
      data-testid={`search-results-group-${title.toLowerCase()}`}
    >
      <h3
        className="search-results-group-title"
        style={{
          padding: '8px 16px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#6b7280',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {title} ({results.length})
      </h3>
      <ul
        role="listbox"
        className="search-results-list"
        style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}
      >
        {results.map((result, index) => {
          const globalIndex = globalStartIndex + index;
          const isSelected = globalIndex === selectedIndex;
          return (
            <li key={result.id} role="option" aria-selected={isSelected}>
              <SearchResultItem
                result={result}
                query={query}
                isSelected={isSelected}
                onClick={() => onItemClick(result)}
                itemRef={isSelected ? selectedItemRef : undefined}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SearchResultsView - Full search results display screen
 *
 * Features:
 * - Groups results by type (pages shown first, then blocks)
 * - Highlights matching text in results
 * - Supports keyboard navigation (arrow keys to move, Enter to select)
 * - Clicking a result navigates to the page (and block if applicable)
 * - Shows result count and empty state
 */
export function SearchResultsView(_props: SearchResultsViewProps): React.ReactElement {
  const navigateToPage = useAppStore((state) => state.navigateToPage);
  const setFocusedBlock = useAppStore((state) => state.setFocusedBlock);

  // Get search state from hook
  const { query, results, isLoading, error } = useSearch();

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group results by type: pages first, then blocks
  const { pageResults, blockResults, totalCount } = useMemo(() => {
    const pages = results.filter((r) => r.type === 'page');
    const blocks = results.filter((r) => r.type === 'block');
    return {
      pageResults: pages,
      blockResults: blocks,
      totalCount: results.length,
    };
  }, [results]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => [...pageResults, ...blockResults], [pageResults, blockResults]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && typeof selectedItemRef.current.scrollIntoView === 'function') {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Navigate to a search result
  const handleNavigate = useCallback(
    (result: SearchResult) => {
      if (result.type === 'page') {
        // Navigate to the page
        navigateToPage(`page/${result.pageId}`);
      } else {
        // Navigate to the page and set focused block
        // For block results, the id is the block ID
        navigateToPage(`page/${result.pageId}`);
        setFocusedBlock(result.id);
      }
    },
    [navigateToPage, setFocusedBlock]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (result: SearchResult) => {
      handleNavigate(result);
    },
    [handleNavigate]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we have results
      if (flatResults.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter': {
          event.preventDefault();
          const selected = flatResults[selectedIndex];
          if (selected) {
            handleNavigate(selected);
          }
          break;
        }
        case 'Home':
          event.preventDefault();
          setSelectedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setSelectedIndex(flatResults.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatResults, selectedIndex, handleNavigate]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // Empty state (no query or no results)
  if (!query.trim() || totalCount === 0) {
    return <EmptyState query={query} />;
  }

  // Results view
  return (
    <div
      ref={containerRef}
      className="search-results-view"
      data-testid="search-results-view"
      role="main"
      aria-label="Search results"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header with result count */}
      <header
        className="search-results-header"
        data-testid="search-results-header"
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          <span data-testid="search-results-count">{totalCount}</span>
          {totalCount === 1 ? ' result' : ' results'} for &quot;
          <span data-testid="search-results-query">{query}</span>&quot;
        </h2>
      </header>

      {/* Results list */}
      <div
        className="search-results-content"
        data-testid="search-results-content"
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {/* Page results (shown first) */}
        <ResultsGroup
          title="Pages"
          results={pageResults}
          query={query}
          selectedIndex={selectedIndex}
          globalStartIndex={0}
          onItemClick={handleItemClick}
          selectedItemRef={selectedItemRef}
        />

        {/* Block results (shown second) */}
        <ResultsGroup
          title="Blocks"
          results={blockResults}
          query={query}
          selectedIndex={selectedIndex}
          globalStartIndex={pageResults.length}
          onItemClick={handleItemClick}
          selectedItemRef={selectedItemRef}
        />
      </div>

      {/* Footer with keyboard hints */}
      <footer
        className="search-results-footer"
        data-testid="search-results-footer"
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>
          <kbd
            style={{
              fontFamily: 'monospace',
              padding: '2px 4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '3px',
            }}
          >
            Up/Down
          </kbd>{' '}
          to navigate
        </span>
        <span>
          <kbd
            style={{
              fontFamily: 'monospace',
              padding: '2px 4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '3px',
            }}
          >
            Enter
          </kbd>{' '}
          to open
        </span>
      </footer>
    </div>
  );
}

export default SearchResultsView;
