/**
 * Tests for GraphScreen component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { GraphScreen } from '../../../src/screens/GraphScreen';
import { DatabaseContext, type DatabaseContextValue } from '../../../src/providers/DatabaseProvider';
import type { MobileDatabase } from '@double-bind/mobile';

// Mock navigation
const mockNavigate = vi.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: vi.fn(),
  setOptions: vi.fn(),
} as any;

// Mock database
const mockQuery = vi.fn();
const mockDb: MobileDatabase = {
  query: mockQuery,
} as unknown as MobileDatabase;

// Mock route
const mockRoute = {
  key: 'graph-screen',
  name: 'Graph' as const,
  params: undefined,
};

// Test wrapper with database context
function createWrapper(dbStatus: 'initializing' | 'ready' | 'error' = 'ready') {
  const contextValue: DatabaseContextValue = {
    db: dbStatus === 'ready' ? mockDb : null,
    status: dbStatus,
    error: dbStatus === 'error' ? 'Test error' : null,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );
  };
}

describe('GraphScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should show loading spinner initially', () => {
      mockQuery.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    });

    it('should show empty state when no pages exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No Pages Yet')).toBeTruthy();
      });
    });

    it('should show error message when query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/Query failed/)).toBeTruthy();
      });
    });

    it('should render graph when data loads successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'Test Page'],
            ['page-2', 'Another Page'],
          ],
        })
        .mockResolvedValueOnce({
          rows: [['page-1', 'page-2']],
        });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('knowledge-graph')).toBeTruthy();
      });
    });
  });

  describe('view mode toggle', () => {
    beforeEach(async () => {
      // Setup with sample data
      mockQuery
        .mockResolvedValue({
          rows: [
            ['page-1', 'Page One'],
            ['page-2', 'Page Two'],
          ],
        })
        .mockResolvedValue({
          rows: [['page-1', 'page-2']],
        });
    });

    it('should start in full graph mode', async () => {
      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('Full Graph')).toBeTruthy();
      });

      const toggleButton = screen.getByTestId('graph-view-toggle');
      expect(toggleButton.props.accessibilityLabel).toBe('Switch to local graph view');
    });

    it('should toggle to local view when button is pressed', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'Page One']],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-toggle')).toBeTruthy();
      });

      const toggleButton = screen.getByTestId('graph-view-toggle');
      fireEvent.press(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Local View')).toBeTruthy();
      });
    });

    it('should show center page name in local view', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'My Center Page']],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-toggle')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('graph-view-toggle'));

      await waitFor(() => {
        expect(screen.getByText(/Showing connections for: My Center Page/)).toBeTruthy();
      });
    });

    it('should toggle back to full view', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'Page One']],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('graph-view-toggle')).toBeTruthy();
      });

      // Toggle to local
      fireEvent.press(screen.getByTestId('graph-view-toggle'));

      await waitFor(() => {
        expect(screen.getByText('Local View')).toBeTruthy();
      });

      // Toggle back to full
      fireEvent.press(screen.getByTestId('graph-view-toggle'));

      await waitFor(() => {
        expect(screen.getByText('Full Graph')).toBeTruthy();
      });
    });
  });

  describe('node selection', () => {
    beforeEach(() => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            ['page-1', 'First Page'],
            ['page-2', 'Second Page'],
          ],
        })
        .mockResolvedValueOnce({
          rows: [['page-1', 'page-2']],
        });
    });

    it('should show detail panel when node is tapped', async () => {
      const { getByTestId } = render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(getByTestId('knowledge-graph')).toBeTruthy();
      });

      // Simulate node press through the graph component
      const graph = getByTestId('knowledge-graph');
      const onNodePress = graph.props.onNodePress;

      onNodePress('page-1');

      await waitFor(() => {
        expect(screen.getByTestId('graph-detail-panel')).toBeTruthy();
        expect(screen.getByText('First Page')).toBeTruthy();
      });
    });

    it('should switch to local view when node is tapped in full view', async () => {
      const { getByTestId } = render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(getByTestId('knowledge-graph')).toBeTruthy();
      });

      // Should be in full view initially
      expect(screen.getByText('Full Graph')).toBeTruthy();

      // Tap a node
      const graph = getByTestId('knowledge-graph');
      graph.props.onNodePress('page-1');

      await waitFor(() => {
        // Should switch to local view
        expect(screen.getByText('Local View')).toBeTruthy();
      });
    });
  });

  describe('detail panel interactions', () => {
    beforeEach(() => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'Test Page']],
        })
        .mockResolvedValueOnce({
          rows: [],
        });
    });

    it('should navigate to page when "Open Page" is pressed', async () => {
      const { getByTestId } = render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(getByTestId('knowledge-graph')).toBeTruthy();
      });

      // Open detail panel
      const graph = getByTestId('knowledge-graph');
      graph.props.onNodePress('page-1');

      await waitFor(() => {
        expect(screen.getByTestId('graph-detail-panel')).toBeTruthy();
      });

      // Press "Open Page" button
      const openButton = screen.getByTestId('graph-detail-panel-open-button');
      fireEvent.press(openButton);

      expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
        screen: 'PagesTab',
        params: {
          screen: 'Page',
          params: { pageId: 'page-1' },
        },
      });
    });

    it('should dismiss detail panel when backdrop is pressed', async () => {
      const { getByTestId } = render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(getByTestId('knowledge-graph')).toBeTruthy();
      });

      // Open detail panel
      const graph = getByTestId('knowledge-graph');
      graph.props.onNodePress('page-1');

      await waitFor(() => {
        expect(screen.getByTestId('graph-detail-panel')).toBeTruthy();
      });

      // Press backdrop
      const backdrop = screen.getByTestId('graph-detail-panel-backdrop');
      fireEvent.press(backdrop);

      await waitFor(() => {
        expect(screen.queryByTestId('graph-detail-panel')).toBeNull();
      });
    });

    it('should close detail panel before navigating', async () => {
      const { getByTestId } = render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(getByTestId('knowledge-graph')).toBeTruthy();
      });

      // Open detail panel
      const graph = getByTestId('knowledge-graph');
      graph.props.onNodePress('page-1');

      await waitFor(() => {
        expect(screen.getByTestId('graph-detail-panel')).toBeTruthy();
      });

      // Press "Open Page"
      const openButton = screen.getByTestId('graph-detail-panel-open-button');
      fireEvent.press(openButton);

      // Panel should be dismissed
      await waitFor(() => {
        expect(screen.queryByTestId('graph-detail-panel')).toBeNull();
      });
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [['page-1', 'Test Page']],
        })
        .mockResolvedValueOnce({
          rows: [],
        });
    });

    it('should have proper accessibility labels on toggle button', async () => {
      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const toggleButton = screen.getByTestId('graph-view-toggle');
        expect(toggleButton.props.accessibilityRole).toBe('button');
        expect(toggleButton.props.accessibilityLabel).toBe('Switch to local graph view');
      });
    });

    it('should meet minimum touch target size', async () => {
      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const toggleButton = screen.getByTestId('graph-view-toggle');
        expect(toggleButton.props.style).toContainEqual(
          expect.objectContaining({ minHeight: 44 })
        );
      });
    });
  });

  describe('empty state action', () => {
    it('should navigate to page list when action is pressed', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      render(
        <GraphScreen navigation={mockNavigation} route={mockRoute} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No Pages Yet')).toBeTruthy();
      });

      const createButton = screen.getByText('Create Page');
      fireEvent.press(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
        screen: 'PagesTab',
        params: {
          screen: 'PageList',
        },
      });
    });
  });
});
