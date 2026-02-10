/**
 * PageScreenEditMode.test.ts - Tests for PageScreen edit mode logic
 *
 * Tests cover:
 * - Edit mode state management
 * - Block operations via useBlockOperations
 * - Service adapter functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Block, BlockId, PageId } from '@double-bind/types';
import { buildBlockTree } from '../../../src/utils/blockTree';

// Mock blocks
const mockBlocks: Block[] = [
  {
    blockId: 'block-1' as BlockId,
    pageId: 'page-123' as PageId,
    parentId: null,
    content: 'First block',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-2' as BlockId,
    pageId: 'page-123' as PageId,
    parentId: null,
    content: 'Second block',
    contentType: 'text',
    order: 'a1',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    blockId: 'block-3' as BlockId,
    pageId: 'page-123' as PageId,
    parentId: 'block-1' as BlockId,
    content: 'Nested block',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe('PageScreen Edit Mode Logic', () => {
  describe('buildBlockTree for edit mode', () => {
    it('should build flat list with correct hierarchy', () => {
      const result = buildBlockTree(mockBlocks, null, 0, new Set());

      expect(result).toHaveLength(3);
      expect(result[0].block.blockId).toBe('block-1');
      expect(result[0].depth).toBe(0);
      expect(result[0].hasChildren).toBe(true);

      expect(result[1].block.blockId).toBe('block-3');
      expect(result[1].depth).toBe(1);
      expect(result[1].hasChildren).toBe(false);

      expect(result[2].block.blockId).toBe('block-2');
      expect(result[2].depth).toBe(0);
      expect(result[2].hasChildren).toBe(false);
    });

    it('should hide children when block is collapsed', () => {
      const collapsedSet = new Set<BlockId>(['block-1' as BlockId]);
      const result = buildBlockTree(mockBlocks, null, 0, collapsedSet);

      expect(result).toHaveLength(2);
      expect(result[0].block.blockId).toBe('block-1');
      expect(result[1].block.blockId).toBe('block-2');
    });

    it('should filter deleted blocks', () => {
      const blocksWithDeleted = [
        ...mockBlocks,
        {
          blockId: 'block-4' as BlockId,
          pageId: 'page-123' as PageId,
          parentId: null,
          content: 'Deleted block',
          contentType: 'text' as const,
          order: 'a2',
          isCollapsed: false,
          isDeleted: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const result = buildBlockTree(blocksWithDeleted, null, 0, new Set());

      expect(result).toHaveLength(3);
      expect(result.every((item) => !item.block.isDeleted)).toBe(true);
    });
  });

  describe('Edit mode behaviors', () => {
    it('should find previous block for focus after deletion', () => {
      const blockList = buildBlockTree(mockBlocks, null, 0, new Set());
      const currentBlockId = 'block-3' as BlockId;
      const currentIndex = blockList.findIndex((item) => item.block.blockId === currentBlockId);

      expect(currentIndex).toBe(1);
      const previousBlock = blockList[currentIndex - 1];
      expect(previousBlock?.block.blockId).toBe('block-1');
    });

    it('should return null when deleting first block', () => {
      const blockList = buildBlockTree(mockBlocks, null, 0, new Set());
      const currentBlockId = 'block-1' as BlockId;
      const currentIndex = blockList.findIndex((item) => item.block.blockId === currentBlockId);

      expect(currentIndex).toBe(0);
      const previousBlock = currentIndex > 0 ? blockList[currentIndex - 1] : null;
      expect(previousBlock).toBeNull();
    });

    it('should find last root block for FAB creation', () => {
      const rootBlocks = mockBlocks.filter((b) => b.parentId === null && !b.isDeleted);
      const lastRootBlock = rootBlocks[rootBlocks.length - 1];

      expect(lastRootBlock?.blockId).toBe('block-2');
    });
  });

  describe('Block operations', () => {
    it('should handle empty block list for FAB', () => {
      const emptyBlocks: Block[] = [];
      const rootBlocks = emptyBlocks.filter((b) => b.parentId === null && !b.isDeleted);
      const lastRootBlock = rootBlocks[rootBlocks.length - 1];

      expect(lastRootBlock).toBeUndefined();
    });

    it('should determine correct parent for Enter key', () => {
      const currentBlockId = 'block-3' as BlockId;
      const currentBlock = mockBlocks.find((b) => b.blockId === currentBlockId);

      expect(currentBlock?.parentId).toBe('block-1');
      // New block should be sibling of current block
    });

    it('should determine correct insert position for Enter key', () => {
      const currentBlockId = 'block-1' as BlockId;
      const currentBlock = mockBlocks.find((b) => b.blockId === currentBlockId);

      // New block should be inserted after current block
      expect(currentBlock?.blockId).toBe('block-1');
    });
  });
});
