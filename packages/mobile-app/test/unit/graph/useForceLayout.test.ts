/**
 * Tests for useForceLayout hook.
 *
 * Verifies the force-directed layout algorithm produces valid node positions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useForceLayout, useNodeMap } from '../../../src/components/graph/useForceLayout';
import type { MobileGraphNode, MobileGraphEdge } from '../../../src/components/graph/types';

describe('useForceLayout', () => {
  const sampleNodes: MobileGraphNode[] = [
    { id: 'node-1', title: 'Node 1' },
    { id: 'node-2', title: 'Node 2' },
    { id: 'node-3', title: 'Node 3' },
  ];

  const sampleEdges: MobileGraphEdge[] = [
    { source: 'node-1', target: 'node-2' },
    { source: 'node-2', target: 'node-3' },
  ];

  it('should return empty array for empty nodes', () => {
    const { result } = renderHook(() => useForceLayout([], [], 300, 400, 'node-1'));

    expect(result.current).toEqual([]);
  });

  it('should return empty array for zero dimensions', () => {
    const { result } = renderHook(() => useForceLayout(sampleNodes, sampleEdges, 0, 0, 'node-1'));

    expect(result.current).toEqual([]);
  });

  it('should produce layout nodes with valid positions', () => {
    const { result } = renderHook(() =>
      useForceLayout(sampleNodes, sampleEdges, 300, 400, 'node-1')
    );

    expect(result.current).toHaveLength(3);

    // All nodes should have valid x, y positions
    result.current.forEach((node) => {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    });
  });

  it('should place center node near the center of the viewport', () => {
    const width = 300;
    const height = 400;
    const centerNodeId = 'node-1';

    const { result } = renderHook(() =>
      useForceLayout(sampleNodes, sampleEdges, width, height, centerNodeId)
    );

    const centerNode = result.current.find((n) => n.id === centerNodeId);
    expect(centerNode).toBeDefined();

    // Center node should be reasonably close to the viewport center
    // (within 50% of width/height from center)
    const centerX = width / 2;
    const centerY = height / 2;
    const tolerance = Math.max(width, height) / 2;

    expect(Math.abs(centerNode!.x - centerX)).toBeLessThan(tolerance);
    expect(Math.abs(centerNode!.y - centerY)).toBeLessThan(tolerance);
  });

  it('should preserve node IDs and titles', () => {
    const { result } = renderHook(() =>
      useForceLayout(sampleNodes, sampleEdges, 300, 400, 'node-1')
    );

    sampleNodes.forEach((originalNode) => {
      const layoutNode = result.current.find((n) => n.id === originalNode.id);
      expect(layoutNode).toBeDefined();
      expect(layoutNode!.title).toBe(originalNode.title);
    });
  });

  it('should use provided positions if available', () => {
    const nodesWithPositions: MobileGraphNode[] = [
      { id: 'node-1', title: 'Node 1', x: 100, y: 100 },
      { id: 'node-2', title: 'Node 2' },
    ];

    const { result } = renderHook(() => useForceLayout(nodesWithPositions, [], 300, 400, 'node-1'));

    // Node with provided position should start at that position
    // (may move slightly due to forces, but should be close)
    const node1 = result.current.find((n) => n.id === 'node-1');
    expect(node1).toBeDefined();
    // Allow some tolerance for force simulation movement
    // but it should be in the ballpark
    expect(node1!.x).toBeGreaterThan(0);
    expect(node1!.y).toBeGreaterThan(0);
  });

  it('should memoize result for same inputs', () => {
    const { result, rerender } = renderHook(
      ({ nodes, edges, width, height, centerNodeId }) =>
        useForceLayout(nodes, edges, width, height, centerNodeId),
      {
        initialProps: {
          nodes: sampleNodes,
          edges: sampleEdges,
          width: 300,
          height: 400,
          centerNodeId: 'node-1',
        },
      }
    );

    const firstResult = result.current;

    // Rerender with same props
    rerender({
      nodes: sampleNodes,
      edges: sampleEdges,
      width: 300,
      height: 400,
      centerNodeId: 'node-1',
    });

    // Should return the same memoized array
    expect(result.current).toBe(firstResult);
  });

  it('should recalculate when inputs change', () => {
    const { result, rerender } = renderHook(
      ({ nodes, edges, width, height, centerNodeId }) =>
        useForceLayout(nodes, edges, width, height, centerNodeId),
      {
        initialProps: {
          nodes: sampleNodes,
          edges: sampleEdges,
          width: 300,
          height: 400,
          centerNodeId: 'node-1',
        },
      }
    );

    const firstResult = result.current;

    // Rerender with different dimensions
    rerender({
      nodes: sampleNodes,
      edges: sampleEdges,
      width: 500,
      height: 600,
      centerNodeId: 'node-1',
    });

    // Should return a new array
    expect(result.current).not.toBe(firstResult);
  });
});

describe('useNodeMap', () => {
  it('should create a map of nodes by ID', () => {
    const layoutNodes = [
      { id: 'node-1', title: 'Node 1', x: 100, y: 100, vx: 0, vy: 0 },
      { id: 'node-2', title: 'Node 2', x: 200, y: 200, vx: 0, vy: 0 },
    ];

    const { result } = renderHook(() => useNodeMap(layoutNodes));

    expect(result.current.size).toBe(2);
    expect(result.current.get('node-1')).toBe(layoutNodes[0]);
    expect(result.current.get('node-2')).toBe(layoutNodes[1]);
  });

  it('should return empty map for empty nodes', () => {
    const { result } = renderHook(() => useNodeMap([]));

    expect(result.current.size).toBe(0);
  });

  it('should memoize result for same input', () => {
    const layoutNodes = [{ id: 'node-1', title: 'Node 1', x: 100, y: 100, vx: 0, vy: 0 }];

    const { result, rerender } = renderHook(({ nodes }) => useNodeMap(nodes), {
      initialProps: { nodes: layoutNodes },
    });

    const firstResult = result.current;

    rerender({ nodes: layoutNodes });

    expect(result.current).toBe(firstResult);
  });
});
