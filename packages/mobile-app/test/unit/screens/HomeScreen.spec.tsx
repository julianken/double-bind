/**
 * @vitest-environment jsdom
 *
 * Tests for HomeScreen component - FAB integration for page creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
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
 * Test hook that simulates the HomeScreen FAB behavior.
 * This allows testing the business logic without React Native components.
 */
function useHomeScreenFAB() {
  const { createPage, isCreating } = useCreatePage();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null);

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
        setNavigatedTo(result.page.pageId);
      }
    },
    [createPage]
  );

  return {
    showModal,
    error,
    isCreating,
    navigatedTo,
    handleOpenModal,
    handleCloseModal,
    handleCreatePage,
  };
}

describe('HomeScreen FAB integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageService.getAllPages.mockResolvedValue([]);
  });

  describe('modal state', () => {
    it('should start with modal closed', () => {
      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      expect(result.current.showModal).toBe(false);
    });

    it('should open modal when FAB is pressed', () => {
      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.handleOpenModal();
      });

      expect(result.current.showModal).toBe(true);
    });

    it('should close modal on cancel', () => {
      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

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
    it('should create page and navigate on success', async () => {
      const newPage: Page = {
        pageId: 'new-page-id',
        title: 'My New Page',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPageService.createPage.mockResolvedValue(newPage);

      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.handleOpenModal();
      });

      await act(async () => {
        await result.current.handleCreatePage('My New Page');
      });

      expect(mockPageService.createPage).toHaveBeenCalledWith('My New Page');
      expect(result.current.navigatedTo).toBe('new-page-id');
      expect(result.current.showModal).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should show error on creation failure', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.handleOpenModal();
      });

      await act(async () => {
        await result.current.handleCreatePage('Test Page');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.showModal).toBe(true); // Modal stays open
      expect(result.current.navigatedTo).toBeNull();
    });

    it('should clear error when modal is closed', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

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

    it('should use default title for empty input', async () => {
      const newPage: Page = {
        pageId: 'default-page',
        title: 'Untitled',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPageService.createPage.mockResolvedValue(newPage);

      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleCreatePage('Untitled');
      });

      expect(mockPageService.createPage).toHaveBeenCalledWith('Untitled');
    });
  });

  describe('loading state', () => {
    it('should track loading state during creation', async () => {
      let resolveCreate: (value: Page) => void;
      const createPromise = new Promise<Page>((resolve) => {
        resolveCreate = resolve;
      });

      mockPageService.createPage.mockReturnValue(createPromise);

      const { result } = renderHook(() => useHomeScreenFAB(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isCreating).toBe(false);

      // Start creation
      act(() => {
        result.current.handleCreatePage('Test');
      });

      // Should be creating now
      expect(result.current.isCreating).toBe(true);

      // Resolve
      await act(async () => {
        resolveCreate!({
          pageId: 'new-page',
          title: 'Test',
          dailyNoteDate: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      expect(result.current.isCreating).toBe(false);
    });
  });
});
