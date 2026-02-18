/**
 * useBlockContextMenu - Manages block-level context menu state.
 *
 * Listens for `block-context-menu` CustomEvents dispatched when the user
 * right-clicks a BlockNode. Returns the menu state plus a set of actions.
 *
 * The hook does NOT render anything — it gives the caller the state and
 * action callbacks needed to render a context menu overlay.
 *
 * Event contract (dispatched on `window`):
 *   block-context-menu → CustomEvent<{ blockId: BlockId; x: number; y: number }>
 *
 * @example
 * ```tsx
 * const { isVisible, position, blockId, close, actions } = useBlockContextMenu();
 *
 * if (isVisible && blockId) {
 *   return <ContextMenuOverlay actions={actions} position={position} onClose={close} />;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import type { BlockId } from '@double-bind/types';
import { useServicesOptional } from '../providers/ServiceProvider.js';
import { invalidateQueries } from './useCozoQuery.js';

// ============================================================================
// Types
// ============================================================================

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface BlockContextMenuAction {
  /** Display label */
  label: string;
  /** Action callback */
  action: () => void;
  /** Whether this item should be disabled */
  disabled?: boolean;
  /** Whether to render a visual separator before this item */
  separator?: boolean;
}

export interface UseBlockContextMenuResult {
  /** Whether the context menu is currently open */
  isVisible: boolean;
  /** Screen-space position where the menu should appear */
  position: ContextMenuPosition;
  /** The block ID this menu applies to, or null when closed */
  blockId: BlockId | null;
  /** Close and reset the context menu */
  close: () => void;
  /** Actions to display in the menu */
  actions: BlockContextMenuAction[];
}

interface BlockContextMenuEventDetail {
  blockId: BlockId;
  x: number;
  y: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useBlockContextMenu listens for `block-context-menu` CustomEvents and
 * returns menu state plus standard block operations as menu actions.
 *
 * Services are accessed via ServiceProvider for copy/cut/delete/duplicate.
 */
export function useBlockContextMenu(): UseBlockContextMenuResult {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [blockId, setBlockId] = useState<BlockId | null>(null);

  // ServiceProvider may not be present in all contexts (e.g., tests)
  const services = useServicesOptional();

  const close = useCallback(() => {
    setIsVisible(false);
    setBlockId(null);
  }, []);

  // Build actions lazily from current blockId + services
  const buildActions = useCallback(
    (targetBlockId: BlockId): BlockContextMenuAction[] => {
      const blockService = services?.blockService ?? null;

      const invalidate = () => {
        invalidateQueries(['block']);
        invalidateQueries(['blocks', 'children']);
        invalidateQueries(['page', 'withBlocks']);
        invalidateQueries(['dailyNote']);
      };

      return [
        {
          label: 'Copy',
          action: () => {
            // Best-effort: read content from DOM selection or service
            if (blockService) {
              void blockService.getById(targetBlockId).then((block) => {
                if (block?.content) {
                  void navigator.clipboard.writeText(block.content).catch(() => {
                    // Clipboard access may be denied in some contexts
                  });
                }
              });
            }
            close();
          },
        },
        {
          label: 'Cut',
          action: () => {
            if (blockService) {
              void blockService.getById(targetBlockId).then(async (block) => {
                if (block?.content) {
                  await navigator.clipboard.writeText(block.content).catch(() => {});
                  await blockService.deleteBlock(targetBlockId);
                  invalidate();
                }
                close();
              });
            } else {
              close();
            }
          },
        },
        {
          label: 'Duplicate',
          action: () => {
            if (blockService) {
              void blockService.getById(targetBlockId).then(async (block) => {
                if (block) {
                  await blockService.createBlock(
                    block.pageId,
                    block.parentId,
                    block.content,
                    targetBlockId // afterBlockId: insert immediately after
                  );
                  invalidate();
                }
                close();
              });
            } else {
              close();
            }
          },
        },
        {
          label: 'Delete Block',
          separator: true,
          action: () => {
            if (blockService) {
              void blockService.deleteBlock(targetBlockId).then(() => {
                invalidate();
              });
            }
            close();
          },
        },
      ];
    },
    [services, close]
  );

  useEffect(() => {
    function handleContextMenu(event: Event) {
      const customEvent = event as CustomEvent<BlockContextMenuEventDetail>;
      const detail = customEvent.detail;

      if (!detail?.blockId) return;

      setBlockId(detail.blockId);
      setPosition({ x: detail.x, y: detail.y });
      setIsVisible(true);
    }

    window.addEventListener('block-context-menu', handleContextMenu);

    return () => {
      window.removeEventListener('block-context-menu', handleContextMenu);
    };
  }, []);

  const actions = blockId ? buildActions(blockId) : [];

  return { isVisible, position, blockId, close, actions };
}

// ============================================================================
// Helper: dispatch event (used by BlockNode right-click handlers)
// ============================================================================

/**
 * Dispatch a block-context-menu event.
 * Call this from a BlockNode onContextMenu handler.
 */
export function dispatchBlockContextMenu(blockId: BlockId, x: number, y: number): void {
  window.dispatchEvent(
    new CustomEvent<BlockContextMenuEventDetail>('block-context-menu', {
      detail: { blockId, x, y },
    })
  );
}
