/**
 * Unit tests for useNeighborhood hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useNeighborhood } from '../../../src/hooks/useNeighborhood.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import type { PageService, BlockService, GraphService, GraphResult } from '@double-bind/core';
import type { Page, Link } from '@double-bind/types';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

// ============================================================================
// Mocks
// ============================================================================

const mockPage1: Page = {
  pageId: 'page-1',
  title: 'Current Page',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
  dailyNoteDate: null,
};

const mockPage2: Page = {
  pageId: 'page-2',
  title: 'Linked Page A',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
  dailyNoteDate: null,
};

const mockPage3: Page = {
  pageId: 'page-3',
  title: 'Linked Page B',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
  dailyNoteDate: null,
};

const mockLink1: Link = {
  sourceId: 'page-1',
  targetId: 'page-2',
  linkType: 'reference',
  createdAt: Date.now(),
  contextBlockId: null,
};

const mockLink2: Link = {
  sourceId: 'page-1',
  targetId: 'page-3',
  linkType: 'reference',
  createdAt: Date.now(),
  contextBlockId: null,
};

const mockNeighborhoodResult: GraphResult = {
  nodes: [mockPage1, mockPage2, mockPage3],
  edges: [mockLink1, mockLink2],
};

const createMockGraphService = () => ({
  getNeighborhood: vi.fn().mockResolvedValue(mockNeighborhoodResult),
  getFullGraph: vi.fn(),
  getPageRank: vi.fn(),
  getCommunities: vi.fn(),
  getSuggestedLinks: vi.fn(),
});

const mockPageService = {} as PageService;
const mockBlockService = {} as BlockService;

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper(graphService: Partial<GraphService>) {
  const services: Services = {
    pageService: mockPageService,
    blockService: mockBlockService,
    graphService: graphService as GraphService,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient();
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ServiceProvider, { services }, children)
    );
  };
}

describe('useNeighborhood', () => {
  let mockGraphService: ReturnType<typeof createMockGraphService>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();
    mockGraphService = createMockGraphService();
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('returns empty arrays and loading=false when pageId is null', () => {
      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood(null, 2), { wrapper });

      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('does not call graphService when pageId is null', () => {
      const wrapper = createWrapper(mockGraphService);
      renderHook(() => useNeighborhood(null, 2), { wrapper });

      expect(mockGraphService.getNeighborhood).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Successful Data Fetching
  // ============================================================================

  describe('Successful Data Fetching', () => {
    it('fetches neighborhood data when pageId is provided', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood('page-1', 2), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-1', 2);
    });

    it('transforms Page[] to MiniGraphNode[]', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood('page-1', 2), { wrapper });

      await waitFor(() => {
        expect(result.current.nodes).toHaveLength(3);
      });

      expect(result.current.nodes).toEqual([
        { id: 'page-1', title: 'Current Page' },
        { id: 'page-2', title: 'Linked Page A' },
        { id: 'page-3', title: 'Linked Page B' },
      ]);
    });

    it('transforms Link[] to MiniGraphEdge[]', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood('page-1', 2), { wrapper });

      await waitFor(() => {
        expect(result.current.edges).toHaveLength(2);
      });

      expect(result.current.edges).toEqual([
        { source: 'page-1', target: 'page-2' },
        { source: 'page-1', target: 'page-3' },
      ]);
    });

    it('respects the hops parameter', async () => {
      const wrapper = createWrapper(mockGraphService);
      renderHook(() => useNeighborhood('page-1', 3), { wrapper });

      await waitFor(() => {
        expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-1', 3);
      });
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('sets isLoading to true while fetching', async () => {
      let resolvePromise: ((result: GraphResult) => void) | null = null;
      mockGraphService.getNeighborhood.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood('page-1', 2), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise?.(mockNeighborhoodResult);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('isLoading is false when pageId is null', () => {
      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood(null, 2), { wrapper });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // Page Changes
  // ============================================================================

  describe('Page Changes', () => {
    it('refetches when pageId changes', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result, rerender } = renderHook(({ pageId }) => useNeighborhood(pageId, 2), {
        wrapper,
        initialProps: { pageId: 'page-1' },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-1', 2);

      // Change pageId
      rerender({ pageId: 'page-2' });

      await waitFor(() => {
        expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-2', 2);
      });
    });

    it('returns empty when pageId changes to null', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result, rerender } = renderHook(({ pageId }) => useNeighborhood(pageId, 2), {
        wrapper,
        initialProps: { pageId: 'page-1' as string | null },
      });

      await waitFor(() => {
        expect(result.current.nodes).toHaveLength(3);
      });

      // Change to null
      rerender({ pageId: null });

      // Should return empty arrays
      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // Empty Results
  // ============================================================================

  describe('Empty Results', () => {
    it('handles isolated page (no connections)', async () => {
      mockGraphService.getNeighborhood.mockResolvedValue({
        nodes: [mockPage1],
        edges: [],
      });

      const wrapper = createWrapper(mockGraphService);
      const { result } = renderHook(() => useNeighborhood('page-1', 2), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.edges).toHaveLength(0);
    });
  });

  // ============================================================================
  // Hops Parameter
  // ============================================================================

  describe('Hops Parameter', () => {
    it('refetches when hops changes', async () => {
      const wrapper = createWrapper(mockGraphService);
      const { result, rerender } = renderHook(({ hops }) => useNeighborhood('page-1', hops), {
        wrapper,
        initialProps: { hops: 1 },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-1', 1);

      // Change hops
      rerender({ hops: 3 });

      await waitFor(() => {
        expect(mockGraphService.getNeighborhood).toHaveBeenCalledWith('page-1', 3);
      });
    });
  });
});
