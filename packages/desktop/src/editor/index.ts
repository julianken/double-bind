/**
 * Editor module exports.
 *
 * This module provides the ProseMirror schema and related types
 * for the Double Bind outliner block editor.
 */

export {
  schema,
  nodes,
  marks,
  type HeadingLevel,
  type NodeTypeName,
  type MarkTypeName,
} from './schema.js';

export * from './plugins/index.js';

export { textToDoc, docToText, validateRoundTrip } from './serialization.js';
