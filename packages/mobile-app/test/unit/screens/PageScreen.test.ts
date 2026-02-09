/**
 * PageScreen.test.ts - Unit tests for PageScreen logic
 *
 * Tests cover:
 * - Block tree building with hierarchy
 * - Deleted block filtering
 * - Block ordering
 * - Orphaned block handling
 */

import { describe, it, expect } from 'vitest';
import type { Block, BlockId } from '@double-bind/types';

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
function buildBlockTree(
  blocks: Block[],
  parentId: BlockId | null,
  depth: number,
  collapsedBlocks: Set<BlockId>
): Array<{ block: Block; depth: number; hasChildren: boolean }> {
  // Get direct children of the current parent
  const children = blocks
    .filter((block) => block.parentId === parentId && !block.isDeleted)
    .sort((a, b) => a.order.localeCompare(b.order));

  const result: Array<{ block: Block; depth: number; hasChildren: boolean }> = [];

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

// Test data
const mockBlocks: Block[] = [
  {
    blockId: 'block-1',
    pageId: 'page-1',
    parentId: null,
    content: 'Root block 1',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-2',
    pageId: 'page-1',
    parentId: 'block-1',
    content: 'Child block 1-1',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-3',
    pageId: 'page-1',
    parentId: 'block-1',
    content: 'Child block 1-2',
    contentType: 'text',
    order: 'a1',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-4',
    pageId: 'page-1',
    parentId: null,
    content: 'Root block 2',
    contentType: 'text',
    order: 'a1',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('buildBlockTree', () => {
  describe('Basic Hierarchy', () => {
    it('should build correct flat list with depths', () => {
      const result = buildBlockTree(mockBlocks, null, 0, new Set());

      expect(result).toHaveLength(4);
      expect(result[0].block.blockId).toBe('block-1');
      expect(result[0].depth).toBe(0);
      expect(result[0].hasChildren).toBe(true);

      expect(result[1].block.blockId).toBe('block-2');
      expect(result[1].depth).toBe(1);
      expect(result[1].hasChildren).toBe(false);

      expect(result[2].block.blockId).toBe('block-3');
      expect(result[2].depth).toBe(1);
      expect(result[2].hasChildren).toBe(false);

      expect(result[3].block.blockId).toBe('block-4');
      expect(result[3].depth).toBe(0);
      expect(result[3].hasChildren).toBe(false);
    });

    it('should handle deeply nested blocks', () => {
      const nestedBlocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Level 0',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: 'block-1',
          content: 'Level 1',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-3',
          pageId: 'page-1',
          parentId: 'block-2',
          content: 'Level 2',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(nestedBlocks, null, 0, new Set());

      expect(result).toHaveLength(3);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(2);
    });
  });

  describe('Block Ordering', () => {
    it('should order blocks by order field', () => {
      const unorderedBlocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Should be second',
          contentType: 'text',
          order: 'b0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: null,
          content: 'Should be first',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(unorderedBlocks, null, 0, new Set());

      expect(result[0].block.content).toBe('Should be first');
      expect(result[1].block.content).toBe('Should be second');
    });
  });

  describe('Deleted Blocks', () => {
    it('should filter out deleted blocks', () => {
      const blocksWithDeleted: Block[] = [
        ...mockBlocks,
        {
          blockId: 'block-5',
          pageId: 'page-1',
          parentId: null,
          content: 'Deleted block',
          contentType: 'text',
          order: 'a2',
          isCollapsed: false,
          isDeleted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(blocksWithDeleted, null, 0, new Set());

      expect(result).toHaveLength(4); // Should still be 4, not 5
      expect(result.every((item) => item.block.content !== 'Deleted block')).toBe(true);
    });

    it('should exclude children of deleted blocks', () => {
      const blocksWithDeletedParent: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Deleted parent',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: 'block-1',
          content: 'Child of deleted',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(blocksWithDeletedParent, null, 0, new Set());

      expect(result).toHaveLength(0); // Neither block should appear
    });
  });

  describe('Collapsed Blocks', () => {
    it('should hide children of collapsed blocks', () => {
      const collapsedSet = new Set<BlockId>(['block-1']);

      const result = buildBlockTree(mockBlocks, null, 0, collapsedSet);

      expect(result).toHaveLength(2); // Only root blocks
      expect(result[0].block.blockId).toBe('block-1');
      expect(result[1].block.blockId).toBe('block-4');
    });

    it('should show children when block is not collapsed', () => {
      const collapsedSet = new Set<BlockId>();

      const result = buildBlockTree(mockBlocks, null, 0, collapsedSet);

      expect(result).toHaveLength(4); // All blocks visible
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty block list', () => {
      const result = buildBlockTree([], null, 0, new Set());

      expect(result).toHaveLength(0);
    });

    it('should handle orphaned blocks gracefully', () => {
      const blocksWithOrphan: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Root block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: 'non-existent-parent',
          content: 'Orphan block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(blocksWithOrphan, null, 0, new Set());

      expect(result).toHaveLength(1); // Only root block
      expect(result[0].block.content).toBe('Root block');
    });

    it('should correctly identify hasChildren flag', () => {
      const result = buildBlockTree(mockBlocks, null, 0, new Set());

      expect(result[0].hasChildren).toBe(true); // block-1 has children
      expect(result[1].hasChildren).toBe(false); // block-2 has no children
      expect(result[2].hasChildren).toBe(false); // block-3 has no children
      expect(result[3].hasChildren).toBe(false); // block-4 has no children
    });
  });
});
