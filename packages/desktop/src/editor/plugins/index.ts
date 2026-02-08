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
  markInputRule,
  boldRule,
  italicRule,
  inlineCodeRule,
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

export {
  highlightReferencesPlugin,
  highlightReferencesPluginKey,
} from './highlight-references.js';

export {
  createAutocompletePlugin as createPageAutocompletePlugin,
  autocompletePluginKey as pageAutocompletePluginKey,
  getAutocompleteState as getPageAutocompleteState,
  isAutocompleteActive as isPageAutocompleteActive,
  closeAutocomplete as closePageAutocomplete,
  selectSuggestion as selectPageSuggestion,
  type AutocompleteSuggestion as PageAutocompleteSuggestion,
  type AutocompleteState as PageAutocompleteState,
  type AutocompletePluginOptions as PageAutocompletePluginOptions,
  type OnSelectSuggestion as OnSelectPageSuggestion,
  type SearchPages,
} from './page-autocomplete.js';
