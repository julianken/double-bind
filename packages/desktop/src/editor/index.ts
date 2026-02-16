/**
 * Editor module exports.
 *
 * This module provides the ProseMirror schema and related types
 * for the Double Bind outliner block editor, along with the
 * BlockEditor React component and serialization utilities.
 */

// Schema exports
export {
  schema,
  nodes,
  marks,
  type HeadingLevel,
  type NodeTypeName,
  type MarkTypeName,
} from './schema.js';

// Plugin exports
export * from './plugins/index.js';

// Serialization utilities (main's exports)
export { textToDoc, docToText, validateRoundTrip } from './serialization.js';

// BlockEditor component (DBB-165)
export {
  BlockEditor,
  getEditorContent,
  focusEditor,
  editorHasFocus,
  type BlockEditorProps,
} from './BlockEditor.js';

// Autocomplete dropdown component (DBB-197)
export {
  AutocompleteDropdown,
  AUTOCOMPLETE_CSS_CLASSES,
  AUTOCOMPLETE_DEFAULT_STYLES,
  type AutocompleteDropdownProps,
} from './AutocompleteDropdown.js';
