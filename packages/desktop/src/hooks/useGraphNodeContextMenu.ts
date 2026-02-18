/**
 * useGraphNodeContextMenu — Hook for graph node right-click context menu.
 *
 * Manages:
 * - Visibility state
 * - Position (screen coordinates)
 * - The node ID that was right-clicked
 * - Menu items (derived from callbacks passed in)
 *
 * Returns a stable `open` callback suitable for use in onNodeRightClick handlers.
 */

import { useState, useCallback } from 'react';
import type { ContextMenuAction } from '../components/graph/ContextMenu.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNodeContextMenuCallbacks {
  /** Navigate to the page */
  onOpenPage: (nodeId: string) => void;
  /** Open page in the sidebar/right panel */
  onOpenInSidebar: (nodeId: string) => void;
  /** Pin the node to a fixed position */
  onPinNode: (nodeId: string) => void;
  /** Remove the node from the current view (filter it out) */
  onRemoveFromView: (nodeId: string) => void;
  /** Whether the node is currently pinned (affects pin menu label) */
  isPinned?: (nodeId: string) => boolean;
}

export interface UseGraphNodeContextMenuResult {
  /** Whether the context menu is visible */
  isVisible: boolean;
  /** Screen x position of the menu */
  x: number;
  /** Screen y position of the menu */
  y: number;
  /** The node ID the menu is for */
  nodeId: string | null;
  /** Menu items to render */
  menuItems: ContextMenuAction[];
  /** Close the context menu */
  close: () => void;
  /** Open the context menu for a node at the given screen position */
  open: (nodeId: string, screenX: number, screenY: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages context menu state for right-clicks on graph nodes.
 *
 * @example
 * ```ts
 * const contextMenu = useGraphNodeContextMenu({
 *   onOpenPage: (id) => navigate(`/page/${id}`),
 *   onOpenInSidebar: (id) => openSidebar(id),
 *   onPinNode: (id) => pinNode(id, nodeX, nodeY),
 *   onRemoveFromView: (id) => removeNode(id),
 * });
 *
 * // In ForceGraph2D onNodeRightClick:
 * function handleRightClick(node, event) {
 *   contextMenu.open(node.id, event.clientX, event.clientY);
 * }
 * ```
 */
export function useGraphNodeContextMenu(
  callbacks: GraphNodeContextMenuCallbacks
): UseGraphNodeContextMenuResult {
  const [state, setState] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
  }>({
    isVisible: false,
    x: 0,
    y: 0,
    nodeId: null,
  });

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isVisible: false, nodeId: null }));
  }, []);

  const open = useCallback((nodeId: string, screenX: number, screenY: number) => {
    setState({ isVisible: true, x: screenX, y: screenY, nodeId });
  }, []);

  // Build menu items based on current nodeId
  const menuItems: ContextMenuAction[] = state.nodeId
    ? [
        {
          label: 'Open page',
          action: () => callbacks.onOpenPage(state.nodeId!),
        },
        {
          label: 'Open in sidebar',
          action: () => callbacks.onOpenInSidebar(state.nodeId!),
        },
        {
          label: callbacks.isPinned?.(state.nodeId) ? 'Unpin from graph' : 'Pin to graph',
          action: () => callbacks.onPinNode(state.nodeId!),
          separator: true,
        },
        {
          label: 'Remove from view',
          action: () => callbacks.onRemoveFromView(state.nodeId!),
        },
      ]
    : [];

  return {
    isVisible: state.isVisible,
    x: state.x,
    y: state.y,
    nodeId: state.nodeId,
    menuItems,
    close,
    open,
  };
}
