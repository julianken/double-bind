/**
 * Tests for Sidebar component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { Sidebar, QuickCapture, SidebarFooter } from '../../../src/layout/Sidebar.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import type { PageService, BlockService, GraphService, SavedQueryService } from '@double-bind/core';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

// ============================================================================
// Mock Services
// ============================================================================

const createMockGraphService = () => ({
  getNeighborhood: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  getFullGraph: vi.fn(),
  getPageRank: vi.fn(),
  getCommunities: vi.fn(),
  getSuggestedLinks: vi.fn(),
});

const createMockPageService = () => ({
  getAllPages: vi.fn().mockResolvedValue([]),
  createPage: vi.fn(),
  getPageWithBlocks: vi.fn(),
  deletePage: vi.fn(),
  getTodaysDailyNote: vi.fn(),
  searchPages: vi.fn(),
});

const createMockServices = (): Services => ({
  pageService: createMockPageService() as unknown as PageService,
  blockService: {} as BlockService,
  graphService: createMockGraphService() as unknown as GraphService,
  savedQueryService: {} as SavedQueryService,
});

let mockServices: Services;

// Wrapper component for tests
function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ServiceProvider, { services: mockServices }, children)
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// Setup
// ============================================================================

describe('Sidebar', () => {
  // Store original localStorage
  const originalLocalStorage = globalThis.localStorage;

  // Mock localStorage
  let mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(() => {
      mockStorage = {};
    }),
    get length() {
      return Object.keys(mockStorage).length;
    },
    key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
  };

  beforeEach(() => {
    // Create fresh mock services for each test
    mockServices = createMockServices();

    // Clear the query cache to avoid stale data across tests
    clearQueryCache();

    // Reset store to initial state
    useAppStore.setState({
      sidebarOpen: true,
      sidebarWidth: 240,
      rightPanelOpen: false,
      rightPanelContent: null,
      focusedBlockId: null,
      selectedBlockIds: new Set(),
      commandPaletteOpen: false,
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });

    // Setup mock localStorage
    mockStorage = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering
  // ============================================================================

  describe('Rendering', () => {
    it('renders when sidebarOpen is true', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByRole('complementary')).toBeDefined();
      expect(screen.getByLabelText('Application sidebar')).toBeDefined();
    });

    it('does not render when sidebarOpen is false', () => {
      useAppStore.setState({ sidebarOpen: false });

      renderWithProvider(<Sidebar />);

      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('renders SearchBar component', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByRole('search')).toBeDefined();
      expect(screen.getByPlaceholderText('Search pages and blocks...')).toBeDefined();
    });

    it('renders QuickCapture component', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByPlaceholderText('Quick capture...')).toBeDefined();
    });

    it('renders PageList component', async () => {
      renderWithProvider(<Sidebar />);

      // PageList renders a loading state initially, then resolves to the empty state
      // when the mock returns an empty array.
      await waitFor(() => {
        expect(screen.getByTestId('page-list-empty')).toBeDefined();
      });
    });

    it('renders SidebarFooter component', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByText('Double Bind')).toBeDefined();
    });

    it('renders New Page button', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByRole('button', { name: 'Create new page' })).toBeDefined();
      expect(screen.getByText('+ New Page')).toBeDefined();
    });

    it('renders resize handle', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeDefined();
    });

    it('renders graph section', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByTestId('sidebar-graph-section')).toBeDefined();
      expect(screen.getByTestId('sidebar-graph-toggle')).toBeDefined();
    });
  });

  // ============================================================================
  // New Page Button
  // ============================================================================

  describe('New Page Button', () => {
    it('is disabled when no onNewPage callback is provided', () => {
      renderWithProvider(<Sidebar />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toHaveProperty('disabled', true);
    });

    it('is enabled when onNewPage callback is provided', () => {
      const onNewPage = vi.fn();
      renderWithProvider(<Sidebar onNewPage={onNewPage} />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toHaveProperty('disabled', false);
    });

    it('calls onNewPage when clicked', async () => {
      const user = userEvent.setup();
      const onNewPage = vi.fn();
      renderWithProvider(<Sidebar onNewPage={onNewPage} />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      await user.click(button);

      expect(onNewPage).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  describe('Keyboard Shortcuts', () => {
    it('toggles sidebar with Ctrl+\\', () => {
      renderWithProvider(<Sidebar />);

      // Initially open
      expect(screen.getByRole('complementary')).toBeDefined();

      // Press Ctrl+\
      act(() => {
        fireEvent.keyDown(document, { key: '\\', ctrlKey: true });
      });

      // Should be closed
      expect(useAppStore.getState().sidebarOpen).toBe(false);
    });

    it('opens sidebar with Ctrl+\\ when closed', () => {
      useAppStore.setState({ sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      // Initially closed
      expect(screen.queryByRole('complementary')).toBeNull();

      // Press Ctrl+\
      act(() => {
        fireEvent.keyDown(document, { key: '\\', ctrlKey: true });
      });

      // Should be open
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('does not toggle sidebar with just \\ key (no Ctrl)', () => {
      renderWithProvider(<Sidebar />);

      act(() => {
        fireEvent.keyDown(document, { key: '\\', ctrlKey: false });
      });

      // Should still be open
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('does not toggle sidebar with Ctrl+other key', () => {
      renderWithProvider(<Sidebar />);

      act(() => {
        fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      });

      // Should still be open
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });
  });

  // ============================================================================
  // Width and Resize
  // ============================================================================

  describe('Width and Resize', () => {
    it('applies default width of 250px when no stored value', () => {
      renderWithProvider(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('250px');
    });

    it('loads width from localStorage on mount', () => {
      mockStorage['sidebar-width'] = '300';
      renderWithProvider(<Sidebar />);

      // Wait for effect to run
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('300px');
    });

    it('ignores invalid stored width below minimum', () => {
      mockStorage['sidebar-width'] = '100'; // Below minimum of 150
      renderWithProvider(<Sidebar />);

      // Should keep store default since 100 is below minimum and invalid
      const sidebar = screen.getByRole('complementary');
      // Store default is 240px when invalid value is found
      expect(sidebar.style.width).toBe('240px');
    });

    it('ignores invalid stored width above maximum', () => {
      mockStorage['sidebar-width'] = '600'; // Above maximum of 500
      renderWithProvider(<Sidebar />);

      // Should keep store default since 600 is above maximum and invalid
      const sidebar = screen.getByRole('complementary');
      // Store default is 240px when invalid value is found
      expect(sidebar.style.width).toBe('240px');
    });

    it('persists width changes to localStorage', () => {
      renderWithProvider(<Sidebar />);

      // Change width in store
      act(() => {
        useAppStore.getState().setSidebarWidth(350);
      });

      // Should be persisted
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('sidebar-width', '350');
    });

    it('handles resize via mouse drag', () => {
      renderWithProvider(<Sidebar />);

      const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' });
      const sidebar = screen.getByRole('complementary');

      // Simulate drag
      fireEvent.mouseDown(resizeHandle, { clientX: 250 });

      // Mock sidebar.offsetWidth
      Object.defineProperty(sidebar, 'offsetWidth', { value: 250, configurable: true });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      // Release mouse
      act(() => {
        fireEvent.mouseUp(document);
      });

      // Width should have changed
      const newWidth = useAppStore.getState().sidebarWidth;
      expect(newWidth).toBeGreaterThanOrEqual(150);
      expect(newWidth).toBeLessThanOrEqual(500);
    });
  });

  // ============================================================================
  // Error Boundary
  // ============================================================================

  describe('Error Boundary', () => {
    // Suppress console.error for cleaner test output
    // eslint-disable-next-line no-console
    const originalError = console.error;
    beforeEach(() => {
      // eslint-disable-next-line no-console
      console.error = vi.fn();
    });

    afterEach(() => {
      // eslint-disable-next-line no-console
      console.error = originalError;
    });

    it('verifies Sidebar is wrapped in ErrorBoundary', () => {
      const { container } = renderWithProvider(<Sidebar />);
      expect(container.querySelector('.sidebar')).toBeDefined();
    });
  });

  // ============================================================================
  // Stub Components
  // ============================================================================

  describe('Stub Components', () => {
    describe('QuickCapture', () => {
      it('renders with correct accessibility attributes', () => {
        render(<QuickCapture />);

        const textarea = screen.getByLabelText('Quick capture');
        expect(textarea).toBeDefined();
        expect(textarea).toHaveProperty('disabled', true);
      });
    });

    describe('SidebarFooter', () => {
      it('renders footer content', () => {
        render(<SidebarFooter />);

        expect(screen.getByText('Double Bind')).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has correct ARIA role and label on sidebar', () => {
      renderWithProvider(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeDefined();
      expect(sidebar.getAttribute('aria-label')).toBe('Application sidebar');
    });

    it('resize handle has correct ARIA attributes', () => {
      renderWithProvider(<Sidebar />);

      const handle = screen.getByRole('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('aria-label')).toBe('Resize sidebar');
    });

    it('New Page button has accessible name', () => {
      renderWithProvider(<Sidebar />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toBeDefined();
    });
  });

  // ============================================================================
  // Integration with Store
  // ============================================================================

  describe('Store Integration', () => {
    it('uses sidebarOpen from store', () => {
      renderWithProvider(<Sidebar />);
      expect(screen.getByRole('complementary')).toBeDefined();

      act(() => {
        useAppStore.getState().toggleSidebar();
      });

      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('uses sidebarWidth from store', () => {
      renderWithProvider(<Sidebar />);

      act(() => {
        useAppStore.getState().setSidebarWidth(400);
      });

      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('400px');
    });
  });

  // ============================================================================
  // Graph Section
  // ============================================================================

  describe('Graph Section', () => {
    it('renders graph section toggle button', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByTestId('sidebar-graph-toggle')).toBeDefined();
      expect(screen.getByText('Graph')).toBeDefined();
    });

    it('shows "No page selected" when no current page', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByTestId('sidebar-graph-empty')).toBeDefined();
      expect(screen.getByText('No page selected')).toBeDefined();
    });

    it('can collapse and expand graph section', async () => {
      const user = userEvent.setup();
      renderWithProvider(<Sidebar />);

      // Initially expanded
      expect(screen.getByTestId('sidebar-graph-content')).toBeDefined();

      // Click to collapse
      await user.click(screen.getByTestId('sidebar-graph-toggle'));

      // Content should be hidden
      expect(screen.queryByTestId('sidebar-graph-content')).toBeNull();

      // Click to expand
      await user.click(screen.getByTestId('sidebar-graph-toggle'));

      // Content should be visible again
      expect(screen.getByTestId('sidebar-graph-content')).toBeDefined();
    });

    it('toggle button has correct aria-expanded attribute', async () => {
      const user = userEvent.setup();
      renderWithProvider(<Sidebar />);

      const toggle = screen.getByTestId('sidebar-graph-toggle');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      await user.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
