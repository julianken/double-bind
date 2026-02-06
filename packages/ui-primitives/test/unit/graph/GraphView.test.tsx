/**
 * Tests for GraphView component.
 *
 * Tests cover:
 * - Rendering with nodes and edges
 * - Node click callback
 * - Node hover callback
 * - Highlighted node handling
 * - Community coloring
 * - PageRank sizing
 * - Data transformation
 *
 * Note: Canvas rendering is mocked since JSDOM doesn't support canvas.
 * We test the component's React behavior and callback handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphView, type GraphViewProps, type GraphNode, type GraphEdge } from '../../../src/graph';

// Store for mock props - outside the mock to be accessible
let mockLastProps: {
  graphData?: {
    nodes: Array<{ id: string; title: string; pageRank?: number; community?: number }>;
    links: Array<{ source: string; target: string }>;
  };
  onNodeClick?: (node: object) => void;
  onNodeHover?: (node: object | null) => void;
  nodeCanvasObject?: (node: object, ctx: object, scale: number) => void;
  nodePointerAreaPaint?: (node: object, color: string, ctx: object) => void;
  width?: number;
  height?: number;
} = {};

// Mock react-force-graph-2d since it requires canvas
vi.mock('react-force-graph-2d', () => {
  const MockForceGraph2D = ({
    graphData,
    onNodeClick,
    onNodeHover,
    nodeCanvasObject,
    nodePointerAreaPaint,
    width,
    height,
  }: {
    graphData: {
      nodes: Array<{ id: string; title: string }>;
      links: Array<{ source: string; target: string }>;
    };
    onNodeClick?: (node: object) => void;
    onNodeHover?: (node: object | null) => void;
    nodeCanvasObject?: (node: object, ctx: object, scale: number) => void;
    nodePointerAreaPaint?: (node: object, color: string, ctx: object) => void;
    width?: number;
    height?: number;
  }) => {
    // Store props for testing
    mockLastProps = {
      graphData,
      onNodeClick,
      onNodeHover,
      nodeCanvasObject,
      nodePointerAreaPaint,
      width,
      height,
    };

    return (
      <div
        data-testid="mock-force-graph"
        data-node-count={graphData.nodes.length}
        data-link-count={graphData.links.length}
      >
        {graphData.nodes.map((node) => (
          <button
            key={node.id}
            data-testid={`node-${node.id}`}
            onClick={() => onNodeClick?.(node)}
            onMouseEnter={() => onNodeHover?.(node)}
            onMouseLeave={() => onNodeHover?.(null)}
          >
            {node.id}
          </button>
        ))}
      </div>
    );
  };

  return {
    default: MockForceGraph2D,
    __esModule: true,
  };
});

// Sample test data
const sampleNodes: GraphNode[] = [
  { id: 'node-1', title: 'Home', pageRank: 0.15, community: 0 },
  { id: 'node-2', title: 'Projects', pageRank: 0.08, community: 1 },
  { id: 'node-3', title: 'Notes', pageRank: 0.05, community: 0 },
];

const sampleEdges: GraphEdge[] = [
  { source: 'node-1', target: 'node-2' },
  { source: 'node-1', target: 'node-3' },
];

// Helper to render GraphView with defaults
function renderGraphView(overrides: Partial<GraphViewProps> = {}) {
  const defaultProps: GraphViewProps = {
    nodes: sampleNodes,
    edges: sampleEdges,
    onNodeClick: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<GraphView {...defaultProps} />),
    onNodeClick: defaultProps.onNodeClick,
    onNodeHover: overrides.onNodeHover,
  };
}

describe('GraphView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLastProps = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderGraphView();

      expect(screen.getByTestId('graph-view')).toBeDefined();
    });

    it('renders the mock force graph component', () => {
      renderGraphView();

      expect(screen.getByTestId('mock-force-graph')).toBeDefined();
    });

    it('passes correct node count to graph', () => {
      renderGraphView();

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-node-count')).toBe('3');
    });

    it('passes correct link count to graph', () => {
      renderGraphView();

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-link-count')).toBe('2');
    });

    it('renders with empty nodes and edges', () => {
      renderGraphView({ nodes: [], edges: [] });

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-node-count')).toBe('0');
      expect(graph.getAttribute('data-link-count')).toBe('0');
    });

    it('applies custom className', () => {
      renderGraphView({ className: 'custom-graph-class' });

      const container = screen.getByTestId('graph-view');
      expect(container.classList.contains('custom-graph-class')).toBe(true);
    });

    it('applies default width and height', () => {
      renderGraphView();

      const container = screen.getByTestId('graph-view');
      expect(container.style.width).toBe('800px');
      expect(container.style.height).toBe('600px');
    });

    it('applies custom width and height', () => {
      renderGraphView({ width: 1024, height: 768 });

      const container = screen.getByTestId('graph-view');
      expect(container.style.width).toBe('1024px');
      expect(container.style.height).toBe('768px');
    });
  });

  describe('Data Transformation', () => {
    it('transforms nodes to internal format', () => {
      renderGraphView();

      const graphData = mockLastProps.graphData;

      expect(graphData?.nodes).toHaveLength(3);
      expect(graphData?.nodes[0]).toEqual({
        id: 'node-1',
        title: 'Home',
        pageRank: 0.15,
        community: 0,
      });
    });

    it('transforms edges to internal format', () => {
      renderGraphView();

      const graphData = mockLastProps.graphData;

      expect(graphData?.links).toHaveLength(2);
      expect(graphData?.links[0]).toEqual({
        source: 'node-1',
        target: 'node-2',
      });
    });

    it('handles nodes without optional properties', () => {
      const nodesWithoutOptional: GraphNode[] = [
        { id: 'node-a', title: 'Page A' },
        { id: 'node-b', title: 'Page B' },
      ];

      renderGraphView({ nodes: nodesWithoutOptional, edges: [] });

      const graphData = mockLastProps.graphData;

      expect(graphData?.nodes[0].pageRank).toBeUndefined();
      expect(graphData?.nodes[0].community).toBeUndefined();
    });
  });

  describe('Node Click Handling', () => {
    it('calls onNodeClick when a node is clicked', () => {
      const { onNodeClick } = renderGraphView();

      fireEvent.click(screen.getByTestId('node-node-1'));

      expect(onNodeClick).toHaveBeenCalledTimes(1);
    });

    it('passes the correct node id to onNodeClick', () => {
      const onNodeClick = vi.fn();
      renderGraphView({ onNodeClick });

      fireEvent.click(screen.getByTestId('node-node-2'));

      expect(onNodeClick).toHaveBeenCalledWith('node-2');
    });

    it('handles clicks on different nodes', () => {
      const onNodeClick = vi.fn();
      renderGraphView({ onNodeClick });

      fireEvent.click(screen.getByTestId('node-node-1'));
      fireEvent.click(screen.getByTestId('node-node-3'));

      expect(onNodeClick).toHaveBeenCalledTimes(2);
      expect(onNodeClick).toHaveBeenNthCalledWith(1, 'node-1');
      expect(onNodeClick).toHaveBeenNthCalledWith(2, 'node-3');
    });
  });

  describe('Node Hover Handling', () => {
    it('calls onNodeHover when mouse enters a node', () => {
      const onNodeHover = vi.fn();
      renderGraphView({ onNodeHover });

      fireEvent.mouseEnter(screen.getByTestId('node-node-1'));

      expect(onNodeHover).toHaveBeenCalledWith('node-1');
    });

    it('calls onNodeHover with null when mouse leaves a node', () => {
      const onNodeHover = vi.fn();
      renderGraphView({ onNodeHover });

      fireEvent.mouseEnter(screen.getByTestId('node-node-1'));
      fireEvent.mouseLeave(screen.getByTestId('node-node-1'));

      expect(onNodeHover).toHaveBeenLastCalledWith(null);
    });

    it('does not throw when onNodeHover is not provided', () => {
      expect(() => {
        renderGraphView({ onNodeHover: undefined });
        fireEvent.mouseEnter(screen.getByTestId('node-node-1'));
      }).not.toThrow();
    });
  });

  describe('Highlighted Node', () => {
    it('accepts highlightedNodeId prop', () => {
      // The mock doesn't visually show highlighting, but we verify the prop is accepted
      expect(() => {
        renderGraphView({ highlightedNodeId: 'node-1' });
      }).not.toThrow();
    });

    it('renders correctly with non-existent highlightedNodeId', () => {
      expect(() => {
        renderGraphView({ highlightedNodeId: 'non-existent' });
      }).not.toThrow();
    });
  });

  describe('Community Coloring', () => {
    it('accepts colorByCommunity prop', () => {
      expect(() => {
        renderGraphView({ colorByCommunity: true });
      }).not.toThrow();
    });

    it('defaults colorByCommunity to false', () => {
      renderGraphView();

      // Component should render without community coloring by default
      expect(screen.getByTestId('graph-view')).toBeDefined();
    });
  });

  describe('PageRank Sizing', () => {
    it('accepts sizeByPageRank prop', () => {
      expect(() => {
        renderGraphView({ sizeByPageRank: true });
      }).not.toThrow();
    });

    it('defaults sizeByPageRank to false', () => {
      renderGraphView();

      // Component should render without PageRank sizing by default
      expect(screen.getByTestId('graph-view')).toBeDefined();
    });

    it('handles nodes without pageRank when sizeByPageRank is true', () => {
      const nodesWithoutRank: GraphNode[] = [
        { id: 'node-a', title: 'Page A' },
        { id: 'node-b', title: 'Page B' },
      ];

      expect(() => {
        renderGraphView({ nodes: nodesWithoutRank, edges: [], sizeByPageRank: true });
      }).not.toThrow();
    });
  });

  describe('Canvas Rendering Callbacks', () => {
    it('provides nodeCanvasObject callback', () => {
      renderGraphView();

      expect(mockLastProps.nodeCanvasObject).toBeDefined();
    });

    it('provides nodePointerAreaPaint callback', () => {
      renderGraphView();

      expect(mockLastProps.nodePointerAreaPaint).toBeDefined();
    });

    it('nodeCanvasObject draws node correctly', () => {
      renderGraphView({ colorByCommunity: false, sizeByPageRank: false });

      const nodeCanvasObject = mockLastProps.nodeCanvasObject;

      // Create mock canvas context
      const mockCtx = {
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
      };

      const testNode = { id: 'node-1', title: 'Home', x: 100, y: 50 };
      nodeCanvasObject?.(testNode, mockCtx, 1);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('nodePointerAreaPaint defines click area', () => {
      renderGraphView();

      const nodePointerAreaPaint = mockLastProps.nodePointerAreaPaint;

      const mockCtx = {
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
      };

      const testNode = { id: 'node-1', title: 'Home', x: 100, y: 50 };
      nodePointerAreaPaint?.(testNode, '#ff0000', mockCtx);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });

  describe('Graph Configuration', () => {
    it('passes width to ForceGraph2D', () => {
      renderGraphView({ width: 1200 });

      expect(mockLastProps.width).toBe(1200);
    });

    it('passes height to ForceGraph2D', () => {
      renderGraphView({ height: 900 });

      expect(mockLastProps.height).toBe(900);
    });
  });

  describe('Edge Cases', () => {
    it('handles single node with no edges', () => {
      const singleNode: GraphNode[] = [{ id: 'lonely', title: 'Lonely Node' }];

      renderGraphView({ nodes: singleNode, edges: [] });

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-node-count')).toBe('1');
      expect(graph.getAttribute('data-link-count')).toBe('0');
    });

    it('handles self-referential edge', () => {
      const selfRefEdges: GraphEdge[] = [{ source: 'node-1', target: 'node-1' }];

      renderGraphView({ edges: selfRefEdges });

      expect(mockLastProps.graphData?.links).toHaveLength(1);
    });

    it('handles duplicate edges', () => {
      const duplicateEdges: GraphEdge[] = [
        { source: 'node-1', target: 'node-2' },
        { source: 'node-1', target: 'node-2' },
      ];

      renderGraphView({ edges: duplicateEdges });

      expect(mockLastProps.graphData?.links).toHaveLength(2);
    });

    it('handles nodes with same community', () => {
      const sameCommunity: GraphNode[] = [
        { id: 'a', title: 'A', community: 5 },
        { id: 'b', title: 'B', community: 5 },
        { id: 'c', title: 'C', community: 5 },
      ];

      expect(() => {
        renderGraphView({ nodes: sameCommunity, edges: [], colorByCommunity: true });
      }).not.toThrow();
    });

    it('handles extreme pageRank values', () => {
      const extremeRanks: GraphNode[] = [
        { id: 'low', title: 'Low', pageRank: 0.00001 },
        { id: 'high', title: 'High', pageRank: 0.99999 },
      ];

      expect(() => {
        renderGraphView({ nodes: extremeRanks, edges: [], sizeByPageRank: true });
      }).not.toThrow();
    });

    it('handles zero pageRank', () => {
      const zeroRank: GraphNode[] = [
        { id: 'zero', title: 'Zero', pageRank: 0 },
        { id: 'some', title: 'Some', pageRank: 0.5 },
      ];

      expect(() => {
        renderGraphView({ nodes: zeroRank, edges: [], sizeByPageRank: true });
      }).not.toThrow();
    });

    it('handles equal pageRank values', () => {
      const equalRanks: GraphNode[] = [
        { id: 'a', title: 'A', pageRank: 0.1 },
        { id: 'b', title: 'B', pageRank: 0.1 },
        { id: 'c', title: 'C', pageRank: 0.1 },
      ];

      expect(() => {
        renderGraphView({ nodes: equalRanks, edges: [], sizeByPageRank: true });
      }).not.toThrow();
    });
  });

  describe('Props Updates', () => {
    it('updates when nodes change', () => {
      const { rerender } = render(
        <GraphView nodes={sampleNodes} edges={sampleEdges} onNodeClick={vi.fn()} />
      );

      const newNodes: GraphNode[] = [{ id: 'new-1', title: 'New Node' }];

      rerender(<GraphView nodes={newNodes} edges={[]} onNodeClick={vi.fn()} />);

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-node-count')).toBe('1');
    });

    it('updates when edges change', () => {
      const { rerender } = render(
        <GraphView nodes={sampleNodes} edges={sampleEdges} onNodeClick={vi.fn()} />
      );

      const newEdges: GraphEdge[] = [];

      rerender(<GraphView nodes={sampleNodes} edges={newEdges} onNodeClick={vi.fn()} />);

      const graph = screen.getByTestId('mock-force-graph');
      expect(graph.getAttribute('data-link-count')).toBe('0');
    });

    it('updates when highlightedNodeId changes', () => {
      const { rerender } = render(
        <GraphView
          nodes={sampleNodes}
          edges={sampleEdges}
          onNodeClick={vi.fn()}
          highlightedNodeId="node-1"
        />
      );

      expect(() => {
        rerender(
          <GraphView
            nodes={sampleNodes}
            edges={sampleEdges}
            onNodeClick={vi.fn()}
            highlightedNodeId="node-2"
          />
        );
      }).not.toThrow();
    });
  });
});
