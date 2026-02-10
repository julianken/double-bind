/**
 * Tests for useAutocomplete hook
 *
 * Tests cover:
 * - Page search with debouncing
 * - "Create new page" suggestion logic
 * - Empty query handling
 * - Loading state management
 * - Database status handling
 * - Error handling
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useAutocomplete } from '../../../src/hooks/useAutocomplete';
import {
  DatabaseContext,
  type DatabaseContextValue,
} from '../../../src/providers/DatabaseProvider';
import type { GraphDB } from '@double-bind/types';
import type { Page } from '@double-bind/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock createServices
const mockSearchPages = vi.fn();

vi.mock('@double-bind/core', () => ({
  createServices: () => ({
    pageService: {
      searchPages: mockSearchPages,
    },
  }),
}));

// Mock database
const mockDb: GraphDB = {
  query: vi.fn(),
  close: vi.fn(),
} as unknown as GraphDB;

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a wrapper component that provides database context.
 */
function createWrapper(dbStatus: 'initializing' | 'ready' | 'error' = 'ready') {
  const contextValue: DatabaseContextValue = {
    db: dbStatus === 'ready' ? mockDb : null,
    status: dbStatus,
    error: dbStatus === 'error' ? 'Test error' : null,
    platform: 'ios',
    retry: vi.fn(),
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
  };
}

/**
 * Helper to create a Page object.
 */
function createPage(pageId: string, title: string): Page {
  return {
    pageId: pageId as any,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
    deletedAt: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('page search', () => {
    it('should search pages and return suggestions', async () => {
      const mockPages = [createPage('page-1', 'Test'), createPage('page-2', 'Testing Ideas')];

      mockSearchPages.mockResolvedValueOnce(mockPages);

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      // Initially not loading, no suggestions
      expect(result.current.isLoading).toBe(false);
      expect(result.current.suggestions).toEqual([]);

      // Fast-forward debounce timer
      vi.advanceTimersByTime(300);

      // Wait for state update
      await waitForNextUpdate();

      // Verify suggestions (should have exact match "Test", no create option)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.suggestions).toHaveLength(2);
      expect(result.current.suggestions[0]).toEqual({
        type: 'page',
        data: {
          pageId: 'page-1',
          title: 'Test',
          isCreateNew: false,
        },
      });
      expect(result.current.suggestions[1]).toEqual({
        type: 'page',
        data: {
          pageId: 'page-2',
          title: 'Testing Ideas',
          isCreateNew: false,
        },
      });
    });

    it('should add "Create new page" suggestion when no exact match', async () => {
      const mockPages = [createPage('page-1', 'Similar Page')];

      mockSearchPages.mockResolvedValueOnce(mockPages);

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'new page',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();

      // Should have original page + create new option
      expect(result.current.suggestions).toHaveLength(2);

      const createSuggestion = result.current.suggestions[1];
      expect(createSuggestion.type).toBe('page');
      expect(createSuggestion.data.title).toBe('new page');
      expect(createSuggestion.data.isCreateNew).toBe(true);
      expect(createSuggestion.data.pageId).toContain('create-');
    });

    it('should not add "Create new page" when exact match exists', async () => {
      const mockPages = [createPage('page-1', 'Exact Match')];

      mockSearchPages.mockResolvedValueOnce(mockPages);

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'exact match',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();

      // Should only have the exact match, no create option
      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].data.isCreateNew).toBe(false);
    });

    it('should handle case-insensitive exact match', async () => {
      const mockPages = [createPage('page-1', 'Test Page')];

      mockSearchPages.mockResolvedValueOnce(mockPages);

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'TEST PAGE',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();

      // Should detect case-insensitive match and not add create option
      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].data.isCreateNew).toBe(false);
    });
  });

  describe('debouncing behavior', () => {
    it('should debounce search by 300ms', async () => {
      mockSearchPages.mockResolvedValue([]);

      const { rerender, waitForNextUpdate } = renderHook(
        ({ query }) =>
          useAutocomplete({
            trigger: 'page',
            query,
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { query: 'a' },
        }
      );

      // Update query multiple times quickly
      rerender({ query: 'ab' });
      rerender({ query: 'abc' });

      // Should not have called search yet
      expect(mockSearchPages).not.toHaveBeenCalled();

      // Fast-forward 299ms - still shouldn't call
      vi.advanceTimersByTime(299);
      expect(mockSearchPages).not.toHaveBeenCalled();

      // Fast-forward 1 more ms - now it should call
      vi.advanceTimersByTime(1);
      await waitForNextUpdate();

      expect(mockSearchPages).toHaveBeenCalledTimes(1);
      expect(mockSearchPages).toHaveBeenCalledWith('abc');
    });

    it('should cancel previous debounced search', async () => {
      mockSearchPages.mockResolvedValue([]);

      const { rerender, waitForNextUpdate } = renderHook(
        ({ query }) =>
          useAutocomplete({
            trigger: 'page',
            query,
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { query: 'first' },
        }
      );

      // Wait 200ms (before debounce completes)
      vi.advanceTimersByTime(200);

      // Update to new query
      rerender({ query: 'second' });

      // Complete the debounce for second query
      vi.advanceTimersByTime(300);
      await waitForNextUpdate();

      // Should only search with the second query
      expect(mockSearchPages).toHaveBeenCalledTimes(1);
      expect(mockSearchPages).toHaveBeenCalledWith('second');
      expect(mockSearchPages).not.toHaveBeenCalledWith('first');
    });
  });

  describe('empty query handling', () => {
    it('should clear suggestions when query is empty', async () => {
      mockSearchPages.mockResolvedValue([createPage('page-1', 'Test')]);

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ query }) =>
          useAutocomplete({
            trigger: 'page',
            query,
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { query: 'test' },
        }
      );

      // Get initial results
      vi.advanceTimersByTime(300);
      await waitForNextUpdate();
      expect(result.current.suggestions).toHaveLength(1);

      // Clear query
      rerender({ query: '' });

      // Should clear immediately without waiting for debounce
      expect(result.current.suggestions).toEqual([]);
    });

    it('should not search with empty query', () => {
      mockSearchPages.mockResolvedValue([]);

      renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: '',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });

    it('should not search with whitespace-only query', () => {
      mockSearchPages.mockResolvedValue([]);

      renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: '   ',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should set loading state during search', async () => {
      // Use real timers for promise resolution
      vi.useRealTimers();

      let resolveSearch: (pages: Page[]) => void = () => {};
      const searchPromise = new Promise<Page[]>((resolve) => {
        resolveSearch = resolve;
      });

      mockSearchPages.mockReturnValueOnce(searchPromise);

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      // Initially not loading
      expect(result.current.isLoading).toBe(false);

      // Wait for debounce and search to start
      await waitForNextUpdate();

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve search
      resolveSearch([]);
      await waitForNextUpdate();

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe('enabled flag', () => {
    it('should not search when disabled', () => {
      mockSearchPages.mockResolvedValue([]);

      renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: false,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });

    it('should clear suggestions when disabled', async () => {
      mockSearchPages.mockResolvedValue([createPage('page-1', 'Test')]);

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ enabled }) =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: true },
        }
      );

      // Get initial results
      vi.advanceTimersByTime(300);
      await waitForNextUpdate();
      expect(result.current.suggestions).toHaveLength(1);

      // Disable
      rerender({ enabled: false });
      expect(result.current.suggestions).toEqual([]);
    });
  });

  describe('trigger type handling', () => {
    it('should only search for page trigger', () => {
      mockSearchPages.mockResolvedValue([]);

      renderHook(
        () =>
          useAutocomplete({
            trigger: 'block',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });

    it('should clear suggestions when trigger changes from page', async () => {
      mockSearchPages.mockResolvedValue([createPage('page-1', 'Test')]);

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ trigger }: { trigger: 'page' | 'block' | 'tag' }) =>
          useAutocomplete({
            trigger,
            query: 'test',
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { trigger: 'page' as const },
        }
      );

      // Get initial results
      vi.advanceTimersByTime(300);
      await waitForNextUpdate();
      expect(result.current.suggestions).toHaveLength(1);

      // Change trigger
      rerender({ trigger: 'block' });
      expect(result.current.suggestions).toEqual([]);
    });
  });

  describe('database status handling', () => {
    it('should not search when database is null', () => {
      mockSearchPages.mockResolvedValue([]);

      renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper('initializing') }
      );

      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle search errors gracefully', async () => {
      mockSearchPages.mockRejectedValueOnce(new Error('Search failed'));

      const { result, waitForNextUpdate } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();

      // Should clear suggestions on error (silent fail)
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should recover from error on next search', async () => {
      // First search fails
      mockSearchPages.mockRejectedValueOnce(new Error('Search failed'));

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ query }) =>
          useAutocomplete({
            trigger: 'page',
            query,
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { query: 'test' },
        }
      );

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();
      expect(result.current.suggestions).toEqual([]);

      // Second search succeeds with exact match for "test2"
      mockSearchPages.mockResolvedValueOnce([createPage('page-1', 'test2')]);
      rerender({ query: 'test2' });

      vi.advanceTimersByTime(300);
      await waitForNextUpdate();
      // Should have exactly 1 result (no create option because of exact match)
      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].data.isCreateNew).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup debounce timer on unmount', () => {
      const { unmount } = renderHook(
        () =>
          useAutocomplete({
            trigger: 'page',
            query: 'test',
            enabled: true,
          }),
        { wrapper: createWrapper() }
      );

      // Set a timer
      vi.advanceTimersByTime(100);

      // Unmount should clear pending timers
      unmount();

      // Advancing time shouldn't trigger search
      vi.advanceTimersByTime(300);
      expect(mockSearchPages).not.toHaveBeenCalled();
    });
  });
});
