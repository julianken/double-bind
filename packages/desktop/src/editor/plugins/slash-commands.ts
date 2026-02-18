/**
 * Slash commands plugin for ProseMirror editor
 *
 * Detects `/` typed at the beginning of a block (or after only whitespace) and
 * dispatches a `slash-command-open` CustomEvent on the editor's DOM element.
 * The event carries viewport coordinates so UI components can position a popup.
 *
 * Dispatch contract:
 *   - Event name: `slash-command-open`
 *   - `event.detail.pos`    — ProseMirror document position of the `/`
 *   - `event.detail.coords` — `{ top, left, bottom, right }` bounding rect
 *                              at that position (from `view.coordsAtPos`)
 *
 * The plugin also listens for `Escape` to close the popup by dispatching
 * `slash-command-close` when the trigger is active.
 *
 * @see docs/frontend/prosemirror.md for editor architecture
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

// ============================================================================
// Plugin Key & State
// ============================================================================

/**
 * Plugin key for accessing slash command state.
 */
export const slashCommandPluginKey = new PluginKey<SlashCommandState>('slash-commands');

/**
 * State maintained by the slash command plugin.
 */
export interface SlashCommandState {
  /** Whether the slash command popup is currently active */
  active: boolean;
  /** Document position where the `/` was typed */
  triggerPos: number;
}

/** Closed / inactive state */
const INACTIVE_STATE: SlashCommandState = { active: false, triggerPos: 0 };

// ============================================================================
// Helper — detect trigger
// ============================================================================

/**
 * Returns the document position of a `/` trigger if the cursor is immediately
 * after one that was typed at the start of a line (or after only whitespace).
 *
 * Returns -1 when no trigger is found.
 */
function findSlashTriggerPos(state: EditorState): number {
  const { $from } = state.selection;

  // Only fire for a collapsed (cursor) selection
  if (!state.selection.empty) return -1;

  // Text in the current text block from the block start to the cursor
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');

  // The trigger fires when the text before the cursor is exactly `/` (or
  // optional leading whitespace followed by `/`).  We do NOT fire if the user
  // has already typed a command character after the `/`, because at that point
  // the dropdown is filtering and a new event is not needed.
  if (!/^\s*\/$/.test(textBefore)) return -1;

  // Absolute document position of the `/`
  const slashOffset = textBefore.lastIndexOf('/');
  const nodeStart = $from.start();
  return nodeStart + slashOffset;
}

// ============================================================================
// Plugin Creation
// ============================================================================

/**
 * Options for the slash commands plugin.
 */
export interface SlashCommandPluginOptions {
  /**
   * Called after the `slash-command-open` event is dispatched.
   * Useful for integration tests or additional side-effects.
   */
  onOpen?: (pos: number, coords: { top: number; left: number; bottom: number; right: number }) => void;
  /**
   * Called after the `slash-command-close` event is dispatched.
   */
  onClose?: () => void;
}

/**
 * Creates the slash commands ProseMirror plugin.
 *
 * The plugin is stateless with respect to the open/close state — it detects
 * the trigger on every text input via `handleTextInput` and dispatches DOM
 * events for the React layer to act on.
 *
 * @example
 * ```ts
 * const slashPlugin = createSlashCommandPlugin();
 *
 * // In your React component, listen for the event:
 * editorDom.addEventListener('slash-command-open', (e) => {
 *   const { pos, coords } = e.detail;
 *   openSlashMenu(coords);
 * });
 * ```
 */
export function createSlashCommandPlugin(options: SlashCommandPluginOptions = {}): Plugin {
  const { onOpen, onClose } = options;

  return new Plugin<SlashCommandState>({
    key: slashCommandPluginKey,

    // -------------------------------------------------------------------------
    // State machine — tracks whether the slash trigger is active
    // -------------------------------------------------------------------------
    state: {
      init(): SlashCommandState {
        return { ...INACTIVE_STATE };
      },

      apply(tr: Transaction, prev: SlashCommandState, _old: EditorState, next: EditorState): SlashCommandState {
        // Allow external meta to force-close the popup
        const meta = tr.getMeta(slashCommandPluginKey) as { type: 'close' } | undefined;
        if (meta?.type === 'close') {
          return { ...INACTIVE_STATE };
        }

        if (!tr.docChanged && !tr.selectionSet) {
          return prev;
        }

        const triggerPos = findSlashTriggerPos(next);
        if (triggerPos !== -1) {
          return { active: true, triggerPos };
        }

        // If previously active and trigger is gone, deactivate
        if (prev.active) {
          return { ...INACTIVE_STATE };
        }

        return prev;
      },
    },

    // -------------------------------------------------------------------------
    // Props — text input interception and key handling
    // -------------------------------------------------------------------------
    props: {
      /**
       * Intercept text input to detect the `/` trigger.
       * Returns false so ProseMirror still inserts the character.
       */
      handleTextInput(_view: EditorView, _from: number, _to: number, _text: string): boolean {
        // We only care about `/`; let ProseMirror insert it first (return false),
        // then the state.apply will detect the trigger and the view.update will
        // dispatch the DOM event.
        // Returning false here is intentional — we want the character inserted.
        return false;
      },

      /**
       * Close the slash command popup when Escape is pressed.
       */
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const pluginState = slashCommandPluginKey.getState(view.state);
        if (!pluginState?.active) return false;

        if (event.key === 'Escape') {
          event.preventDefault();

          // Dispatch the close meta transaction. The view.update lifecycle will
          // detect the active → inactive transition and call dispatchSlashCommandClose
          // on the next render cycle. Do NOT call dispatchSlashCommandClose here
          // directly — that would fire the close event twice per Escape.
          const tr = view.state.tr.setMeta(slashCommandPluginKey, { type: 'close' });
          view.dispatch(tr);

          return true;
        }

        return false;
      },
    },

    // -------------------------------------------------------------------------
    // View — fires the DOM event after state transitions
    // -------------------------------------------------------------------------
    view() {
      return {
        update(view: EditorView, prevEditorState: EditorState) {
          const current = slashCommandPluginKey.getState(view.state);
          const previous = slashCommandPluginKey.getState(prevEditorState);

          // Trigger the DOM event when we transition from inactive → active
          if (current?.active && !previous?.active) {
            dispatchSlashCommandOpen(view, current.triggerPos, onOpen);
          }

          // Dispatch close event when we transition from active → inactive
          if (!current?.active && previous?.active) {
            dispatchSlashCommandClose(view, onClose);
          }
        },
      };
    },
  });
}

// ============================================================================
// DOM Event Helpers
// ============================================================================

/**
 * Dispatches the `slash-command-open` CustomEvent on the editor DOM element.
 */
function dispatchSlashCommandOpen(
  view: EditorView,
  triggerPos: number,
  onOpen?: SlashCommandPluginOptions['onOpen']
): void {
  let coords: { top: number; left: number; bottom: number; right: number };

  try {
    const raw = view.coordsAtPos(triggerPos);
    coords = { top: raw.top, left: raw.left, bottom: raw.bottom, right: raw.right };
  } catch {
    // Position may be out of bounds in edge cases — use a safe default
    coords = { top: 0, left: 0, bottom: 0, right: 0 };
  }

  const detail = { pos: triggerPos, coords };

  const event = new CustomEvent('slash-command-open', {
    bubbles: true,
    cancelable: true,
    detail,
  });

  view.dom.dispatchEvent(event);
  onOpen?.(triggerPos, coords);
}

/**
 * Dispatches the `slash-command-close` CustomEvent on the editor DOM element.
 */
function dispatchSlashCommandClose(
  view: EditorView,
  onClose?: SlashCommandPluginOptions['onClose']
): void {
  const event = new CustomEvent('slash-command-close', {
    bubbles: true,
    cancelable: false,
    detail: {},
  });

  view.dom.dispatchEvent(event);
  onClose?.();
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Returns the current slash command plugin state from an EditorState.
 */
export function getSlashCommandState(state: EditorState): SlashCommandState | undefined {
  return slashCommandPluginKey.getState(state);
}

/**
 * Returns true if the slash command popup is currently active.
 */
export function isSlashCommandActive(state: EditorState): boolean {
  return slashCommandPluginKey.getState(state)?.active ?? false;
}

/**
 * Programmatically closes the slash command popup.
 */
export function closeSlashCommand(view: EditorView): void {
  const tr = view.state.tr.setMeta(slashCommandPluginKey, { type: 'close' });
  view.dispatch(tr);
}
