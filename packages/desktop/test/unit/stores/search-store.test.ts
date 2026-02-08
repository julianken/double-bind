/**
 * Unit tests for search-store
 *
 * Tests cover:
 * - Initial state
 * - State setters
 * - clearSearch action
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from '../../../src/stores/search-store.js';
import type { SearchResult } from '../../../src/hooks/useSearch.js';

// ============================================================================
// Tests
// ============================================================================

describe('useSearchStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useSearchStore.getState().clearSearch();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('has empty query initially', () => {
      expect(useSearchStore.getState().query).toBe('');
    });

    it('has empty debouncedQuery initially', () => {
      expect(useSearchStore.getState().debouncedQuery).toBe('');
    });

    it('is not loading initially', () => {
      expect(useSearchStore.getState().isLoading).toBe(false);
    });

    it('has empty results initially', () => {
      expect(useSearchStore.getState().results).toEqual([]);
    });

    it('has no error initially', () => {
      expect(useSearchStore.getState().error).toBeNull();
    });
  });

  // ============================================================================
  // State Setters
  // ============================================================================

  describe('setQuery', () => {
    it('updates the query', () => {
      useSearchStore.getState().setQuery('test query');
      expect(useSearchStore.getState().query).toBe('test query');
    });
  });

  describe('setDebouncedQuery', () => {
    it('updates the debouncedQuery', () => {
      useSearchStore.getState().setDebouncedQuery('debounced query');
      expect(useSearchStore.getState().debouncedQuery).toBe('debounced query');
    });
  });

  describe('setIsLoading', () => {
    it('updates the isLoading state', () => {
      useSearchStore.getState().setIsLoading(true);
      expect(useSearchStore.getState().isLoading).toBe(true);

      useSearchStore.getState().setIsLoading(false);
      expect(useSearchStore.getState().isLoading).toBe(false);
    });
  });

  describe('setResults', () => {
    it('updates the results', () => {
      const mockResults: SearchResult[] = [
        {
          id: 'page-1',
          type: 'page',
          title: 'Test Page',
          pageId: 'page-1',
          score: 0.9,
        },
      ];

      useSearchStore.getState().setResults(mockResults);
      expect(useSearchStore.getState().results).toEqual(mockResults);
    });
  });

  describe('setError', () => {
    it('updates the error', () => {
      const error = new Error('Search failed');
      useSearchStore.getState().setError(error);
      expect(useSearchStore.getState().error).toBe(error);
    });

    it('can clear the error by setting null', () => {
      useSearchStore.getState().setError(new Error('Search failed'));
      useSearchStore.getState().setError(null);
      expect(useSearchStore.getState().error).toBeNull();
    });
  });

  // ============================================================================
  // clearSearch
  // ============================================================================

  describe('clearSearch', () => {
    it('resets all state to initial values', () => {
      // Set some state first
      useSearchStore.getState().setQuery('test');
      useSearchStore.getState().setDebouncedQuery('test');
      useSearchStore.getState().setIsLoading(true);
      useSearchStore.getState().setResults([
        {
          id: 'page-1',
          type: 'page',
          title: 'Test',
          pageId: 'page-1',
          score: 0.9,
        },
      ]);
      useSearchStore.getState().setError(new Error('Error'));

      // Clear
      useSearchStore.getState().clearSearch();

      // Verify all reset
      expect(useSearchStore.getState().query).toBe('');
      expect(useSearchStore.getState().debouncedQuery).toBe('');
      expect(useSearchStore.getState().isLoading).toBe(false);
      expect(useSearchStore.getState().results).toEqual([]);
      expect(useSearchStore.getState().error).toBeNull();
    });
  });
});
