/**
 * blockTree.ts - Utility functions for building block tree structures
 *
 * Provides functions to convert hierarchical block data into flat lists
 * suitable for rendering in FlatList with proper depth and hierarchy metadata.
 */

import type { Block, BlockId } from '@double-bind/types';
import type { BlockListItem } from '@double-bind/mobile-primitives';

/**
 * Build a flat list of blocks with hierarchy information for FlatList rendering.
 * This function traverses the block tree and creates a flattened structure
 * with depth information for proper indentation.
 *
 * @param blocks - All blocks for the page
 * @param parentId - Current parent ID to filter children (null = root blocks)
 * @param depth - Current nesting depth
 * @param collapsedBlocks - Set of collapsed block IDs
 * @returns Flattened array of blocks with depth and hierarchy metadata
 */
export function buildBlockTree(
  blocks: Block[],
  parentId: BlockId | null,
  depth: number,
  collapsedBlocks: Set<BlockId>
): BlockListItem[] {
  // Get direct children of the current parent
  const children = blocks
    .filter((block) => block.parentId === parentId && !block.isDeleted)
    .sort((a, b) => a.order.localeCompare(b.order));

  const result: BlockListItem[] = [];

  for (const block of children) {
    // Check if this block has children
    const hasChildren = blocks.some((b) => b.parentId === block.blockId && !b.isDeleted);

    // Add this block to the result
    result.push({
      block,
      depth,
      hasChildren,
    });

    // Recursively add children if not collapsed
    if (hasChildren && !collapsedBlocks.has(block.blockId)) {
      result.push(...buildBlockTree(blocks, block.blockId, depth + 1, collapsedBlocks));
    }
  }

  return result;
}
