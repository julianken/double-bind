/**
 * Keymap plugin for ProseMirror editor
 *
 * Implements keyboard shortcuts for text formatting, block operations,
 * and block navigation per keyboard-first.md design spec.
 */

import { keymap } from 'prosemirror-keymap';
import { toggleMark, baseKeymap } from 'prosemirror-commands';
import { Plugin } from 'prosemirror-state';
import type { Schema, MarkType } from 'prosemirror-model';
import type { EditorState, Transaction, Command } from 'prosemirror-state';

/**
 * Block service interface for block-level operations
 */
export interface BlockService {
  moveBlockUp(blockId: string): Promise<void>;
  moveBlockDown(blockId: string): Promise<void>;
  collapseBlock(blockId: string): Promise<void>;
  expandBlock(blockId: string): Promise<void>;
  toggleTodo(blockId: string): Promise<void>;
  focusPreviousBlock(): void;
  focusNextBlock(): void;
}

/**
 * Options for keymap plugin creation
 */
export interface KeymapPluginOptions {
  /** ProseMirror schema with marks defined */
  schema: Schema;
  /** Block service for block-level operations */
  blockService?: BlockService;
  /** Current block ID (for block operations) */
  getBlockId?: () => string | null;
}

/**
 * Creates a toggle mark command that handles missing mark types gracefully
 */
function createToggleMarkCommand(markType: MarkType | undefined): Command {
  if (!markType) {
    return () => false;
  }
  return toggleMark(markType);
}

/**
 * Check if cursor is at the first line of the editor
 */
function isAtFirstLine(state: EditorState): boolean {
  const { $from } = state.selection;
  // If selection is at the start of the document
  if ($from.pos <= 1) return true;

  // Check if there's no text before on the current line
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n');
  const hasNewlineBefore = textBefore.includes('\n');

  // At first line if no newline in text before cursor within this block
  return !hasNewlineBefore && $from.parentOffset === $from.parent.firstChild?.nodeSize;
}

/**
 * Check if cursor is at the last line of the editor
 */
function isAtLastLine(state: EditorState): boolean {
  const { $from } = state.selection;
  const parent = $from.parent;

  // Get text from cursor to end of parent
  const textAfter = parent.textBetween($from.parentOffset, parent.content.size, '\n');
  const hasNewlineAfter = textAfter.includes('\n');

  // At last line if no newline in text after cursor within this block
  return !hasNewlineAfter;
}

/**
 * Creates text formatting keybindings
 */
function createTextFormattingKeymap(schema: Schema): Record<string, Command> {
  const bindings: Record<string, Command> = {};

  // Bold: Ctrl+B
  bindings['Mod-b'] = createToggleMarkCommand(schema.marks.bold);
  bindings['Mod-B'] = createToggleMarkCommand(schema.marks.bold);

  // Italic: Ctrl+I
  bindings['Mod-i'] = createToggleMarkCommand(schema.marks.italic);
  bindings['Mod-I'] = createToggleMarkCommand(schema.marks.italic);

  // Code: Ctrl+E
  bindings['Mod-e'] = createToggleMarkCommand(schema.marks.code);
  bindings['Mod-E'] = createToggleMarkCommand(schema.marks.code);

  // Highlight: Ctrl+H
  bindings['Mod-h'] = createToggleMarkCommand(schema.marks.highlight);
  bindings['Mod-H'] = createToggleMarkCommand(schema.marks.highlight);

  // Strikethrough: Ctrl+Shift+K
  bindings['Mod-Shift-k'] = createToggleMarkCommand(schema.marks.strikethrough);
  bindings['Mod-Shift-K'] = createToggleMarkCommand(schema.marks.strikethrough);

  return bindings;
}

/**
 * Creates block operation keybindings
 */
function createBlockOperationsKeymap(
  blockService?: BlockService,
  getBlockId?: () => string | null
): Record<string, Command> {
  const bindings: Record<string, Command> = {};

  if (!blockService || !getBlockId) {
    return bindings;
  }

  // Move block up: Alt+Up
  bindings['Alt-ArrowUp'] = () => {
    const blockId = getBlockId();
    if (blockId) {
      void blockService.moveBlockUp(blockId);
      return true;
    }
    return false;
  };

  // Move block down: Alt+Down
  bindings['Alt-ArrowDown'] = () => {
    const blockId = getBlockId();
    if (blockId) {
      void blockService.moveBlockDown(blockId);
      return true;
    }
    return false;
  };

  // Collapse block: Ctrl+Shift+Up
  bindings['Mod-Shift-ArrowUp'] = () => {
    const blockId = getBlockId();
    if (blockId) {
      void blockService.collapseBlock(blockId);
      return true;
    }
    return false;
  };

  // Expand block: Ctrl+Shift+Down
  bindings['Mod-Shift-ArrowDown'] = () => {
    const blockId = getBlockId();
    if (blockId) {
      void blockService.expandBlock(blockId);
      return true;
    }
    return false;
  };

  // Toggle TODO: Ctrl+Enter
  bindings['Mod-Enter'] = () => {
    const blockId = getBlockId();
    if (blockId) {
      void blockService.toggleTodo(blockId);
      return true;
    }
    return false;
  };

  return bindings;
}

/**
 * Creates block navigation keybindings
 */
function createBlockNavigationKeymap(blockService?: BlockService): Record<string, Command> {
  const bindings: Record<string, Command> = {};

  if (!blockService) {
    return bindings;
  }

  // Up arrow at first line moves to previous block
  bindings['ArrowUp'] = (state: EditorState, _dispatch?: (tr: Transaction) => void) => {
    if (isAtFirstLine(state)) {
      blockService.focusPreviousBlock();
      return true;
    }
    // Let default behavior handle it
    return false;
  };

  // Down arrow at last line moves to next block
  bindings['ArrowDown'] = (state: EditorState, _dispatch?: (tr: Transaction) => void) => {
    if (isAtLastLine(state)) {
      blockService.focusNextBlock();
      return true;
    }
    // Let default behavior handle it
    return false;
  };

  return bindings;
}

/**
 * Creates the keymap plugin for the ProseMirror editor
 *
 * @param options - Plugin configuration options
 * @returns ProseMirror plugin with keybindings
 *
 * @example
 * ```ts
 * const keymapPlugin = createKeymapPlugin({
 *   schema: mySchema,
 *   blockService: myBlockService,
 *   getBlockId: () => currentBlockId
 * });
 *
 * const state = EditorState.create({
 *   schema: mySchema,
 *   plugins: [keymapPlugin]
 * });
 * ```
 */
export function createKeymapPlugin(options: KeymapPluginOptions): Plugin {
  const { schema, blockService, getBlockId } = options;

  // Combine all keybindings
  const bindings: Record<string, Command> = {
    // Text formatting shortcuts (highest priority)
    ...createTextFormattingKeymap(schema),
    // Block operations
    ...createBlockOperationsKeymap(blockService, getBlockId),
    // Block navigation
    ...createBlockNavigationKeymap(blockService),
  };

  return keymap(bindings);
}

/**
 * Creates a plugin that combines custom keymap with base keymap
 *
 * @param options - Plugin configuration options
 * @returns Array of ProseMirror plugins
 */
export function createEditorKeymaps(options: KeymapPluginOptions): Plugin[] {
  return [
    // Custom bindings take priority
    createKeymapPlugin(options),
    // Fall back to base keymap for standard editing commands
    keymap(baseKeymap),
  ];
}

/**
 * Standard keybindings map (for documentation/UI display)
 */
export const KEYBINDINGS = {
  // Text formatting
  bold: 'Ctrl+B',
  italic: 'Ctrl+I',
  code: 'Ctrl+E',
  highlight: 'Ctrl+H',
  strikethrough: 'Ctrl+Shift+K',

  // Block operations
  moveBlockUp: 'Alt+Up',
  moveBlockDown: 'Alt+Down',
  collapseBlock: 'Ctrl+Shift+Up',
  expandBlock: 'Ctrl+Shift+Down',
  toggleTodo: 'Ctrl+Enter',

  // Block navigation
  previousBlock: 'Up (at first line)',
  nextBlock: 'Down (at last line)',
} as const;

export type KeybindingName = keyof typeof KEYBINDINGS;
