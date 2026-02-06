/**
 * ProseMirror editor plugins
 */

export {
  createKeymapPlugin,
  createEditorKeymaps,
  KEYBINDINGS,
  type BlockService,
  type KeymapPluginOptions,
  type KeybindingName,
} from './keymap.js';

export {
  createPersistencePlugin,
  persistencePluginKey,
  getPersistenceState,
  DEFAULT_DEBOUNCE_MS,
  type PersistencePluginOptions,
} from './persistence.js';

export {
  outlinerPlugins,
  createOutlinerPlugin,
  createOutlinerKeymap,
  outlinerPluginKey,
  getContentBeforeCursor,
  getContentAfterCursor,
  type OutlinerContext,
} from './outliner.js';

export {
  createInputRulesPlugin,
  headingRule,
  bulletRule,
  todoUncheckedRule,
  todoCheckedRule,
  codeBlockRule,
  type InputRulesConfig,
} from './input-rules.js';

export {
  createTagAutocompletePlugin,
  tagAutocompletePluginKey,
  getTagAutocompleteState,
  isTagAutocompleteActive,
  deactivateTagAutocomplete,
  filterSuggestions,
  isValidTagChar,
  type TagSuggestion,
  type TagProvider,
  type TagAutocompleteState,
  type TagAutocompletePluginOptions,
} from './tag-autocomplete.js';

export {
  createBlockRefAutocompletePlugin,
  autocompletePluginKey,
  getAutocompleteState,
  closeAutocompleteFromView,
  selectResultByIndex,
  truncatePreview,
  type AutocompletePluginOptions,
  type AutocompleteState,
  type BlockRefResult,
  type BlockSearchFn,
  type OnSelectBlockRef,
} from './autocomplete.js';
