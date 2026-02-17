/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useCreatePage } from '../../../src/hooks/useCreatePage';
import { DatabaseContext } from '../../../src/providers/DatabaseProvider';
import type { Database, Page } from '@double-bind/types';

describe('useCreatePage', () => {
  let mockDb: Database;

  const mockServices = {
    pageService: {
      createPage: vi.fn(),
      getAllPages: vi.fn(),
    },
    blockService: {},
    graphService: {},
    searchService: {},
    savedQueryService: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn(),
      mutate: vi.fn(),
      close: vi.fn(),
      export: vi.fn(),
      importRelations: vi.fn(),
    } as unknown as Database;
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <DatabaseContext.Provider
          value={{
            db: mockDb,
            services: mockServices as any,
            status: 'ready',
            error: null,
            platform: 'ios',
            retry: vi.fn(),
            isLoading: false,
            isReady: true,
          }}
        >
          {children}
        </DatabaseContext.Provider>
      );
    };
  }

  it('should create a page with default title', async () => {
    const mockPage: Page = {
      pageId: 'page-1',
      title: 'Untitled',
      dailyNoteDate: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockServices.pageService.getAllPages.mockResolvedValue([]);
    mockServices.pageService.createPage.mockResolvedValue(mockPage);

    const { result, waitForNextUpdate } = renderHook(() => useCreatePage(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCreating).toBe(false);

    const createPromise = result.current.createPage();
    const createResult = await createPromise;

    expect(createResult.page).toEqual(mockPage);
    expect(createResult.error).toBeNull();
    expect(mockServices.pageService.createPage).toHaveBeenCalledWith('Untitled');
    expect(result.current.isCreating).toBe(false);
  });

  it('should create a page with custom title', async () => {
    const mockPage: Page = {
      pageId: 'page-1',
      title: 'My Page',
      dailyNoteDate: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockServices.pageService.createPage.mockResolvedValue(mockPage);
    mockServices.pageService.getAllPages.mockResolvedValue([]);

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: createWrapper(),
    });

    const createResult = await result.current.createPage('My Page');

    expect(createResult.page).toEqual(mockPage);
    expect(mockServices.pageService.createPage).toHaveBeenCalledWith('My Page');
  });

  it('should auto-increment Untitled pages', async () => {
    const existingPages: Page[] = [
      {
        pageId: 'page-1',
        title: 'Untitled',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        pageId: 'page-2',
        title: 'Untitled 2',
        dailyNoteDate: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const mockPage: Page = {
      pageId: 'page-3',
      title: 'Untitled 3',
      dailyNoteDate: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockServices.pageService.getAllPages.mockResolvedValue(existingPages);
    mockServices.pageService.createPage.mockResolvedValue(mockPage);

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: createWrapper(),
    });

    const createResult = await result.current.createPage();

    expect(createResult.page).toEqual(mockPage);
    expect(mockServices.pageService.createPage).toHaveBeenCalledWith('Untitled 3');
  });

  it('should handle creation errors', async () => {
    const error = new Error('Failed to create page');
    mockServices.pageService.getAllPages.mockResolvedValue([]);
    mockServices.pageService.createPage.mockRejectedValue(error);

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: createWrapper(),
    });

    const createResult = await result.current.createPage();

    expect(createResult.page).toBeNull();
    expect(createResult.error).toEqual(error);
    expect(result.current.error).toEqual(error);
  });

  it('should return error when database is not ready', async () => {
    function NotReadyWrapper({ children }: { children: ReactNode }) {
      return (
        <DatabaseContext.Provider
          value={{
            db: null,
            services: null,
            status: 'initializing',
            error: null,
            platform: 'ios',
            retry: vi.fn(),
            isLoading: true,
            isReady: false,
          }}
        >
          {children}
        </DatabaseContext.Provider>
      );
    }

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: NotReadyWrapper,
    });

    const createResult = await result.current.createPage();

    expect(createResult.page).toBeNull();
    expect(createResult.error?.message).toBe('Database not ready');
  });
});
