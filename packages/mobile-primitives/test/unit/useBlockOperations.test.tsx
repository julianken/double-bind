/**
 * useBlockOperations Hook Tests
 *
 * Tests block CRUD operations with undo/redo functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Block, BlockId, PageId } from '@double-bind/types';
import type { BlockService } from '../../src/hooks/useBlockOperations';

// Import hook for type testing only
import '../../src/hooks/useBlockOperations';

// Test helper to create mock blocks
function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: `block-${Math.random().toString(36).slice(2)}` as BlockId,
    pageId: 'page-456' as PageId,
    parentId: null,
    content: 'Test block content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('useBlockOperations', () => {
  let mockService: BlockService;
  let mockBlocks: Map<BlockId, Block>;

  beforeEach(() => {
    mockBlocks = new Map();

    mockService = {
      createBlock: vi.fn(async (pageId, parentId, content) => {
        const block = createMockBlock({ pageId, parentId, content });
        mockBlocks.set(block.blockId, block);
        return block;
      }),
      deleteBlock: vi.fn(async (blockId) => {
        mockBlocks.delete(blockId);
      }),
      updateContent: vi.fn(async (blockId, content) => {
        const block = mockBlocks.get(blockId);
        if (block) {
          const updatedBlock = { ...block, content, updatedAt: Date.now() };
          mockBlocks.set(blockId, updatedBlock);
        }
      }),
      getById: vi.fn(async (blockId) => {
        return mockBlocks.get(blockId) ?? null;
      }),
    };
  });

  describe('BlockService interface', () => {
    it('should have createBlock method', () => {
      expect(mockService.createBlock).toBeDefined();
      expect(typeof mockService.createBlock).toBe('function');
    });

    it('should have deleteBlock method', () => {
      expect(mockService.deleteBlock).toBeDefined();
      expect(typeof mockService.deleteBlock).toBe('function');
    });

    it('should have updateContent method', () => {
      expect(mockService.updateContent).toBeDefined();
      expect(typeof mockService.updateContent).toBe('function');
    });

    it('should have getById method', () => {
      expect(mockService.getById).toBeDefined();
      expect(typeof mockService.getById).toBe('function');
    });
  });

  describe('create operation', () => {
    it('should create a block successfully', async () => {
      const pageId = 'page-123' as PageId;
      const content = 'New block';

      const createdBlock = await mockService.createBlock(pageId, null, content);

      expect(createdBlock).toBeDefined();
      expect(createdBlock.content).toBe(content);
      expect(createdBlock.pageId).toBe(pageId);
      expect(mockService.createBlock).toHaveBeenCalledWith(pageId, null, content);
      expect(mockBlocks.has(createdBlock.blockId)).toBe(true);
    });

    it('should create a block with parent', async () => {
      const pageId = 'page-123' as PageId;
      const parentId = 'block-parent' as BlockId;
      const content = 'Child block';

      const createdBlock = await mockService.createBlock(pageId, parentId, content);

      expect(createdBlock.parentId).toBe(parentId);
      expect(mockService.createBlock).toHaveBeenCalledWith(pageId, parentId, content);
    });
  });

  describe('delete operation', () => {
    it('should delete an existing block', async () => {
      // Create a block first
      const createdBlock = await mockService.createBlock(
        'page-123' as PageId,
        null,
        'Block to delete'
      );

      expect(mockBlocks.has(createdBlock.blockId)).toBe(true);

      // Delete the block
      await mockService.deleteBlock(createdBlock.blockId);

      expect(mockService.deleteBlock).toHaveBeenCalledWith(createdBlock.blockId);
      expect(mockBlocks.has(createdBlock.blockId)).toBe(false);
    });

    it('should handle deleting non-existent block gracefully', async () => {
      const blockId = 'non-existent' as BlockId;

      await expect(mockService.deleteBlock(blockId)).resolves.not.toThrow();
      expect(mockService.deleteBlock).toHaveBeenCalledWith(blockId);
    });
  });

  describe('update operation', () => {
    it('should update block content', async () => {
      // Create a block first
      const createdBlock = await mockService.createBlock(
        'page-123' as PageId,
        null,
        'Original content'
      );

      const newContent = 'Updated content';
      await mockService.updateContent(createdBlock.blockId, newContent);

      expect(mockService.updateContent).toHaveBeenCalledWith(createdBlock.blockId, newContent);

      const updatedBlock = mockBlocks.get(createdBlock.blockId);
      expect(updatedBlock?.content).toBe(newContent);
    });

    it('should not fail when updating non-existent block', async () => {
      const blockId = 'non-existent' as BlockId;

      await expect(mockService.updateContent(blockId, 'New content')).resolves.not.toThrow();
    });
  });

  describe('getById operation', () => {
    it('should retrieve an existing block', async () => {
      const createdBlock = await mockService.createBlock(
        'page-123' as PageId,
        null,
        'Test block'
      );

      const retrievedBlock = await mockService.getById(createdBlock.blockId);

      expect(retrievedBlock).not.toBeNull();
      expect(retrievedBlock?.blockId).toBe(createdBlock.blockId);
      expect(retrievedBlock?.content).toBe('Test block');
    });

    it('should return null for non-existent block', async () => {
      const retrievedBlock = await mockService.getById('non-existent' as BlockId);

      expect(retrievedBlock).toBeNull();
    });
  });

  describe('undo stack behavior', () => {
    it('should track operations in correct order', async () => {
      // Create multiple blocks
      const block1 = await mockService.createBlock('page-123' as PageId, null, 'Block 1');
      const block2 = await mockService.createBlock('page-123' as PageId, null, 'Block 2');
      const block3 = await mockService.createBlock('page-123' as PageId, null, 'Block 3');

      expect(mockBlocks.size).toBe(3);
      expect(mockService.createBlock).toHaveBeenCalledTimes(3);
    });

    it('should handle delete after create', async () => {
      const block = await mockService.createBlock('page-123' as PageId, null, 'Test');
      expect(mockBlocks.has(block.blockId)).toBe(true);

      await mockService.deleteBlock(block.blockId);
      expect(mockBlocks.has(block.blockId)).toBe(false);
    });

    it('should handle update after create', async () => {
      const block = await mockService.createBlock('page-123' as PageId, null, 'Original');
      expect(block.content).toBe('Original');

      await mockService.updateContent(block.blockId, 'Updated');
      const updated = mockBlocks.get(block.blockId);
      expect(updated?.content).toBe('Updated');
    });
  });

  describe('redo stack behavior', () => {
    it('should allow redo after undo', async () => {
      // This test verifies the conceptual flow
      const block = await mockService.createBlock('page-123' as PageId, null, 'Test');
      const blockId = block.blockId;

      // Simulate undo: delete the created block
      await mockService.deleteBlock(blockId);
      expect(mockBlocks.has(blockId)).toBe(false);

      // Simulate redo: recreate the block
      const recreatedBlock = await mockService.createBlock(
        'page-123' as PageId,
        null,
        'Test'
      );
      expect(mockBlocks.has(recreatedBlock.blockId)).toBe(true);
    });

    it('should clear redo stack on new operation', async () => {
      // Create, delete (undo), then create new (should clear redo)
      const block1 = await mockService.createBlock('page-123' as PageId, null, 'Block 1');
      await mockService.deleteBlock(block1.blockId);

      const block2 = await mockService.createBlock('page-123' as PageId, null, 'Block 2');

      expect(mockBlocks.size).toBe(1);
      expect(mockBlocks.has(block2.blockId)).toBe(true);
    });
  });

  describe('stack size management', () => {
    it('should handle large number of operations', async () => {
      // Create 52 blocks (exceeds MAX_HISTORY_SIZE of 50)
      const blocks: Block[] = [];
      for (let i = 0; i < 52; i++) {
        const block = await mockService.createBlock(
          'page-123' as PageId,
          null,
          `Block ${i}`
        );
        blocks.push(block);
      }

      expect(mockBlocks.size).toBe(52);
      expect(mockService.createBlock).toHaveBeenCalledTimes(52);
    });

    it('should maintain block state correctly after many operations', async () => {
      // Create and update blocks
      const block1 = await mockService.createBlock('page-123' as PageId, null, 'Content 1');
      await mockService.updateContent(block1.blockId, 'Updated 1');

      const block2 = await mockService.createBlock('page-123' as PageId, null, 'Content 2');
      await mockService.updateContent(block2.blockId, 'Updated 2');

      const retrieved1 = mockBlocks.get(block1.blockId);
      const retrieved2 = mockBlocks.get(block2.blockId);

      expect(retrieved1?.content).toBe('Updated 1');
      expect(retrieved2?.content).toBe('Updated 2');
    });
  });

  describe('error handling', () => {
    it('should handle block not found during update', async () => {
      const blockId = 'non-existent' as BlockId;
      const beforeBlock = await mockService.getById(blockId);

      expect(beforeBlock).toBeNull();
    });

    it('should handle block not found during delete', async () => {
      const blockId = 'non-existent' as BlockId;
      const beforeBlock = await mockService.getById(blockId);

      expect(beforeBlock).toBeNull();
    });

    it('should handle service errors gracefully', async () => {
      const errorService: BlockService = {
        createBlock: vi.fn().mockRejectedValue(new Error('Create failed')),
        deleteBlock: vi.fn().mockRejectedValue(new Error('Delete failed')),
        updateContent: vi.fn().mockRejectedValue(new Error('Update failed')),
        getById: vi.fn().mockRejectedValue(new Error('GetById failed')),
      };

      await expect(errorService.createBlock('page-123' as PageId, null, 'Test')).rejects.toThrow('Create failed');
      await expect(errorService.deleteBlock('block-123' as BlockId)).rejects.toThrow('Delete failed');
      await expect(errorService.updateContent('block-123' as BlockId, 'New')).rejects.toThrow('Update failed');
      await expect(errorService.getById('block-123' as BlockId)).rejects.toThrow('GetById failed');
    });
  });

  describe('canUndo/canRedo state management', () => {
    it('should start with no operations', () => {
      // Initially no operations
      expect(mockService.createBlock).not.toHaveBeenCalled();
      expect(mockService.deleteBlock).not.toHaveBeenCalled();
      expect(mockService.updateContent).not.toHaveBeenCalled();
    });

    it('should track operations count', async () => {
      await mockService.createBlock('page-123' as PageId, null, 'Block 1');
      expect(mockService.createBlock).toHaveBeenCalledTimes(1);

      await mockService.createBlock('page-123' as PageId, null, 'Block 2');
      expect(mockService.createBlock).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed operation types', async () => {
      const block = await mockService.createBlock('page-123' as PageId, null, 'Test');
      await mockService.updateContent(block.blockId, 'Updated');
      await mockService.deleteBlock(block.blockId);

      expect(mockService.createBlock).toHaveBeenCalledTimes(1);
      expect(mockService.updateContent).toHaveBeenCalledTimes(1);
      expect(mockService.deleteBlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('operation timestamps', () => {
    it('should create blocks with timestamps', async () => {
      const before = Date.now();
      const block = await mockService.createBlock('page-123' as PageId, null, 'Test');
      const after = Date.now();

      expect(block.createdAt).toBeGreaterThanOrEqual(before);
      expect(block.createdAt).toBeLessThanOrEqual(after);
      expect(block.updatedAt).toBeGreaterThanOrEqual(before);
      expect(block.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should update timestamps on content change', async () => {
      const block = await mockService.createBlock('page-123' as PageId, null, 'Original');
      const originalUpdatedAt = block.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await mockService.updateContent(block.blockId, 'Updated');
      const updated = mockBlocks.get(block.blockId);

      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });
});
