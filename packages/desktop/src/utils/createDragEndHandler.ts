/**
 * Shared drag-end handler factory for block reordering.
 *
 * Used by both PageView (root-level blocks) and BlockNode (nested children)
 * to handle drag-and-drop reordering within a single level of the block tree.
 *
 * Each nesting level has its own DndContext + SortableContext, and this factory
 * creates the appropriate handleDragEnd callback scoped to that level's siblings.
 *
 * @see docs/frontend/react-architecture.md
 */

import type { DragEndEvent } from '@dnd-kit/core';
import type { Block, BlockId } from '@double-bind/types';
import type { BlockService } from '@double-bind/core';
import { invalidateQueries } from '../hooks/useCozoQuery.js';

/**
 * Create a drag-end handler for a list of sibling blocks.
 *
 * @param siblings - The ordered array of sibling blocks at this level
 * @param blockService - The block service for performing the move operation
 * @returns An async DragEndEvent handler
 */
export function createDragEndHandler(siblings: Block[], blockService: BlockService) {
  return async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeBlock = siblings.find((b) => b.blockId === activeId);
    const overBlock = siblings.find((b) => b.blockId === overId);
    if (!activeBlock || !overBlock) return;

    const overIndex = siblings.findIndex((b) => b.blockId === overId);
    const activeIndex = siblings.findIndex((b) => b.blockId === activeId);

    // Calculate afterBlockId: the block that the moved block should be placed after.
    // When moving down (activeIndex < overIndex), place after the over block.
    // When moving up (activeIndex > overIndex), place after the block before over
    // (or undefined if moving to position 0, meaning first position).
    const afterBlockId =
      activeIndex < overIndex
        ? overId
        : overIndex > 0
          ? siblings[overIndex - 1]!.blockId
          : undefined;

    try {
      await blockService.moveBlock(
        activeId as BlockId,
        activeBlock.parentId,
        afterBlockId as BlockId | undefined
      );
    } catch {
      // moveBlock may throw BLOCK_NOT_FOUND or DB_MUTATION_FAILED
      // Visual state resets automatically via @dnd-kit
    } finally {
      // Always invalidate to sync UI with actual DB state
      invalidateQueries(['blocks']);
      invalidateQueries(['block']);
      invalidateQueries(['page', 'withBlocks']);
    }
  };
}
