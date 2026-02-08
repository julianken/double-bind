/**
 * Autocomplete Plugin for [[page links
 *
 * Provides autocomplete functionality when typing `[[` in the editor.
 * Shows a dropdown with matching pages and allows navigation with
 * arrow keys and selection with Enter/Tab.
 *
 * Features:
 * - Triggers on `[[` pattern
 * - Searches pages by title as user types
 * - Up/Down arrow navigation
 * - Enter/Tab to select and insert `[[Page Title]]`
 * - Escape to dismiss without inserting
 * - "Create: [[new page]]" option for non-existent pages
 *
 * @see docs/frontend/prosemirror.md for editor architecture
 */

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a suggestion in the autocomplete dropdown
 */
export interface AutocompleteSuggestion {
  /** Page ID (null for "create new" option) */
  pageId: string | null;
  /** Page title to display */
  title: string;
  /** Whether this is the "create new page" option */
  isCreateNew: boolean;
}

/**
 * State of the autocomplete plugin
 */
export interface AutocompleteState {
  /** Whether the autocomplete is currently active */
  active: boolean;
  /** The query text after [[ */
  query: string;
  /** Position in document where [[ starts */
  triggerPos: number;
  /** The search results / suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Currently selected index (-1 if none) */
  selectedIndex: number;
  /** Screen coordinates for positioning the dropdown */
  coords: { top: number; left: number } | null;
}

/**
 * Callback type for when a suggestion is selected
 */
export type OnSelectSuggestion = (suggestion: AutocompleteSuggestion, view: EditorView) => void;

/**
 * Callback type for searching pages
 */
export type SearchPages = (query: string) => Promise<AutocompleteSuggestion[]>;

/**
 * Options for creating the autocomplete plugin
 */
export interface AutocompletePluginOptions {
  /** Function to search for pages by query */
  searchPages: SearchPages;
  /** Callback when a suggestion is selected */
  onSelect?: OnSelectSuggestion;
  /** Debounce delay for search (ms) */
  debounceMs?: number;
}

// ============================================================================
// Plugin Key
// ============================================================================

/**
 * Plugin key for accessing autocomplete state
 */
export const autocompletePluginKey = new PluginKey<AutocompleteState>('autocomplete');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the initial/empty autocomplete state
 */
function getInitialState(): AutocompleteState {
  return {
    active: false,
    query: '',
    triggerPos: 0,
    suggestions: [],
    selectedIndex: -1,
    coords: null,
  };
}

/**
 * Find trigger from a Transaction (for use in apply)
 */
function findTriggerFromTransaction(tr: Transaction): { pos: number; query: string } | null {
  const { $from } = tr.selection;

  // Only check if selection is collapsed (cursor)
  if (!tr.selection.empty) {
    return null;
  }

  // Get text from start of current text block to cursor
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');

  // Find last occurrence of [[ that isn't closed by ]]
  let lastOpenBracket = -1;
  let i = textBefore.length - 1;

  // Search backwards for [[ that isn't followed by ]] before cursor
  while (i >= 0) {
    if (i > 0 && textBefore[i - 1] === '[' && textBefore[i] === '[') {
      // Found [[, check if there's a ]] after it
      const afterBrackets = textBefore.slice(i + 1);
      if (!afterBrackets.includes(']]')) {
        lastOpenBracket = i - 1;
        break;
      }
    }
    i--;
  }

  if (lastOpenBracket === -1) {
    return null;
  }

  // Extract query (everything after [[ up to cursor)
  const query = textBefore.slice(lastOpenBracket + 2);

  // Calculate absolute position in document
  const nodeStart = $from.start();
  const triggerPos = nodeStart + lastOpenBracket;

  return { pos: triggerPos, query };
}

/**
 * Insert a page link at the trigger position.
 * Creates a text node with the pageLink mark for visual highlighting
 * when the mark type is available in the schema.
 */
function insertPageLink(view: EditorView, triggerPos: number, title: string, query: string): void {
  const { state, dispatch } = view;

  // Calculate positions
  const from = triggerPos;
  // +2 for [[ and query length
  const to = triggerPos + 2 + query.length;

  // Create the replacement text, with pageLink mark if available
  const linkText = `[[${title}]]`;
  const pageLinkMarkType = state.schema.marks.pageLink;
  // TODO: Resolve pageId from title at insertion time. Currently empty because
  // page resolution is async and autocomplete insertion is synchronous.
  const textNode = pageLinkMarkType
    ? state.schema.text(linkText, [pageLinkMarkType.create({ pageId: '', title })])
    : state.schema.text(linkText);

  // Create transaction
  const tr = state.tr.replaceWith(from, to, textNode);

  // Move cursor after the link
  const newPos = from + linkText.length;
  tr.setSelection(TextSelection.create(tr.doc, newPos));

  dispatch(tr);
}

// ============================================================================
// Plugin Creation
// ============================================================================

/**
 * Creates the autocomplete plugin for `[[` page link completion.
 *
 * @param options - Plugin configuration
 * @returns ProseMirror plugin
 *
 * @example
 * ```ts
 * const plugin = createAutocompletePlugin({
 *   searchPages: async (query) => {
 *     const pages = await pageService.searchPages(query);
 *     return pages.map(p => ({
 *       pageId: p.pageId,
 *       title: p.title,
 *       isCreateNew: false
 *     }));
 *   },
 *   onSelect: (suggestion, view) => {
 *     // Handle selection
 *   }
 * });
 * ```
 */
export function createAutocompletePlugin(options: AutocompletePluginOptions): Plugin {
  const { searchPages, onSelect, debounceMs = 150 } = options;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentView: EditorView | null = null;

  // Function to update suggestions asynchronously
  async function updateSuggestions(query: string): Promise<void> {
    if (!currentView) return;

    const state = autocompletePluginKey.getState(currentView.state);
    if (!state?.active) return;

    try {
      const results = await searchPages(query);

      // Add "Create new" option if query doesn't exactly match any result
      const exactMatch = results.some((r) => r.title.toLowerCase() === query.toLowerCase());

      const suggestions: AutocompleteSuggestion[] = [...results];

      if (query.trim() && !exactMatch) {
        suggestions.push({
          pageId: null,
          title: query.trim(),
          isCreateNew: true,
        });
      }

      // Dispatch update
      if (currentView) {
        const tr = currentView.state.tr.setMeta(autocompletePluginKey, {
          type: 'updateSuggestions',
          suggestions,
        });
        currentView.dispatch(tr);
      }
    } catch {
      // On error, just show create option
      if (currentView && query.trim()) {
        const tr = currentView.state.tr.setMeta(autocompletePluginKey, {
          type: 'updateSuggestions',
          suggestions: [
            {
              pageId: null,
              title: query.trim(),
              isCreateNew: true,
            },
          ],
        });
        currentView.dispatch(tr);
      }
    }
  }

  // Debounced search
  function debouncedSearch(query: string): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void updateSuggestions(query);
    }, debounceMs);
  }

  return new Plugin<AutocompleteState>({
    key: autocompletePluginKey,

    state: {
      init(): AutocompleteState {
        return getInitialState();
      },

      apply(tr: Transaction, prevState: AutocompleteState): AutocompleteState {
        // Check for meta updates
        const meta = tr.getMeta(autocompletePluginKey);

        if (meta?.type === 'close') {
          return getInitialState();
        }

        if (meta?.type === 'updateSuggestions') {
          return {
            ...prevState,
            suggestions: meta.suggestions,
            selectedIndex: meta.suggestions.length > 0 ? 0 : -1,
          };
        }

        if (meta?.type === 'selectIndex') {
          return {
            ...prevState,
            selectedIndex: meta.index,
          };
        }

        if (meta?.type === 'updateCoords') {
          return {
            ...prevState,
            coords: meta.coords,
          };
        }

        // Check for trigger on document or selection changes
        if (tr.docChanged || tr.selectionSet) {
          const triggerResult = findTriggerFromTransaction(tr);

          if (triggerResult) {
            // Trigger is active
            const isNewTrigger = !prevState.active || triggerResult.pos !== prevState.triggerPos;
            const queryChanged = prevState.query !== triggerResult.query;

            if (isNewTrigger || queryChanged) {
              return {
                active: true,
                query: triggerResult.query,
                triggerPos: triggerResult.pos,
                suggestions: isNewTrigger ? [] : prevState.suggestions,
                selectedIndex: isNewTrigger ? -1 : prevState.selectedIndex,
                coords: prevState.coords,
              };
            }

            return prevState;
          } else if (prevState.active) {
            // Trigger is no longer active
            return getInitialState();
          }
        }

        return prevState;
      },
    },

    view(view: EditorView) {
      currentView = view;

      return {
        update(view: EditorView) {
          currentView = view;
          const state = autocompletePluginKey.getState(view.state);

          if (state?.active) {
            // Update coordinates for dropdown positioning
            try {
              const coords = view.coordsAtPos(state.triggerPos);
              const currentCoords = state.coords;

              if (
                !currentCoords ||
                currentCoords.top !== coords.bottom ||
                currentCoords.left !== coords.left
              ) {
                const tr = view.state.tr.setMeta(autocompletePluginKey, {
                  type: 'updateCoords',
                  coords: { top: coords.bottom, left: coords.left },
                });
                view.dispatch(tr);
              }
            } catch {
              // Position might be invalid
            }

            // Trigger search
            debouncedSearch(state.query);
          }
        },

        destroy() {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          currentView = null;
        },
      };
    },

    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const state = autocompletePluginKey.getState(view.state);

        if (!state?.active) {
          return false;
        }

        const { suggestions, selectedIndex, triggerPos, query } = state;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            if (suggestions.length > 0) {
              const newIndex = (selectedIndex + 1) % suggestions.length;
              const tr = view.state.tr.setMeta(autocompletePluginKey, {
                type: 'selectIndex',
                index: newIndex,
              });
              view.dispatch(tr);
            }
            return true;

          case 'ArrowUp':
            event.preventDefault();
            if (suggestions.length > 0) {
              const newIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
              const tr = view.state.tr.setMeta(autocompletePluginKey, {
                type: 'selectIndex',
                index: newIndex,
              });
              view.dispatch(tr);
            }
            return true;

          case 'Enter':
          case 'Tab':
            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
              event.preventDefault();
              const suggestion = suggestions[selectedIndex]!;

              // Insert the link
              insertPageLink(view, triggerPos, suggestion.title, query);

              // Close autocomplete
              const tr = view.state.tr.setMeta(autocompletePluginKey, {
                type: 'close',
              });
              view.dispatch(tr);

              // Call onSelect callback
              onSelect?.(suggestion, view);

              return true;
            }
            return false;

          case 'Escape':
            event.preventDefault();
            {
              const tr = view.state.tr.setMeta(autocompletePluginKey, {
                type: 'close',
              });
              view.dispatch(tr);
            }
            return true;

          default:
            return false;
        }
      },
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the current autocomplete state from an editor state
 */
export function getAutocompleteState(state: EditorState): AutocompleteState | undefined {
  return autocompletePluginKey.getState(state);
}

/**
 * Check if autocomplete is currently active
 */
export function isAutocompleteActive(state: EditorState): boolean {
  return autocompletePluginKey.getState(state)?.active ?? false;
}

/**
 * Close the autocomplete dropdown programmatically
 */
export function closeAutocomplete(view: EditorView): void {
  const tr = view.state.tr.setMeta(autocompletePluginKey, { type: 'close' });
  view.dispatch(tr);
}

/**
 * Select a suggestion by index programmatically
 */
export function selectSuggestion(view: EditorView, index: number): void {
  const state = autocompletePluginKey.getState(view.state);
  if (!state?.active || index < 0 || index >= state.suggestions.length) {
    return;
  }

  const suggestion = state.suggestions[index]!;

  // Insert the link
  insertPageLink(view, state.triggerPos, suggestion.title, state.query);

  // Close autocomplete
  closeAutocomplete(view);
}
