/**
 * Tests for PageView screen component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import type { Block, Page } from '@double-bind/types';
import { PageView, PageTitle } from '../../../src/screens/PageView.js';
import { BlockNode } from '../../../src/components/BlockNode.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

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

const mockBlocks: Block[] = [
  {
    blockId: 'block-1',
    pageId: 'page-1',
    parentId: null,
    content: 'First root block',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    blockId: 'block-2',
    pageId: 'page-1',
    parentId: null,
    content: 'Second root block',
    contentType: 'text',
    order: 'a1',
    isCollapsed: false,
    isDeleted: false,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    blockId: 'block-3',
    pageId: 'page-1',
    parentId: 'block-1',
    content: 'Child of first block',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    blockId: 'block-4',
    pageId: 'page-1',
    parentId: 'block-3',
    content: 'Grandchild block',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
];

// ============================================================================
// Mock Services
// ============================================================================

function createMockServices(overrides?: Partial<Services>): Services {
  return {
    pageService: {
      getPageWithBlocks: vi.fn().mockResolvedValue({ page: mockPage, blocks: mockBlocks }),
      getPageBacklinks: vi.fn().mockResolvedValue([]),
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
      moveBlockUp: vi.fn(),
      moveBlockDown: vi.fn(),
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

function TestWrapper({ children, services }: { children: React.ReactNode; services: Services }) {
  return <ServiceProvider services={services}>{children}</ServiceProvider>;
}

// ============================================================================
// Tests
// ============================================================================

describe('PageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('shows loading state while fetching', async () => {
      // Create a service that delays resolution
      const services = createMockServices();
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      expect(screen.getByTestId('page-view-loading')).toBeDefined();
      expect(screen.getByText('Loading page...')).toBeDefined();
    });

    it('has correct ARIA role for loading state', () => {
      const services = createMockServices();
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      expect(screen.getByRole('status')).toBeDefined();
    });
  });

  // ==========================================================================
  // Success State
  // ==========================================================================

  describe('Success State', () => {
    it('renders page title', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toBeDefined();
      });

      expect(screen.getByTestId('page-title').textContent).toBe('Test Page');
    });

    it('renders block tree with correct structure', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-tree')).toBeDefined();
      });

      // Verify tree role
      expect(screen.getByRole('tree')).toBeDefined();

      // Verify all blocks are rendered
      expect(screen.getByTestId('block-block-1')).toBeDefined();
      expect(screen.getByTestId('block-block-2')).toBeDefined();
      expect(screen.getByTestId('block-block-3')).toBeDefined();
      expect(screen.getByTestId('block-block-4')).toBeDefined();
    });

    it('renders block content correctly', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-content-block-1')).toBeDefined();
      });

      expect(screen.getByTestId('block-content-block-1').textContent).toBe('First root block');
      expect(screen.getByTestId('block-content-block-2').textContent).toBe('Second root block');
      expect(screen.getByTestId('block-content-block-3').textContent).toBe('Child of first block');
      expect(screen.getByTestId('block-content-block-4').textContent).toBe('Grandchild block');
    });

    it('passes pageId to data-page-id attribute', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      expect(screen.getByTestId('page-view').getAttribute('data-page-id')).toBe('page-1');
    });

    it('fetches page data with correct pageId', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-123" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(services.pageService.getPageWithBlocks).toHaveBeenCalledWith('page-123');
      });
    });
  });

  // ==========================================================================
  // Error State
  // ==========================================================================

  describe('Error State', () => {
    it('shows error state when query fails', async () => {
      const services = createMockServices();
      const error = new Error('Failed to fetch page');
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view-error')).toBeDefined();
      });

      expect(screen.getByText('Failed to load page')).toBeDefined();
      expect(screen.getByText('Failed to fetch page')).toBeDefined();
    });

    it('has correct ARIA role for error state', async () => {
      const services = createMockServices();
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Test error')
      );

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Empty State
  // ==========================================================================

  describe('Empty State', () => {
    it('shows empty state when page has no blocks', async () => {
      const services = createMockServices();
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: [],
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view-empty')).toBeDefined();
      });

      expect(screen.getByText(/This page has no content yet/)).toBeDefined();
    });

    it('still renders page title in empty state', async () => {
      const services = createMockServices();
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: [],
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toBeDefined();
      });

      expect(screen.getByTestId('page-title').textContent).toBe('Test Page');
    });
  });

  // ==========================================================================
  // Block Tree Organization
  // ==========================================================================

  describe('Block Tree Organization', () => {
    it('organizes blocks by parent_id hierarchy', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-tree')).toBeDefined();
      });

      // Root blocks should have depth=0
      const block1 = screen.getByTestId('block-block-1');
      const block2 = screen.getByTestId('block-block-2');
      expect(block1.getAttribute('data-depth')).toBe('0');
      expect(block2.getAttribute('data-depth')).toBe('0');

      // Child block should have depth=1
      const block3 = screen.getByTestId('block-block-3');
      expect(block3.getAttribute('data-depth')).toBe('1');

      // Grandchild should have depth=2
      const block4 = screen.getByTestId('block-block-4');
      expect(block4.getAttribute('data-depth')).toBe('2');
    });

    it('sorts blocks by order key within each level', async () => {
      const services = createMockServices();
      // Blocks with reverse order keys
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: [
          { ...mockBlocks[1]!, order: 'a1' }, // Second root (should be second)
          { ...mockBlocks[0]!, order: 'a0' }, // First root (should be first)
        ],
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-tree')).toBeDefined();
      });

      // Get all tree items
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems[0]?.getAttribute('data-block-id')).toBe('block-1');
      expect(treeItems[1]?.getAttribute('data-block-id')).toBe('block-2');
    });

    it('handles orphan blocks as root nodes', async () => {
      const services = createMockServices();
      // Block with non-existent parent
      const orphanBlock: Block = {
        blockId: 'block-orphan',
        pageId: 'page-1',
        parentId: 'non-existent-parent',
        content: 'Orphan block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: 1704067200000,
        updatedAt: 1704067200000,
      };

      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: [orphanBlock],
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-orphan')).toBeDefined();
      });

      // Orphan should be treated as root (depth=0)
      expect(screen.getByTestId('block-block-orphan').getAttribute('data-depth')).toBe('0');
    });
  });

  // ==========================================================================
  // Collapsed Blocks
  // ==========================================================================

  describe('Collapsed Blocks', () => {
    it('hides children when block is collapsed', async () => {
      const services = createMockServices();
      const blocksWithCollapsed = [
        { ...mockBlocks[0]!, isCollapsed: true }, // Collapsed parent
        mockBlocks[2]!, // Child - should not be visible
      ];

      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: blocksWithCollapsed,
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-1')).toBeDefined();
      });

      // Parent should have aria-expanded=false
      expect(screen.getByTestId('block-block-1').getAttribute('aria-expanded')).toBe('false');

      // Child should not be rendered (collapsed parent hides children)
      expect(screen.queryByTestId('block-block-3')).toBeNull();
    });

    it('shows children when block is expanded', async () => {
      const services = createMockServices();
      const blocksWithExpanded = [
        { ...mockBlocks[0]!, isCollapsed: false }, // Expanded parent
        mockBlocks[2]!, // Child - should be visible
      ];

      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: blocksWithExpanded,
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-1')).toBeDefined();
      });

      // Parent should have aria-expanded=true
      expect(screen.getByTestId('block-block-1').getAttribute('aria-expanded')).toBe('true');

      // Child should be visible
      expect(screen.getByTestId('block-block-3')).toBeDefined();
    });

    it('shows correct bullet for collapsed block with children', async () => {
      const services = createMockServices();
      const blocksWithCollapsed = [{ ...mockBlocks[0]!, isCollapsed: true }, mockBlocks[2]!];

      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: blocksWithCollapsed,
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-1')).toBeDefined();
      });

      // Collapsed block with children should show right-pointing triangle
      const bullet = screen.getByTestId('block-block-1').querySelector('.block-bullet');
      expect(bullet?.textContent).toBe('\u25B6'); // Right-pointing triangle
    });

    it('shows correct bullet for expanded block with children', async () => {
      const services = createMockServices();
      const blocksWithExpanded = [{ ...mockBlocks[0]!, isCollapsed: false }, mockBlocks[2]!];

      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: blocksWithExpanded,
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-1')).toBeDefined();
      });

      // Expanded block with children should show down-pointing triangle
      const bullet = screen.getByTestId('block-block-1').querySelector('.block-bullet');
      expect(bullet?.textContent).toBe('\u25BC'); // Down-pointing triangle
    });

    it('shows bullet point for leaf blocks', async () => {
      const services = createMockServices();
      // Single block with no children
      (services.pageService.getPageWithBlocks as ReturnType<typeof vi.fn>).mockResolvedValue({
        page: mockPage,
        blocks: [mockBlocks[1]!], // Block with no children
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-block-2')).toBeDefined();
      });

      // Leaf block should show bullet point
      const bullet = screen.getByTestId('block-block-2').querySelector('.block-bullet');
      expect(bullet?.textContent).toBe('\u2022'); // Bullet point
    });
  });

  // ==========================================================================
  // Query Caching
  // ==========================================================================

  describe('Query Caching', () => {
    it('uses unique query key per pageId', async () => {
      const services = createMockServices();

      const { rerender } = render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(services.pageService.getPageWithBlocks).toHaveBeenCalledTimes(1);
      });

      // Change pageId - should trigger new fetch
      rerender(
        <TestWrapper services={services}>
          <PageView pageId="page-2" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(services.pageService.getPageWithBlocks).toHaveBeenCalledTimes(2);
      });

      expect(services.pageService.getPageWithBlocks).toHaveBeenCalledWith('page-1');
      expect(services.pageService.getPageWithBlocks).toHaveBeenCalledWith('page-2');
    });
  });

  // ==========================================================================
  // Backlinks Section
  // ==========================================================================

  describe('Backlinks Section', () => {
    it('renders backlinks section with data-testid', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-section')).toBeDefined();
      });

      expect(screen.getByTestId('backlinks-section-header')).toBeDefined();
    });

    it('fetches backlinks for the page', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(services.pageService.getPageBacklinks).toHaveBeenCalledWith('page-1');
      });
    });

    it('shows loading state while fetching backlinks', async () => {
      const services = createMockServices();
      // Make backlinks fetch never resolve to keep loading state
      (services.pageService.getPageBacklinks as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-section-header')).toBeDefined();
      });

      // Header should show Loading... text when backlinks are loading
      expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('shows backlink count when loaded', async () => {
      const services = createMockServices();
      const mockBacklinks = [
        {
          block: {
            blockId: 'backlink-block-1',
            pageId: 'source-page-1',
            parentId: null,
            content: 'Links to [[Test Page]]',
            contentType: 'text',
            order: 'a0',
            isCollapsed: false,
            isDeleted: false,
            createdAt: 1704067200000,
            updatedAt: 1704067200000,
          },
          page: {
            pageId: 'source-page-1',
            title: 'Source Page',
            createdAt: 1704067200000,
            updatedAt: 1704067200000,
            isDeleted: false,
            dailyNoteDate: null,
          },
        },
      ];
      (services.pageService.getPageBacklinks as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBacklinks
      );

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-count')).toBeDefined();
      });

      expect(screen.getByTestId('backlinks-count').textContent).toBe('1');
    });

    it('shows zero count when no backlinks', async () => {
      const services = createMockServices();
      (services.pageService.getPageBacklinks as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-count')).toBeDefined();
      });

      expect(screen.getByTestId('backlinks-count').textContent).toBe('0');
    });

    it('renders backlinks content when expanded', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-section')).toBeDefined();
      });

      // Backlinks should be expanded by default
      expect(screen.getByTestId('backlinks-content')).toBeDefined();
    });

    it('toggles backlinks visibility on header click', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-section-header')).toBeDefined();
      });

      // Backlinks content should be visible initially
      expect(screen.getByTestId('backlinks-content')).toBeDefined();

      // Click header to collapse
      fireEvent.click(screen.getByTestId('backlinks-section-header'));

      // Backlinks content should be hidden
      expect(screen.queryByTestId('backlinks-content')).toBeNull();

      // Click header again to expand
      fireEvent.click(screen.getByTestId('backlinks-section-header'));

      // Backlinks content should be visible again
      expect(screen.getByTestId('backlinks-content')).toBeDefined();
    });

    it('header has correct aria-expanded state', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-section-header')).toBeDefined();
      });

      // Initially expanded
      expect(screen.getByTestId('backlinks-section-header').getAttribute('aria-expanded')).toBe(
        'true'
      );

      // Click to collapse
      fireEvent.click(screen.getByTestId('backlinks-section-header'));

      expect(screen.getByTestId('backlinks-section-header').getAttribute('aria-expanded')).toBe(
        'false'
      );
    });
  });

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================

  describe('Keyboard Shortcuts', () => {
    it('Ctrl+B toggles backlinks visibility', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-content')).toBeDefined();
      });

      // Initially expanded
      expect(screen.getByTestId('backlinks-content')).toBeDefined();

      // Press Ctrl+B to collapse
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

      // Backlinks content should be hidden
      expect(screen.queryByTestId('backlinks-content')).toBeNull();

      // Press Ctrl+B again to expand
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

      // Backlinks content should be visible again
      expect(screen.getByTestId('backlinks-content')).toBeDefined();
    });

    it('Cmd+B toggles backlinks visibility (macOS)', async () => {
      const services = createMockServices();

      // Mock navigator.platform to simulate macOS
      const originalPlatform = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
      Object.defineProperty(Navigator.prototype, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      try {
        render(
          <TestWrapper services={services}>
            <PageView pageId="page-1" />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('backlinks-content')).toBeDefined();
        });

        // Initially expanded
        expect(screen.getByTestId('backlinks-content')).toBeDefined();

        // Press Cmd+B to collapse (metaKey for macOS)
        fireEvent.keyDown(window, { key: 'b', metaKey: true });

        // Backlinks content should be hidden
        expect(screen.queryByTestId('backlinks-content')).toBeNull();
      } finally {
        // Restore original platform
        if (originalPlatform) {
          Object.defineProperty(Navigator.prototype, 'platform', originalPlatform);
        }
      }
    });

    it('does not toggle backlinks when B pressed without modifier', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-content')).toBeDefined();
      });

      // Initially expanded
      expect(screen.getByTestId('backlinks-content')).toBeDefined();

      // Press B without modifier
      fireEvent.keyDown(window, { key: 'b' });

      // Backlinks content should still be visible
      expect(screen.getByTestId('backlinks-content')).toBeDefined();
    });

    it('uppercase B also toggles backlinks', async () => {
      const services = createMockServices();

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('backlinks-content')).toBeDefined();
      });

      // Press Ctrl+Shift+B (uppercase B)
      fireEvent.keyDown(window, { key: 'B', ctrlKey: true });

      // Should still toggle (implementation uses toLowerCase())
      expect(screen.queryByTestId('backlinks-content')).toBeNull();
    });
  });

  // ==========================================================================
  // Multi-Block Move (Alt+Up/Down)
  // ==========================================================================

  describe('Multi-Block Move', () => {
    it('Alt+Up moves all selected blocks up when multiple blocks are selected', async () => {
      const services = createMockServices();
      const moveBlockUpMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.moveBlockUp as ReturnType<typeof vi.fn>) = moveBlockUpMock;

      // Set up selected blocks in the store
      const { useAppStore } = await import('../../../src/stores/ui-store.js');
      useAppStore.setState({
        selectedBlockIds: new Set(['block-1', 'block-2']),
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      // Press Alt+Up to move selected blocks up
      fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });

      await waitFor(() => {
        expect(moveBlockUpMock).toHaveBeenCalledTimes(2);
      });

      expect(moveBlockUpMock).toHaveBeenCalledWith('block-1');
      expect(moveBlockUpMock).toHaveBeenCalledWith('block-2');

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('Alt+Down moves all selected blocks down when multiple blocks are selected', async () => {
      const services = createMockServices();
      const moveBlockDownMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.moveBlockDown as ReturnType<typeof vi.fn>) = moveBlockDownMock;

      // Set up selected blocks in the store
      const { useAppStore } = await import('../../../src/stores/ui-store.js');
      useAppStore.setState({
        selectedBlockIds: new Set(['block-3', 'block-4']),
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      // Press Alt+Down to move selected blocks down
      fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });

      await waitFor(() => {
        expect(moveBlockDownMock).toHaveBeenCalledTimes(2);
      });

      expect(moveBlockDownMock).toHaveBeenCalledWith('block-4');
      expect(moveBlockDownMock).toHaveBeenCalledWith('block-3');

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block move when only one block is selected', async () => {
      const services = createMockServices();
      const moveBlockUpMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.moveBlockUp as ReturnType<typeof vi.fn>) = moveBlockUpMock;

      // Set up single selected block in the store
      const { useAppStore } = await import('../../../src/stores/ui-store.js');
      useAppStore.setState({
        selectedBlockIds: new Set(['block-1']),
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      // Press Alt+Up - should not trigger multi-block move (handled by BlockNode)
      fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call moveBlockUp since only 1 block is selected
      expect(moveBlockUpMock).not.toHaveBeenCalled();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block move when no blocks are selected', async () => {
      const services = createMockServices();
      const moveBlockUpMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.moveBlockUp as ReturnType<typeof vi.fn>) = moveBlockUpMock;

      // Ensure no blocks are selected
      const { useAppStore } = await import('../../../src/stores/ui-store.js');
      useAppStore.setState({
        selectedBlockIds: new Set(),
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      // Press Alt+Up
      fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call moveBlockUp
      expect(moveBlockUpMock).not.toHaveBeenCalled();
    });

    it('handles move errors gracefully', async () => {
      const services = createMockServices();
      const moveBlockUpMock = vi.fn().mockRejectedValue(new Error('Cannot move'));
      (services.blockService.moveBlockUp as ReturnType<typeof vi.fn>) = moveBlockUpMock;

      // Set up selected blocks in the store
      const { useAppStore } = await import('../../../src/stores/ui-store.js');
      useAppStore.setState({
        selectedBlockIds: new Set(['block-1', 'block-2']),
      });

      render(
        <TestWrapper services={services}>
          <PageView pageId="page-1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('page-view')).toBeDefined();
      });

      // Press Alt+Up - should not throw
      expect(() => {
        fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
      }).not.toThrow();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });
  });
});

// ============================================================================
// PageTitle Component Tests
// ============================================================================

describe('PageTitle', () => {
  it('renders title text', () => {
    render(<PageTitle title="My Page Title" />);

    expect(screen.getByTestId('page-title').textContent).toBe('My Page Title');
  });

  it('renders as h1 element', () => {
    render(<PageTitle title="Test" />);

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('has correct CSS class', () => {
    render(<PageTitle title="Test" />);

    expect(screen.getByTestId('page-title').className).toContain('page-title');
  });
});

// ============================================================================
// BlockNode Component Tests
// ============================================================================

describe('BlockNode', () => {
  const mockBlockNode: Block = {
    blockId: 'test-block',
    pageId: 'page-1',
    parentId: null,
    content: 'Test content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  };

  it('renders block content', () => {
    render(<BlockNode node={{ block: mockBlockNode, children: [] }} />);

    expect(screen.getByTestId('block-content-test-block').textContent).toBe('Test content');
  });

  it('renders with correct role', () => {
    render(<BlockNode node={{ block: mockBlockNode, children: [] }} />);

    expect(screen.getByRole('treeitem')).toBeDefined();
  });

  it('renders children recursively', () => {
    const childBlock: Block = {
      ...mockBlockNode,
      blockId: 'child-block',
      parentId: 'test-block',
      content: 'Child content',
    };

    render(
      <BlockNode
        node={{
          block: mockBlockNode,
          children: [{ block: childBlock, children: [] }],
        }}
      />
    );

    expect(screen.getByTestId('block-test-block')).toBeDefined();
    expect(screen.getByTestId('block-child-block')).toBeDefined();
  });

  it('sets depth attribute correctly', () => {
    render(<BlockNode node={{ block: mockBlockNode, children: [] }} depth={3} />);

    expect(screen.getByTestId('block-test-block').getAttribute('data-depth')).toBe('3');
  });

  it('defaults depth to 0', () => {
    render(<BlockNode node={{ block: mockBlockNode, children: [] }} />);

    expect(screen.getByTestId('block-test-block').getAttribute('data-depth')).toBe('0');
  });

  it('does not set aria-expanded for leaf nodes', () => {
    render(<BlockNode node={{ block: mockBlockNode, children: [] }} />);

    expect(screen.getByTestId('block-test-block').getAttribute('aria-expanded')).toBeNull();
  });

  it('renders children in group role container', () => {
    const childBlock: Block = {
      ...mockBlockNode,
      blockId: 'child-block',
      parentId: 'test-block',
    };

    render(
      <BlockNode
        node={{
          block: mockBlockNode,
          children: [{ block: childBlock, children: [] }],
        }}
      />
    );

    expect(screen.getByRole('group')).toBeDefined();
  });
});
