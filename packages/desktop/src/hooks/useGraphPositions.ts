/**
 * useGraphPositions — Hook managing graph node positions across renders.
 *
 * Stores positions in a ref so they survive React re-renders without
 * causing additional renders themselves. Provides:
 * - `positions` — current positions map (stable ref)
 * - `updatePositions` — update one or more node positions
 * - `resetLayout` — clear all cached positions
 *
 * This hook does NOT run a force simulation — that is delegated to
 * react-force-graph-2d. Instead, it caches the resolved positions emitted
 * by the force graph so they can be restored after a re-mount (e.g., theme
 * change that unmounts/remounts the canvas).
 */

import { useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodePosition {
  x: number;
  y: number;
  fx?: number; // Fixed x (pinned)
  fy?: number; // Fixed y (pinned)
}

export interface UseGraphPositionsResult {
  /** Ref to the current positions map. Read without causing re-renders. */
  positions: React.MutableRefObject<Map<string, NodePosition>>;
  /** Update positions for one or more nodes. */
  updatePositions: (updates: Map<string, NodePosition> | [string, NodePosition][]) => void;
  /** Update a single node position. */
  updatePosition: (nodeId: string, position: NodePosition) => void;
  /** Pin a node at the given position. */
  pinNode: (nodeId: string, x: number, y: number) => void;
  /** Unpin a node (remove fx/fy). */
  unpinNode: (nodeId: string) => void;
  /** Clear all cached positions. */
  resetLayout: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manage graph node positions with stable ref identity.
 *
 * @example
 * ```ts
 * const { positions, updatePosition, resetLayout } = useGraphPositions();
 *
 * // In a ForceGraph2D onNodeDragEnd callback:
 * function handleNodeDragEnd(node) {
 *   updatePosition(node.id, { x: node.x, y: node.y });
 * }
 * ```
 */
export function useGraphPositions(): UseGraphPositionsResult {
  const positions = useRef<Map<string, NodePosition>>(new Map());

  const updatePositions = useCallback(
    (updates: Map<string, NodePosition> | [string, NodePosition][]) => {
      const entries = updates instanceof Map ? updates.entries() : updates[Symbol.iterator]();
      for (const [id, pos] of entries) {
        positions.current.set(id, pos);
      }
    },
    []
  );

  const updatePosition = useCallback((nodeId: string, position: NodePosition) => {
    positions.current.set(nodeId, position);
  }, []);

  const pinNode = useCallback((nodeId: string, x: number, y: number) => {
    const existing = positions.current.get(nodeId) ?? { x, y };
    positions.current.set(nodeId, { ...existing, x, y, fx: x, fy: y });
  }, []);

  const unpinNode = useCallback((nodeId: string) => {
    const existing = positions.current.get(nodeId);
    if (existing) {
      const { fx: _fx, fy: _fy, ...rest } = existing;
      void _fx;
      void _fy;
      positions.current.set(nodeId, rest);
    }
  }, []);

  const resetLayout = useCallback(() => {
    positions.current.clear();
  }, []);

  return {
    positions,
    updatePositions,
    updatePosition,
    pinNode,
    unpinNode,
    resetLayout,
  };
}
