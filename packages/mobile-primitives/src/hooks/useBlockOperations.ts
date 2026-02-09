/**
 * useBlockOperations - Hook for block CRUD operations with undo/redo support
 *
 * Provides operations for creating, updating, and deleting blocks with
 * proper undo/redo stack management for mobile interfaces.
 */

import { useCallback, useRef, useState } from 'react';
import type { Block, BlockId, PageId } from '@double-bind/types';

/**
 * Block service interface for CRUD operations
 */
export interface BlockService {
  createBlock: (
    pageId: PageId,
    parentId: BlockId | null,
    content: string,
    afterBlockId?: BlockId
  ) => Promise<Block>;
  deleteBlock: (blockId: BlockId) => Promise<void>;
  updateContent: (blockId: BlockId, content: string) => Promise<void>;
  getById: (blockId: BlockId) => Promise<Block | null>;
}

/**
 * Operation type for undo/redo stack
 */
export type OperationType = 'create' | 'delete' | 'update';

/**
 * Represents a single undoable operation
 */
export interface UndoableOperation {
  type: OperationType;
  blockId: BlockId;
  before?: Block | null;
  after?: Block | null;
  timestamp: number;
}

/**
 * Options for creating a new block
 */
export interface CreateBlockOptions {
  pageId: PageId;
  parentId: BlockId | null;
  content?: string;
  afterBlockId?: BlockId;
}

/**
 * Result returned by useBlockOperations hook
 */
export interface BlockOperationsResult {
  /**
   * Create a new block with undo support
   */
  createBlock: (options: CreateBlockOptions) => Promise<Block>;

  /**
   * Delete a block with undo support
   */
  deleteBlock: (blockId: BlockId) => Promise<void>;

  /**
   * Update block content with undo support
   */
  updateBlockContent: (blockId: BlockId, content: string) => Promise<void>;

  /**
   * Undo the last operation
   */
  undo: () => Promise<boolean>;

  /**
   * Redo the last undone operation
   */
  redo: () => Promise<boolean>;

  /**
   * Whether undo is available
   */
  canUndo: boolean;

  /**
   * Whether redo is available
   */
  canRedo: boolean;

  /**
   * Clear the undo/redo stack
   */
  clearHistory: () => void;
}

/**
 * Maximum number of operations to keep in undo/redo stack
 */
const MAX_HISTORY_SIZE = 50;

/**
 * Hook to manage block CRUD operations with undo/redo support
 *
 * @param blockService - The block service instance for performing operations
 *
 * @example
 * ```tsx
 * function BlockEditor({ blockService }: { blockService: BlockService }) {
 *   const { createBlock, deleteBlock, undo, redo, canUndo, canRedo } =
 *     useBlockOperations(blockService);
 *
 *   const handleEnter = async () => {
 *     const newBlock = await createBlock({
 *       pageId: 'page-123',
 *       parentId: null,
 *       content: '',
 *       afterBlockId: currentBlockId,
 *     });
 *     focusBlock(newBlock.blockId);
 *   };
 *
 *   return (
 *     <View>
 *       <Button onPress={undo} disabled={!canUndo}>Undo</Button>
 *       <Button onPress={redo} disabled={!canRedo}>Redo</Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useBlockOperations(blockService: BlockService): BlockOperationsResult {
  // Undo/redo stacks - using refs to avoid re-renders on every operation
  const undoStack = useRef<UndoableOperation[]>([]);
  const redoStack = useRef<UndoableOperation[]>([]);

  // State to track whether undo/redo is available (for UI updates)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Update the can undo/redo state based on stack sizes
   */
  const updateUndoRedoState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  /**
   * Add an operation to the undo stack and clear redo stack
   */
  const pushOperation = useCallback(
    (operation: UndoableOperation) => {
      // Add to undo stack
      undoStack.current.push(operation);

      // Limit stack size
      if (undoStack.current.length > MAX_HISTORY_SIZE) {
        undoStack.current.shift();
      }

      // Clear redo stack (new operations invalidate redo history)
      redoStack.current = [];

      updateUndoRedoState();
    },
    [updateUndoRedoState]
  );

  /**
   * Create a new block with undo support
   */
  const createBlock = useCallback(
    async (options: CreateBlockOptions): Promise<Block> => {
      const { pageId, parentId, content = '', afterBlockId } = options;

      // Create the block
      const newBlock = await blockService.createBlock(pageId, parentId, content, afterBlockId);

      // Record the operation for undo
      pushOperation({
        type: 'create',
        blockId: newBlock.blockId,
        before: null,
        after: newBlock,
        timestamp: Date.now(),
      });

      return newBlock;
    },
    [blockService, pushOperation]
  );

  /**
   * Delete a block with undo support
   */
  const deleteBlock = useCallback(
    async (blockId: BlockId): Promise<void> => {
      // Get the block before deletion for undo
      const blockBefore = await blockService.getById(blockId);

      if (!blockBefore) {
        throw new Error(`Block not found: ${blockId}`);
      }

      // Delete the block
      await blockService.deleteBlock(blockId);

      // Record the operation for undo
      pushOperation({
        type: 'delete',
        blockId,
        before: blockBefore,
        after: null,
        timestamp: Date.now(),
      });
    },
    [blockService, pushOperation]
  );

  /**
   * Update block content with undo support
   */
  const updateBlockContent = useCallback(
    async (blockId: BlockId, content: string): Promise<void> => {
      // Get the block before update for undo
      const blockBefore = await blockService.getById(blockId);

      if (!blockBefore) {
        throw new Error(`Block not found: ${blockId}`);
      }

      // Update the content
      await blockService.updateContent(blockId, content);

      // Get the block after update
      const blockAfter = await blockService.getById(blockId);

      // Record the operation for undo
      pushOperation({
        type: 'update',
        blockId,
        before: blockBefore,
        after: blockAfter,
        timestamp: Date.now(),
      });
    },
    [blockService, pushOperation]
  );

  /**
   * Undo the last operation
   */
  const undo = useCallback(async (): Promise<boolean> => {
    const operation = undoStack.current.pop();

    if (!operation) {
      return false;
    }

    try {
      // Reverse the operation
      switch (operation.type) {
        case 'create':
          // Delete the created block
          if (operation.after) {
            await blockService.deleteBlock(operation.blockId);
          }
          break;

        case 'delete':
          // Recreate the deleted block
          // TODO: Block position is not preserved during undo/redo
          // When a deleted block is recreated, it appears at the end of the parent's children.
          // To fully preserve order, we would need to store and restore the block's `order` field,
          // which requires BlockService.createBlockWithOrder() method.
          // This is acceptable for MVP - users can manually reorder after undo.
          if (operation.before) {
            await blockService.createBlock(
              operation.before.pageId,
              operation.before.parentId ?? null,
              operation.before.content,
              undefined // We don't have afterBlockId - block will be created at end
            );
          }
          break;

        case 'update':
          // Restore previous content
          if (operation.before) {
            await blockService.updateContent(operation.blockId, operation.before.content);
          }
          break;
      }

      // Move operation to redo stack
      redoStack.current.push(operation);
      updateUndoRedoState();

      return true;
    } catch (error) {
      // If undo fails, put the operation back
      undoStack.current.push(operation);
      updateUndoRedoState();
      throw error;
    }
  }, [blockService, updateUndoRedoState]);

  /**
   * Redo the last undone operation
   */
  const redo = useCallback(async (): Promise<boolean> => {
    const operation = redoStack.current.pop();

    if (!operation) {
      return false;
    }

    try {
      // Re-apply the operation
      switch (operation.type) {
        case 'create':
          // Recreate the block
          if (operation.after) {
            await blockService.createBlock(
              operation.after.pageId,
              operation.after.parentId ?? null,
              operation.after.content,
              undefined
            );
          }
          break;

        case 'delete':
          // Re-delete the block
          await blockService.deleteBlock(operation.blockId);
          break;

        case 'update':
          // Re-apply the content update
          if (operation.after) {
            await blockService.updateContent(operation.blockId, operation.after.content);
          }
          break;
      }

      // Move operation back to undo stack
      undoStack.current.push(operation);
      updateUndoRedoState();

      return true;
    } catch (error) {
      // If redo fails, put the operation back
      redoStack.current.push(operation);
      updateUndoRedoState();
      throw error;
    }
  }, [blockService, updateUndoRedoState]);

  /**
   * Clear the undo/redo history
   */
  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  return {
    createBlock,
    deleteBlock,
    updateBlockContent,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
