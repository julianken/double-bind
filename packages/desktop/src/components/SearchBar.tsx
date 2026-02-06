/**
 * SearchBar - Global search input component for the sidebar
 *
 * Provides the primary entry point for full-text search across the knowledge base.
 *
 * Features:
 * - Search icon and placeholder text ("Search pages and blocks...")
 * - Keyboard shortcut to focus (Ctrl+K / Cmd+K on macOS)
 * - Debounced search calls (300ms delay via useSearch hook)
 * - Minimum query length hint (shows when query is 1 character)
 * - Inline loading indicator during search
 * - Clear button to reset the search input
 * - Escape key to blur and clear the input
 * - Navigates to SearchResultsView when results are available
 *
 * @see docs/frontend/keyboard-first.md for keyboard shortcuts
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSearch } from '../hooks/useSearch.js';
import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Constants
// ============================================================================

const SEARCH_PLACEHOLDER = 'Search pages and blocks...';
const SEARCH_RESULTS_ROUTE = 'search';
const MIN_LENGTH_HINT = 'Type at least 2 characters';

// ============================================================================
// Icons
// ============================================================================

/**
 * Search magnifying glass icon
 */
function SearchIcon() {
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
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11L14 14" />
    </svg>
  );
}

/**
 * Clear/close X icon
 */
function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3L11 11M11 3L3 11" />
    </svg>
  );
}

/**
 * Loading spinner icon
 */
function LoadingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      data-testid="search-loading-spinner"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <circle
        cx="7"
        cy="7"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface SearchBarProps {
  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Optional callback when search is initiated
   */
  onSearch?: (query: string) => void;

  /**
   * Optional callback when input is cleared
   */
  onClear?: () => void;

  /**
   * Placeholder text. Defaults to "Search pages and blocks..."
   */
  placeholder?: string;

  /**
   * Whether to enable the Ctrl+K / Cmd+K keyboard shortcut.
   * Defaults to true.
   */
  enableGlobalShortcut?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SearchBar component for global search functionality.
 *
 * Integrates with useSearch hook to handle search queries
 * and navigation to search results view.
 *
 * @example
 * ```tsx
 * function Sidebar() {
 *   return (
 *     <div className="sidebar">
 *       <SearchBar onSearch={(query) => handleSearch(query)} />
 *       <PageList />
 *     </div>
 *   );
 * }
 * ```
 */
export function SearchBar({
  className,
  onSearch,
  onClear,
  placeholder = SEARCH_PLACEHOLDER,
  enableGlobalShortcut = true,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  const { query, setQuery, isLoading, clearSearch, showMinLengthHint } = useSearch({
    onResults: () => {
      // Navigate to search results view when results are available
      navigateToPage(SEARCH_RESULTS_ROUTE);
    },
  });

  // Handle input change
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setQuery(value);
      onSearch?.(value);
    },
    [setQuery, onSearch]
  );

  // Handle clear button click
  const handleClear = useCallback(() => {
    clearSearch();
    onClear?.();
    inputRef.current?.focus();
  }, [clearSearch, onClear]);

  // Handle key down events
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSearch();
        onClear?.();
        inputRef.current?.blur();
      } else if (event.key === 'Enter' && query.trim()) {
        // Submit search - navigate to results
        navigateToPage(SEARCH_RESULTS_ROUTE);
      }
    },
    [clearSearch, onClear, query, navigateToPage]
  );

  // Handle form submit (for accessibility)
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (query.trim()) {
        navigateToPage(SEARCH_RESULTS_ROUTE);
      }
    },
    [query, navigateToPage]
  );

  // Global keyboard shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    if (!enableGlobalShortcut) return;

    function handleGlobalKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enableGlobalShortcut]);

  return (
    <form
      className={`search-bar${className ? ` ${className}` : ''}`}
      role="search"
      onSubmit={handleSubmit}
      data-testid="search-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        border: '1px solid transparent',
      }}
    >
      {/* Search icon or loading spinner */}
      <span
        className="search-bar-icon"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          flexShrink: 0,
        }}
      >
        {isLoading ? <LoadingSpinner /> : <SearchIcon />}
      </span>

      {/* Search input */}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search pages and blocks"
        data-testid="search-bar-input"
        autoComplete="off"
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: '14px',
          color: '#111827',
          minWidth: 0,
        }}
      />

      {/* Minimum length hint (shown when query is 1 character) */}
      {showMinLengthHint && (
        <span
          className="search-bar-hint"
          aria-live="polite"
          data-testid="search-bar-min-length-hint"
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {MIN_LENGTH_HINT}
        </span>
      )}

      {/* Keyboard shortcut hint (shown when input is empty) */}
      {!query && (
        <span
          className="search-bar-shortcut"
          aria-hidden="true"
          data-testid="search-bar-shortcut"
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            backgroundColor: '#e5e7eb',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {navigator.platform.includes('Mac') ? '\u2318K' : 'Ctrl+K'}
        </span>
      )}

      {/* Clear button (shown when input has value) */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          data-testid="search-bar-clear"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          <ClearIcon />
        </button>
      )}
    </form>
  );
}

// ============================================================================
// CSS Keyframes (injected into document)
// ============================================================================

// Inject CSS for spinner animation
if (typeof document !== 'undefined') {
  const styleId = 'search-bar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .search-bar:focus-within {
        border-color: #3b82f6 !important;
        background-color: #fff !important;
      }

      .search-bar-clear:hover {
        background-color: #e5e7eb !important;
      }
    `;
    document.head.appendChild(style);
  }
}
