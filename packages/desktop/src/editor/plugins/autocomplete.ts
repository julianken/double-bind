/**
 * Autocomplete plugin for block references ((block_id))
 *
 * Triggered by typing `((` in the editor. Shows a dropdown with matching blocks
 * based on full-text search of block content. User can filter by typing,
 * navigate with arrow keys, and select with Enter/Tab.
 *
 * @see docs/frontend/keyboard-first.md for autocomplete triggers spec
 * @see docs/frontend/prosemirror.md for reference autocomplete plugin spec
 */

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { PageId } from '@double-bind/types';

/**
 * Plugin key for identifying the autocomplete plugin.
 */
export const autocompletePluginKey = new PluginKey<AutocompleteState>('blockRefAutocomplete');

/**
 * Result item for block reference autocomplete.
 */
export interface BlockRefResult {
  /** Block ID (ULID) */
  blockId: string;
  /** Block content preview (truncated) */
  preview: string;
  /** Page title where the block lives */
  pageTitle: string;
  /** Page ID for navigation */
  pageId: PageId;
}

/**
 * Block search function type - injected from service layer.
 */
export type BlockSearchFn = (query: string) => Promise<BlockRefResult[]>;

/**
 * Callback when a block reference is selected.
 */
export type OnSelectBlockRef = (blockId: string, preview: string) => void;

/**
 * State maintained by the autocomplete plugin.
 */
export interface AutocompleteState {
  /** Whether the autocomplete dropdown is active */
  active: boolean;
  /** The trigger position (where `((` was typed) */
  triggerPos: number;
  /** The search query typed after `((` */
  query: string;
  /** Search results */
  results: BlockRefResult[];
  /** Currently selected index */
  selectedIndex: number;
  /** Whether a search is in progress */
  isLoading: boolean;
}

/**
 * Default initial state.
 */
const initialState: AutocompleteState = {
  active: false,
  triggerPos: 0,
  query: '',
  results: [],
  selectedIndex: 0,
  isLoading: false,
};

/**
 * Configuration for the autocomplete plugin.
 */
export interface AutocompletePluginOptions {
  /** Function to search blocks by content */
  searchBlocks: BlockSearchFn;
  /** Maximum number of results to show */
  maxResults?: number;
  /** Minimum characters to type before searching (after trigger) */
  minQueryLength?: number;
  /** Debounce delay in milliseconds for search */
  debounceMs?: number;
}

/**
 * Maximum preview length for block content.
 */
const MAX_PREVIEW_LENGTH = 50;

/**
 * Truncates content to a maximum length, adding ellipsis if needed.
 */
export function truncatePreview(content: string, maxLength: number = MAX_PREVIEW_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength - 3) + '...';
}

/**
 * Detects if the text before cursor ends with `((` trigger.
 * Returns the position of the first `(` if found, -1 otherwise.
 */
function findTriggerPosition(state: EditorState): number {
  const { from } = state.selection;
  const textBefore = state.doc.textBetween(Math.max(0, from - 50), from);

  // Find the last occurrence of `((`
  const triggerIndex = textBefore.lastIndexOf('((');
  if (triggerIndex === -1) {
    return -1;
  }

  // Check if there's a closing `))`after the trigger - if so, it's already complete
  const afterTrigger = textBefore.slice(triggerIndex);
  if (afterTrigger.includes('))')) {
    return -1;
  }

  // Calculate absolute position
  const absolutePos = from - textBefore.length + triggerIndex;
  return absolutePos;
}

/**
 * Gets the query text typed after the trigger.
 */
function getQueryAfterTrigger(state: EditorState, triggerPos: number): string {
  const { from } = state.selection;
  // Skip the `((` (2 characters)
  const queryStart = triggerPos + 2;
  if (queryStart >= from) {
    return '';
  }
  return state.doc.textBetween(queryStart, from);
}

/**
 * Creates the autocomplete plugin for block references.
 */
export function createBlockRefAutocompletePlugin(options: AutocompletePluginOptions): Plugin {
  const { searchBlocks, maxResults = 10, minQueryLength = 0, debounceMs = 150 } = options;

  return new Plugin<AutocompleteState>({
    key: autocompletePluginKey,

    state: {
      init(_config: unknown, state: EditorState): AutocompleteState {
        // Check for trigger in initial state
        const triggerPos = findTriggerPosition(state);
        if (triggerPos !== -1) {
          const query = getQueryAfterTrigger(state, triggerPos);
          // Check for early termination
          if (!query.includes(')')) {
            return {
              ...initialState,
              active: true,
              triggerPos,
              query,
            };
          }
        }
        return { ...initialState };
      },

      apply(
        tr: Transaction,
        prevState: AutocompleteState,
        _oldState: EditorState,
        newState: EditorState
      ): AutocompleteState {
        // Check for meta to update state directly
        const meta = tr.getMeta(autocompletePluginKey);
        if (meta) {
          return { ...prevState, ...meta };
        }

        // If not active, check if we should activate
        if (!prevState.active) {
          const triggerPos = findTriggerPosition(newState);
          if (triggerPos !== -1) {
            const query = getQueryAfterTrigger(newState, triggerPos);
            return {
              ...initialState,
              active: true,
              triggerPos,
              query,
            };
          }
          return prevState;
        }

        // If active, check if we should deactivate or update query
        const triggerPos = findTriggerPosition(newState);
        if (triggerPos === -1) {
          // Trigger no longer valid (e.g., user deleted it or cursor moved away)
          return { ...initialState };
        }

        // Update query
        const query = getQueryAfterTrigger(newState, triggerPos);

        // Check for early termination: if query contains `)`, close autocomplete
        if (query.includes(')')) {
          return { ...initialState };
        }

        return {
          ...prevState,
          triggerPos,
          query,
        };
      },
    },

    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const state = autocompletePluginKey.getState(view.state);
        if (!state?.active) {
          return false;
        }

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            navigateResults(view, 1);
            return true;

          case 'ArrowUp':
            event.preventDefault();
            navigateResults(view, -1);
            return true;

          case 'Enter':
          case 'Tab':
            if (state.results.length > 0) {
              event.preventDefault();
              selectResult(view, state);
              return true;
            }
            return false;

          case 'Escape':
            event.preventDefault();
            closeAutocomplete(view);
            return true;

          default:
            return false;
        }
      },

      decorations(state: EditorState): DecorationSet | null {
        const pluginState = autocompletePluginKey.getState(state);
        if (!pluginState?.active) {
          return null;
        }

        // Create a widget decoration at the trigger position
        // This is used by the React component to position the dropdown
        const widget = Decoration.widget(
          pluginState.triggerPos,
          () => {
            const span = document.createElement('span');
            span.className = 'block-ref-autocomplete-anchor';
            span.dataset.active = 'true';
            return span;
          },
          { side: 0 }
        );

        return DecorationSet.create(state.doc, [widget]);
      },
    },

    view() {
      return {
        update(view: EditorView, prevState: EditorState) {
          const state = autocompletePluginKey.getState(view.state);
          const prevPluginState = autocompletePluginKey.getState(prevState);

          // If query changed, trigger search
          if (state?.active && state.query !== prevPluginState?.query) {
            triggerSearch(view, state.query, searchBlocks, maxResults, minQueryLength, debounceMs);
          }
        },
      };
    },
  });
}

/**
 * Navigate through autocomplete results.
 */
function navigateResults(view: EditorView, direction: number): void {
  const state = autocompletePluginKey.getState(view.state);
  if (!state) return;

  const newIndex = Math.max(0, Math.min(state.results.length - 1, state.selectedIndex + direction));

  const tr = view.state.tr.setMeta(autocompletePluginKey, {
    selectedIndex: newIndex,
  });
  view.dispatch(tr);
}

/**
 * Select the current result and insert the block reference.
 */
function selectResult(view: EditorView, state: AutocompleteState): void {
  const selectedResult = state.results[state.selectedIndex];
  if (!selectedResult) return;

  // Calculate the range to replace (from trigger to current position)
  const { from } = view.state.selection;
  const replaceStart = state.triggerPos;
  const replaceEnd = from;

  // Create the block reference text with blockRef mark: ((block_id))
  const refText = `((${selectedResult.blockId}))`;
  const blockRefMarkType = view.state.schema.marks.blockRef;
  const textNode = blockRefMarkType
    ? view.state.schema.text(refText, [blockRefMarkType.create({ blockId: selectedResult.blockId })])
    : view.state.schema.text(refText);

  // Create transaction to replace the trigger + query with the reference
  const tr = view.state.tr
    .replaceWith(replaceStart, replaceEnd, textNode)
    .setMeta(autocompletePluginKey, { ...initialState });

  view.dispatch(tr);
  view.focus();
}

/**
 * Close the autocomplete dropdown without selecting.
 */
function closeAutocomplete(view: EditorView): void {
  const tr = view.state.tr.setMeta(autocompletePluginKey, { ...initialState });
  view.dispatch(tr);
}

/**
 * Trigger a debounced search.
 */
function triggerSearch(
  view: EditorView,
  query: string,
  searchBlocks: BlockSearchFn,
  maxResults: number,
  minQueryLength: number,
  debounceMs: number
): void {
  // Check minimum query length
  if (query.length < minQueryLength) {
    const tr = view.state.tr.setMeta(autocompletePluginKey, {
      results: [],
      isLoading: false,
    });
    view.dispatch(tr);
    return;
  }

  // Set loading state
  const loadingTr = view.state.tr.setMeta(autocompletePluginKey, {
    isLoading: true,
  });
  view.dispatch(loadingTr);

  // Debounce the search
  setTimeout(async () => {
    try {
      const results = await searchBlocks(query);
      const limitedResults = results.slice(0, maxResults);

      // Check if still active before updating
      const currentState = autocompletePluginKey.getState(view.state);
      if (!currentState?.active) {
        return;
      }

      const tr = view.state.tr.setMeta(autocompletePluginKey, {
        results: limitedResults,
        selectedIndex: 0,
        isLoading: false,
      });
      view.dispatch(tr);
    } catch {
      // Silently handle search errors - show empty results
      const tr = view.state.tr.setMeta(autocompletePluginKey, {
        results: [],
        isLoading: false,
      });
      view.dispatch(tr);
    }
  }, debounceMs);
}

/**
 * Gets the current autocomplete state from an editor state.
 */
export function getAutocompleteState(state: EditorState): AutocompleteState | undefined {
  return autocompletePluginKey.getState(state);
}

/**
 * Programmatically closes the autocomplete.
 */
export function closeAutocompleteFromView(view: EditorView): void {
  closeAutocomplete(view);
}

/**
 * Programmatically selects a result by index.
 */
export function selectResultByIndex(view: EditorView, index: number): void {
  const state = autocompletePluginKey.getState(view.state);
  if (!state?.active || index < 0 || index >= state.results.length) {
    return;
  }

  const updatedState = { ...state, selectedIndex: index };
  selectResult(view, updatedState);
}
