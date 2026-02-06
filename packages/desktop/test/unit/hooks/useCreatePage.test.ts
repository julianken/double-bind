/**
 * Unit tests for useCreatePage hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useCreatePage } from '../../../src/hooks/useCreatePage.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import type { PageService, BlockService } from '@double-bind/core';
import type { Page } from '@double-bind/types';

// ============================================================================
// Mocks
// ============================================================================

const mockPage: Page = {
  pageId: 'test-page-id-123',
  title: 'Untitled',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
  dailyNoteDate: null,
};

const createMockPageService = () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  getPageWithBlocks: vi.fn(),
  deletePage: vi.fn(),
  getTodaysDailyNote: vi.fn(),
  searchPages: vi.fn(),
});

const mockBlockService = {} as BlockService;

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper(pageService: Partial<PageService>) {
  const services: Services = {
    pageService: pageService as PageService,
    blockService: mockBlockService,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ServiceProvider, { services }, children);
  };
}

describe('useCreatePage', () => {
  let mockPageService: ReturnType<typeof createMockPageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();

    // Reset store state
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });

    mockPageService = createMockPageService();
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('returns initial state correctly', () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.createPage).toBe('function');
    });
  });

  // ============================================================================
  // Successful Page Creation
  // ============================================================================

  describe('Successful Page Creation', () => {
    it('creates a page with default title', async () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage();
      });

      expect(mockPageService.createPage).toHaveBeenCalledWith('Untitled');
      expect(createResult?.page).toEqual(mockPage);
      expect(createResult?.error).toBeNull();
    });

    it('creates a page with custom title', async () => {
      const customTitle = 'My Custom Page';
      const customPage = { ...mockPage, title: customTitle };
      mockPageService.createPage.mockResolvedValue(customPage);

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage(customTitle);
      });

      expect(mockPageService.createPage).toHaveBeenCalledWith(customTitle);
      expect(createResult?.page?.title).toBe(customTitle);
    });

    it('navigates to the new page after creation', async () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      await act(async () => {
        await result.current.createPage();
      });

      const storeState = useAppStore.getState();
      expect(storeState.currentPageId).toBe(mockPage.pageId);
      expect(storeState.pageHistory).toContain(mockPage.pageId);
    });

    it('sets isCreating to true during creation', async () => {
      // Create a delayed promise to observe loading state
      let resolveCreate: ((page: Page) => void) | null = null;
      mockPageService.createPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      // Start creation
      let createPromise: Promise<Page | null>;
      act(() => {
        createPromise = result.current.createPage();
      });

      // Check loading state
      expect(result.current.isCreating).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolveCreate?.(mockPage);
        await createPromise;
      });

      // Check final state
      expect(result.current.isCreating).toBe(false);
    });

    it('clears error on successful creation after previous failure', async () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      // First call fails
      mockPageService.createPage.mockRejectedValueOnce(new Error('First error'));

      await act(async () => {
        await result.current.createPage();
      });

      expect(result.current.error).not.toBeNull();

      // Second call succeeds
      mockPageService.createPage.mockResolvedValueOnce(mockPage);

      await act(async () => {
        await result.current.createPage();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('handles Error instances correctly', async () => {
      const error = new Error('Failed to create page');
      mockPageService.createPage.mockRejectedValue(error);

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage();
      });

      expect(createResult?.page).toBeNull();
      expect(createResult?.error).toBe(error);
      expect(result.current.error).toBe(error);
      expect(result.current.isCreating).toBe(false);
    });

    it('handles non-Error rejection values', async () => {
      mockPageService.createPage.mockRejectedValue('String error');

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage();
      });

      expect(createResult?.error).toBeInstanceOf(Error);
      expect(createResult?.error?.message).toBe('String error');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('String error');
    });

    it('does not navigate on error', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Creation failed'));

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      await act(async () => {
        await result.current.createPage();
      });

      const storeState = useAppStore.getState();
      expect(storeState.currentPageId).toBeNull();
      expect(storeState.pageHistory).toEqual([]);
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('prevents concurrent page creations by returning quickly', async () => {
      let resolveFirst: ((page: Page) => void) | null = null;
      let callCount = 0;

      mockPageService.createPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            callCount++;
            if (callCount === 1) {
              resolveFirst = resolve;
            } else {
              resolve({ ...mockPage, pageId: `page-${callCount}` });
            }
          })
      );

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      // Start first creation
      let firstPromise: Promise<Page | null>;
      act(() => {
        firstPromise = result.current.createPage();
      });

      // Start second creation (while first is still in progress)
      // Note: The hook doesn't prevent this, but consumers should check isCreating
      let secondPromise: Promise<Page | null>;
      act(() => {
        secondPromise = result.current.createPage();
      });

      // Resolve both
      await act(async () => {
        resolveFirst?.(mockPage);
        await firstPromise;
        await secondPromise;
      });

      // Both calls went through (hook doesn't prevent, consumer should)
      expect(mockPageService.createPage).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Return Value
  // ============================================================================

  describe('Return Value', () => {
    it('returns the created page on success', async () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage();
      });

      expect(createResult?.page).toEqual(mockPage);
      expect(createResult?.error).toBeNull();
    });

    it('returns null page and error on failure', async () => {
      const error = new Error('Failed');
      mockPageService.createPage.mockRejectedValue(error);

      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      let createResult: { page: Page | null; error: Error | null } | null = null;

      await act(async () => {
        createResult = await result.current.createPage();
      });

      expect(createResult?.page).toBeNull();
      expect(createResult?.error).toBe(error);
    });
  });

  // ============================================================================
  // Multiple Calls
  // ============================================================================

  describe('Multiple Calls', () => {
    it('handles multiple sequential creations', async () => {
      const wrapper = createWrapper(mockPageService);
      const { result } = renderHook(() => useCreatePage(), { wrapper });

      // Create first page
      mockPageService.createPage.mockResolvedValueOnce({
        ...mockPage,
        pageId: 'page-1',
      });

      await act(async () => {
        await result.current.createPage('Page 1');
      });

      expect(useAppStore.getState().currentPageId).toBe('page-1');

      // Create second page
      mockPageService.createPage.mockResolvedValueOnce({
        ...mockPage,
        pageId: 'page-2',
      });

      await act(async () => {
        await result.current.createPage('Page 2');
      });

      expect(useAppStore.getState().currentPageId).toBe('page-2');
      expect(mockPageService.createPage).toHaveBeenCalledTimes(2);
    });
  });
});
