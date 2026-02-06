/**
 * Tests for App component integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { App } from '../../../src/App.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

describe('App', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders the app shell', () => {
      render(<App />);
      expect(screen.getByTestId('app-shell')).toBeDefined();
    });

    it('renders the sidebar when open', () => {
      render(<App />);
      expect(screen.getByTestId('sidebar')).toBeDefined();
    });

    it('does not render sidebar when closed', () => {
      useAppStore.setState({ sidebarOpen: false });
      render(<App />);
      expect(screen.queryByTestId('sidebar')).toBeNull();
    });

    it('renders the navigation bar', () => {
      render(<App />);
      expect(screen.getByTestId('navigation-bar')).toBeDefined();
    });

    it('renders DailyNotesView by default when no page selected', () => {
      render(<App />);
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });
  });

  // ==========================================================================
  // Navigation
  // ==========================================================================

  describe('Navigation', () => {
    it('navigates to page when navigateToPage is called', () => {
      render(<App />);

      act(() => {
        useAppStore.getState().navigateToPage('page/test-page');
      });

      expect(screen.getByTestId('page-view')).toBeDefined();
      expect(screen.getByTestId('page-id').textContent).toContain('test-page');
    });

    it('shows DailyNotesView when navigating to empty page ID', () => {
      render(<App />);

      // First navigate to a page
      act(() => {
        useAppStore.getState().navigateToPage('page/test-page');
      });
      expect(screen.getByTestId('page-view')).toBeDefined();

      // Navigate to empty/null should show daily notes
      act(() => {
        useAppStore.setState({ currentPageId: null });
      });
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('navigates to graph view', () => {
      render(<App />);

      act(() => {
        useAppStore.getState().navigateToPage('graph');
      });

      expect(screen.getByTestId('graph-view')).toBeDefined();
    });

    it('navigates to query view', () => {
      render(<App />);

      act(() => {
        useAppStore.getState().navigateToPage('query');
      });

      expect(screen.getByTestId('query-view')).toBeDefined();
    });
  });

  // ==========================================================================
  // Navigation Bar Buttons
  // ==========================================================================

  describe('Navigation Bar Buttons', () => {
    it('back button is disabled when no history', () => {
      render(<App />);

      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toHaveProperty('disabled', true);
    });

    it('forward button is disabled when at end of history', () => {
      render(<App />);

      const forwardButton = screen.getByRole('button', { name: /go forward/i });
      expect(forwardButton).toHaveProperty('disabled', true);
    });

    it('back button is enabled when there is history', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      render(<App />);

      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toHaveProperty('disabled', false);
    });

    it('forward button is enabled when not at end of history', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      render(<App />);

      const forwardButton = screen.getByRole('button', { name: /go forward/i });
      expect(forwardButton).toHaveProperty('disabled', false);
    });

    it('clicking back button navigates back', () => {
      useAppStore.setState({
        currentPageId: 'page/page-2',
        pageHistory: ['page/page-1', 'page/page-2'],
        historyIndex: 1,
      });

      render(<App />);

      const backButton = screen.getByRole('button', { name: /go back/i });
      fireEvent.click(backButton);

      expect(useAppStore.getState().currentPageId).toBe('page/page-1');
    });

    it('clicking forward button navigates forward', () => {
      useAppStore.setState({
        currentPageId: 'page/page-1',
        pageHistory: ['page/page-1', 'page/page-2'],
        historyIndex: 0,
      });

      render(<App />);

      const forwardButton = screen.getByRole('button', { name: /go forward/i });
      fireEvent.click(forwardButton);

      expect(useAppStore.getState().currentPageId).toBe('page/page-2');
    });
  });

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================

  describe('Keyboard Shortcuts', () => {
    it('Ctrl+[ navigates back', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      render(<App />);

      const event = new KeyboardEvent('keydown', {
        key: '[',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().currentPageId).toBe('page-1');
    });

    it('Ctrl+] navigates forward', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      render(<App />);

      const event = new KeyboardEvent('keydown', {
        key: ']',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().currentPageId).toBe('page-2');
    });

    it('Cmd+[ navigates back (Mac)', () => {
      useAppStore.setState({
        currentPageId: 'page-2',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 1,
      });

      render(<App />);

      const event = new KeyboardEvent('keydown', {
        key: '[',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().currentPageId).toBe('page-1');
    });

    it('Cmd+] navigates forward (Mac)', () => {
      useAppStore.setState({
        currentPageId: 'page-1',
        pageHistory: ['page-1', 'page-2'],
        historyIndex: 0,
      });

      render(<App />);

      const event = new KeyboardEvent('keydown', {
        key: ']',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().currentPageId).toBe('page-2');
    });
  });

  // ==========================================================================
  // Sidebar Navigation
  // ==========================================================================

  describe('Sidebar Navigation', () => {
    it('clicking Daily Notes navigates to home', () => {
      useAppStore.setState({ currentPageId: 'page/test' });
      render(<App />);

      const dailyNotesButton = screen.getByRole('button', { name: /daily notes/i });
      fireEvent.click(dailyNotesButton);

      // Navigating to '' should still show daily notes view on re-render
      // The store should have the empty string as currentPageId
      expect(useAppStore.getState().currentPageId).toBe('');
    });

    it('clicking Graph navigates to graph view', () => {
      render(<App />);

      const graphButton = screen.getByRole('button', { name: /graph view/i });
      fireEvent.click(graphButton);

      expect(useAppStore.getState().currentPageId).toBe('graph');
    });

    it('clicking Query navigates to query view', () => {
      render(<App />);

      const queryButton = screen.getByRole('button', { name: /query editor/i });
      fireEvent.click(queryButton);

      expect(useAppStore.getState().currentPageId).toBe('query');
    });
  });

  // ==========================================================================
  // Content Swapping
  // ==========================================================================

  describe('Content Swapping', () => {
    it('sidebar persists while content changes', () => {
      render(<App />);

      // Initially shows daily notes
      expect(screen.getByTestId('sidebar')).toBeDefined();
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();

      // Navigate to page view
      act(() => {
        useAppStore.getState().navigateToPage('page/test');
      });

      // Sidebar still present, content changed
      expect(screen.getByTestId('sidebar')).toBeDefined();
      expect(screen.getByTestId('page-view')).toBeDefined();

      // Navigate to graph view
      act(() => {
        useAppStore.getState().navigateToPage('graph');
      });

      // Sidebar still present, content changed again
      expect(screen.getByTestId('sidebar')).toBeDefined();
      expect(screen.getByTestId('graph-view')).toBeDefined();
    });

    it('navigation bar persists while content changes', () => {
      render(<App />);

      expect(screen.getByTestId('navigation-bar')).toBeDefined();

      act(() => {
        useAppStore.getState().navigateToPage('page/test');
      });

      expect(screen.getByTestId('navigation-bar')).toBeDefined();
    });
  });

  // ==========================================================================
  // Command Palette
  // ==========================================================================

  describe('Command Palette', () => {
    it('shows command palette when open', () => {
      act(() => {
        useAppStore.setState({ commandPaletteOpen: true });
      });

      render(<App />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });

    it('command palette takes priority over current page', () => {
      useAppStore.setState({
        currentPageId: 'page/test',
        commandPaletteOpen: true,
      });

      render(<App />);

      // Command palette should be shown, not page view
      expect(screen.getByTestId('command-palette')).toBeDefined();
      expect(screen.queryByTestId('page-view')).toBeNull();
    });
  });
});
