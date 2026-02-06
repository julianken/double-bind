/**
 * Tag Autocomplete Plugin for ProseMirror
 *
 * Provides autocomplete functionality for tags triggered by typing `#`.
 * Shows a dropdown of existing tags, allows filtering by typing more,
 * and inserts the selected tag.
 *
 * Features:
 * - Triggers on `#` character
 * - Filters existing tags as user types
 * - Up/Down arrow navigation
 * - Enter/Tab to select
 * - Escape to dismiss
 * - "Create: #newtag" option for non-existing tags
 */

import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

/**
 * Tag suggestion with metadata.
 */
export interface TagSuggestion {
  /** The tag name (without the # prefix) */
  tag: string;
  /** Usage count (higher means more popular) */
  count: number;
  /** Whether this is a "create new" suggestion */
  isCreate?: boolean;
}

/**
 * Provider function to fetch tag suggestions.
 * This allows the plugin to be database-agnostic.
 */
export type TagProvider = () => Promise<TagSuggestion[]>;

/**
 * Plugin key for the tag autocomplete plugin.
 */
export const tagAutocompletePluginKey = new PluginKey<TagAutocompleteState>('tagAutocomplete');

/**
 * Internal state tracked by the tag autocomplete plugin.
 */
export interface TagAutocompleteState {
  /** Whether the autocomplete is currently active */
  active: boolean;
  /** Start position of the trigger (the # character) */
  triggerPos: number | null;
  /** Current filter text (what user typed after #) */
  filter: string;
  /** Current list of suggestions */
  suggestions: TagSuggestion[];
  /** Currently selected index in the dropdown */
  selectedIndex: number;
  /** Decoration set for visual feedback */
  decorations: DecorationSet;
}

/**
 * Initial plugin state.
 */
function createInitialState(_doc: EditorState['doc']): TagAutocompleteState {
  return {
    active: false,
    triggerPos: null,
    filter: '',
    suggestions: [],
    selectedIndex: 0,
    decorations: DecorationSet.empty,
  };
}

/**
 * Action types for state updates.
 */
type TagAutocompleteAction =
  | { type: 'activate'; triggerPos: number }
  | { type: 'update'; filter: string; suggestions: TagSuggestion[] }
  | { type: 'select'; index: number }
  | { type: 'navigate'; direction: 'up' | 'down' }
  | { type: 'deactivate' };

/**
 * Filter and sort suggestions based on user input.
 */
export function filterSuggestions(allTags: TagSuggestion[], filter: string): TagSuggestion[] {
  const lowerFilter = filter.toLowerCase();

  // Filter tags that match the input
  const matches = allTags
    .filter((t) => t.tag.toLowerCase().includes(lowerFilter))
    .sort((a, b) => {
      // Prioritize exact prefix matches
      const aStartsWith = a.tag.toLowerCase().startsWith(lowerFilter);
      const bStartsWith = b.tag.toLowerCase().startsWith(lowerFilter);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Then sort by count (more popular first)
      return b.count - a.count;
    })
    .slice(0, 10); // Limit to 10 suggestions

  // If the filter doesn't match any existing tag exactly, add "Create" option
  const exactMatch = allTags.some((t) => t.tag.toLowerCase() === lowerFilter);

  if (filter.length > 0 && !exactMatch) {
    matches.push({
      tag: filter,
      count: 0,
      isCreate: true,
    });
  }

  return matches;
}

/**
 * Check if character is valid in a tag name.
 * Tags can contain alphanumeric characters, hyphens, and underscores.
 */
export function isValidTagChar(char: string): boolean {
  return /^[a-zA-Z0-9_-]$/.test(char);
}

/**
 * Extract the filter text from the document between trigger and cursor.
 */
function getFilterText(state: EditorState, triggerPos: number): string {
  const { from } = state.selection;
  if (from <= triggerPos) return '';

  // Get text between trigger position and cursor
  const textAfterTrigger = state.doc.textBetween(triggerPos, from);

  // Skip the # character itself
  return textAfterTrigger.slice(1);
}

/**
 * Check if cursor is still in valid autocomplete context.
 */
function isValidContext(state: EditorState, triggerPos: number): boolean {
  const { from } = state.selection;

  // Cursor must be after trigger
  if (from <= triggerPos) return false;

  // Check if there's any whitespace or newlines between trigger and cursor
  const textAfterTrigger = state.doc.textBetween(triggerPos, from);

  // Skip the # character and check remaining characters
  const filterPart = textAfterTrigger.slice(1);

  // If there's whitespace, we've moved past the tag
  if (/\s/.test(filterPart)) return false;

  // All characters in the filter must be valid tag characters
  for (const char of filterPart) {
    if (!isValidTagChar(char)) return false;
  }

  return true;
}

/**
 * Creates the tag autocomplete decoration (highlight).
 */
function createDecorations(
  doc: EditorState['doc'],
  triggerPos: number,
  cursorPos: number
): DecorationSet {
  const deco = Decoration.inline(triggerPos, cursorPos, {
    class: 'tag-autocomplete-active',
  });
  return DecorationSet.create(doc, [deco]);
}

/**
 * Options for creating the tag autocomplete plugin.
 */
export interface TagAutocompletePluginOptions {
  /**
   * Function to fetch all available tags.
   * Should return tags ordered by usage count descending.
   */
  tagProvider: TagProvider;

  /**
   * Callback invoked when a tag is selected.
   * The plugin inserts the tag text; this callback is for additional actions.
   */
  onTagSelect?: (tag: string) => void;

  /**
   * Custom render function for the dropdown.
   * If not provided, a default renderer is used.
   */
  renderDropdown?: (
    view: EditorView,
    state: TagAutocompleteState,
    onSelect: (index: number) => void
  ) => HTMLElement | null;
}

/**
 * Create a text span element safely.
 */
function createTextSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * Default dropdown renderer.
 */
function createDefaultDropdown(
  view: EditorView,
  state: TagAutocompleteState,
  onSelect: (index: number) => void
): HTMLElement | null {
  if (!state.active || state.suggestions.length === 0) {
    return null;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'tag-autocomplete-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Tag suggestions');

  state.suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'tag-autocomplete-item';
    if (index === state.selectedIndex) {
      item.classList.add('selected');
      item.setAttribute('aria-selected', 'true');
    }
    item.setAttribute('role', 'option');

    if (suggestion.isCreate) {
      item.appendChild(createTextSpan('tag-create', 'Create: '));
      item.appendChild(createTextSpan('tag-name', `#${suggestion.tag}`));
    } else {
      item.appendChild(createTextSpan('tag-name', `#${suggestion.tag}`));
      item.appendChild(createTextSpan('tag-count', String(suggestion.count)));
    }

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onSelect(index);
    });

    item.addEventListener('mouseenter', () => {
      // Update selected index on hover
      view.dispatch(
        view.state.tr.setMeta(tagAutocompletePluginKey, {
          type: 'select',
          index,
        })
      );
    });

    dropdown.appendChild(item);
  });

  return dropdown;
}

/**
 * Position the dropdown below the trigger character.
 */
function positionDropdown(view: EditorView, dropdown: HTMLElement, triggerPos: number): void {
  const coords = view.coordsAtPos(triggerPos);
  const editorRect = view.dom.getBoundingClientRect();

  // Position below the trigger character
  dropdown.style.position = 'absolute';
  dropdown.style.left = `${coords.left - editorRect.left}px`;
  dropdown.style.top = `${coords.bottom - editorRect.top + 4}px`;
  dropdown.style.zIndex = '100';
}

/**
 * Creates the tag autocomplete plugin.
 *
 * @param options - Configuration options
 * @returns A ProseMirror Plugin instance
 *
 * @example
 * ```typescript
 * const plugin = createTagAutocompletePlugin({
 *   tagProvider: async () => {
 *     const tags = await tagRepo.getAllTags();
 *     return tags.map(t => ({ tag: t.tag, count: t.count }));
 *   },
 *   onTagSelect: (tag) => handleTagSelected(tag),
 * });
 * ```
 */
export function createTagAutocompletePlugin(
  options: TagAutocompletePluginOptions
): Plugin<TagAutocompleteState> {
  const { tagProvider, onTagSelect, renderDropdown = createDefaultDropdown } = options;

  // Cache for fetched tags
  let cachedTags: TagSuggestion[] | null = null;

  // Dropdown element reference
  let dropdownElement: HTMLElement | null = null;
  let dropdownContainer: HTMLElement | null = null;

  /**
   * Fetch tags and update cache.
   */
  async function fetchTags(): Promise<TagSuggestion[]> {
    if (cachedTags) return cachedTags;
    cachedTags = await tagProvider();
    return cachedTags;
  }

  /**
   * Invalidate the tag cache (call when tags are added/removed).
   */
  function invalidateCache(): void {
    cachedTags = null;
  }

  /**
   * Insert the selected tag into the document.
   */
  function insertTag(view: EditorView, tag: string, triggerPos: number): void {
    const { state } = view;
    const { from } = state.selection;

    // Replace the trigger and filter with the full tag
    const tr = state.tr.delete(triggerPos, from).insertText(`#${tag} `, triggerPos);

    view.dispatch(tr);

    // Deactivate autocomplete
    view.dispatch(view.state.tr.setMeta(tagAutocompletePluginKey, { type: 'deactivate' }));

    // Notify callback
    onTagSelect?.(tag);

    // Invalidate cache in case we created a new tag
    invalidateCache();
  }

  /**
   * Handle selection from dropdown.
   */
  function handleSelect(view: EditorView, index: number): void {
    const pluginState = tagAutocompletePluginKey.getState(view.state);
    if (!pluginState?.active || pluginState.triggerPos === null) return;

    const suggestion = pluginState.suggestions[index];
    if (!suggestion) return;

    insertTag(view, suggestion.tag, pluginState.triggerPos);
  }

  /**
   * Update or remove the dropdown.
   */
  function updateDropdown(view: EditorView, state: TagAutocompleteState): void {
    // Remove existing dropdown
    if (dropdownElement) {
      dropdownElement.remove();
      dropdownElement = null;
    }

    if (!state.active || state.triggerPos === null) {
      return;
    }

    // Ensure container exists
    if (!dropdownContainer) {
      dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'tag-autocomplete-container';
      dropdownContainer.style.position = 'relative';
      view.dom.parentElement?.appendChild(dropdownContainer);
    }

    // Create new dropdown
    dropdownElement = renderDropdown(view, state, (index) => handleSelect(view, index));

    if (dropdownElement) {
      dropdownContainer.appendChild(dropdownElement);
      positionDropdown(view, dropdownElement, state.triggerPos);
    }
  }

  return new Plugin<TagAutocompleteState>({
    key: tagAutocompletePluginKey,

    state: {
      init(_config, state): TagAutocompleteState {
        return createInitialState(state.doc);
      },

      apply(tr, value, _oldState, newState): TagAutocompleteState {
        // Handle explicit actions from transaction metadata
        const action = tr.getMeta(tagAutocompletePluginKey) as TagAutocompleteAction | undefined;

        if (action) {
          switch (action.type) {
            case 'activate':
              return {
                ...value,
                active: true,
                triggerPos: action.triggerPos,
                filter: '',
                suggestions: [],
                selectedIndex: 0,
                decorations: createDecorations(
                  newState.doc,
                  action.triggerPos,
                  newState.selection.from
                ),
              };

            case 'update':
              if (!value.active || value.triggerPos === null) return value;
              return {
                ...value,
                filter: action.filter,
                suggestions: action.suggestions,
                selectedIndex: 0,
                decorations: createDecorations(
                  newState.doc,
                  value.triggerPos,
                  newState.selection.from
                ),
              };

            case 'select':
              return {
                ...value,
                selectedIndex: action.index,
              };

            case 'navigate': {
              if (!value.active || value.suggestions.length === 0) return value;
              const maxIndex = value.suggestions.length - 1;
              let newIndex = value.selectedIndex;

              if (action.direction === 'up') {
                newIndex = newIndex <= 0 ? maxIndex : newIndex - 1;
              } else {
                newIndex = newIndex >= maxIndex ? 0 : newIndex + 1;
              }

              return {
                ...value,
                selectedIndex: newIndex,
              };
            }

            case 'deactivate':
              return createInitialState(newState.doc);
          }
        }

        // If autocomplete is active, check if context is still valid
        if (value.active && value.triggerPos !== null) {
          // Map trigger position through transaction
          const mappedTriggerPos = tr.mapping.map(value.triggerPos);

          // Check if we're still in valid context
          if (!isValidContext(newState, mappedTriggerPos)) {
            return createInitialState(newState.doc);
          }

          // Update decorations with mapped positions
          return {
            ...value,
            triggerPos: mappedTriggerPos,
            decorations: createDecorations(newState.doc, mappedTriggerPos, newState.selection.from),
          };
        }

        return value;
      },
    },

    props: {
      decorations(state) {
        const pluginState = tagAutocompletePluginKey.getState(state);
        return pluginState?.decorations ?? DecorationSet.empty;
      },

      handleTextInput(view, from, _to, text): boolean {
        // Check if user typed #
        if (text === '#') {
          const pluginState = tagAutocompletePluginKey.getState(view.state);

          // Don't activate if already active
          if (pluginState?.active) return false;

          // Check if we're at a valid position (start of word)
          const charBefore = from > 0 ? view.state.doc.textBetween(from - 1, from) : '';

          // Only trigger if at start of content or after whitespace
          if (charBefore && !/\s/.test(charBefore)) {
            return false;
          }

          // Let the # be inserted first
          setTimeout(async () => {
            // Activate autocomplete after the # is inserted
            // The trigger position is where the # character is
            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'activate',
                triggerPos: from,
              })
            );

            // Fetch tags and update suggestions
            const tags = await fetchTags();
            const suggestions = filterSuggestions(tags, '');

            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'update',
                filter: '',
                suggestions,
              })
            );
          }, 0);

          return false; // Let ProseMirror insert the #
        }

        // If autocomplete is active, update filter
        const pluginState = tagAutocompletePluginKey.getState(view.state);
        if (pluginState?.active && pluginState.triggerPos !== null) {
          // Let the character be inserted first
          setTimeout(async () => {
            const newPluginState = tagAutocompletePluginKey.getState(view.state);
            if (!newPluginState?.active || newPluginState.triggerPos === null) return;

            const filter = getFilterText(view.state, newPluginState.triggerPos);

            // Fetch tags if not cached
            const tags = await fetchTags();
            const suggestions = filterSuggestions(tags, filter);

            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'update',
                filter,
                suggestions,
              })
            );
          }, 0);
        }

        return false;
      },

      handleKeyDown(view, event): boolean {
        const pluginState = tagAutocompletePluginKey.getState(view.state);
        if (!pluginState?.active) return false;

        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'navigate',
                direction: 'up',
              })
            );
            return true;

          case 'ArrowDown':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'navigate',
                direction: 'down',
              })
            );
            return true;

          case 'Enter':
          case 'Tab':
            if (pluginState.suggestions.length > 0) {
              event.preventDefault();
              handleSelect(view, pluginState.selectedIndex);
              return true;
            }
            return false;

          case 'Escape':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(tagAutocompletePluginKey, {
                type: 'deactivate',
              })
            );
            return true;

          case 'Backspace': {
            // If we're about to delete the # trigger, deactivate
            const { from } = view.state.selection;
            if (from <= (pluginState.triggerPos ?? 0) + 1) {
              // Let backspace happen, then deactivate
              setTimeout(() => {
                view.dispatch(
                  view.state.tr.setMeta(tagAutocompletePluginKey, {
                    type: 'deactivate',
                  })
                );
              }, 0);
            }
            return false;
          }

          default:
            return false;
        }
      },
    },

    view(_editorView) {
      return {
        update(view, prevState) {
          const pluginState = tagAutocompletePluginKey.getState(view.state);
          const prevPluginState = tagAutocompletePluginKey.getState(prevState);

          // Only update dropdown if state changed
          if (pluginState !== prevPluginState && pluginState) {
            updateDropdown(view, pluginState);
          }
        },

        destroy() {
          // Clean up dropdown
          if (dropdownElement) {
            dropdownElement.remove();
            dropdownElement = null;
          }
          if (dropdownContainer) {
            dropdownContainer.remove();
            dropdownContainer = null;
          }
        },
      };
    },
  });
}

/**
 * Get the current tag autocomplete state from an EditorState.
 */
export function getTagAutocompleteState(state: EditorState): TagAutocompleteState | undefined {
  return tagAutocompletePluginKey.getState(state);
}

/**
 * Check if tag autocomplete is currently active.
 */
export function isTagAutocompleteActive(state: EditorState): boolean {
  const pluginState = tagAutocompletePluginKey.getState(state);
  return pluginState?.active ?? false;
}

/**
 * Programmatically deactivate the tag autocomplete.
 */
export function deactivateTagAutocomplete(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(tagAutocompletePluginKey, { type: 'deactivate' }));
}
