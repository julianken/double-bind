/**
 * @vitest-environment jsdom
 */

/**
 * Tests for useWikiLinkAutocomplete hook.
 *
 * Validates the integration layer between useAutocomplete and editor UI:
 * - Trigger activation and query management
 * - Selection with link formatting
 * - New page creation flow
 * - State reset on dismiss
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useWikiLinkAutocomplete } from '../../../src/hooks/useWikiLinkAutocomplete';
import { DatabaseContext } from '../../../src/providers/DatabaseProvider';
import { createServices } from '@double-bind/core';
import type { AutocompleteSuggestion } from '../../../src/editor/types';
import type { MobileDatabase } from '../../../src/database/MobileDatabase';

// Mock dependencies
vi.mock('@double-bind/core');

describe('useWikiLinkAutocomplete', () => {
  // Mock values
  let mockDb: MobileDatabase;
  let mockPageService: {
    getOrCreateByTitle: Mock;
    searchPages: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database
    mockDb = {
      query: vi.fn(),
      mutate: vi.fn(),
      close: vi.fn(),
      export: vi.fn(),
      importRelations: vi.fn(),
    } as unknown as MobileDatabase;

    // Setup mock page service
    mockPageService = {
      getOrCreateByTitle: vi.fn(),
      searchPages: vi.fn().mockResolvedValue([]),
    };

    // Mock createServices
    (createServices as Mock).mockReturnValue({
      pageService: mockPageService,
    });
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <DatabaseContext.Provider
          value={{
            db: mockDb,
            status: 'ready',
            error: null,
            platform: 'ios',
            retry: vi.fn(),
          }}
        >
          {children}
        </DatabaseContext.Provider>
      );
    };
  }

  describe('initial state', () => {
    it('should start with autocomplete inactive', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('handleTrigger', () => {
    it('should activate autocomplete when page trigger is detected', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'test query');

      expect(result.current.isActive).toBe(true);
      expect(result.current.query).toBe('test query');
    });

    it('should search for pages after trigger', async () => {
      mockPageService.searchPages.mockResolvedValue([
        { pageId: 'p1', title: 'Test Page' },
      ]);

      const { result, waitForNextUpdate } = renderHook(
        () => useWikiLinkAutocomplete(),
        {
          wrapper: createWrapper(),
        }
      );

      result.current.handleTrigger('page', 'test');

      // Wait for debounce and search
      await waitForNextUpdate({ timeout: 500 });

      expect(mockPageService.searchPages).toHaveBeenCalledWith('test');
    });

    it('should ignore non-page triggers', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('block', 'test query');

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
    });

    it('should update query as user types', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'a');
      expect(result.current.query).toBe('a');

      result.current.handleTrigger('page', 'ab');
      expect(result.current.query).toBe('ab');

      result.current.handleTrigger('page', 'abc');
      expect(result.current.query).toBe('abc');
    });
  });

  describe('handleSelect - existing page', () => {
    const existingSuggestion: AutocompleteSuggestion = {
      type: 'page',
      data: {
        pageId: 'page-123',
        title: 'Existing Page',
        isCreateNew: false,
      },
    };

    it('should return formatted link text for existing page', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      const selection = await result.current.handleSelect(existingSuggestion);

      expect(selection.text).toBe('[[Existing Page]]');
      expect(selection.pageId).toBe('page-123');
    });

    it('should deactivate autocomplete after selection', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'test');
      await result.current.handleSelect(existingSuggestion);

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
    });

    it('should not create a new page', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      await result.current.handleSelect(existingSuggestion);

      expect(mockPageService.getOrCreateByTitle).not.toHaveBeenCalled();
    });
  });

  describe('handleSelect - create new page', () => {
    const createNewSuggestion: AutocompleteSuggestion = {
      type: 'page',
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pageId: 'create-New Page' as any, // Temporary ID
        title: 'New Page',
        isCreateNew: true,
      },
    };

    beforeEach(() => {
      mockPageService.getOrCreateByTitle.mockResolvedValue({
        pageId: 'page-new-456',
        title: 'New Page',
      });
    });

    it('should create new page when isCreateNew is true', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      await result.current.handleSelect(createNewSuggestion);

      expect(createServices).toHaveBeenCalledWith(mockDb);
      expect(mockPageService.getOrCreateByTitle).toHaveBeenCalledWith('New Page');
    });

    it('should return formatted link text with new page ID', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      const selection = await result.current.handleSelect(createNewSuggestion);

      expect(selection.text).toBe('[[New Page]]');
      expect(selection.pageId).toBe('page-new-456');
    });

    it('should deactivate autocomplete after creating page', async () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'new');
      await result.current.handleSelect(createNewSuggestion);

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
    });
  });

  describe('handleSelect - non-page suggestions', () => {
    it('should return empty text for block suggestions', async () => {
      const blockSuggestion: AutocompleteSuggestion = {
        type: 'block',
        data: {
          blockId: 'block-123',
          content: 'Some content',
          pageTitle: 'Page',
        },
      };

      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      const selection = await result.current.handleSelect(blockSuggestion);

      expect(selection.text).toBe('');
      expect(selection.pageId).toBeUndefined();
    });

    it('should return empty text for tag suggestions', async () => {
      const tagSuggestion: AutocompleteSuggestion = {
        type: 'tag',
        data: {
          tag: 'important',
          count: 5,
        },
      };

      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      const selection = await result.current.handleSelect(tagSuggestion);

      expect(selection.text).toBe('');
      expect(selection.pageId).toBeUndefined();
    });
  });

  describe('handleDismiss', () => {
    it('should deactivate autocomplete', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'test');
      result.current.handleDismiss();

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
    });

    it('should not insert any text or create pages', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      result.current.handleTrigger('page', 'test');
      result.current.handleDismiss();

      expect(mockPageService.getOrCreateByTitle).not.toHaveBeenCalled();
    });
  });

  describe('suggestions from search', () => {
    it('should show suggestions from search results', async () => {
      mockPageService.searchPages.mockResolvedValue([
        { pageId: 'p1', title: 'Page 1' },
        { pageId: 'p2', title: 'Page 2' },
      ]);

      const { result, waitForNextUpdate } = renderHook(
        () => useWikiLinkAutocomplete(),
        {
          wrapper: createWrapper(),
        }
      );

      result.current.handleTrigger('page', 'test');

      await waitForNextUpdate({ timeout: 500 });

      expect(result.current.suggestions).toHaveLength(3); // 2 results + "Create new" option
      expect(result.current.suggestions[0].data.title).toBe('Page 1');
      expect(result.current.suggestions[1].data.title).toBe('Page 2');
      expect(result.current.suggestions[2].data.isCreateNew).toBe(true);
    });

    it('should show loading state during search', async () => {
      mockPageService.searchPages.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const { result, waitForNextUpdate } = renderHook(
        () => useWikiLinkAutocomplete(),
        {
          wrapper: createWrapper(),
        }
      );

      result.current.handleTrigger('page', 'test');

      // Wait for debounce to trigger loading state
      await waitForNextUpdate({ timeout: 500 });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full autocomplete flow', async () => {
      mockPageService.searchPages.mockResolvedValue([
        { pageId: 'p1', title: 'Test Page' },
      ]);

      const { result, waitForNextUpdate } = renderHook(
        () => useWikiLinkAutocomplete(),
        {
          wrapper: createWrapper(),
        }
      );

      // 1. User types [[
      result.current.handleTrigger('page', 'test');
      expect(result.current.isActive).toBe(true);
      expect(result.current.query).toBe('test');

      // 2. Wait for search results
      await waitForNextUpdate({ timeout: 500 });

      // 3. User selects suggestion
      const selection = await result.current.handleSelect(result.current.suggestions[0]);

      expect(selection.text).toBe('[[Test Page]]');
      expect(result.current.isActive).toBe(false);
    });

    it('should handle dismiss during search', () => {
      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      // Start autocomplete
      result.current.handleTrigger('page', 'test');
      expect(result.current.isActive).toBe(true);

      // Dismiss before selection
      result.current.handleDismiss();

      expect(result.current.isActive).toBe(false);
      expect(result.current.query).toBe('');
    });

    it('should handle database unavailable gracefully', async () => {
      // Create wrapper with null db
      function NullDbWrapper({ children }: { children: ReactNode }) {
        return (
          <DatabaseContext.Provider
            value={{
              db: null,
              status: 'initializing',
              error: null,
              platform: 'ios',
              retry: vi.fn(),
            }}
          >
            {children}
          </DatabaseContext.Provider>
        );
      }

      const createSuggestion: AutocompleteSuggestion = {
        type: 'page',
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pageId: 'create-test' as any,
          title: 'Test',
          isCreateNew: true,
        },
      };

      const { result } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: NullDbWrapper,
      });

      // Should not crash when trying to create page without db
      const selection = await result.current.handleSelect(createSuggestion);

      expect(selection.text).toBe('[[Test]]');
      expect(mockPageService.getOrCreateByTitle).not.toHaveBeenCalled();
    });
  });

  describe('stability', () => {
    it('should provide stable callback references', () => {
      const { result, rerender } = renderHook(() => useWikiLinkAutocomplete(), {
        wrapper: createWrapper(),
      });

      const firstTrigger = result.current.handleTrigger;
      const firstSelect = result.current.handleSelect;
      const firstDismiss = result.current.handleDismiss;

      rerender();

      expect(result.current.handleTrigger).toBe(firstTrigger);
      expect(result.current.handleSelect).toBe(firstSelect);
      expect(result.current.handleDismiss).toBe(firstDismiss);
    });
  });
});
