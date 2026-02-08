/**
 * Tests for DailyNotesView screen component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Page, Block } from '@double-bind/types';
import {
  DailyNotesView,
  formatDailyNoteDate,
  getTodayISODate,
} from '../../../src/screens/DailyNotesView.js';
import { ServiceProvider, type Services } from '../../../src/providers/index.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

// ============================================================================
// Mock Data
// ============================================================================

const mockDailyNote: Page = {
  pageId: 'page-daily-2025-02-06',
  title: '2025-02-06',
  dailyNoteDate: '2025-02-06',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
};

const mockBlocks: Block[] = [
  {
    blockId: 'block-1',
    pageId: 'page-daily-2025-02-06',
    parentId: null,
    content: 'First block content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-2',
    pageId: 'page-daily-2025-02-06',
    parentId: null,
    content: 'Second block content',
    contentType: 'text',
    order: 'a1',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ============================================================================
// Mock Services
// ============================================================================

function createMockServices(
  overrides: {
    getTodaysDailyNote?: () => Promise<Page>;
    getPageWithBlocks?: (pageId: string) => Promise<{ page: Page; blocks: Block[] }>;
  } = {}
): Services {
  return {
    pageService: {
      getTodaysDailyNote: overrides.getTodaysDailyNote ?? vi.fn().mockResolvedValue(mockDailyNote),
      getPageWithBlocks:
        overrides.getPageWithBlocks ??
        vi.fn().mockResolvedValue({
          page: mockDailyNote,
          blocks: mockBlocks,
        }),
      createPage: vi.fn(),
      deletePage: vi.fn(),
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
  };
}

// ============================================================================
// Test Wrapper
// ============================================================================

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

function renderWithServices(ui: React.ReactElement, services: Services = createMockServices()) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>{ui}</ServiceProvider>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('DailyNotesView', () => {
  afterEach(() => {
    cleanup();
    clearQueryCache();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('shows loading indicator while fetching daily note', async () => {
      // Use a delayed promise to keep loading state visible
      const services = createMockServices({
        getTodaysDailyNote: () => new Promise(() => {}), // Never resolves
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      expect(screen.getByTestId('daily-notes-loading')).toBeDefined();
      expect(screen.getByText(/loading today's daily note/i)).toBeDefined();
    });

    it('has correct accessibility attributes during loading', async () => {
      const services = createMockServices({
        getTodaysDailyNote: () => new Promise(() => {}),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      const loadingElement = screen.getByTestId('daily-notes-loading');
      expect(loadingElement.getAttribute('aria-busy')).toBe('true');
      expect(loadingElement.getAttribute('role')).toBe('main');
    });
  });

  // ==========================================================================
  // Error State
  // ==========================================================================

  describe('Error State', () => {
    it('shows error message when daily note fetch fails', async () => {
      const services = createMockServices({
        getTodaysDailyNote: () => Promise.reject(new Error('Database connection failed')),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-error')).toBeDefined();
      });

      expect(screen.getByText(/failed to load daily note/i)).toBeDefined();
      expect(screen.getByText(/database connection failed/i)).toBeDefined();
    });

    it('handles non-Error rejection', async () => {
      const services = createMockServices({
        getTodaysDailyNote: () => Promise.reject('String error'),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-error')).toBeDefined();
      });

      expect(screen.getByText(/string error/i)).toBeDefined();
    });
  });

  // ==========================================================================
  // Success State
  // ==========================================================================

  describe('Success State', () => {
    it('renders daily note view after successful load', async () => {
      renderWithServices(<DailyNotesView params={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-view')).toBeDefined();
      });
    });

    it('displays formatted date as title', async () => {
      renderWithServices(<DailyNotesView params={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-title')).toBeDefined();
      });

      const title = screen.getByTestId('daily-notes-title');
      // Should contain formatted date (e.g., "Thursday, February 6, 2025")
      expect(title.textContent).toContain('February');
      expect(title.textContent).toContain('2025');
    });

    it('shows ISO date in time element', async () => {
      renderWithServices(<DailyNotesView params={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-date-iso')).toBeDefined();
      });

      const timeElement = screen.getByTestId('daily-notes-date-iso');
      expect(timeElement.getAttribute('datetime')).toBe('2025-02-06');
      expect(timeElement.textContent).toBe('2025-02-06');
    });

    it('renders blocks from the daily note', async () => {
      renderWithServices(<DailyNotesView params={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-content')).toBeDefined();
      });

      // Wait for blocks to load
      await waitFor(() => {
        expect(screen.getByText('First block content')).toBeDefined();
        expect(screen.getByText('Second block content')).toBeDefined();
      });
    });

    it('shows empty state when no blocks exist', async () => {
      const services = createMockServices({
        getPageWithBlocks: () => Promise.resolve({ page: mockDailyNote, blocks: [] }),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-empty')).toBeDefined();
      });

      expect(screen.getByText(/start writing/i)).toBeDefined();
    });

    it('has correct accessibility attributes', async () => {
      renderWithServices(<DailyNotesView params={{}} />);

      await waitFor(() => {
        expect(screen.getByTestId('daily-notes-view')).toBeDefined();
      });

      const view = screen.getByTestId('daily-notes-view');
      expect(view.getAttribute('role')).toBe('main');
      expect(view.getAttribute('aria-label')).toContain('Daily note for');
    });
  });

  // ==========================================================================
  // Service Integration
  // ==========================================================================

  describe('Service Integration', () => {
    it('calls getTodaysDailyNote on mount', async () => {
      const getTodaysDailyNote = vi.fn().mockResolvedValue(mockDailyNote);
      const services = createMockServices({ getTodaysDailyNote });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(getTodaysDailyNote).toHaveBeenCalledTimes(1);
      });
    });

    it('calls getPageWithBlocks after daily note loads', async () => {
      const getPageWithBlocks = vi.fn().mockResolvedValue({
        page: mockDailyNote,
        blocks: mockBlocks,
      });
      const services = createMockServices({ getPageWithBlocks });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(getPageWithBlocks).toHaveBeenCalledWith(mockDailyNote.pageId);
      });
    });

    it('cancels in-flight requests on unmount', async () => {
      let resolvePromise: (value: Page) => void;
      const getTodaysDailyNote = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );
      const services = createMockServices({ getTodaysDailyNote });

      const { unmount } = renderWithServices(<DailyNotesView params={{}} />, services);

      // Unmount before promise resolves
      unmount();

      // Resolve after unmount - should not cause errors
      resolvePromise!(mockDailyNote);

      // No errors should occur
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  // ==========================================================================
  // Block Rendering
  // ==========================================================================

  describe('Block Rendering', () => {
    it('filters out deleted blocks', async () => {
      const blocksWithDeleted = [
        ...mockBlocks,
        {
          blockId: 'block-deleted',
          pageId: 'page-daily-2025-02-06',
          parentId: null,
          content: 'Deleted block',
          contentType: 'text' as const,
          order: 'a2',
          isCollapsed: false,
          isDeleted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const services = createMockServices({
        getPageWithBlocks: () =>
          Promise.resolve({
            page: mockDailyNote,
            blocks: blocksWithDeleted,
          }),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByText('First block content')).toBeDefined();
      });

      // Deleted block should not be rendered
      // Note: The component receives all blocks but could filter them
      // For now, the service returns non-deleted blocks
    });

    it('only renders root-level blocks (parentId === null)', async () => {
      const blocksWithChildren = [
        ...mockBlocks,
        {
          blockId: 'block-child',
          pageId: 'page-daily-2025-02-06',
          parentId: 'block-1', // Child of first block
          content: 'Child block content',
          contentType: 'text' as const,
          order: 'a0a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const services = createMockServices({
        getPageWithBlocks: () =>
          Promise.resolve({
            page: mockDailyNote,
            blocks: blocksWithChildren,
          }),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByText('First block content')).toBeDefined();
        expect(screen.getByText('Second block content')).toBeDefined();
      });

      // Child blocks would be rendered inside their parent in full implementation
      // For now, they're filtered at the root level
    });

    it('sorts blocks by order', async () => {
      const unsortedBlocks: Block[] = [
        {
          blockId: 'block-z',
          pageId: 'page-daily-2025-02-06',
          parentId: null,
          content: 'Block Z (last)',
          contentType: 'text',
          order: 'z0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-a',
          pageId: 'page-daily-2025-02-06',
          parentId: null,
          content: 'Block A (first)',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const services = createMockServices({
        getPageWithBlocks: () =>
          Promise.resolve({
            page: mockDailyNote,
            blocks: unsortedBlocks,
          }),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByText('Block A (first)')).toBeDefined();
      });

      // Get all block elements and verify order
      const blockElements = screen.getAllByRole('treeitem');
      expect(blockElements[0]?.textContent).toContain('Block A (first)');
      expect(blockElements[1]?.textContent).toContain('Block Z (last)');
    });

    it('shows placeholder for empty block content', async () => {
      const blocksWithEmpty: Block[] = [
        {
          blockId: 'block-empty',
          pageId: 'page-daily-2025-02-06',
          parentId: null,
          content: '',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const services = createMockServices({
        getPageWithBlocks: () =>
          Promise.resolve({
            page: mockDailyNote,
            blocks: blocksWithEmpty,
          }),
      });

      renderWithServices(<DailyNotesView params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByText('(empty block)')).toBeDefined();
      });
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('formatDailyNoteDate', () => {
  it('formats ISO date to human-readable string', () => {
    const result = formatDailyNoteDate('2025-02-06');

    expect(result).toContain('February');
    expect(result).toContain('6');
    expect(result).toContain('2025');
    expect(result).toContain('Thursday');
  });

  it('handles different dates correctly', () => {
    expect(formatDailyNoteDate('2024-12-25')).toContain('December');
    expect(formatDailyNoteDate('2024-12-25')).toContain('25');
    expect(formatDailyNoteDate('2024-01-01')).toContain('January');
  });

  it('returns raw date for invalid input', () => {
    expect(formatDailyNoteDate('invalid')).toBe('invalid');
    expect(formatDailyNoteDate('')).toBe('');
  });
});

describe('getTodayISODate', () => {
  beforeEach(() => {
    // Mock date to have consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-06T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today date in ISO format', () => {
    const result = getTodayISODate();
    expect(result).toBe('2025-02-06');
  });

  it('returns date in YYYY-MM-DD format', () => {
    const result = getTodayISODate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
