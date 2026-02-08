/**
 * Tests for PageView screen component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import type { Block, Page } from '@double-bind/types';
import { PageView } from '../../../src/screens/PageView.js';
import { PageTitle } from '../../../src/screens/index.js';
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

      // Real PageTitle renders an <input> for regular pages, so check value
      const titleEl = screen.getByTestId('page-title') as HTMLInputElement;
      expect(titleEl.value).toBe('Test Page');
    });

    // Tests for block tree structure and block content rendering removed:
    // The actual BlockNode component fetches data via useBlock/useBlockChildren hooks,
    // not via props. Block rendering is covered by test/unit/components/BlockNode.test.tsx.

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

      // Real PageTitle renders an <input> for regular pages, so check value
      const titleEl = screen.getByTestId('page-title') as HTMLInputElement;
      expect(titleEl.value).toBe('Test Page');
    });
  });

  // ==========================================================================
  // Block Tree Organization
  // ==========================================================================

  // Block Tree Organization tests removed: BlockNode uses useBlock/useBlockChildren hooks,
  // not the prop-based API these tests expected. See test/unit/components/BlockNode.test.tsx.

  // ==========================================================================
  // Collapsed Blocks
  // ==========================================================================

  // Collapsed Blocks tests removed: BlockNode uses useBlock/useBlockChildren hooks,
  // not the prop-based API these tests expected. See test/unit/components/BlockNode.test.tsx.

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

  // ==========================================================================
  // Multi-Block Indent/Outdent (Tab/Shift+Tab)
  // ==========================================================================

  describe('Multi-Block Indent/Outdent', () => {
    it('Tab indents all selected blocks when multiple blocks are selected', async () => {
      const services = createMockServices();
      const indentBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.indentBlock as ReturnType<typeof vi.fn>) = indentBlockMock;

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

      // Press Tab to indent selected blocks
      fireEvent.keyDown(window, { key: 'Tab' });

      await waitFor(() => {
        expect(indentBlockMock).toHaveBeenCalledTimes(2);
      });

      expect(indentBlockMock).toHaveBeenCalledWith('block-1');
      expect(indentBlockMock).toHaveBeenCalledWith('block-2');

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('Shift+Tab outdents all selected blocks when multiple blocks are selected', async () => {
      const services = createMockServices();
      const outdentBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.outdentBlock as ReturnType<typeof vi.fn>) = outdentBlockMock;

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

      // Press Shift+Tab to outdent selected blocks
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

      await waitFor(() => {
        expect(outdentBlockMock).toHaveBeenCalledTimes(2);
      });

      expect(outdentBlockMock).toHaveBeenCalledWith('block-3');
      expect(outdentBlockMock).toHaveBeenCalledWith('block-4');

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block indent when only one block is selected', async () => {
      const services = createMockServices();
      const indentBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.indentBlock as ReturnType<typeof vi.fn>) = indentBlockMock;

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

      // Press Tab - should not trigger multi-block indent (handled by BlockNode)
      fireEvent.keyDown(window, { key: 'Tab' });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call indentBlock since only 1 block is selected
      expect(indentBlockMock).not.toHaveBeenCalled();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block indent when no blocks are selected', async () => {
      const services = createMockServices();
      const indentBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.indentBlock as ReturnType<typeof vi.fn>) = indentBlockMock;

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

      // Press Tab
      fireEvent.keyDown(window, { key: 'Tab' });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call indentBlock
      expect(indentBlockMock).not.toHaveBeenCalled();
    });

    it('handles indent errors gracefully', async () => {
      const services = createMockServices();
      const indentBlockMock = vi.fn().mockRejectedValue(new Error('Cannot indent'));
      (services.blockService.indentBlock as ReturnType<typeof vi.fn>) = indentBlockMock;

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

      // Press Tab - should not throw
      expect(() => {
        fireEvent.keyDown(window, { key: 'Tab' });
      }).not.toThrow();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('handles outdent errors gracefully', async () => {
      const services = createMockServices();
      const outdentBlockMock = vi.fn().mockRejectedValue(new Error('Cannot outdent'));
      (services.blockService.outdentBlock as ReturnType<typeof vi.fn>) = outdentBlockMock;

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

      // Press Shift+Tab - should not throw
      expect(() => {
        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
      }).not.toThrow();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });
  });

  // ==========================================================================
  // Multi-Block Delete (Delete/Backspace)
  // ==========================================================================

  describe('Multi-Block Delete', () => {
    it('Delete key deletes all selected blocks when multiple blocks are selected', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Delete to delete selected blocks
      fireEvent.keyDown(window, { key: 'Delete' });

      await waitFor(() => {
        expect(deleteBlockMock).toHaveBeenCalled();
      });

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('Backspace key deletes all selected blocks when multiple blocks are selected', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Backspace to delete selected blocks
      fireEvent.keyDown(window, { key: 'Backspace' });

      await waitFor(() => {
        expect(deleteBlockMock).toHaveBeenCalled();
      });

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block delete when only one block is selected', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Delete - should not trigger multi-block delete (handled by BlockNode)
      fireEvent.keyDown(window, { key: 'Delete' });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call deleteBlock since only 1 block is selected
      expect(deleteBlockMock).not.toHaveBeenCalled();

      // Clean up
      useAppStore.setState({ selectedBlockIds: new Set() });
    });

    it('does not trigger multi-block delete when no blocks are selected', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Delete
      fireEvent.keyDown(window, { key: 'Delete' });

      // Small delay to ensure async handler would have run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call deleteBlock
      expect(deleteBlockMock).not.toHaveBeenCalled();
    });

    it('clears selection after deletion', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockResolvedValue(undefined);
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Delete to delete selected blocks
      fireEvent.keyDown(window, { key: 'Delete' });

      await waitFor(() => {
        expect(deleteBlockMock).toHaveBeenCalled();
      });

      // Selection should be cleared
      await waitFor(() => {
        expect(useAppStore.getState().selectedBlockIds.size).toBe(0);
      });
    });

    it('handles delete errors gracefully', async () => {
      const services = createMockServices();
      const deleteBlockMock = vi.fn().mockRejectedValue(new Error('Cannot delete'));
      (services.blockService.deleteBlock as ReturnType<typeof vi.fn>) = deleteBlockMock;

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

      // Press Delete - should not throw
      expect(() => {
        fireEvent.keyDown(window, { key: 'Delete' });
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
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  it('renders title text for regular page', () => {
    render(
      <PageTitle pageId="page-1" title="My Page Title" dailyNoteDate={null} onSave={mockOnSave} />
    );

    const titleEl = screen.getByTestId('page-title') as HTMLInputElement;
    expect(titleEl.value).toBe('My Page Title');
  });

  it('renders as h1 element for daily note', () => {
    render(
      <PageTitle
        pageId="page-1"
        title="2024-01-15"
        dailyNoteDate="2024-01-15"
        onSave={mockOnSave}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('has correct CSS class', () => {
    render(<PageTitle pageId="page-1" title="Test" dailyNoteDate={null} onSave={mockOnSave} />);

    expect(screen.getByTestId('page-title').className).toContain('page-title');
  });
});

// ============================================================================
// BlockNode Component Tests
// ============================================================================

// BlockNode tests removed: The actual BlockNode component accepts { blockId, depth } props
// and fetches data via hooks, not the { node: { block, children } } API these tests expected.
// See test/unit/components/BlockNode.test.tsx for correct BlockNode tests (72 tests).
