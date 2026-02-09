/**
 * Tests for usePaginatedQuery hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { usePaginatedQuery } from '../../src/pagination/usePaginatedQuery';
import type { PageFetcher, PaginatedResult } from '@double-bind/types';

describe('usePaginatedQuery', () => {
  type TestItem = { id: string; name: string };

  let mockFetcher: PageFetcher<TestItem>;

  beforeEach(() => {
    mockFetcher = vi.fn() as unknown as PageFetcher<TestItem>;
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(true);
    expect(result.current.cursor).toBeNull();
    expect(result.current.loadedCount).toBe(0);
    expect(result.current.isInitialLoad).toBe(true);
  });

  it('should fetch first page', async () => {
    const mockResult: PaginatedResult<TestItem> = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      totalCount: null,
      nextCursor: 'cursor-2',
      hasMore: true,
      pageSize: 20,
    };

    mockFetcher.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher, { pageSize: 20 }));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(mockResult.items);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.cursor).toBe('cursor-2');
    expect(result.current.loadedCount).toBe(2);
    expect(result.current.isInitialLoad).toBe(false);
    expect(mockFetcher).toHaveBeenCalledWith({ pageSize: 20, cursor: undefined });
  });

  it('should fetch multiple pages', async () => {
    const page1: PaginatedResult<TestItem> = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      totalCount: null,
      nextCursor: 'cursor-2',
      hasMore: true,
      pageSize: 20,
    };

    const page2: PaginatedResult<TestItem> = {
      items: [
        { id: '3', name: 'Item 3' },
        { id: '4', name: 'Item 4' },
      ],
      totalCount: null,
      nextCursor: 'cursor-4',
      hasMore: true,
      pageSize: 20,
    };

    mockFetcher.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher, { pageSize: 20 }));

    // Fetch first page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);

    // Fetch second page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[2]).toEqual({ id: '3', name: 'Item 3' });
    expect(result.current.cursor).toBe('cursor-4');
    expect(mockFetcher).toHaveBeenNthCalledWith(2, { pageSize: 20, cursor: 'cursor-2' });
  });

  it('should handle last page', async () => {
    const lastPage: PaginatedResult<TestItem> = {
      items: [{ id: '5', name: 'Item 5' }],
      totalCount: null,
      nextCursor: null,
      hasMore: false,
      pageSize: 20,
    };

    mockFetcher.mockResolvedValueOnce(lastPage);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.cursor).toBeNull();
  });

  it('should not fetch if already loading', async () => {
    const page: PaginatedResult<TestItem> = {
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: 'cursor-1',
      hasMore: true,
      pageSize: 20,
    };

    mockFetcher.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(page), 100))
    );

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    // Start first fetch
    act(() => {
      void result.current.fetchNextPage();
    });

    // Try to start second fetch immediately
    act(() => {
      void result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should only call fetcher once
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('should not fetch if hasMore is false', async () => {
    mockFetcher.mockResolvedValueOnce({
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: null,
      hasMore: false,
      pageSize: 20,
    });

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    // Fetch first (and only) page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Try to fetch again
    await act(async () => {
      await result.current.fetchNextPage();
    });

    // Should only call fetcher once
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    const error = new Error('Fetch failed');
    mockFetcher.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.items).toEqual([]);
  });

  it('should reset state', async () => {
    mockFetcher.mockResolvedValueOnce({
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: 'cursor-1',
      hasMore: true,
      pageSize: 20,
    });

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    // Fetch a page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.cursor).toBeNull();
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isInitialLoad).toBe(true);
  });

  it('should refresh data', async () => {
    const page1: PaginatedResult<TestItem> = {
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: 'cursor-1',
      hasMore: true,
      pageSize: 20,
    };

    const page2: PaginatedResult<TestItem> = {
      items: [{ id: '2', name: 'Item 2' }],
      totalCount: null,
      nextCursor: 'cursor-2',
      hasMore: true,
      pageSize: 20,
    };

    mockFetcher.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    // Fetch initial page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(page1.items);

    // Refresh
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(page2.items);
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('should retry after error', async () => {
    const error = new Error('Fetch failed');
    const page: PaginatedResult<TestItem> = {
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: 'cursor-1',
      hasMore: true,
      pageSize: 20,
    };

    mockFetcher.mockRejectedValueOnce(error).mockResolvedValueOnce(page);

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher));

    // First fetch fails
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);

    // Retry
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual(page.items);
  });

  it('should use custom page size', async () => {
    mockFetcher.mockResolvedValueOnce({
      items: [{ id: '1', name: 'Item 1' }],
      totalCount: null,
      nextCursor: null,
      hasMore: false,
      pageSize: 50,
    });

    const { result } = renderHook(() => usePaginatedQuery(mockFetcher, { pageSize: 50 }));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith({ pageSize: 50, cursor: undefined });
  });

  it('should use initial cursor', async () => {
    mockFetcher.mockResolvedValueOnce({
      items: [{ id: '5', name: 'Item 5' }],
      totalCount: null,
      nextCursor: 'cursor-5',
      hasMore: true,
      pageSize: 20,
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(mockFetcher, { cursor: 'cursor-4', pageSize: 20 })
    );

    expect(result.current.cursor).toBe('cursor-4');

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith({ pageSize: 20, cursor: 'cursor-4' });
    expect(result.current.cursor).toBe('cursor-5');
  });
});
