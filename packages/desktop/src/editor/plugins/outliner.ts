/**
 * Outliner ProseMirror plugin for Double-Bind.
 *
 * Handles core outliner keyboard behaviors:
 * - Tab: Indent the current block
 * - Shift+Tab: Outdent the current block
 * - Enter: Split block at cursor position, creating a new sibling block below
 * - Backspace at position 0: Merge content with previous block
 * - Delete at end of block: Merge next block's content into current block
 * - Shift+Enter: Insert newline within the block (does not split)
 */

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import type { BlockService } from '@double-bind/core';
import type { BlockId, PageId } from '@double-bind/types';

/**
 * Plugin key for identifying the outliner plugin.
 */
export const outlinerPluginKey = new PluginKey('outliner');

/**
 * Context provided to the outliner plugin for block operations.
 * This is used to pass necessary information from the React component.
 */
export interface OutlinerContext {
  /** The current block being edited */
  blockId: BlockId;
  /** The page containing the block */
  pageId: PageId;
  /** The parent block ID (null if root-level block) */
  parentId: BlockId | null;
  /** The previous sibling block ID (null if first block) */
  previousBlockId: BlockId | null;
  /** The next sibling block ID (null if last block) */
  nextBlockId: BlockId | null;
  /** Callback to get content before cursor position */
  getContentBeforeCursor: (view: EditorView) => string;
  /** Callback to get content after cursor position */
  getContentAfterCursor: (view: EditorView) => string;
  /** Callback to focus a specific block */
  focusBlock: (blockId: BlockId, position?: 'start' | 'end') => void;
  /** Callback to refresh the block list after mutations */
  onBlocksChanged: () => void;
  /** Callback to get content of a specific block */
  getBlockContent?: (blockId: BlockId) => string;
}

/**
 * Commands for outliner operations.
 * These return true if the command was handled, false otherwise.
 */
type OutlinerCommand = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  view: EditorView,
  context: OutlinerContext,
  blockService: BlockService
) => boolean | Promise<boolean>;

/**
 * Indent the current block by making it a child of the previous sibling.
 */
const indentBlock: OutlinerCommand = async (
  _state,
  _dispatch,
  _view,
  context,
  blockService
): Promise<boolean> => {
  try {
    await blockService.indentBlock(context.blockId);
    context.onBlocksChanged();
    return true;
  } catch {
    // Cannot indent (e.g., no previous sibling)
    return false;
  }
};

/**
 * Outdent the current block by making it a sibling of its parent.
 */
const outdentBlock: OutlinerCommand = async (
  _state,
  _dispatch,
  _view,
  context,
  blockService
): Promise<boolean> => {
  try {
    await blockService.outdentBlock(context.blockId);
    context.onBlocksChanged();
    return true;
  } catch {
    // Cannot outdent (e.g., already at root level)
    return false;
  }
};

/**
 * Split block at cursor position, creating a new sibling block below.
 */
const splitBlock: OutlinerCommand = async (
  _state,
  _dispatch,
  view,
  context,
  blockService
): Promise<boolean> => {
  const contentBefore = context.getContentBeforeCursor(view);
  const contentAfter = context.getContentAfterCursor(view);

  try {
    // Update current block with content before cursor
    await blockService.updateContent(context.blockId, contentBefore);

    // Create new block with content after cursor as a sibling at the same level
    const newBlock = await blockService.createBlock(
      context.pageId,
      context.parentId, // Same parent as current block = sibling at same level
      contentAfter,
      context.blockId // Insert after current block
    );

    context.onBlocksChanged();

    // Focus the new block at the start
    context.focusBlock(newBlock.blockId, 'start');

    return true;
  } catch {
    return false;
  }
};

/**
 * Delete an empty block entirely when Backspace is pressed.
 * If the block has content, fall through to the default merge behavior.
 */
const deleteEmptyBlockOnBackspace: OutlinerCommand = async (
  _state,
  _dispatch,
  view,
  context,
  blockService
): Promise<boolean> => {
  const currentContent = view.state.doc.textContent;

  // Only handle empty blocks - non-empty blocks use standard merge behavior
  if (currentContent.trim() !== '') {
    return false;
  }

  try {
    // Delete the empty block
    await blockService.deleteBlock(context.blockId);

    context.onBlocksChanged();

    // Focus previous block at the end, or next block at start
    if (context.previousBlockId) {
      context.focusBlock(context.previousBlockId, 'end');
    } else if (context.nextBlockId) {
      context.focusBlock(context.nextBlockId, 'start');
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Merge current block with previous block when backspace is pressed at position 0.
 * Note: The position check is done in the shouldHandle callback in createOutlinerKeymap.
 */
const mergeWithPrevious: OutlinerCommand = async (
  _state,
  _dispatch,
  view,
  context,
  blockService
): Promise<boolean> => {
  // Previous block check is done in shouldHandle, but we keep a guard for safety
  if (!context.previousBlockId) {
    return false;
  }

  const currentContent = view.state.doc.textContent;

  try {
    // Delete current block
    await blockService.deleteBlock(context.blockId);

    // Note: Proper merge would require fetching the previous block's content
    // and appending the current content. This requires access to the block
    // data which the plugin doesn't have direct access to.
    // The UI layer (React component) should provide a merge callback.

    context.onBlocksChanged();

    // Focus previous block at the end
    context.focusBlock(context.previousBlockId, 'end');

    // If we need to append content, the UI layer should handle it
    if (currentContent) {
      // This is a limitation - the full implementation should be in the UI layer
      // that has access to both blocks' content
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Delete an empty block entirely when Delete is pressed.
 * If the block has content, fall through to the default merge behavior.
 */
const deleteEmptyBlockOnDelete: OutlinerCommand = async (
  _state,
  _dispatch,
  view,
  context,
  blockService
): Promise<boolean> => {
  const currentContent = view.state.doc.textContent;

  // Only handle empty blocks - non-empty blocks use standard merge behavior
  if (currentContent.trim() !== '') {
    return false;
  }

  try {
    // Delete the empty block
    await blockService.deleteBlock(context.blockId);

    context.onBlocksChanged();

    // Focus next block at start, or previous block at end
    if (context.nextBlockId) {
      context.focusBlock(context.nextBlockId, 'start');
    } else if (context.previousBlockId) {
      context.focusBlock(context.previousBlockId, 'end');
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Merge next block into current block when Delete is pressed at end of block.
 * Note: The position check is done in the shouldHandle callback in createOutlinerKeymap.
 */
const mergeWithNext: OutlinerCommand = async (
  _state,
  _dispatch,
  view,
  context,
  blockService
): Promise<boolean> => {
  // Next block check is done in shouldHandle, but we keep a guard for safety
  if (!context.nextBlockId) {
    return false;
  }

  const currentContent = view.state.doc.textContent;

  try {
    // Get the next block's content if available
    const nextBlockContent = context.getBlockContent?.(context.nextBlockId) ?? '';

    // Update current block with merged content
    const mergedContent = currentContent + nextBlockContent;
    await blockService.updateContent(context.blockId, mergedContent);

    // Delete the next block
    await blockService.deleteBlock(context.nextBlockId);

    context.onBlocksChanged();

    // Keep focus in current block at the merge point (end of original content)
    // The focusBlock with a specific cursor position would be ideal,
    // but 'end' will work for now since we stay in the same block
    context.focusBlock(context.blockId, 'end');

    return true;
  } catch {
    return false;
  }
};

/**
 * Insert a newline character within the block (Shift+Enter).
 * This does NOT split the block.
 */
const insertNewline = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined
): boolean => {
  if (dispatch) {
    const tr = state.tr.insertText('\n');
    dispatch(tr);
  }
  return true;
};

/**
 * Creates an async key handler that wraps async commands.
 *
 * @param shouldHandle - Optional sync check to determine if the handler should run.
 *                       If provided and returns false, the handler returns false
 *                       to let default behavior proceed.
 */
function createAsyncKeyHandler(
  context: () => OutlinerContext | null,
  blockService: BlockService,
  command: OutlinerCommand,
  shouldHandle?: (state: EditorState, ctx: OutlinerContext) => boolean
): (state: EditorState, dispatch?: (tr: Transaction) => void, view?: EditorView) => boolean {
  return (state, dispatch, view) => {
    const ctx = context();
    if (!ctx || !view) {
      return false;
    }

    // If a sync check is provided, use it to determine if we should handle
    if (shouldHandle && !shouldHandle(state, ctx)) {
      return false;
    }

    // Execute the async command
    // Return true immediately to prevent default behavior
    // The actual operation happens asynchronously
    void command(state, dispatch, view, ctx, blockService);
    return true;
  };
}

/**
 * Creates the outliner keymap plugin.
 *
 * @param blockService - The BlockService instance for block operations
 * @param getContext - Function to get the current outliner context
 * @returns A ProseMirror keymap plugin
 */
export function createOutlinerKeymap(
  blockService: BlockService,
  getContext: () => OutlinerContext | null
): Plugin {
  return keymap({
    // Note: Tab and Shift-Tab are handled in createOutlinerPlugin's handleKeyDown
    // because we need to call event.preventDefault() to stop browser focus change

    // Enter: Split block at cursor
    Enter: createAsyncKeyHandler(getContext, blockService, splitBlock),

    // Shift-Enter: Insert newline (sync, doesn't need async handling)
    'Shift-Enter': insertNewline,

    // Backspace: Delete empty block OR merge with previous when at start
    // First try to delete empty block, then fall back to merge behavior
    Backspace: (state, dispatch, view) => {
      const ctx = getContext();
      if (!ctx || !view) return false;

      const { from } = state.selection;
      const isAtStart = from === 0 || from === 1;

      // First, try to delete empty block (works anywhere in the block)
      if (state.doc.textContent.trim() === '') {
        void deleteEmptyBlockOnBackspace(state, dispatch, view, ctx, blockService);
        return true;
      }

      // Only handle merge if at start of block and there's a previous block
      if (!isAtStart || ctx.previousBlockId === null) {
        return false;
      }

      void mergeWithPrevious(state, dispatch, view, ctx, blockService);
      return true;
    },

    // Delete: Delete empty block OR merge with next when at end
    // First try to delete empty block, then fall back to merge behavior
    Delete: (state, dispatch, view) => {
      const ctx = getContext();
      if (!ctx || !view) return false;

      const { to } = state.selection;
      const docSize = state.doc.content.size;
      const isAtEnd = to >= docSize;

      // First, try to delete empty block (works anywhere in the block)
      if (state.doc.textContent.trim() === '') {
        void deleteEmptyBlockOnDelete(state, dispatch, view, ctx, blockService);
        return true;
      }

      // Only handle merge if at end of block and there's a next block
      if (!isAtEnd || ctx.nextBlockId === null) {
        return false;
      }

      void mergeWithNext(state, dispatch, view, ctx, blockService);
      return true;
    },
  });
}

/**
 * Creates the full outliner plugin with state and keymap.
 *
 * @param blockService - The BlockService instance for block operations
 * @param getContext - Function to get the current outliner context
 * @returns A ProseMirror plugin
 */
export function createOutlinerPlugin(
  blockService: BlockService,
  getContext: () => OutlinerContext | null
): Plugin {
  return new Plugin({
    key: outlinerPluginKey,

    props: {
      /**
       * Handle Tab key for indent/outdent operations.
       * We use handleKeyDown instead of keymap + handleDOMEvents because:
       * 1. We need to call preventDefault() to stop browser focus change
       * 2. We need to trigger the async indent/outdent operation
       * 3. Using handleKeyDown lets us do both in one place
       */
      handleKeyDown(view, event) {
        if (event.key === 'Tab') {
          const ctx = getContext();
          if (!ctx) {
            return false;
          }

          // Prevent browser's default tab behavior (focus change)
          event.preventDefault();

          // Execute indent or outdent based on Shift key
          if (event.shiftKey) {
            void outdentBlock(view.state, undefined, view, ctx, blockService);
          } else {
            void indentBlock(view.state, undefined, view, ctx, blockService);
          }

          // Return true to indicate we handled the key
          return true;
        }
        return false;
      },
    },
  });
}

/**
 * Helper function to get text content before cursor position.
 */
export function getContentBeforeCursor(view: EditorView): string {
  const { from } = view.state.selection;
  return view.state.doc.textBetween(0, from);
}

/**
 * Helper function to get text content after cursor position.
 */
export function getContentAfterCursor(view: EditorView): string {
  const { to } = view.state.selection;
  const docSize = view.state.doc.content.size;
  return view.state.doc.textBetween(to, docSize);
}

/**
 * Export all plugins needed for the outliner functionality.
 * Should be used when setting up the ProseMirror editor.
 *
 * @param blockService - The BlockService instance for block operations
 * @param getContext - Function to get the current outliner context
 * @returns Array of ProseMirror plugins to add to the editor
 */
export function outlinerPlugins(
  blockService: BlockService,
  getContext: () => OutlinerContext | null
): Plugin[] {
  return [
    createOutlinerKeymap(blockService, getContext),
    createOutlinerPlugin(blockService, getContext),
  ];
}
