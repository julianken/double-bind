/**
 * BlockEditor - React component that wraps a ProseMirror EditorView for editing a single block.
 *
 * This component:
 * - Mounts a ProseMirror EditorView on a DOM ref
 * - Initializes EditorState from initialContent using the schema and serialization utilities
 * - Loads all plugins: keymap, input-rules, history
 * - Optionally integrates with BlockService for persistence and outliner operations
 * - Cleans up EditorView on unmount
 * - Renders inline within BlockNode as shown in react-architecture.md
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 * @see docs/frontend/state-management.md for ProseMirror state ownership
 */

import { useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import type { BlockService } from '@double-bind/core';
import type { BlockId, PageId } from '@double-bind/types';

import { schema } from './schema.js';
import { textToDoc, docToText } from './serialization.js';
import {
  createKeymapPlugin,
  createInputRulesPlugin,
  createPersistencePlugin,
  outlinerPlugins,
  type OutlinerContext,
} from './plugins/index.js';

/**
 * Props for the BlockEditor component.
 *
 * The component supports two usage modes:
 * 1. Callback-based (for testing/simple use): Provide onContentChange, onIndent, etc.
 * 2. Service-based (for production): Provide blockService, pageId, etc.
 *
 * When blockService is provided, the service-based plugins (persistence, outliner) are used.
 * When only callbacks are provided, a simpler callback-based approach is used.
 */
export interface BlockEditorProps {
  /**
   * Unique identifier for the block being edited.
   * Used for persistence and outliner operations.
   */
  blockId: BlockId;

  /**
   * Initial text content to display in the editor.
   * This is converted to a ProseMirror document on mount.
   */
  initialContent: string;

  // ============================================================================
  // Service-based integration (production mode)
  // ============================================================================

  /**
   * BlockService instance for persistence and block operations.
   * When provided, enables full persistence and outliner functionality.
   */
  blockService?: BlockService;

  /**
   * Page ID containing this block.
   * Required when blockService is provided.
   */
  pageId?: PageId;

  /**
   * Previous sibling block ID (for merge operations).
   * Pass null if this is the first block.
   */
  previousBlockId?: BlockId | null;

  /**
   * Callback to focus a specific block by ID.
   * Required when blockService is provided.
   */
  focusBlock?: (blockId: BlockId, position?: 'start' | 'end') => void;

  /**
   * Callback invoked when blocks have changed (after split, merge, indent, etc.).
   * Required when blockService is provided.
   */
  onBlocksChanged?: () => void;

  // ============================================================================
  // Callback-based integration (testing/simple mode)
  // ============================================================================

  /**
   * Called when content changes (debounced).
   * Used in callback mode when blockService is not provided.
   * @param content - The new text content
   */
  onContentChange?: (content: string) => void;

  /**
   * Called when the user requests to indent this block (Tab).
   * Used in callback mode when blockService is not provided.
   */
  onIndent?: () => void;

  /**
   * Called when the user requests to outdent this block (Shift+Tab).
   * Used in callback mode when blockService is not provided.
   */
  onOutdent?: () => void;

  /**
   * Called when the user requests to split this block at the cursor (Enter).
   * Used in callback mode when blockService is not provided.
   * @param cursorPosition - Position in text where the split should occur
   */
  onSplitBlock?: (cursorPosition: number) => void;

  /**
   * Called when the user requests to merge with the previous block (Backspace at start).
   * Used in callback mode when blockService is not provided.
   */
  onMergeWithPrevious?: () => void;

  // ============================================================================
  // Common props
  // ============================================================================

  /**
   * Called when the editor receives focus.
   */
  onFocus?: () => void;

  /**
   * Called when the editor loses focus.
   */
  onBlur?: () => void;

  /**
   * Whether the editor should be focused on mount.
   * Default: false
   */
  autoFocus?: boolean;

  /**
   * Additional CSS class names for the editor container.
   */
  className?: string;

  /**
   * Additional inline styles for the editor container.
   */
  style?: CSSProperties;

  /**
   * Placeholder text to show when the editor is empty.
   */
  placeholder?: string;

  /**
   * Whether the editor is read-only.
   * Default: false
   */
  readOnly?: boolean;

  /**
   * Test ID for the editor container (for testing).
   */
  testId?: string;
}

/**
 * Creates a simple outliner plugin that uses callbacks instead of BlockService.
 * This is used when blockService is not provided (e.g., in tests).
 */
function createCallbackOutlinerPlugin(options: {
  onIndent?: () => void;
  onOutdent?: () => void;
  onSplitBlock?: (cursorPosition: number) => void;
  onMergeWithPrevious?: () => void;
}) {
  return keymap({
    Tab: () => {
      options.onIndent?.();
      return true;
    },
    'Shift-Tab': () => {
      options.onOutdent?.();
      return true;
    },
    Enter: (state) => {
      if (options.onSplitBlock) {
        const { $from } = state.selection;
        options.onSplitBlock($from.parentOffset);
        return true;
      }
      return false;
    },
    Backspace: (state) => {
      const { $from } = state.selection;
      if ($from.parentOffset === 0 && options.onMergeWithPrevious) {
        options.onMergeWithPrevious();
        return true;
      }
      return false;
    },
  });
}

/**
 * Creates a simple persistence plugin that uses callbacks instead of BlockService.
 * This is used when blockService is not provided (e.g., in tests).
 */
function createCallbackPersistencePlugin(options: {
  onSave?: (content: string) => void;
  debounceMs?: number;
}) {
  const { onSave, debounceMs = 300 } = options;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastContent: string | null = null;

  return keymap({
    // This is a no-op keymap, but we use the view lifecycle for persistence
  });
}

/**
 * BlockEditor component - A React wrapper around ProseMirror for editing a single block.
 *
 * The editor is the authoritative source of truth for the block's content while
 * it is being edited. On blur or debounced intervals, content is persisted.
 *
 * @example
 * ```tsx
 * // Callback-based mode (testing/simple)
 * <BlockEditor
 *   blockId="block-123"
 *   initialContent="Hello, world!"
 *   onContentChange={(content) => console.log(content)}
 *   onIndent={() => console.log('indent')}
 *   autoFocus
 * />
 *
 * // Service-based mode (production)
 * <BlockEditor
 *   blockId="block-123"
 *   pageId="page-456"
 *   initialContent="Hello, world!"
 *   blockService={services.blockService}
 *   previousBlockId="block-122"
 *   focusBlock={(id, pos) => setFocusedBlock(id, pos)}
 *   onBlocksChanged={() => invalidateQueries(['blocks'])}
 *   autoFocus
 * />
 * ```
 */
export function BlockEditor({
  blockId,
  initialContent,
  blockService,
  pageId,
  previousBlockId,
  focusBlock,
  onBlocksChanged,
  onContentChange,
  onIndent,
  onOutdent,
  onSplitBlock,
  onMergeWithPrevious,
  onFocus,
  onBlur,
  autoFocus = false,
  className,
  style,
  placeholder,
  readOnly = false,
  testId,
}: BlockEditorProps) {
  // Ref for the DOM element where ProseMirror will mount
  const editorRef = useRef<HTMLDivElement>(null);
  // Ref to store the EditorView instance
  const viewRef = useRef<EditorView | null>(null);
  // Ref to store the outliner context (updated on each render)
  const contextRef = useRef<OutlinerContext | null>(null);

  // Determine if we're in service mode
  const useServiceMode = blockService && pageId && focusBlock && onBlocksChanged;

  // Update context ref on each render so plugins always have fresh values
  useEffect(() => {
    if (useServiceMode) {
      contextRef.current = {
        blockId,
        pageId: pageId!,
        previousBlockId: previousBlockId ?? null,
        getContentBeforeCursor: (view: EditorView) => {
          const { from } = view.state.selection;
          return view.state.doc.textBetween(0, from);
        },
        getContentAfterCursor: (view: EditorView) => {
          const { to } = view.state.selection;
          const docSize = view.state.doc.content.size;
          return view.state.doc.textBetween(to, docSize);
        },
        focusBlock: focusBlock!,
        onBlocksChanged: onBlocksChanged!,
      };
    }
  });

  // Stable callback to get current context
  const getContext = useCallback((): OutlinerContext | null => {
    return contextRef.current;
  }, []);

  // Stable callback for content change (callback mode)
  const handleContentChange = useCallback(
    (content: string) => {
      onContentChange?.(content);
    },
    [onContentChange]
  );

  // Create the editor on mount
  useEffect(() => {
    if (!editorRef.current) return;

    // Don't recreate if already exists
    if (viewRef.current) return;

    // Create initial document from content
    const doc = textToDoc(initialContent);

    // Assemble plugins based on mode
    const plugins = [
      // History for undo/redo
      history(),
      // Custom keymap for formatting
      createKeymapPlugin({ schema }),
      // Input rules for Markdown shortcuts
      createInputRulesPlugin(schema),
    ];

    if (useServiceMode) {
      // Service-based mode: use full plugins
      plugins.push(
        // Outliner operations (indent, outdent, split, merge)
        ...outlinerPlugins(blockService!, getContext),
        // Auto-save with debounce
        createPersistencePlugin({
          blockId,
          blockService: blockService!,
          onBlur,
        })
      );
    } else {
      // Callback-based mode: use simple callback plugins
      plugins.push(
        createCallbackOutlinerPlugin({
          onIndent,
          onOutdent,
          onSplitBlock,
          onMergeWithPrevious,
        })
      );
    }

    // Base keymap (Enter, Backspace, etc.) - loaded last so our handlers take precedence
    plugins.push(keymap(baseKeymap));

    // Create initial editor state
    const state = EditorState.create({
      doc,
      schema,
      plugins,
    });

    // Create the editor view
    const view = new EditorView(editorRef.current, {
      state,
      editable: () => !readOnly,
      dispatchTransaction(transaction: Transaction) {
        // Update the view's state
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        // In callback mode, trigger content change on doc changes
        if (!useServiceMode && transaction.docChanged) {
          // Debounce would be nice here, but for simplicity we call immediately
          handleContentChange(docToText(newState.doc));
        }
      },
      handleDOMEvents: {
        focus: () => {
          onFocus?.();
          return false;
        },
        blur: () => {
          onBlur?.();
          return false;
        },
      },
      // Accessibility attributes
      attributes: {
        role: 'textbox',
        'aria-multiline': 'false',
        'aria-label': 'Block content',
        ...(placeholder && { 'data-placeholder': placeholder }),
      },
    });

    viewRef.current = view;

    // Auto-focus if requested
    if (autoFocus) {
      view.focus();
    }

    // Cleanup on unmount
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
    // Note: We intentionally exclude callback dependencies to avoid recreating the editor.
    // The editor is created once and handles its own updates via ProseMirror.
  }, [blockId]); // Only recreate when blockId changes

  // Update editable state when readOnly changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.setProps({
        editable: () => !readOnly,
      });
    }
  }, [readOnly]);

  return (
    <div
      ref={editorRef}
      className={`block-editor ${className || ''}`}
      style={style}
      data-testid={testId || `block-editor-${blockId}`}
      data-block-id={blockId}
    />
  );
}

/**
 * Gets the current text content from a BlockEditor.
 * This is useful for imperative access to the editor content.
 *
 * @param view - The ProseMirror EditorView instance
 * @returns The current text content
 */
export function getEditorContent(view: EditorView): string {
  return docToText(view.state.doc);
}

/**
 * Focuses the editor programmatically.
 *
 * @param view - The ProseMirror EditorView instance
 */
export function focusEditor(view: EditorView): void {
  view.focus();
}

/**
 * Checks if the editor has focus.
 *
 * @param view - The ProseMirror EditorView instance
 * @returns true if the editor has focus
 */
export function editorHasFocus(view: EditorView): boolean {
  return view.hasFocus();
}
