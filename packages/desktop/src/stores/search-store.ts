/**
 * Search Store - Shared state for search functionality
 *
 * This Zustand store provides shared search state between SearchBar and
 * SearchResultsView components. Before this store, each component calling
 * useSearch() would get independent React state, causing the query to be
 * lost during navigation.
 *
 * @see docs/frontend/state-management.md for architecture details
 */

import { create } from 'zustand';
import type { SearchResult } from '../hooks/useSearch.js';

// ============================================================================
// Types
// ============================================================================

export interface SearchStore {
  /** Current search query (what user typed) */
  query: string;

  /** Debounced query (what is actually being searched) */
  debouncedQuery: string;

  /** Whether a search is currently in progress */
  isLoading: boolean;

  /** Current search results */
  results: SearchResult[];

  /** Error from last search, if any */
  error: Error | null;

  /** Set the query (immediate, before debounce) */
  setQuery: (query: string) => void;

  /** Set the debounced query (after debounce delay) */
  setDebouncedQuery: (query: string) => void;

  /** Set loading state */
  setIsLoading: (isLoading: boolean) => void;

  /** Set search results */
  setResults: (results: SearchResult[]) => void;

  /** Set error */
  setError: (error: Error | null) => void;

  /** Clear all search state */
  clearSearch: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  debouncedQuery: '',
  isLoading: false,
  results: [],
  error: null,

  setQuery: (query) => set({ query }),

  setDebouncedQuery: (debouncedQuery) => set({ debouncedQuery }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setResults: (results) => set({ results }),

  setError: (error) => set({ error }),

  clearSearch: () =>
    set({
      query: '',
      debouncedQuery: '',
      isLoading: false,
      results: [],
      error: null,
    }),
}));

// Expose store for E2E testing (only in development/test)
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  (window as unknown as { __SEARCH_STORE__?: typeof useSearchStore }).__SEARCH_STORE__ =
    useSearchStore;
}
