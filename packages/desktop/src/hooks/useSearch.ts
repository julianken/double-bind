/**
 * useSearch - Hook for managing search state and functionality
 *
 * Manages search query state, loading state, and search results.
 * Implements:
 * - 300ms debouncing to prevent excessive database queries
 * - Minimum query length validation (default: 2 characters)
 * - AbortController to cancel in-flight requests when new keystrokes arrive
 *
 * Note: The actual SearchService doesn't exist yet - this hook uses a mock
 * implementation. The real service will be built in DBB-3.
 *
 * @see docs/frontend/state-management.md for state architecture
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Constants
// ============================================================================

/** Default debounce delay in milliseconds */
export const DEFAULT_DEBOUNCE_MS = 300;

/** Default minimum query length */
export const DEFAULT_MIN_QUERY_LENGTH = 2;

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
   * Debounce delay in milliseconds.
   * Defaults to 300ms.
   */
  debounceMs?: number;

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

  /** Manually trigger a search (bypasses debounce) */
  search: (query: string) => Promise<void>;

  /**
   * Whether to show the "type at least X characters" hint.
   * True when query length is between 1 and minQueryLength-1 (inclusive).
   */
  showMinLengthHint: boolean;

  /** The debounced query (what will be/is being searched) */
  debouncedQuery: string;
}

// ============================================================================
// Mock Search Service
// ============================================================================

/**
 * Mock search function - simulates async search.
 * Will be replaced by actual SearchService when DBB-3 is implemented.
 *
 * @param query - The search query
 * @param signal - AbortSignal for cancellation
 */
async function mockSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  // Simulate network delay
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, 150);

    // Handle abort
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Search aborted', 'AbortError'));
    });
  });

  // Check if aborted after delay
  if (signal?.aborted) {
    throw new DOMException('Search aborted', 'AbortError');
  }

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
 * Hook for managing search functionality with debouncing and request cancellation.
 *
 * Features:
 * - 300ms debounce delay (configurable)
 * - Minimum query length validation (default: 2 characters)
 * - Automatic cancellation of in-flight requests when query changes
 * - Race condition prevention
 *
 * @param options - Configuration options
 * @returns Search state and actions
 *
 * @example
 * ```tsx
 * function SearchBar() {
 *   const {
 *     query,
 *     setQuery,
 *     isLoading,
 *     results,
 *     showMinLengthHint,
 *   } = useSearch({
 *     onResults: (results) => handleResults(results),
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder={isLoading ? 'Searching...' : 'Search...'}
 *       />
 *       {showMinLengthHint && (
 *         <span>Type at least 2 characters</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const {
    minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onResults,
    onSearchStart,
    onError,
  } = options;

  // State
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Refs for managing async operations
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestRequestId = useRef(0);

  // Computed state: show hint when query is 1 to minQueryLength-1 characters
  const showMinLengthHint = query.length > 0 && query.length < minQueryLength;

  /**
   * Cancel any pending debounce timer
   */
  const cancelDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  /**
   * Cancel any in-flight search request
   */
  const cancelInFlightRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Execute the actual search
   */
  const executeSearch = useCallback(
    async (searchQuery: string, requestId: number) => {
      // Don't search if query is too short
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Cancel any existing in-flight request
      cancelInFlightRequest();

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);
      onSearchStart?.();

      try {
        const searchResults = await mockSearch(searchQuery, abortController.signal);

        // Only update if this is still the latest request
        if (requestId === latestRequestId.current && !abortController.signal.aborted) {
          setResults(searchResults);
          onResults?.(searchResults);
          setIsLoading(false);
        }
      } catch (err) {
        // Ignore abort errors - they're expected when cancelling
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        // Only update if this is still the latest request
        if (requestId === latestRequestId.current) {
          const error = err instanceof Error ? err : new Error('Search failed');
          setError(error);
          onError?.(error);
          setIsLoading(false);
        }
      }
    },
    [minQueryLength, onResults, onSearchStart, onError, cancelInFlightRequest]
  );

  /**
   * Public search function - bypasses debounce for manual triggers
   */
  const search = useCallback(
    async (searchQuery: string) => {
      cancelDebounce();
      const requestId = ++latestRequestId.current;
      setDebouncedQuery(searchQuery);
      await executeSearch(searchQuery, requestId);
    },
    [executeSearch, cancelDebounce]
  );

  /**
   * Set query with debouncing
   */
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Cancel any pending debounce timer
      cancelDebounce();

      // Cancel any in-flight request immediately when typing
      cancelInFlightRequest();

      // If query is too short, clear results immediately (no debounce)
      if (newQuery.length < minQueryLength) {
        setDebouncedQuery(newQuery);
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Set loading state immediately for better UX feedback
      setIsLoading(true);

      // Debounce the actual search
      debounceTimerRef.current = setTimeout(() => {
        const requestId = ++latestRequestId.current;
        setDebouncedQuery(newQuery);
        executeSearch(newQuery, requestId);
      }, debounceMs);
    },
    [executeSearch, cancelDebounce, cancelInFlightRequest, minQueryLength, debounceMs]
  );

  /**
   * Clear search - cancels all pending operations
   */
  const clearSearch = useCallback(() => {
    cancelDebounce();
    cancelInFlightRequest();
    latestRequestId.current++;
    setQueryState('');
    setDebouncedQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, [cancelDebounce, cancelInFlightRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelDebounce();
      cancelInFlightRequest();
    };
  }, [cancelDebounce, cancelInFlightRequest]);

  return {
    query,
    setQuery,
    isLoading,
    results,
    hasResults: results.length > 0,
    error,
    clearSearch,
    search,
    showMinLengthHint,
    debouncedQuery,
  };
}
