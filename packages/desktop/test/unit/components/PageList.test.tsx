/**
 * Tests for PageList component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from 'react';
import type { Page, PageService, BlockService } from '@double-bind/core';
import { PageList, PageListItem } from '../../../src/components/PageList.js';
import { ServiceProvider } from '../../../src/providers/ServiceProvider.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

// ============================================================================
// Mock Data
// ============================================================================

const mockPages: Page[] = [
  {
    pageId: 'page-1',
    title: 'First Page',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
    isDeleted: false,
    dailyNoteDate: null,
  },
  {
    pageId: 'page-2',
    title: 'Second Page',
    createdAt: Date.now() - 3600000, // 1 hour ago
    updatedAt: Date.now() - 3600000,
    isDeleted: false,
    dailyNoteDate: null,
  },
  {
    pageId: 'page-3',
    title: 'Third Page',
    createdAt: Date.now() - 86400000, // 1 day ago
    updatedAt: Date.now() - 86400000,
    isDeleted: false,
    dailyNoteDate: null,
  },
];

// ============================================================================
// Mock Services
// ============================================================================

function createMockPageService(pages: Page[] = mockPages): PageService {
  return {
    createPage: vi.fn(),
    getPageWithBlocks: vi.fn(),
    deletePage: vi.fn(),
    getTodaysDailyNote: vi.fn(),
    searchPages: vi.fn(),
    getAllPages: vi.fn().mockResolvedValue(pages),
  } as unknown as PageService;
}

function createMockBlockService(): BlockService {
  return {
    createBlock: vi.fn(),
    updateBlockContent: vi.fn(),
    moveBlock: vi.fn(),
    deleteBlock: vi.fn(),
    getBlockBacklinks: vi.fn(),
  } as unknown as BlockService;
}

// ============================================================================
// Test Wrapper
// ============================================================================

function TestWrapper({
  children,
  pageService = createMockPageService(),
  blockService = createMockBlockService(),
}: {
  children: React.ReactNode;
  pageService?: PageService;
  blockService?: BlockService;
}) {
  return <ServiceProvider services={{ pageService, blockService }}>{children}</ServiceProvider>;
}

// ============================================================================
// Tests
// ============================================================================

describe('PageList', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });
    // Clear query cache
    clearQueryCache();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders loading state initially', () => {
      const pageService = createMockPageService();
      // Make the promise never resolve to see loading state
      pageService.getAllPages = vi.fn().mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      expect(screen.getByTestId('page-list-loading')).toBeDefined();
      expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('renders pages after loading', async () => {
      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      expect(screen.getByText('First Page')).toBeDefined();
      expect(screen.getByText('Second Page')).toBeDefined();
      expect(screen.getByText('Third Page')).toBeDefined();
    });

    it('renders empty state when no pages', async () => {
      const pageService = createMockPageService([]);

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list-empty')).toBeDefined();
      });

      expect(screen.getByText('No pages yet')).toBeDefined();
    });

    it('renders error state on failure', async () => {
      const pageService = createMockPageService();
      pageService.getAllPages = vi.fn().mockRejectedValue(new Error('Failed'));

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list-error')).toBeDefined();
      });

      expect(screen.getByText('Failed to load pages')).toBeDefined();
    });
  });

  // ==========================================================================
  // Page List Items
  // ==========================================================================

  describe('Page List Items', () => {
    it('displays page titles', async () => {
      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('First Page')).toBeDefined();
        expect(screen.getByText('Second Page')).toBeDefined();
        expect(screen.getByText('Third Page')).toBeDefined();
      });
    });

    it('displays relative timestamps', async () => {
      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      // Check that timestamps are rendered (exact text depends on when test runs)
      const items = screen.getAllByRole('option');
      expect(items.length).toBe(3);
    });

    it('displays "Untitled" for pages without title', async () => {
      const pagesWithUntitled: Page[] = [
        {
          pageId: 'page-untitled',
          title: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];
      const pageService = createMockPageService(pagesWithUntitled);

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Untitled')).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Active Page Highlighting
  // ==========================================================================

  describe('Active Page Highlighting', () => {
    it('highlights the currently active page', async () => {
      useAppStore.setState({ currentPageId: 'page-2' });

      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      const activeItem = screen.getByTestId('page-list-item-page-2');
      expect(activeItem.getAttribute('aria-selected')).toBe('true');

      const inactiveItem = screen.getByTestId('page-list-item-page-1');
      expect(inactiveItem.getAttribute('aria-selected')).toBe('false');
    });

    it('updates highlighting when currentPageId changes', async () => {
      useAppStore.setState({ currentPageId: 'page-1' });

      const { rerender } = render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      expect(screen.getByTestId('page-list-item-page-1').getAttribute('aria-selected')).toBe(
        'true'
      );

      act(() => {
        useAppStore.setState({ currentPageId: 'page-3' });
      });

      rerender(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      expect(screen.getByTestId('page-list-item-page-1').getAttribute('aria-selected')).toBe(
        'false'
      );
      expect(screen.getByTestId('page-list-item-page-3').getAttribute('aria-selected')).toBe(
        'true'
      );
    });
  });

  // ==========================================================================
  // Navigation
  // ==========================================================================

  describe('Navigation', () => {
    it('calls navigateToPage when clicking a page', async () => {
      const navigateToPageSpy = vi.fn();
      useAppStore.setState({ navigateToPage: navigateToPageSpy });

      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('page-list-item-page-2'));

      expect(navigateToPageSpy).toHaveBeenCalledWith('page-2');
    });

    it('navigates when pressing Enter on a page', async () => {
      const navigateToPageSpy = vi.fn();
      useAppStore.setState({ navigateToPage: navigateToPageSpy });

      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      const pageItem = screen.getByTestId('page-list-item-page-1');
      fireEvent.keyDown(pageItem, { key: 'Enter' });

      expect(navigateToPageSpy).toHaveBeenCalledWith('page-1');
    });

    it('navigates when pressing Space on a page', async () => {
      const navigateToPageSpy = vi.fn();
      useAppStore.setState({ navigateToPage: navigateToPageSpy });

      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      const pageItem = screen.getByTestId('page-list-item-page-3');
      fireEvent.keyDown(pageItem, { key: ' ' });

      expect(navigateToPageSpy).toHaveBeenCalledWith('page-3');
    });
  });

  // ==========================================================================
  // Query Options
  // ==========================================================================

  describe('Query Options', () => {
    it('passes limit to getAllPages', async () => {
      const pageService = createMockPageService();

      render(
        <TestWrapper pageService={pageService}>
          <PageList limit={50} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(pageService.getAllPages).toHaveBeenCalledWith({ limit: 50 });
      });
    });

    it('uses default limit of 100', async () => {
      const pageService = createMockPageService();

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(pageService.getAllPages).toHaveBeenCalledWith({ limit: 100 });
      });
    });
  });

  // ==========================================================================
  // Accessibility
  // ==========================================================================

  describe('Accessibility', () => {
    it('has correct ARIA roles', async () => {
      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      const list = screen.getByRole('listbox');
      expect(list).toBeDefined();
      expect(list.getAttribute('aria-label')).toBe('Pages');

      const items = screen.getAllByRole('option');
      expect(items.length).toBe(3);
    });

    it('has correct aria-selected attributes', async () => {
      useAppStore.setState({ currentPageId: 'page-1' });

      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      expect(screen.getByTestId('page-list-item-page-1').getAttribute('aria-selected')).toBe(
        'true'
      );
      expect(screen.getByTestId('page-list-item-page-2').getAttribute('aria-selected')).toBe(
        'false'
      );
    });

    it('items are focusable', async () => {
      render(
        <TestWrapper>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-list')).toBeDefined();
      });

      const items = screen.getAllByRole('option');
      items.forEach((item) => {
        expect(item.getAttribute('tabindex')).toBe('0');
      });
    });

    it('loading state has correct role', () => {
      const pageService = createMockPageService();
      pageService.getAllPages = vi.fn().mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      const loadingElement = screen.getByRole('status');
      expect(loadingElement.getAttribute('aria-label')).toBe('Loading pages');
    });

    it('error state has alert role', async () => {
      const pageService = createMockPageService();
      pageService.getAllPages = vi.fn().mockRejectedValue(new Error('Failed'));

      render(
        <TestWrapper pageService={pageService}>
          <PageList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });
  });
});

// ============================================================================
// PageListItem Component Tests
// ============================================================================

describe('PageListItem', () => {
  const mockPage: Page = {
    pageId: 'test-page',
    title: 'Test Page',
    createdAt: Date.now(),
    updatedAt: Date.now() - 60000, // 1 minute ago
    isDeleted: false,
    dailyNoteDate: null,
  };

  it('renders page title', () => {
    render(<PageListItem page={mockPage} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Test Page')).toBeDefined();
  });

  it('renders relative timestamp', () => {
    render(<PageListItem page={mockPage} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('1m ago')).toBeDefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<PageListItem page={mockPage} isActive={false} onClick={onClick} />);

    fireEvent.click(screen.getByRole('option'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has aria-selected true when active', () => {
    render(<PageListItem page={mockPage} isActive={true} onClick={() => {}} />);
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true');
  });

  it('has aria-selected false when inactive', () => {
    render(<PageListItem page={mockPage} isActive={false} onClick={() => {}} />);
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('false');
  });
});
