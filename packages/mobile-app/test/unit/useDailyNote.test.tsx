/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useDailyNote } from '../../src/hooks/useDailyNote';
import { DatabaseContext } from '../../src/providers/DatabaseProvider';
import type { GraphDB, Page } from '@double-bind/types';

describe('useDailyNote', () => {
  let mockDb: GraphDB;

  const mockPage: Page = {
    pageId: 'test-page-id',
    title: '2026-02-09',
    createdAt: 1707494400000,
    updatedAt: 1707494400000,
    isDeleted: false,
    dailyNoteDate: '2026-02-09',
  };

  beforeEach(() => {
    // Create mock database with query method
    mockDb = {
      query: vi.fn(),
      mutate: vi.fn(),
      close: vi.fn(),
      export: vi.fn(),
      importRelations: vi.fn(),
    } as unknown as GraphDB;
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

  it('should fetch daily note for given date', async () => {
    // Mock the database query to return a page
    (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
      rows: [
        [
          mockPage.pageId,
          mockPage.title,
          mockPage.createdAt,
          mockPage.updatedAt,
          mockPage.isDeleted,
          mockPage.dailyNoteDate,
        ],
      ],
    });

    const { result, waitForNextUpdate } = renderHook(() => useDailyNote('2026-02-09'), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dailyNote).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for data to load
    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.dailyNote).toEqual(mockPage);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const errorMessage = 'Database connection failed';
    (mockDb.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useDailyNote('2026-02-09'), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.dailyNote).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  it('should refetch daily note when refetch is called', async () => {
    (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
      rows: [
        [
          mockPage.pageId,
          mockPage.title,
          mockPage.createdAt,
          mockPage.updatedAt,
          mockPage.isDeleted,
          mockPage.dailyNoteDate,
        ],
      ],
    });

    const { result, waitForNextUpdate } = renderHook(() => useDailyNote('2026-02-09'), {
      wrapper: createWrapper(),
    });

    await waitForNextUpdate();

    expect(mockDb.query).toHaveBeenCalledTimes(1);

    // Call refetch
    result.current.refetch();

    await waitForNextUpdate();
    expect(mockDb.query).toHaveBeenCalledTimes(2);
  });

  it('should fetch new daily note when date changes', async () => {
    const mockPage1 = { ...mockPage, pageId: 'page-1', title: '2026-02-09' };
    const mockPage2 = { ...mockPage, pageId: 'page-2', title: '2026-02-10' };

    (mockDb.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [
          [
            mockPage1.pageId,
            mockPage1.title,
            mockPage1.createdAt,
            mockPage1.updatedAt,
            mockPage1.isDeleted,
            mockPage1.dailyNoteDate,
          ],
        ],
      })
      .mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [
          [
            mockPage2.pageId,
            mockPage2.title,
            mockPage2.createdAt,
            mockPage2.updatedAt,
            mockPage2.isDeleted,
            mockPage2.dailyNoteDate,
          ],
        ],
      });

    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ date }: { date: string }) => useDailyNote(date),
      {
        wrapper: createWrapper(),
        initialProps: { date: '2026-02-09' },
      }
    );

    await waitForNextUpdate();

    expect(result.current.dailyNote).toEqual(mockPage1);

    // Change date
    rerender({ date: '2026-02-10' });

    await waitForNextUpdate();

    expect(result.current.dailyNote).toEqual(mockPage2);
  });

  it('should not fetch when database is not ready', () => {
    function NotReadyWrapper({ children }: { children: ReactNode }) {
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

    const { result } = renderHook(() => useDailyNote('2026-02-09'), {
      wrapper: NotReadyWrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.dailyNote).toBeNull();
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should cleanup on unmount', async () => {
    (mockDb.query as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                headers: [
                  'page_id',
                  'title',
                  'created_at',
                  'updated_at',
                  'is_deleted',
                  'daily_note_date',
                ],
                rows: [
                  [
                    mockPage.pageId,
                    mockPage.title,
                    mockPage.createdAt,
                    mockPage.updatedAt,
                    mockPage.isDeleted,
                    mockPage.dailyNoteDate,
                  ],
                ],
              }),
            100
          );
        })
    );

    const { result, unmount } = renderHook(() => useDailyNote('2026-02-09'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    // Unmount before promise resolves
    unmount();

    // Wait to ensure promise would have resolved
    await new Promise((resolve) => setTimeout(resolve, 150));

    // State should not update after unmount
    expect(result.current.isLoading).toBe(true);
  });
});
