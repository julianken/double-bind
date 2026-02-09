/**
 * Tests for useGraphData hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useGraphData } from '../../../src/hooks/useGraphData';
import { DatabaseContext, type DatabaseContextValue } from '../../../src/providers/DatabaseProvider';
import type { MobileGraphDB } from '@double-bind/mobile';

// Mock database
const mockQuery = vi.fn();
const mockDb: MobileGraphDB = {
  query: mockQuery,
} as unknown as MobileGraphDB;

// Test wrapper that provides database context
function createWrapper(dbStatus: 'initializing' | 'ready' | 'error' = 'ready') {
  const contextValue: DatabaseContextValue = {
    db: dbStatus === 'ready' ? mockDb : null,
    status: dbStatus,
    error: dbStatus === 'error' ? 'Test error' : null,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );
  };
}

describe('useGraphData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('full graph mode', () => {
    it('should fetch all pages and links', async () => {
      // Setup mock responses
      mockQuery
        .mockResolvedValueOnce({
          // Pages query
          rows: [
            ['page-1', 'Page One'],
            ['page-2', 'Page Two'],
            ['page-3', 'Page Three'],
          ],
        })
        .mockResolvedValueOnce({
          // Links query
          rows: [
            ['page-1', 'page-2'],
            ['page-2', 'page-3'],
          ],
        });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Check results
      expect(result.current.nodes).toEqual([
        { id: 'page-1', title: 'Page One' },
        { id: 'page-2', title: 'Page Two' },
        { id: 'page-3', title: 'Page Three' },
      ]);

      expect(result.current.edges).toEqual([
        { source: 'page-1', target: 'page-2' },
        { source: 'page-2', target: 'page-3' },
      ]);

      expect(result.current.error).toBe(null);
    });

    it('should detect bidirectional links', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'Page One'],
            ['page-2', 'Page Two'],
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'page-2'],
            ['page-2', 'page-1'], // Bidirectional
          ],
        });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // First edge should be marked as bidirectional
      expect(result.current.edges).toEqual([
        { source: 'page-1', target: 'page-2', isBidirectional: true },
      ]);
    });

    it('should handle empty database', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it('should handle query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database query failed'));

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Database query failed');
    });
  });

  describe('local graph mode', () => {
    it('should fetch neighborhood for center page', async () => {
      mockQuery
        .mockResolvedValueOnce({
          // Neighborhood pages
          rows: [
            ['page-1', 'Center Page'],
            ['page-2', 'Connected Page'],
          ],
        })
        .mockResolvedValueOnce({
          // Links between neighborhood pages
          rows: [['page-1', 'page-2']],
        });

      const { result } = renderHook(
        () =>
          useGraphData({
            mode: 'local',
            centerPageId: 'page-1',
            depth: 1,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nodes).toEqual([
        { id: 'page-1', title: 'Center Page' },
        { id: 'page-2', title: 'Connected Page' },
      ]);

      expect(result.current.edges).toEqual([{ source: 'page-1', target: 'page-2' }]);
    });

    it('should require centerPageId in local mode', async () => {
      const { result } = renderHook(
        () =>
          useGraphData({
            mode: 'local',
            // Missing centerPageId
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('centerPageId is required for local graph mode');
    });

    it('should use custom depth parameter', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      renderHook(
        () =>
          useGraphData({
            mode: 'local',
            centerPageId: 'page-1',
            depth: 2, // Custom depth
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(mockQuery).toHaveBeenCalled();
      });

      // Check that query includes depth = 2
      const queryCall = mockQuery.mock.calls[0][0] as string;
      expect(queryCall).toContain('prevDepth < 2');
      expect(queryCall).toContain('reachable[pageId, 2]');
    });
  });

  describe('database status handling', () => {
    it('should not query when database is initializing', async () => {
      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper('initializing'),
      });

      expect(result.current.loading).toBe(true);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper('error'),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Test error');
    });
  });

  describe('refresh functionality', () => {
    it('should refresh data when refresh is called', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockQuery.mock.calls.length;

      // Call refresh
      result.current.refresh();

      await waitFor(() => {
        expect(mockQuery.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('data validation', () => {
    it('should filter out invalid node rows', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'Valid Page'],
            null, // Invalid
            ['page-2'], // Missing title
            [123, 'Invalid ID'], // Wrong type
            ['page-3', 'Another Valid'],
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only valid rows should be included
      expect(result.current.nodes).toEqual([
        { id: 'page-1', title: 'Valid Page' },
        { id: 'page-3', title: 'Another Valid' },
      ]);
    });

    it('should filter out invalid edge rows', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'Page']],
        })
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'page-2'], // Valid
            null, // Invalid
            ['page-1'], // Missing target
            [123, 'page-2'], // Wrong type
          ],
        });

      const { result } = renderHook(() => useGraphData({ mode: 'full' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only valid edge should be included
      expect(result.current.edges).toEqual([{ source: 'page-1', target: 'page-2' }]);
    });
  });
});
