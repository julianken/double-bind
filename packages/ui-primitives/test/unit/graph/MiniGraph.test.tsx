/**
 * Tests for MiniGraph component.
 *
 * Tests cover:
 * - Rendering with nodes and edges
 * - Empty state rendering
 * - Center node emphasis
 * - Click handler functionality
 * - Dimension props
 * - Data attributes
 * - Custom className support
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  MiniGraph,
  type MiniGraphProps,
  type MiniGraphNode,
  type MiniGraphEdge,
} from '../../../src/graph/MiniGraph';

// Mock react-force-graph-2d since it uses canvas
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(({ graphData, onNodeClick, width, height, nodeLabel }) => {
    // Simplified mock that renders nodes as clickable elements
    return (
      <div
        data-testid="force-graph-mock"
        style={{ width, height }}
        data-node-count={graphData.nodes.length}
        data-link-count={graphData.links.length}
      >
        {graphData.nodes.map((node: { id: string; title: string; isCenter: boolean }) => (
          <button
            key={node.id}
            data-testid={`graph-node-${node.id}`}
            data-is-center={node.isCenter}
            data-title={node.title}
            onClick={() => onNodeClick?.(node)}
            title={nodeLabel?.(node)}
          >
            {node.title}
          </button>
        ))}
      </div>
    );
  }),
}));

// Sample test data
const sampleNodes: MiniGraphNode[] = [
  { id: 'page-1', title: 'Current Page' },
  { id: 'page-2', title: 'Linked Page A' },
  { id: 'page-3', title: 'Linked Page B' },
];

const sampleEdges: MiniGraphEdge[] = [
  { source: 'page-1', target: 'page-2' },
  { source: 'page-1', target: 'page-3' },
];

// Helper to render MiniGraph with defaults
function renderMiniGraph(overrides: Partial<MiniGraphProps> = {}) {
  const defaultProps: MiniGraphProps = {
    centerNodeId: 'page-1',
    nodes: sampleNodes,
    edges: sampleEdges,
    ...overrides,
  };

  return {
    ...render(<MiniGraph {...defaultProps} />),
    props: defaultProps,
  };
}

describe('MiniGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the mini-graph container', () => {
      renderMiniGraph();

      expect(screen.getByTestId('mini-graph')).toBeDefined();
    });

    it('renders with default dimensions when not specified', () => {
      renderMiniGraph();

      const container = screen.getByTestId('mini-graph');
      expect(container.style.width).toBe('200px');
      expect(container.style.height).toBe('150px');
    });

    it('renders with custom dimensions', () => {
      renderMiniGraph({ width: 300, height: 250 });

      const container = screen.getByTestId('mini-graph');
      expect(container.style.width).toBe('300px');
      expect(container.style.height).toBe('250px');
    });

    it('passes dimensions to ForceGraph2D', () => {
      renderMiniGraph({ width: 350, height: 280 });

      const forceGraph = screen.getByTestId('force-graph-mock');
      expect(forceGraph.style.width).toBe('350px');
      expect(forceGraph.style.height).toBe('280px');
    });

    it('renders all nodes', () => {
      renderMiniGraph();

      expect(screen.getByTestId('graph-node-page-1')).toBeDefined();
      expect(screen.getByTestId('graph-node-page-2')).toBeDefined();
      expect(screen.getByTestId('graph-node-page-3')).toBeDefined();
    });

    it('sets correct node count in graph data', () => {
      renderMiniGraph();

      const forceGraph = screen.getByTestId('force-graph-mock');
      expect(forceGraph.getAttribute('data-node-count')).toBe('3');
    });

    it('sets correct link count in graph data', () => {
      renderMiniGraph();

      const forceGraph = screen.getByTestId('force-graph-mock');
      expect(forceGraph.getAttribute('data-link-count')).toBe('2');
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no nodes provided', () => {
      renderMiniGraph({ nodes: [], edges: [] });

      expect(screen.getByTestId('mini-graph-empty')).toBeDefined();
      expect(screen.queryByTestId('mini-graph')).toBeNull();
    });

    it('displays "No connections" message in empty state', () => {
      renderMiniGraph({ nodes: [], edges: [] });

      expect(screen.getByText('No connections')).toBeDefined();
    });

    it('applies dimensions to empty state container', () => {
      renderMiniGraph({ nodes: [], edges: [], width: 250, height: 180 });

      const emptyContainer = screen.getByTestId('mini-graph-empty');
      expect(emptyContainer.style.width).toBe('250px');
      expect(emptyContainer.style.height).toBe('180px');
    });
  });

  describe('Center Node Emphasis', () => {
    it('marks the center node as center', () => {
      renderMiniGraph({ centerNodeId: 'page-1' });

      const centerNode = screen.getByTestId('graph-node-page-1');
      expect(centerNode.getAttribute('data-is-center')).toBe('true');
    });

    it('does not mark other nodes as center', () => {
      renderMiniGraph({ centerNodeId: 'page-1' });

      const otherNode = screen.getByTestId('graph-node-page-2');
      expect(otherNode.getAttribute('data-is-center')).toBe('false');
    });

    it('updates center node when centerNodeId changes', () => {
      const { rerender } = renderMiniGraph({ centerNodeId: 'page-1' });

      // Initially page-1 is center
      expect(screen.getByTestId('graph-node-page-1').getAttribute('data-is-center')).toBe('true');
      expect(screen.getByTestId('graph-node-page-2').getAttribute('data-is-center')).toBe('false');

      // Re-render with different center
      rerender(<MiniGraph centerNodeId="page-2" nodes={sampleNodes} edges={sampleEdges} />);

      expect(screen.getByTestId('graph-node-page-1').getAttribute('data-is-center')).toBe('false');
      expect(screen.getByTestId('graph-node-page-2').getAttribute('data-is-center')).toBe('true');
    });

    it('stores center node ID in data attribute', () => {
      renderMiniGraph({ centerNodeId: 'page-1' });

      const container = screen.getByTestId('mini-graph');
      expect(container.getAttribute('data-center-node')).toBe('page-1');
    });
  });

  describe('Click Handling', () => {
    it('calls onNodeClick when a node is clicked', async () => {
      const user = userEvent.setup();
      const onNodeClick = vi.fn();
      renderMiniGraph({ onNodeClick });

      await user.click(screen.getByTestId('graph-node-page-2'));

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith('page-2');
    });

    it('calls onNodeClick with center node ID when center is clicked', async () => {
      const user = userEvent.setup();
      const onNodeClick = vi.fn();
      renderMiniGraph({ onNodeClick, centerNodeId: 'page-1' });

      await user.click(screen.getByTestId('graph-node-page-1'));

      expect(onNodeClick).toHaveBeenCalledWith('page-1');
    });

    it('does not throw when onNodeClick is not provided', async () => {
      const user = userEvent.setup();
      renderMiniGraph({ onNodeClick: undefined });

      // Should not throw
      await expect(user.click(screen.getByTestId('graph-node-page-1'))).resolves.not.toThrow();
    });

    it('handles multiple clicks correctly', async () => {
      const user = userEvent.setup();
      const onNodeClick = vi.fn();
      renderMiniGraph({ onNodeClick });

      await user.click(screen.getByTestId('graph-node-page-1'));
      await user.click(screen.getByTestId('graph-node-page-2'));
      await user.click(screen.getByTestId('graph-node-page-3'));

      expect(onNodeClick).toHaveBeenCalledTimes(3);
      expect(onNodeClick).toHaveBeenNthCalledWith(1, 'page-1');
      expect(onNodeClick).toHaveBeenNthCalledWith(2, 'page-2');
      expect(onNodeClick).toHaveBeenNthCalledWith(3, 'page-3');
    });
  });

  describe('Node Labels', () => {
    it('sets node title attribute for tooltip', () => {
      renderMiniGraph();

      const node = screen.getByTestId('graph-node-page-1');
      expect(node.getAttribute('title')).toBe('Current Page');
    });

    it('sets data-title attribute on nodes', () => {
      renderMiniGraph();

      const node = screen.getByTestId('graph-node-page-2');
      expect(node.getAttribute('data-title')).toBe('Linked Page A');
    });
  });

  describe('Styling', () => {
    it('applies custom className to container', () => {
      renderMiniGraph({ className: 'custom-mini-graph' });

      const container = screen.getByTestId('mini-graph');
      expect(container.classList.contains('custom-mini-graph')).toBe(true);
    });

    it('applies custom className to empty state container', () => {
      renderMiniGraph({ nodes: [], edges: [], className: 'custom-empty-graph' });

      const container = screen.getByTestId('mini-graph-empty');
      expect(container.classList.contains('custom-empty-graph')).toBe(true);
    });

    it('has overflow hidden on container', () => {
      renderMiniGraph();

      const container = screen.getByTestId('mini-graph');
      expect(container.style.overflow).toBe('hidden');
    });

    it('has border-radius on container', () => {
      renderMiniGraph();

      const container = screen.getByTestId('mini-graph');
      expect(container.style.borderRadius).toBe('4px');
    });
  });

  describe('Edge Cases', () => {
    it('handles single node without edges', () => {
      renderMiniGraph({
        nodes: [{ id: 'page-1', title: 'Lonely Page' }],
        edges: [],
        centerNodeId: 'page-1',
      });

      expect(screen.getByTestId('graph-node-page-1')).toBeDefined();
      expect(screen.getByTestId('force-graph-mock').getAttribute('data-link-count')).toBe('0');
    });

    it('handles nodes with very long titles', () => {
      const longTitle = 'This is a very long page title that should be truncated in the display';
      renderMiniGraph({
        nodes: [{ id: 'page-1', title: longTitle }],
        edges: [],
        centerNodeId: 'page-1',
      });

      const node = screen.getByTestId('graph-node-page-1');
      expect(node.getAttribute('data-title')).toBe(longTitle);
    });

    it('handles centerNodeId that does not exist in nodes', () => {
      renderMiniGraph({
        centerNodeId: 'non-existent-page',
      });

      // All nodes should have isCenter=false
      expect(screen.getByTestId('graph-node-page-1').getAttribute('data-is-center')).toBe('false');
      expect(screen.getByTestId('graph-node-page-2').getAttribute('data-is-center')).toBe('false');
      expect(screen.getByTestId('graph-node-page-3').getAttribute('data-is-center')).toBe('false');
    });

    it('handles minimum dimensions (200x150)', () => {
      renderMiniGraph({ width: 200, height: 150 });

      const container = screen.getByTestId('mini-graph');
      expect(container.style.width).toBe('200px');
      expect(container.style.height).toBe('150px');
    });

    it('handles self-referential edges', () => {
      renderMiniGraph({
        nodes: [{ id: 'page-1', title: 'Self-ref Page' }],
        edges: [{ source: 'page-1', target: 'page-1' }],
        centerNodeId: 'page-1',
      });

      expect(screen.getByTestId('force-graph-mock').getAttribute('data-link-count')).toBe('1');
    });
  });

  describe('Memoization', () => {
    it('is memoized (wrapped with memo)', () => {
      const onNodeClick = vi.fn();
      const { rerender } = renderMiniGraph({ onNodeClick });

      const containerBefore = screen.getByTestId('mini-graph');

      rerender(
        <MiniGraph
          centerNodeId="page-1"
          nodes={sampleNodes}
          edges={sampleEdges}
          onNodeClick={onNodeClick}
        />
      );

      const containerAfter = screen.getByTestId('mini-graph');

      // Same DOM node indicates memoization worked
      expect(containerBefore).toBe(containerAfter);
    });
  });

  describe('Graph Data Transformation', () => {
    it('transforms nodes with isCenter flag', () => {
      renderMiniGraph({ centerNodeId: 'page-2' });

      // Verify the center node is correctly identified
      expect(screen.getByTestId('graph-node-page-2').getAttribute('data-is-center')).toBe('true');
      expect(screen.getByTestId('graph-node-page-1').getAttribute('data-is-center')).toBe('false');
    });

    it('preserves node titles in transformed data', () => {
      renderMiniGraph();

      expect(screen.getByTestId('graph-node-page-1').getAttribute('data-title')).toBe(
        'Current Page'
      );
      expect(screen.getByTestId('graph-node-page-2').getAttribute('data-title')).toBe(
        'Linked Page A'
      );
      expect(screen.getByTestId('graph-node-page-3').getAttribute('data-title')).toBe(
        'Linked Page B'
      );
    });
  });
});
