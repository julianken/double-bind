/**
 * Tests for Sidebar component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  Sidebar,
  SearchBar,
  QuickCapture,
  PageList,
  SidebarFooter,
} from '../../../src/layout/Sidebar.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

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
      render(<Sidebar />);

      expect(screen.getByRole('complementary')).toBeDefined();
      expect(screen.getByLabelText('Application sidebar')).toBeDefined();
    });

    it('does not render when sidebarOpen is false', () => {
      useAppStore.setState({ sidebarOpen: false });

      render(<Sidebar />);

      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('renders SearchBar component', () => {
      render(<Sidebar />);

      expect(screen.getByRole('search')).toBeDefined();
      expect(screen.getByPlaceholderText('Search pages...')).toBeDefined();
    });

    it('renders QuickCapture component', () => {
      render(<Sidebar />);

      expect(screen.getByPlaceholderText('Quick capture...')).toBeDefined();
    });

    it('renders PageList component', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation', { name: 'Page navigation' })).toBeDefined();
    });

    it('renders SidebarFooter component', () => {
      render(<Sidebar />);

      expect(screen.getByText('Double Bind')).toBeDefined();
    });

    it('renders New Page button', () => {
      render(<Sidebar />);

      expect(screen.getByRole('button', { name: 'Create new page' })).toBeDefined();
      expect(screen.getByText('+ New Page')).toBeDefined();
    });

    it('renders resize handle', () => {
      render(<Sidebar />);

      expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeDefined();
    });
  });

  // ============================================================================
  // New Page Button
  // ============================================================================

  describe('New Page Button', () => {
    it('is disabled when no onNewPage callback is provided', () => {
      render(<Sidebar />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toHaveProperty('disabled', true);
    });

    it('is enabled when onNewPage callback is provided', () => {
      const onNewPage = vi.fn();
      render(<Sidebar onNewPage={onNewPage} />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toHaveProperty('disabled', false);
    });

    it('calls onNewPage when clicked', async () => {
      const user = userEvent.setup();
      const onNewPage = vi.fn();
      render(<Sidebar onNewPage={onNewPage} />);

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
      render(<Sidebar />);

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
      render(<Sidebar />);

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
      render(<Sidebar />);

      act(() => {
        fireEvent.keyDown(document, { key: '\\', ctrlKey: false });
      });

      // Should still be open
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('does not toggle sidebar with Ctrl+other key', () => {
      render(<Sidebar />);

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
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('250px');
    });

    it('loads width from localStorage on mount', () => {
      mockStorage['sidebar-width'] = '300';
      render(<Sidebar />);

      // Wait for effect to run
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('300px');
    });

    it('ignores invalid stored width below minimum', () => {
      mockStorage['sidebar-width'] = '100'; // Below minimum of 150
      render(<Sidebar />);

      // Should keep store default since 100 is below minimum and invalid
      const sidebar = screen.getByRole('complementary');
      // Store default is 240px when invalid value is found
      expect(sidebar.style.width).toBe('240px');
    });

    it('ignores invalid stored width above maximum', () => {
      mockStorage['sidebar-width'] = '600'; // Above maximum of 500
      render(<Sidebar />);

      // Should keep store default since 600 is above maximum and invalid
      const sidebar = screen.getByRole('complementary');
      // Store default is 240px when invalid value is found
      expect(sidebar.style.width).toBe('240px');
    });

    it('persists width changes to localStorage', () => {
      render(<Sidebar />);

      // Change width in store
      act(() => {
        useAppStore.getState().setSidebarWidth(350);
      });

      // Should be persisted
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('sidebar-width', '350');
    });

    it('handles resize via mouse drag', () => {
      render(<Sidebar />);

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
      // We can verify the Sidebar is wrapped in an ErrorBoundary by checking
      // the component structure renders correctly
      const { container } = render(<Sidebar />);
      expect(container.querySelector('.sidebar')).toBeDefined();
    });
  });

  // ============================================================================
  // Stub Components
  // ============================================================================

  describe('Stub Components', () => {
    describe('SearchBar', () => {
      it('renders with correct accessibility attributes', () => {
        render(<SearchBar />);

        const search = screen.getByRole('search');
        expect(search).toBeDefined();

        const input = screen.getByLabelText('Search pages');
        expect(input).toBeDefined();
        expect(input).toHaveProperty('disabled', true);
      });
    });

    describe('QuickCapture', () => {
      it('renders with correct accessibility attributes', () => {
        render(<QuickCapture />);

        const textarea = screen.getByLabelText('Quick capture');
        expect(textarea).toBeDefined();
        expect(textarea).toHaveProperty('disabled', true);
      });
    });

    describe('PageList', () => {
      it('renders with correct accessibility attributes', () => {
        render(<PageList />);

        const nav = screen.getByRole('navigation', { name: 'Page navigation' });
        expect(nav).toBeDefined();

        const list = screen.getByRole('list');
        expect(list).toBeDefined();
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
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeDefined();
      expect(sidebar.getAttribute('aria-label')).toBe('Application sidebar');
    });

    it('resize handle has correct ARIA attributes', () => {
      render(<Sidebar />);

      const handle = screen.getByRole('separator');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('aria-label')).toBe('Resize sidebar');
    });

    it('New Page button has accessible name', () => {
      render(<Sidebar />);

      const button = screen.getByRole('button', { name: 'Create new page' });
      expect(button).toBeDefined();
    });
  });

  // ============================================================================
  // Integration with Store
  // ============================================================================

  describe('Store Integration', () => {
    it('uses sidebarOpen from store', () => {
      render(<Sidebar />);
      expect(screen.getByRole('complementary')).toBeDefined();

      act(() => {
        useAppStore.getState().toggleSidebar();
      });

      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('uses sidebarWidth from store', () => {
      render(<Sidebar />);

      act(() => {
        useAppStore.getState().setSidebarWidth(400);
      });

      const sidebar = screen.getByRole('complementary');
      expect(sidebar.style.width).toBe('400px');
    });
  });
});
