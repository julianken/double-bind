/**
 * @vitest-environment jsdom
 *
 * Tests for PagesScreen component - FAB integration for page creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { DatabaseContext, type DatabaseContextValue } from '../../../src/providers/DatabaseProvider';
import { useCreatePage } from '../../../src/hooks/useCreatePage';
import type { MobileGraphDB } from '@double-bind/mobile';
import type { Page } from '@double-bind/types';

// Mock services
const mockPageService = {
  createPage: vi.fn(),
  getAllPages: vi.fn(),
};

const mockServices = {
  pageService: mockPageService,
  blockService: {},
  graphService: {},
  searchService: {},
  savedQueryService: {},
};

// Mock database
const mockDb: MobileGraphDB = {
  query: vi.fn(),
} as unknown as MobileGraphDB;

// Test wrapper with database context
function createWrapper(isReady: boolean = true) {
  const contextValue: DatabaseContextValue = {
    db: isReady ? mockDb : null,
    services: isReady ? (mockServices as any) : null,
    status: isReady ? 'ready' : 'initializing',
    error: null,
    platform: 'ios',
    retry: vi.fn(),
    isLoading: !isReady,
    isReady,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
  };
}

/**
 * Test hook that simulates the PagesScreen FAB behavior.
 * This allows testing the business logic without React Native components.
 */
function usePagesScreenFAB(onPagePress?: (pageId: string) => void) {
  const { createPage, isCreating } = useCreatePage();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPages = useCallback(async () => {
    try {
      const allPages = await mockPageService.getAllPages();
      setPages(allPages);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setError(null);
  }, []);

  const handleCreatePage = useCallback(
    async (title: string) => {
      const result = await createPage(title);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.page) {
        setError(null);
        setShowModal(false);
        onPagePress?.(result.page.pageId);
        await loadPages();
      }
    },
    [createPage, onPagePress, loadPages]
  );

  return {
    showModal,
    error,
    isCreating,
    isLoading,
    pages,
    handleOpenModal,
    handleCloseModal,
    handleCreatePage,
  };
}

describe('PagesScreen FAB integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageService.getAllPages.mockResolvedValue([]);
  });

  describe('modal state', () => {
    it('should start with modal closed', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();
      expect(result.current.showModal).toBe(false);
    });

    it('should open modal when FAB is pressed', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      act(() => {
        result.current.handleOpenModal();
      });

      expect(result.current.showModal).toBe(true);
    });

    it('should close modal on cancel', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      act(() => {
        result.current.handleOpenModal();
      });
      expect(result.current.showModal).toBe(true);

      act(() => {
        result.current.handleCloseModal();
      });
      expect(result.current.showModal).toBe(false);
    });
  });

  describe('page creation', () => {
    it('should create page and call onPagePress on success', async () => {
      const newPage: Page = {
        pageId: 'new-page-id',
        title: 'My New Page',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPageService.createPage.mockResolvedValue(newPage);
      mockPageService.getAllPages.mockResolvedValue([newPage]);

      const onPagePress = vi.fn();
      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(onPagePress), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      act(() => {
        result.current.handleOpenModal();
      });

      await act(async () => {
        await result.current.handleCreatePage('My New Page');
      });

      expect(mockPageService.createPage).toHaveBeenCalledWith('My New Page');
      expect(onPagePress).toHaveBeenCalledWith('new-page-id');
      expect(result.current.showModal).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should refresh page list after creation', async () => {
      const existingPage: Page = {
        pageId: 'existing-page',
        title: 'Existing',
        dailyNoteDate: null,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      };

      const newPage: Page = {
        pageId: 'new-page',
        title: 'New Page',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // First call returns existing pages, second call returns all including new
      mockPageService.getAllPages
        .mockResolvedValueOnce([existingPage])
        .mockResolvedValueOnce([existingPage, newPage]);

      mockPageService.createPage.mockResolvedValue(newPage);

      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();
      expect(result.current.pages).toHaveLength(1);

      await act(async () => {
        await result.current.handleCreatePage('New Page');
      });

      expect(result.current.pages).toHaveLength(2);
      expect(mockPageService.getAllPages).toHaveBeenCalledTimes(2);
    });

    it('should show error on creation failure', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Creation failed'));

      const onPagePress = vi.fn();
      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(onPagePress), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      act(() => {
        result.current.handleOpenModal();
      });

      await act(async () => {
        await result.current.handleCreatePage('Test Page');
      });

      expect(result.current.error).toBe('Creation failed');
      expect(result.current.showModal).toBe(true); // Modal stays open
      expect(onPagePress).not.toHaveBeenCalled();
    });

    it('should clear error when modal is closed', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Error'));

      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      act(() => {
        result.current.handleOpenModal();
      });

      await act(async () => {
        await result.current.handleCreatePage('Test');
      });

      expect(result.current.error).toBe('Error');

      act(() => {
        result.current.handleCloseModal();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading while pages are loading', () => {
      // Mock that never resolves
      mockPageService.getAllPages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should stop loading after pages load', async () => {
      mockPageService.getAllPages.mockResolvedValue([]);

      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('empty state', () => {
    it('should have empty pages array when no pages exist', async () => {
      mockPageService.getAllPages.mockResolvedValue([]);

      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      expect(result.current.pages).toHaveLength(0);
    });

    it('should show pages when they exist', async () => {
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Page 1',
          dailyNoteDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          pageId: 'page-2',
          title: 'Page 2',
          dailyNoteDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockPageService.getAllPages.mockResolvedValue(pages);

      const { result, waitForNextUpdate } = renderHook(() => usePagesScreenFAB(), {
        wrapper: createWrapper(),
      });

      await waitForNextUpdate();

      expect(result.current.pages).toHaveLength(2);
    });
  });
});
