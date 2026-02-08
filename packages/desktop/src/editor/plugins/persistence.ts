/**
 * Persistence Plugin for ProseMirror
 *
 * Saves block content to CozoDB with debouncing during typing.
 * Provides immediate save on blur with query invalidation.
 *
 * Features:
 * - Debounced save (300ms) triggers after last keystroke
 * - Immediate save fires on editor blur/deactivation
 * - Query invalidation (['blocks'], ['backlinks'], ['search'], ['links']) on blur
 * - Pending debounce is cancelled and flushed on blur
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { BlockId } from '@double-bind/types';
import type { BlockService } from '@double-bind/core';
import { invalidateQueries } from '../../hooks/useCozoQuery.js';

/**
 * Plugin key for the persistence plugin.
 * Used to access plugin state from EditorState.
 */
export const persistencePluginKey = new PluginKey('persistence');

/**
 * Default debounce delay in milliseconds.
 */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Options for creating the persistence plugin.
 */
export interface PersistencePluginOptions {
  /** The block ID being edited */
  blockId: BlockId;
  /** BlockService instance for saving content */
  blockService: BlockService;
  /** Optional callback invoked on blur (after save and invalidation) */
  onBlur?: () => void;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
}

/**
 * Internal state tracked by the persistence plugin.
 */
interface PersistenceState {
  /** The block ID being edited */
  blockId: BlockId;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Last saved content (to detect changes) */
  lastSavedContent: string | null;
}

/**
 * Creates a ProseMirror plugin that handles persisting block content to CozoDB.
 *
 * The plugin:
 * - Tracks document changes and marks the editor as dirty
 * - Debounces saves to avoid excessive writes during typing (300ms default)
 * - Immediately saves on blur/deactivation
 * - Invalidates relevant queries on blur (blocks, backlinks, search, links)
 *
 * @param options - Configuration options for the plugin
 * @returns A ProseMirror Plugin instance
 *
 * @example
 * ```typescript
 * const plugin = createPersistencePlugin({
 *   blockId: 'block-123',
 *   blockService: services.blockService,
 *   onBlur: () => handleEditorBlur(),
 * });
 *
 * const state = EditorState.create({
 *   schema: mySchema,
 *   plugins: [plugin],
 * });
 * ```
 */
export function createPersistencePlugin(options: PersistencePluginOptions): Plugin {
  const { blockId, blockService, onBlur, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  // Debounce timer reference (stored outside plugin state for mutability)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Track if a save is in progress to avoid race conditions
  let isSaving = false;
  // Store the pending content to save
  let pendingContent: string | null = null;
  // Track the last saved content to detect if invalidation is needed on blur
  let lastSavedContent: string | null = null;

  /**
   * Cancel any pending debounced save.
   */
  const cancelDebounce = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  /**
   * Save content to the database.
   */
  const saveContent = async (content: string): Promise<void> => {
    if (isSaving) {
      // Queue this save for later
      pendingContent = content;
      return;
    }

    isSaving = true;
    try {
      await blockService.updateContent(blockId, content);
      // Track what we saved so we can detect changes on blur
      lastSavedContent = content;
    } finally {
      isSaving = false;

      // If there was a pending save while we were saving, execute it now
      if (pendingContent !== null) {
        const nextContent = pendingContent;
        pendingContent = null;
        await saveContent(nextContent);
      }
    }
  };

  /**
   * Schedule a debounced save.
   */
  const scheduleSave = (content: string): void => {
    cancelDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void saveContent(content);
    }, debounceMs);
  };

  /**
   * Flush any pending save immediately.
   * Called on blur to ensure content is saved before deactivation.
   */
  const flushPendingSave = async (view: EditorView): Promise<void> => {
    // Cancel the debounce timer
    const hadPendingTimer = debounceTimer !== null;
    cancelDebounce();

    // Get current content from the editor
    const content = view.state.doc.textContent;

    // Only save and invalidate if there were actual changes:
    // 1. There was a pending debounce timer (user was typing), OR
    // 2. Content differs from last saved (if we've saved before)
    // If lastSavedContent is null, we haven't saved yet, so only save if there was typing
    const contentChanged = lastSavedContent !== null && content !== lastSavedContent;
    const shouldSaveAndInvalidate = hadPendingTimer || contentChanged;

    if (shouldSaveAndInvalidate) {
      // Save immediately
      await saveContent(content);

      // Invalidate queries only when content actually changed
      invalidateQueries(['blocks']);
      invalidateQueries(['backlinks']);
      invalidateQueries(['search']);
      invalidateQueries(['links']);
    }

    // Invoke the onBlur callback if provided
    onBlur?.();
  };

  return new Plugin({
    key: persistencePluginKey,

    state: {
      init(): PersistenceState {
        return {
          blockId,
          isDirty: false,
          lastSavedContent: null,
        };
      },

      apply(tr, value, _oldState, newState): PersistenceState {
        // If the document changed, mark as dirty and schedule save
        if (tr.docChanged) {
          const content = newState.doc.textContent;

          // Only schedule save if content actually changed
          if (content !== value.lastSavedContent) {
            scheduleSave(content);
            return {
              ...value,
              isDirty: true,
            };
          }
        }

        return value;
      },
    },

    props: {
      handleDOMEvents: {
        blur(view: EditorView): boolean {
          // Flush pending save on blur
          void flushPendingSave(view);
          // Return false to allow default blur behavior
          return false;
        },
      },
    },

    view() {
      return {
        destroy() {
          // Clean up debounce timer when view is destroyed
          cancelDebounce();
        },
      };
    },
  });
}

/**
 * Get the persistence plugin state from an EditorState.
 *
 * @param state - The EditorState to query
 * @returns The persistence plugin state, or undefined if plugin is not installed
 */
export function getPersistenceState(
  state: Parameters<typeof persistencePluginKey.getState>[0]
): PersistenceState | undefined {
  return persistencePluginKey.getState(state) as PersistenceState | undefined;
}
