/**
 * Unit tests for useBacklinks hook
 *
 * Tests the hook that fetches and formats backlinks for a page.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Block, Page } from '@double-bind/types';
import { useBacklinks } from '../../../src/hooks/useBacklinks.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

// ============================================================================
// Mock Data
// ============================================================================

const mockPage: Page = {
  pageId: 'page-1',
  title: 'Test Page',
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
  isDeleted: false,
  dailyNoteDate: null,
};

const mockSourcePage: Page = {
  pageId: 'source-page-1',
  title: 'Source Page',
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
  isDeleted: false,
  dailyNoteDate: null,
};

const mockSourcePage2: Page = {
  pageId: 'source-page-2',
  title: 'Another Source',
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
  isDeleted: false,
  dailyNoteDate: null,
};

const mockBacklinkBlock: Block = {
  blockId: 'backlink-block-1',
  pageId: 'source-page-1',
  parentId: null,
  content: 'This links to [[Test Page]]',
  contentType: 'text',
  order: 'a0',
  isCollapsed: false,
  isDeleted: false,
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
};

const mockBacklinkBlock2: Block = {
  blockId: 'backlink-block-2',
  pageId: 'source-page-2',
  parentId: null,
  content: 'Also references [[Test Page]] here',
  contentType: 'text',
  order: 'a0',
  isCollapsed: false,
  isDeleted: false,
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
};

// Mock PageBacklink type matches what PageService.getPageBacklinks returns
interface MockPageBacklink {
  block: Block;
  page: Page;
}

const mockBacklinks: MockPageBacklink[] = [
  { block: mockBacklinkBlock, page: mockSourcePage },
  { block: mockBacklinkBlock2, page: mockSourcePage2 },
];

// ============================================================================
// Mock Services Factory
// ============================================================================

function createMockServices(overrides?: Partial<Services>): Services {
  return {
    pageService: {
      getPageWithBlocks: vi.fn().mockResolvedValue({ page: mockPage, blocks: [] }),
      getPageBacklinks: vi.fn().mockResolvedValue(mockBacklinks),
      createPage: vi.fn(),
      deletePage: vi.fn(),
      getTodaysDailyNote: vi.fn(),
      searchPages: vi.fn(),
    } as unknown as Services['pageService'],
    blockService: {
      updateContent: vi.fn(),
      createBlock: vi.fn(),
      deleteBlock: vi.fn(),
      moveBlock: vi.fn(),
      indentBlock: vi.fn(),
      outdentBlock: vi.fn(),
      toggleCollapse: vi.fn(),
      getBacklinks: vi.fn(),
    } as unknown as Services['blockService'],
    ...overrides,
  };
}

// ============================================================================
// Test Wrapper
// ============================================================================

function createWrapper(services: Services) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient();
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ServiceProvider, { services }, children)
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useBacklinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
  });

  // ==========================================================================
  // Basic Functionality
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('returns linkedRefs from pageService.getPageBacklinks()', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify linkedRefs are populated
      expect(result.current.linkedRefs).toHaveLength(2);
      expect(result.current.linkedRefs[0]).toEqual({
        block: mockBacklinkBlock,
        page: mockSourcePage,
      });
      expect(result.current.linkedRefs[1]).toEqual({
        block: mockBacklinkBlock2,
        page: mockSourcePage2,
      });

      // Verify service was called with correct pageId
      expect(services.pageService.getPageBacklinks).toHaveBeenCalledWith('page-1');
    });

    it('returns isLoading: true while fetching', async () => {
      const services = createMockServices();

      // Make the service return a promise that never resolves (to keep loading state)
      (services.pageService.getPageBacklinks as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      // Initial state should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.linkedRefs).toEqual([]);
      expect(result.current.unlinkedRefs).toEqual([]);
    });

    it('returns empty arrays when no backlinks exist', async () => {
      const services = createMockServices();
      (services.pageService.getPageBacklinks as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.linkedRefs).toEqual([]);
      expect(result.current.unlinkedRefs).toEqual([]);
    });

    it('always returns empty unlinkedRefs (not yet implemented)', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Even with linked refs, unlinked refs should always be empty
      expect(result.current.linkedRefs.length).toBeGreaterThan(0);
      expect(result.current.unlinkedRefs).toEqual([]);
    });
  });

  // ==========================================================================
  // Query Key and Caching
  // ==========================================================================

  describe('Query Key and Caching', () => {
    it('uses unique query key per pageId', async () => {
      const services = createMockServices();

      // First render with page-1
      const { result: result1 } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(services.pageService.getPageBacklinks).toHaveBeenCalledWith('page-1');

      // Second render with page-2
      const { result: result2 } = renderHook(() => useBacklinks('page-2'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(services.pageService.getPageBacklinks).toHaveBeenCalledWith('page-2');
      expect(services.pageService.getPageBacklinks).toHaveBeenCalledTimes(2);
    });

    it('re-fetches when pageId changes', async () => {
      const services = createMockServices();

      const { result, rerender } = renderHook(({ pageId }) => useBacklinks(pageId), {
        wrapper: createWrapper(services),
        initialProps: { pageId: 'page-1' },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(services.pageService.getPageBacklinks).toHaveBeenCalledTimes(1);

      // Change pageId
      rerender({ pageId: 'page-2' });

      await waitFor(() => {
        expect(services.pageService.getPageBacklinks).toHaveBeenCalledTimes(2);
      });

      expect(services.pageService.getPageBacklinks).toHaveBeenCalledWith('page-2');
    });
  });

  // ==========================================================================
  // Data Transformation
  // ==========================================================================

  describe('Data Transformation', () => {
    it('transforms PageBacklink[] to LinkedRef[] format', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify structure matches LinkedRef interface
      for (const ref of result.current.linkedRefs) {
        expect(ref).toHaveProperty('block');
        expect(ref).toHaveProperty('page');
        expect(ref.block).toHaveProperty('blockId');
        expect(ref.block).toHaveProperty('content');
        expect(ref.page).toHaveProperty('pageId');
        expect(ref.page).toHaveProperty('title');
      }
    });

    it('preserves block and page data integrity', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstRef = result.current.linkedRefs[0]!;

      // Verify block data is complete
      expect(firstRef.block.blockId).toBe('backlink-block-1');
      expect(firstRef.block.content).toBe('This links to [[Test Page]]');
      expect(firstRef.block.pageId).toBe('source-page-1');

      // Verify page data is complete
      expect(firstRef.page.pageId).toBe('source-page-1');
      expect(firstRef.page.title).toBe('Source Page');
    });
  });

  // ==========================================================================
  // Enabled State
  // ==========================================================================

  describe('Enabled State', () => {
    it('does not fetch when pageId is empty string', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('' as unknown as string), {
        wrapper: createWrapper(services),
      });

      // With enabled: !!pageId (which is false for empty string), it should not fetch
      expect(result.current.isLoading).toBe(false);
      expect(result.current.linkedRefs).toEqual([]);
      expect(services.pageService.getPageBacklinks).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Return Type
  // ==========================================================================

  describe('Return Type', () => {
    it('returns UseBacklinksResult shape', async () => {
      const services = createMockServices();

      const { result } = renderHook(() => useBacklinks('page-1'), {
        wrapper: createWrapper(services),
      });

      // Check return type has all expected properties
      expect(result.current).toHaveProperty('linkedRefs');
      expect(result.current).toHaveProperty('unlinkedRefs');
      expect(result.current).toHaveProperty('isLoading');

      // Verify types
      expect(Array.isArray(result.current.linkedRefs)).toBe(true);
      expect(Array.isArray(result.current.unlinkedRefs)).toBe(true);
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });
});
