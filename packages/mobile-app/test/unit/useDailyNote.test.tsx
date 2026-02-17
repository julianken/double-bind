/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import type { ReactNode } from 'react';
import { useDailyNote } from '../../src/hooks/useDailyNote';
import { DatabaseContext } from '../../src/providers/DatabaseProvider';
import type { Database, Page } from '@double-bind/types';

describe('useDailyNote', () => {
  let mockDb: Database;

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
    } as unknown as Database;
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

    const initialCallCount = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.length;

    // Call refetch
    result.current.refetch();

    await waitForNextUpdate();

    // Should have made at least one more call after refetch
    const newCallCount = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(newCallCount).toBeGreaterThan(initialCallCount);
  });

  it('should fetch new daily note when date changes', async () => {
    const mockPage1 = {
      ...mockPage,
      pageId: 'page-1',
      title: '2026-02-09',
      dailyNoteDate: '2026-02-09',
    };
    const mockPage2 = {
      ...mockPage,
      pageId: 'page-2',
      title: '2026-02-10',
      dailyNoteDate: '2026-02-10',
    };

    // getByDailyNoteDate makes 2 queries: lookup in daily_notes, then getById
    // We need to return the correct sequence for each date
    let currentDate = '2026-02-09';

    (mockDb.query as ReturnType<typeof vi.fn>).mockImplementation(
      (script: string, params?: Record<string, unknown>) => {
        // If params has a date, use it to determine which mock page to return
        if (params && 'date' in params) {
          currentDate = params.date as string;
        }

        // First query is the daily_notes lookup - return the page_id
        if (script.includes('*daily_notes')) {
          const pageId = currentDate === '2026-02-09' ? mockPage1.pageId : mockPage2.pageId;
          return Promise.resolve({
            headers: ['page_id'],
            rows: [[pageId]],
          });
        }

        // Second query is getById - return the full page data
        if (script.includes('*pages')) {
          const page = currentDate === '2026-02-09' ? mockPage1 : mockPage2;
          return Promise.resolve({
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
                page.pageId,
                page.title,
                page.createdAt,
                page.updatedAt,
                page.isDeleted,
                page.dailyNoteDate,
              ],
            ],
          });
        }

        // Default response for any other queries
        return Promise.resolve({ headers: [], rows: [] });
      }
    );

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
