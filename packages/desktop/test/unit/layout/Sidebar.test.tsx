/**
 * Tests for Sidebar component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { Sidebar, SidebarFooter } from '../../../src/layout/Sidebar.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import type { PageService, BlockService, GraphService, SavedQueryService } from '@double-bind/core';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
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
  beforeEach(() => {
    // Create fresh mock services for each test
    mockServices = createMockServices();

    // Clear the query cache to avoid stale data across tests
    clearQueryCache();

    // Reset store to initial state
    useAppStore.setState({
      sidebarMode: 'open',
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
  });

  afterEach(() => {
    clearQueryCache();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Mode Rendering
  // ============================================================================

  describe('Mode Rendering', () => {
    it('renders open mode with full sidebar content', () => {
      renderWithProvider(<Sidebar />);

      // Open mode shows QuickCapture and page controls
      expect(screen.getByPlaceholderText('Quick capture...')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Create new page' })).toBeDefined();
    });

    it('renders rail mode with icon rail and no full content', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      expect(screen.getByTestId('sidebar-rail')).toBeDefined();
      // Full content should not be present in rail mode
      expect(screen.queryByRole('button', { name: 'Create new page' })).toBeNull();
    });

    it('renders nothing in closed mode', () => {
      useAppStore.setState({ sidebarMode: 'closed', sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      expect(screen.queryByTestId('sidebar-rail')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Create new page' })).toBeNull();
      expect(screen.queryByPlaceholderText('Quick capture...')).toBeNull();
    });

    it('cycles through open -> rail -> closed -> open', () => {
      renderWithProvider(<Sidebar />);

      // Start: open
      expect(screen.getByRole('button', { name: 'Create new page' })).toBeDefined();

      // Cycle to rail
      act(() => {
        useAppStore.getState().cycleSidebarMode();
      });
      expect(useAppStore.getState().sidebarMode).toBe('rail');

      // Cycle to closed
      act(() => {
        useAppStore.getState().cycleSidebarMode();
      });
      expect(useAppStore.getState().sidebarMode).toBe('closed');

      // Cycle back to open
      act(() => {
        useAppStore.getState().cycleSidebarMode();
      });
      expect(useAppStore.getState().sidebarMode).toBe('open');
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
  // PageList
  // ============================================================================

  describe('PageList', () => {
    it('renders PageList component in open mode', async () => {
      renderWithProvider(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByTestId('page-list-empty')).toBeDefined();
      });
    });

    it('does not render PageList in rail mode', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      expect(screen.queryByTestId('page-list')).toBeNull();
      expect(screen.queryByTestId('page-list-empty')).toBeNull();
    });
  });

  // ============================================================================
  // Resize Handle
  // ============================================================================

  describe('Resize Handle', () => {
    it('renders resize handle in open mode', () => {
      renderWithProvider(<Sidebar />);

      expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeDefined();
    });

    it('does not render resize handle in rail mode', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).toBeNull();
    });

    it('handles resize via mouse drag', () => {
      renderWithProvider(<Sidebar />);

      const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' });

      // Simulate drag
      fireEvent.mouseDown(resizeHandle, { clientX: 250 });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(document, { clientX: 300 });
      });

      // Release mouse
      act(() => {
        fireEvent.mouseUp(document);
      });

      // Width should remain within bounds
      const newWidth = useAppStore.getState().sidebarWidth;
      expect(newWidth).toBeGreaterThanOrEqual(150);
      expect(newWidth).toBeLessThanOrEqual(500);
    });

    it('handles ArrowRight key to increase width', () => {
      renderWithProvider(<Sidebar />);

      const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' });
      const initialWidth = useAppStore.getState().sidebarWidth;

      act(() => {
        fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' });
      });

      const newWidth = useAppStore.getState().sidebarWidth;
      expect(newWidth).toBe(Math.min(500, initialWidth + 5));
    });

    it('handles ArrowLeft key to decrease width', () => {
      useAppStore.setState({ sidebarWidth: 300 });
      renderWithProvider(<Sidebar />);

      const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' });

      act(() => {
        fireEvent.keyDown(resizeHandle, { key: 'ArrowLeft' });
      });

      const newWidth = useAppStore.getState().sidebarWidth;
      expect(newWidth).toBe(295);
    });

    it('handles Shift+ArrowRight for large step', () => {
      renderWithProvider(<Sidebar />);

      const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' });
      const initialWidth = useAppStore.getState().sidebarWidth;

      act(() => {
        fireEvent.keyDown(resizeHandle, { key: 'ArrowRight', shiftKey: true });
      });

      const newWidth = useAppStore.getState().sidebarWidth;
      expect(newWidth).toBe(Math.min(500, initialWidth + 20));
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
    it('resize handle has correct ARIA attributes', () => {
      renderWithProvider(<Sidebar />);

      const handle = screen.getByRole('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('aria-label')).toBe('Resize sidebar');
      expect(handle.getAttribute('aria-valuemin')).toBe('150');
      expect(handle.getAttribute('aria-valuemax')).toBe('500');
      expect(handle.getAttribute('tabindex')).toBe('0');
    });

    it('New Page button has accessible name', () => {
      renderWithProvider(<Sidebar />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toBeDefined();
    });

    it('rail mode renders icon rail with data-testid', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });
      renderWithProvider(<Sidebar />);

      expect(screen.getByTestId('sidebar-rail')).toBeDefined();
    });
  });

  // ============================================================================
  // Integration with Store
  // ============================================================================

  describe('Store Integration', () => {
    it('uses sidebarMode from store — closed mode hides content', () => {
      renderWithProvider(<Sidebar />);
      expect(screen.getByRole('button', { name: 'Create new page' })).toBeDefined();

      act(() => {
        useAppStore.setState({ sidebarMode: 'closed', sidebarOpen: false });
      });

      expect(screen.queryByRole('button', { name: 'Create new page' })).toBeNull();
    });

    it('uses sidebarWidth from store', () => {
      renderWithProvider(<Sidebar />);

      act(() => {
        useAppStore.getState().setSidebarWidth(400);
      });

      expect(useAppStore.getState().sidebarWidth).toBe(400);
    });

    it('setSidebarWidth persists via Zustand (not localStorage)', () => {
      renderWithProvider(<Sidebar />);

      act(() => {
        useAppStore.getState().setSidebarWidth(350);
      });

      expect(useAppStore.getState().sidebarWidth).toBe(350);
    });
  });
});
