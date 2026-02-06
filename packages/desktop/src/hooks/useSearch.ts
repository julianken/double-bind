/**
 * useSearch - Hook for managing search state and functionality
 *
 * Manages search query state, loading state, and search results.
 * Debouncing is handled separately (see DBB-XX for debouncing implementation).
 *
 * Note: The actual SearchService doesn't exist yet - this hook uses a mock
 * implementation. The real service will be built in DBB-3.
 *
 * @see docs/frontend/state-management.md for state architecture
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Search result item returned by the search service.
 * This is a placeholder type - will be refined when SearchService is implemented.
 */
export interface SearchResult {
  /** Unique identifier for the result */
  id: string;
  /** Type of result: page or block */
  type: 'page' | 'block';
  /** Title or content snippet */
  title: string;
  /** Highlighted matching text */
  highlight?: string;
  /** Page ID (for blocks, this is the parent page) */
  pageId: string;
  /** Relevance score */
  score: number;
}

/**
 * Options for the useSearch hook.
 */
export interface UseSearchOptions {
  /**
   * Minimum query length to trigger search.
   * Defaults to 2 characters.
   */
  minQueryLength?: number;

  /**
   * Callback when search results are returned.
   */
  onResults?: (results: SearchResult[]) => void;

  /**
   * Callback when search starts.
   */
  onSearchStart?: () => void;

  /**
   * Callback when an error occurs.
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useSearch hook.
 */
export interface UseSearchResult {
  /** Current search query */
  query: string;

  /** Set the search query */
  setQuery: (query: string) => void;

  /** Whether a search is in progress */
  isLoading: boolean;

  /** Current search results */
  results: SearchResult[];

  /** Whether there are any results */
  hasResults: boolean;

  /** Any error that occurred during search */
  error: Error | null;

  /** Clear the search query and results */
  clearSearch: () => void;

  /** Manually trigger a search */
  search: (query: string) => Promise<void>;
}

// ============================================================================
// Mock Search Service
// ============================================================================

/**
 * Mock search function - simulates async search.
 * Will be replaced by actual SearchService when DBB-3 is implemented.
 */
async function mockSearch(query: string): Promise<SearchResult[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Return empty results for now
  // Real implementation will query CozoDB with FTS
  if (!query.trim()) {
    return [];
  }

  // Mock results for development/testing
  return [
    {
      id: 'mock-page-1',
      type: 'page',
      title: `Page matching "${query}"`,
      pageId: 'mock-page-1',
      score: 0.95,
    },
    {
      id: 'mock-block-1',
      type: 'block',
      title: `Block containing "${query}"`,
      highlight: `...text with <mark>${query}</mark> highlighted...`,
      pageId: 'mock-page-2',
      score: 0.85,
    },
  ];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing search functionality.
 *
 * Provides search query state, loading state, results, and actions.
 * Note: Actual debouncing is a separate concern (see DBB-XX).
 *
 * @param options - Configuration options
 * @returns Search state and actions
 *
 * @example
 * ```tsx
 * function SearchBar() {
 *   const { query, setQuery, isLoading, results } = useSearch({
 *     onResults: (results) => handleResults(results),
 *   });
 *
 *   return (
 *     <input
 *       value={query}
 *       onChange={(e) => setQuery(e.target.value)}
 *       placeholder={isLoading ? 'Searching...' : 'Search...'}
 *     />
 *   );
 * }
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { minQueryLength = 2, onResults, onSearchStart, onError } = options;

  // State
  const [query, setQueryState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Track the latest search request to handle race conditions
  const latestRequestId = useRef(0);

  // Internal search function
  const executeSearch = useCallback(
    async (searchQuery: string, requestId: number) => {
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      onSearchStart?.();

      try {
        const searchResults = await mockSearch(searchQuery);

        // Only update if this is still the latest request
        if (requestId === latestRequestId.current) {
          setResults(searchResults);
          onResults?.(searchResults);
        }
      } catch (err) {
        // Only update if this is still the latest request
        if (requestId === latestRequestId.current) {
          const error = err instanceof Error ? err : new Error('Search failed');
          setError(error);
          onError?.(error);
        }
      } finally {
        // Only update if this is still the latest request
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [minQueryLength, onResults, onSearchStart, onError]
  );

  // Public search function
  const search = useCallback(
    async (searchQuery: string) => {
      const requestId = ++latestRequestId.current;
      await executeSearch(searchQuery, requestId);
    },
    [executeSearch]
  );

  // Set query and trigger search
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);
      const requestId = ++latestRequestId.current;
      executeSearch(newQuery, requestId);
    },
    [executeSearch]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    latestRequestId.current++;
    setQueryState('');
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    query,
    setQuery,
    isLoading,
    results,
    hasResults: results.length > 0,
    error,
    clearSearch,
    search,
  };
}
