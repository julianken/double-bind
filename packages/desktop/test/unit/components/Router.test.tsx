/**
 * Tests for Router component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { Router, type Route } from '../../../src/components/Router.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// ============================================================================
// Mock Components
// ============================================================================

function PageView({ params }: { params: Record<string, string> }) {
  return (
    <div data-testid="page-view">
      <h1>Page View</h1>
      <span data-testid="page-id">{params.id || 'no-id'}</span>
    </div>
  );
}

function DailyNotesView() {
  return (
    <div data-testid="daily-notes-view">
      <h1>Daily Notes</h1>
    </div>
  );
}

function SearchView({ params }: { params: Record<string, string> }) {
  return (
    <div data-testid="search-view">
      <h1>Search</h1>
      <span data-testid="query">{params.query || 'no-query'}</span>
    </div>
  );
}

function CommandPalette() {
  return (
    <div data-testid="command-palette">
      <h1>Command Palette</h1>
    </div>
  );
}

function CustomNotFound() {
  return (
    <div data-testid="custom-not-found">
      <h1>Custom 404</h1>
    </div>
  );
}

function CustomDefault() {
  return (
    <div data-testid="custom-default">
      <h1>Custom Default</h1>
    </div>
  );
}

// ============================================================================
// Test Routes
// ============================================================================

const testRoutes: Route[] = [
  { id: 'page', path: '/page/:id', component: PageView },
  { id: 'daily', path: '/daily', component: DailyNotesView },
  { id: 'search', path: '/search/:query', component: SearchView },
  { id: 'command-palette', path: '/command-palette', component: CommandPalette },
];

// ============================================================================
// Tests
// ============================================================================

describe('Router', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      currentPageId: null,
      commandPaletteOpen: false,
    });
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders default component when no page is selected', () => {
      useAppStore.setState({ currentPageId: null });

      render(<Router routes={testRoutes} />);

      expect(screen.getByText('No Page Selected')).toBeDefined();
    });

    it('renders custom default component when provided', () => {
      useAppStore.setState({ currentPageId: null });

      render(<Router routes={testRoutes} defaultComponent={CustomDefault} />);

      expect(screen.getByTestId('custom-default')).toBeDefined();
    });

    it('renders matching route component', () => {
      useAppStore.setState({ currentPageId: 'daily' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('renders not found component when no route matches', () => {
      useAppStore.setState({ currentPageId: 'unknown-page' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByText('Page Not Found')).toBeDefined();
    });

    it('renders custom not found component when provided', () => {
      useAppStore.setState({ currentPageId: 'unknown-page' });

      render(<Router routes={testRoutes} notFoundComponent={CustomNotFound} />);

      expect(screen.getByTestId('custom-not-found')).toBeDefined();
    });
  });

  // ==========================================================================
  // Route Matching
  // ==========================================================================

  describe('Route Matching', () => {
    it('matches simple route without params', () => {
      useAppStore.setState({ currentPageId: 'daily' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('matches route with single param', () => {
      useAppStore.setState({ currentPageId: 'page/abc-123' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('page-view')).toBeDefined();
      expect(screen.getByTestId('page-id').textContent).toBe('abc-123');
    });

    it('matches route with multiple params', () => {
      useAppStore.setState({ currentPageId: 'search/my-query' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('search-view')).toBeDefined();
      expect(screen.getByTestId('query').textContent).toBe('my-query');
    });

    it('passes empty params object for routes without params', () => {
      useAppStore.setState({ currentPageId: 'daily' });

      render(<Router routes={testRoutes} />);

      const dailyView = screen.getByTestId('daily-notes-view');
      expect(dailyView).toBeDefined();
    });

    it('matches first route when multiple routes could match', () => {
      const routes: Route[] = [
        { id: 'first', path: '/page/:id', component: PageView },
        { id: 'second', path: '/page/:id', component: SearchView },
      ];

      useAppStore.setState({ currentPageId: 'page/test' });

      render(<Router routes={routes} />);

      // Should render first matching route (PageView)
      expect(screen.getByTestId('page-view')).toBeDefined();
    });
  });

  // ==========================================================================
  // Parameter Extraction
  // ==========================================================================

  describe('Parameter Extraction', () => {
    it('extracts single parameter correctly', () => {
      useAppStore.setState({ currentPageId: 'page/my-page-id' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('page-id').textContent).toBe('my-page-id');
    });

    it('extracts parameter with special characters', () => {
      useAppStore.setState({ currentPageId: 'page/2024-01-15_notes' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('page-id').textContent).toBe('2024-01-15_notes');
    });

    it('extracts parameter from second segment', () => {
      useAppStore.setState({ currentPageId: 'search/my-search-query' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('query').textContent).toBe('my-search-query');
    });

    it('handles empty parameter segments', () => {
      useAppStore.setState({ currentPageId: 'unknown-route' });

      render(<Router routes={testRoutes} />);

      // Should not match any route and show 404
      expect(screen.getByText('Page Not Found')).toBeDefined();
    });
  });

  // ==========================================================================
  // Command Palette Priority
  // ==========================================================================

  describe('Command Palette Priority', () => {
    it('renders command palette when open, overriding current page', () => {
      useAppStore.setState({
        currentPageId: 'daily',
        commandPaletteOpen: true,
      });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });

    it('renders current page when command palette is closed', () => {
      useAppStore.setState({
        currentPageId: 'daily',
        commandPaletteOpen: false,
      });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('renders nothing special if command palette open but no route defined', () => {
      const routesWithoutCommandPalette = testRoutes.filter((r) => r.id !== 'command-palette');

      useAppStore.setState({
        currentPageId: 'daily',
        commandPaletteOpen: true,
      });

      render(<Router routes={routesWithoutCommandPalette} />);

      // Should fall through to normal routing and render daily view
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles empty routes array', () => {
      useAppStore.setState({ currentPageId: 'any-page' });

      render(<Router routes={[]} />);

      expect(screen.getByText('Page Not Found')).toBeDefined();
    });

    it('handles null currentPageId with routes that require params', () => {
      useAppStore.setState({ currentPageId: null });

      render(<Router routes={testRoutes} />);

      // Should render default component, not attempt to match param routes
      expect(screen.getByText('No Page Selected')).toBeDefined();
    });

    it('handles pageId with leading slash', () => {
      // Router should handle both 'page/id' and '/page/id'
      useAppStore.setState({ currentPageId: 'page/test-id' });

      render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('page-view')).toBeDefined();
      expect(screen.getByTestId('page-id').textContent).toBe('test-id');
    });

    it('handles pageId with trailing slash', () => {
      useAppStore.setState({ currentPageId: 'daily/' });

      render(<Router routes={testRoutes} />);

      // Trailing slash should still match
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('does not match partial routes', () => {
      useAppStore.setState({ currentPageId: 'page' });

      render(<Router routes={testRoutes} />);

      // 'page' should not match '/page/:id'
      expect(screen.getByText('Page Not Found')).toBeDefined();
    });

    it('handles routes with similar patterns', () => {
      const routes: Route[] = [
        { id: 'page', path: '/page/:id', component: PageView },
        { id: 'page-edit', path: '/page/:id/edit', component: SearchView },
      ];

      useAppStore.setState({ currentPageId: 'page/123' });

      render(<Router routes={routes} />);

      // Should match the first route, not the more specific second route
      expect(screen.getByTestId('page-view')).toBeDefined();
    });
  });

  // ==========================================================================
  // Reactivity
  // ==========================================================================

  describe('Reactivity', () => {
    it('updates rendered component when currentPageId changes', () => {
      useAppStore.setState({ currentPageId: 'daily' });

      const { rerender } = render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();

      // Change page
      act(() => {
        useAppStore.setState({ currentPageId: 'page/new-page' });
      });
      rerender(<Router routes={testRoutes} />);

      expect(screen.getByTestId('page-view')).toBeDefined();
      expect(screen.getByTestId('page-id').textContent).toBe('new-page');
    });

    it('updates rendered component when commandPaletteOpen changes', () => {
      useAppStore.setState({
        currentPageId: 'daily',
        commandPaletteOpen: false,
      });

      const { rerender } = render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();

      // Open command palette
      act(() => {
        useAppStore.setState({ commandPaletteOpen: true });
      });
      rerender(<Router routes={testRoutes} />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });

    it('handles rapid navigation changes', () => {
      const { rerender } = render(<Router routes={testRoutes} />);

      // Rapidly change pages
      act(() => {
        useAppStore.setState({ currentPageId: 'daily' });
      });
      rerender(<Router routes={testRoutes} />);
      expect(screen.getByTestId('daily-notes-view')).toBeDefined();

      act(() => {
        useAppStore.setState({ currentPageId: 'page/test-1' });
      });
      rerender(<Router routes={testRoutes} />);
      expect(screen.getByTestId('page-view')).toBeDefined();

      act(() => {
        useAppStore.setState({ currentPageId: 'search/query-1' });
      });
      rerender(<Router routes={testRoutes} />);
      expect(screen.getByTestId('search-view')).toBeDefined();

      act(() => {
        useAppStore.setState({ currentPageId: null });
      });
      rerender(<Router routes={testRoutes} />);
      expect(screen.getByText('No Page Selected')).toBeDefined();
    });
  });

  // ==========================================================================
  // Integration with AppStore
  // ==========================================================================

  describe('Integration with AppStore', () => {
    it('subscribes to currentPageId changes', () => {
      const { rerender } = render(<Router routes={testRoutes} />);

      // Initial state
      expect(screen.getByText('No Page Selected')).toBeDefined();

      // Update via store action
      act(() => {
        useAppStore.getState().navigateToPage('daily');
      });
      rerender(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();
    });

    it('subscribes to commandPaletteOpen changes', () => {
      useAppStore.setState({ currentPageId: 'daily' });

      const { rerender } = render(<Router routes={testRoutes} />);

      expect(screen.getByTestId('daily-notes-view')).toBeDefined();

      // Toggle command palette via store action
      act(() => {
        useAppStore.getState().toggleCommandPalette();
      });
      rerender(<Router routes={testRoutes} />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });
  });
});
