/**
 * Tests for GraphViewScreen component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import type { Page, Link, PageId } from '@double-bind/types';
import { GraphViewScreen } from '../../../src/screens/GraphViewScreen.js';
import { ServiceProvider, type Services } from '../../../src/providers/index.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

// ============================================================================
// Mock Data
// ============================================================================

const mockPages: Page[] = [
  {
    pageId: 'page-1',
    title: 'Page One',
    dailyNoteDate: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
  },
  {
    pageId: 'page-2',
    title: 'Page Two',
    dailyNoteDate: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
  },
  {
    pageId: 'page-3',
    title: 'Page Three',
    dailyNoteDate: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
  },
];

const mockLinks: Link[] = [
  {
    sourceId: 'page-1',
    targetId: 'page-2',
    linkType: 'reference',
    createdAt: Date.now(),
    contextBlockId: null,
  },
  {
    sourceId: 'page-2',
    targetId: 'page-3',
    linkType: 'reference',
    createdAt: Date.now(),
    contextBlockId: null,
  },
];

const mockPageRankMap = new Map<PageId, number>([
  ['page-1', 0.4],
  ['page-2', 0.35],
  ['page-3', 0.25],
]);

const mockCommunityMap = new Map<PageId, number>([
  ['page-1', 0],
  ['page-2', 0],
  ['page-3', 1],
]);

// ============================================================================
// Mock GraphView component
// ============================================================================

vi.mock('@double-bind/ui-primitives', () => ({
  GraphView: vi.fn(({ nodes, edges, onNodeClick, colorByCommunity, sizeByPageRank }) => (
    <div
      data-testid="mock-graph-view"
      data-node-count={nodes.length}
      data-edge-count={edges.length}
      data-color-by-community={colorByCommunity}
      data-size-by-pagerank={sizeByPageRank}
    >
      {nodes.map((node: { id: string; title: string }) => (
        <button key={node.id} data-testid={`node-${node.id}`} onClick={() => onNodeClick(node.id)}>
          {node.title}
        </button>
      ))}
    </div>
  )),
}));

// ============================================================================
// Mock Services
// ============================================================================

function createMockServices(
  overrides: {
    getFullGraph?: () => Promise<{ nodes: Page[]; edges: Link[] }>;
    getPageRank?: () => Promise<Map<PageId, number>>;
    getCommunities?: () => Promise<Map<PageId, number>>;
  } = {}
): Services {
  return {
    pageService: {
      getTodaysDailyNote: vi.fn(),
      getPageWithBlocks: vi.fn(),
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
    graphService: {
      getFullGraph:
        overrides.getFullGraph ?? vi.fn().mockResolvedValue({ nodes: mockPages, edges: mockLinks }),
      getPageRank: overrides.getPageRank ?? vi.fn().mockResolvedValue(mockPageRankMap),
      getCommunities: overrides.getCommunities ?? vi.fn().mockResolvedValue(mockCommunityMap),
      getNeighborhood: vi.fn(),
      getSuggestedLinks: vi.fn(),
    } as unknown as Services['graphService'],
  };
}

// ============================================================================
// Test Wrapper
// ============================================================================

function renderWithServices(ui: React.ReactElement, services: Services = createMockServices()) {
  return render(<ServiceProvider services={services}>{ui}</ServiceProvider>);
}

// ============================================================================
// Tests
// ============================================================================

describe('GraphViewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();
    // Reset store state
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      const services = createMockServices({
        getFullGraph: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      expect(screen.getByTestId('graph-view-loading')).toBeDefined();
      expect(screen.getByText('Loading graph...')).toBeDefined();
    });
  });

  describe('Error State', () => {
    it('shows error state when graph fetch fails', async () => {
      const services = createMockServices({
        getFullGraph: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-error')).toBeDefined();
      });

      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no pages exist', async () => {
      const services = createMockServices({
        getFullGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-empty')).toBeDefined();
      });

      expect(screen.getByText('No pages yet')).toBeDefined();
    });
  });

  describe('Success State', () => {
    it('renders graph with nodes when data is loaded', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      // Check GraphView receives correct data
      const mockGraphView = screen.getByTestId('mock-graph-view');
      expect(mockGraphView.getAttribute('data-node-count')).toBe('3');
      expect(mockGraphView.getAttribute('data-edge-count')).toBe('2');
    });

    it('renders toolbar with controls', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-toolbar')).toBeDefined();
      });

      expect(screen.getByTestId('color-by-community-toggle')).toBeDefined();
      expect(screen.getByTestId('size-by-pagerank-toggle')).toBeDefined();
      expect(screen.getByTestId('graph-close-button')).toBeDefined();
    });
  });

  describe('Toolbar Controls', () => {
    it('toggles color by community', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      const toggle = screen.getByTestId('color-by-community-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);

      const mockGraphView = screen.getByTestId('mock-graph-view');
      expect(mockGraphView.getAttribute('data-color-by-community')).toBe('true');
    });

    it('toggles size by PageRank', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      const toggle = screen.getByTestId('size-by-pagerank-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);

      const mockGraphView = screen.getByTestId('mock-graph-view');
      expect(mockGraphView.getAttribute('data-size-by-pagerank')).toBe('true');
    });

    it('closes graph view on close button click', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      const closeButton = screen.getByTestId('graph-close-button');
      fireEvent.click(closeButton);

      // Should set currentPageId to null
      expect(useAppStore.getState().currentPageId).toBeNull();
    });
  });

  describe('Node Interaction', () => {
    it('navigates to page on node click', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      // Click on a node (mocked in GraphView)
      const node = screen.getByTestId('node-page-1');
      fireEvent.click(node);

      // Should navigate to the page
      expect(useAppStore.getState().currentPageId).toBe('page-1');
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes for loading state', () => {
      const services = createMockServices({
        getFullGraph: vi.fn().mockImplementation(() => new Promise(() => {})),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      const loadingElement = screen.getByTestId('graph-view-loading');
      expect(loadingElement.getAttribute('aria-busy')).toBe('true');
      expect(loadingElement.getAttribute('aria-label')).toBe('Loading graph');
    });

    it('has correct ARIA attributes for error state', async () => {
      const services = createMockServices({
        getFullGraph: vi.fn().mockRejectedValue(new Error('Test error')),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        const errorElement = screen.getByTestId('graph-view-error');
        expect(errorElement.getAttribute('aria-label')).toBe('Error loading graph');
      });
    });

    it('has correct ARIA attributes for success state', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        const graphElement = screen.getByTestId('graph-view-screen');
        expect(graphElement.getAttribute('aria-label')).toBe('Graph view');
      });
    });

    it('has accessible close button', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-screen')).toBeDefined();
      });

      const closeButton = screen.getByTestId('graph-close-button');
      expect(closeButton.getAttribute('aria-label')).toBe('Close graph view');
    });
  });

  describe('Data Transformation', () => {
    it('transforms pages to GraphNode format with PageRank and community', async () => {
      const services = createMockServices();

      renderWithServices(<GraphViewScreen params={{}} />, services);

      await waitFor(() => {
        expect(screen.getByTestId('mock-graph-view')).toBeDefined();
      });

      // Verify the graph service methods were called
      expect(services.graphService.getFullGraph).toHaveBeenCalled();
      expect(services.graphService.getPageRank).toHaveBeenCalled();
      expect(services.graphService.getCommunities).toHaveBeenCalled();
    });

    it('handles missing PageRank data gracefully', async () => {
      const services = createMockServices({
        getPageRank: vi.fn().mockRejectedValue(new Error('PageRank unavailable')),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      // Should still render the graph (PageRank is optional)
      await waitFor(() => {
        expect(screen.getByTestId('mock-graph-view')).toBeDefined();
      });
    });

    it('handles missing community data gracefully', async () => {
      const services = createMockServices({
        getCommunities: vi.fn().mockRejectedValue(new Error('Communities unavailable')),
      });

      renderWithServices(<GraphViewScreen params={{}} />, services);

      // Should still render the graph (communities are optional)
      await waitFor(() => {
        expect(screen.getByTestId('mock-graph-view')).toBeDefined();
      });
    });
  });
});
