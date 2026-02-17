/**
 * Tests for QueryViewScreen component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database, QueryResult } from '@double-bind/types';
import type { Services } from '../../../src/providers/ServiceProvider.js';
import { ServiceProvider } from '../../../src/providers/ServiceProvider.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import { QueryViewScreen } from '../../../src/screens/QueryViewScreen.js';
import { useQueryHistoryStore } from '../../../src/stores/query-history-store.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

// Mock Database
function createMockDatabase(): Database {
  return {
    query: vi.fn().mockResolvedValue({
      headers: ['page_id', 'title'],
      rows: [
        ['page-1', 'Test Page 1'],
        ['page-2', 'Test Page 2'],
      ],
    } satisfies QueryResult),
    mutate: vi.fn().mockResolvedValue({ headers: [], rows: [] }),
    importRelations: vi.fn().mockResolvedValue(undefined),
    exportRelations: vi.fn().mockResolvedValue({}),
    backup: vi.fn().mockResolvedValue(undefined),
  };
}

// Mock services
function createMockServices(database: Database): Services {
  return {
    pageService: {
      createPage: vi.fn(),
      getById: vi.fn(),
      getAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getWithBlocks: vi.fn(),
      getBacklinks: vi.fn(),
      getOrCreateDailyNote: vi.fn(),
    } as unknown as Services['pageService'],
    blockService: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getByPage: vi.fn(),
      getBacklinks: vi.fn(),
    } as unknown as Services['blockService'],
    graphService: {
      getFullGraph: vi.fn(),
      getNeighborhood: vi.fn(),
      getPageRank: vi.fn(),
      getCommunities: vi.fn(),
      getSuggestedLinks: vi.fn(),
    } as unknown as Services['graphService'],
    savedQueryService: {
      create: vi.fn(),
      getById: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      search: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getByName: vi.fn(),
      nameExists: vi.fn(),
    } as unknown as Services['savedQueryService'],
    database,
  };
}

describe('QueryViewScreen', () => {
  let mockDatabase: Database;
  let mockServices: Services;

  beforeEach(() => {
    // Reset stores
    useAppStore.setState({
      sidebarOpen: true,
      sidebarWidth: 240,
      rightPanelOpen: false,
      rightPanelContent: null,
      focusedBlockId: null,
      selectedBlockIds: new Set(),
      commandPaletteOpen: false,
      currentPageId: 'query',
      pageHistory: ['query'],
      historyIndex: 0,
    });

    useQueryHistoryStore.setState({
      entries: [],
    });

    mockDatabase = createMockDatabase();
    mockServices = createMockServices(mockDatabase);
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders the query view container', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('query-view')).toBeDefined();
    });

    it('renders the toolbar', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('query-toolbar')).toBeDefined();
    });

    it('renders mode toggle buttons', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('mode-visual')).toBeDefined();
      expect(screen.getByTestId('mode-raw')).toBeDefined();
    });

    it('renders execute button', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('execute-query')).toBeDefined();
    });

    it('renders save button', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('save-query-button')).toBeDefined();
    });

    it('renders side panel with tabs', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('query-side-panel')).toBeDefined();
      expect(screen.getByTestId('tab-saved')).toBeDefined();
      expect(screen.getByTestId('tab-history')).toBeDefined();
    });

    it('renders editor pane', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('query-editor-pane')).toBeDefined();
    });

    it('renders results pane', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );
      expect(screen.getByTestId('query-results-pane')).toBeDefined();
    });
  });

  // ==========================================================================
  // Mode Switching
  // ==========================================================================

  describe('Mode Switching', () => {
    it('starts in visual mode by default', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      const visualButton = screen.getByTestId('mode-visual');
      expect(visualButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('switches to raw mode when clicked', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      const rawButton = screen.getByTestId('mode-raw');
      fireEvent.click(rawButton);

      expect(rawButton.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('raw-query-editor')).toBeDefined();
    });

    it('shows visual query builder in visual mode', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('visual-query-builder')).toBeDefined();
    });

    it('shows code editor in raw mode', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('mode-raw'));

      expect(screen.getByTestId('raw-query-editor')).toBeDefined();
    });
  });

  // ==========================================================================
  // Query Execution
  // ==========================================================================

  describe('Query Execution', () => {
    it('executes query when execute button clicked in raw mode', async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      // Switch to raw mode
      fireEvent.click(screen.getByTestId('mode-raw'));

      // Click execute
      fireEvent.click(screen.getByTestId('execute-query'));

      await waitFor(() => {
        expect(mockDatabase.query).toHaveBeenCalled();
      });
    });

    it('displays results after execution', async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      // Switch to raw mode
      fireEvent.click(screen.getByTestId('mode-raw'));

      // Click execute
      fireEvent.click(screen.getByTestId('execute-query'));

      await waitFor(() => {
        expect(screen.getByTestId('query-result-table')).toBeDefined();
      });
    });

    it('displays error when query fails', async () => {
      const errorDatabase = createMockDatabase();
      (errorDatabase.query as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Query syntax error')
      );

      const errorServices = createMockServices(errorDatabase);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={errorServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      // Switch to raw mode
      fireEvent.click(screen.getByTestId('mode-raw'));

      // Click execute
      fireEvent.click(screen.getByTestId('execute-query'));

      await waitFor(() => {
        expect(screen.getByTestId('query-error')).toBeDefined();
      });
    });

    it('adds executed query to history', async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      // Switch to raw mode
      fireEvent.click(screen.getByTestId('mode-raw'));

      // Click execute
      fireEvent.click(screen.getByTestId('execute-query'));

      await waitFor(() => {
        const history = useQueryHistoryStore.getState().entries;
        expect(history.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Side Panel
  // ==========================================================================

  describe('Side Panel', () => {
    it('shows saved queries tab by default', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('saved-queries-list')).toBeDefined();
    });

    it('switches to history tab when clicked', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('tab-history'));

      // History panel should now be visible
      expect(
        screen.getByTestId('query-history-panel-empty') || screen.getByTestId('query-history-panel')
      ).toBeDefined();
    });
  });

  // ==========================================================================
  // Save Query Modal
  // ==========================================================================

  describe('Save Query Modal', () => {
    it('opens save modal when save button clicked', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('save-query-button'));

      expect(screen.getByTestId('save-query-modal')).toBeDefined();
    });

    it('closes modal when cancel clicked', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('save-query-button'));
      expect(screen.getByTestId('save-query-modal')).toBeDefined();

      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByTestId('save-query-modal')).toBeNull();
    });

    it('has name input in modal', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('save-query-button'));

      expect(screen.getByTestId('save-query-name-input')).toBeDefined();
    });

    it('has description input in modal', () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <ServiceProvider services={mockServices}>
            <QueryViewScreen params={{}} />
          </ServiceProvider>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('save-query-button'));

      expect(screen.getByTestId('save-query-description-input')).toBeDefined();
    });
  });

  // ==========================================================================
  // Without Services
  // ==========================================================================

  describe('Without Services', () => {
    it('shows placeholder message when no services available', () => {
      render(<QueryViewScreen params={{}} />);

      expect(screen.getByTestId('query-view')).toBeDefined();
      expect(screen.getByText('Query editor is not available in this context.')).toBeDefined();
    });
  });
});
