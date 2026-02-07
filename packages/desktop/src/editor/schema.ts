/**
 * ProseMirror schema for the Double Bind outliner block editor.
 *
 * This schema defines the document structure for individual blocks.
 * Each block is a single ProseMirror instance containing one of the
 * defined node types with optional marks for inline formatting.
 *
 * Node types:
 * - paragraph: Standard text block
 * - heading: Heading with level 1-3
 * - code_block: Monospace code block
 * - todo_item: Checkbox item with checked state
 * - query_embed: Embedded Datalog query result
 *
 * Formatting Marks:
 * - bold, italic, code, highlight, strikethrough
 *
 * Reference Marks:
 * - pageLink: Link to another page ([[Page Name]])
 * - blockRef: Reference to another block (((block_id)))
 * - tag: Hashtag reference (#tag or #[[multi word tag]])
 */

import { Schema } from 'prosemirror-model';
import type { NodeSpec, MarkSpec, DOMOutputSpec } from 'prosemirror-model';

// ============================================================================
// Node Specifications
// ============================================================================

/**
 * Document node - the root container for block content.
 * Contains exactly one block-level node.
 */
const doc: NodeSpec = {
  content: 'block',
};

/**
 * Text node - inline text content.
 * Supports all defined marks.
 */
const text: NodeSpec = {
  group: 'inline',
};

/**
 * Paragraph node - standard text block.
 * The default block type for regular content.
 */
const paragraph: NodeSpec = {
  content: 'inline*',
  group: 'block',
  parseDOM: [{ tag: 'p' }],
  toDOM(): DOMOutputSpec {
    return ['p', 0];
  },
};

/**
 * Heading node - header text with configurable level.
 * Supports levels 1-3 (h1, h2, h3).
 */
const heading: NodeSpec = {
  attrs: {
    level: { default: 1, validate: 'number' },
  },
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [
    {
      tag: 'h1',
      getAttrs(): { level: number } {
        return { level: 1 };
      },
    },
    {
      tag: 'h2',
      getAttrs(): { level: number } {
        return { level: 2 };
      },
    },
    {
      tag: 'h3',
      getAttrs(): { level: number } {
        return { level: 3 };
      },
    },
  ],
  toDOM(node): DOMOutputSpec {
    const level = node.attrs.level as number;
    // Clamp level to valid range 1-3
    const validLevel = Math.max(1, Math.min(3, level));
    return [`h${validLevel}`, 0];
  },
};

/**
 * Code block node - monospace preformatted text.
 * Does not support inline marks (code is literal).
 */
const code_block: NodeSpec = {
  content: 'text*',
  group: 'block',
  code: true,
  defining: true,
  marks: '',
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
  toDOM(): DOMOutputSpec {
    return ['pre', ['code', 0]];
  },
};

/**
 * Todo item node - checkbox with checked state.
 * Used for task lists and action items.
 */
const todo_item: NodeSpec = {
  attrs: {
    checked: { default: false, validate: 'boolean' },
  },
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [
    {
      tag: 'div[data-type="todo"]',
      getAttrs(dom): { checked: boolean } | false {
        if (!(dom instanceof HTMLElement)) return false;
        return { checked: dom.dataset.checked === 'true' };
      },
    },
  ],
  toDOM(node): DOMOutputSpec {
    const checked = node.attrs.checked as boolean;
    return [
      'div',
      {
        'data-type': 'todo',
        'data-checked': String(checked),
        class: checked ? 'todo-item checked' : 'todo-item',
      },
      ['input', { type: 'checkbox', checked: checked ? 'checked' : null }],
      ['span', { class: 'todo-content' }, 0],
    ];
  },
};

/**
 * Query embed node - embedded Datalog query result.
 * Stores the query string and cached results for display.
 *
 * Attributes:
 * - query: The Datalog query string
 * - results: JSON-stringified query results (cached for display)
 */
const query_embed: NodeSpec = {
  attrs: {
    query: { default: '', validate: 'string' },
    results: { default: '', validate: 'string' },
  },
  group: 'block',
  atom: true, // Treated as a single unit, not editable inline
  selectable: true,
  draggable: true,
  parseDOM: [
    {
      tag: 'div[data-type="query"]',
      getAttrs(dom): { query: string; results: string } | false {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          query: dom.dataset.query || '',
          results: dom.dataset.results || '',
        };
      },
    },
  ],
  toDOM(node): DOMOutputSpec {
    const query = node.attrs.query as string;
    const results = node.attrs.results as string;
    return [
      'div',
      {
        'data-type': 'query',
        'data-query': query,
        'data-results': results,
        class: 'query-embed',
      },
      ['code', { class: 'query-source' }, query],
    ];
  },
};

// ============================================================================
// Mark Specifications
// ============================================================================

/**
 * Bold mark - strong emphasis.
 * Keyboard shortcut: Ctrl+B / Cmd+B
 */
const bold: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b' },
    {
      style: 'font-weight',
      getAttrs(value): false | null {
        // Match font-weight values that indicate bold
        if (typeof value !== 'string') return false;
        return /^(bold(er)?|[5-9]\d{2})$/.test(value) ? null : false;
      },
    },
  ],
  toDOM(): DOMOutputSpec {
    return ['strong', 0];
  },
};

/**
 * Italic mark - emphasis.
 * Keyboard shortcut: Ctrl+I / Cmd+I
 */
const italic: MarkSpec = {
  parseDOM: [
    { tag: 'i' },
    { tag: 'em' },
    {
      style: 'font-style',
      getAttrs(value): false | null {
        return value === 'italic' ? null : false;
      },
    },
  ],
  toDOM(): DOMOutputSpec {
    return ['em', 0];
  },
};

/**
 * Code mark - inline monospace text.
 * Keyboard shortcut: Ctrl+E / Cmd+E
 */
const code: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM(): DOMOutputSpec {
    return ['code', 0];
  },
};

/**
 * Highlight mark - background highlight.
 * Keyboard shortcut: Ctrl+H / Cmd+H
 */
const highlight: MarkSpec = {
  parseDOM: [
    { tag: 'mark' },
    {
      style: 'background-color',
      getAttrs(value): false | null {
        // Accept any non-transparent background as highlight
        if (typeof value !== 'string') return false;
        return value && value !== 'transparent' && value !== 'none' ? null : false;
      },
    },
  ],
  toDOM(): DOMOutputSpec {
    return ['mark', 0];
  },
};

/**
 * Strikethrough mark - deleted/crossed out text.
 * Keyboard shortcut: Ctrl+Shift+K / Cmd+Shift+K
 */
const strikethrough: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'strike' },
    { tag: 'del' },
    {
      style: 'text-decoration',
      getAttrs(value): false | null {
        if (typeof value !== 'string') return false;
        return value.includes('line-through') ? null : false;
      },
    },
  ],
  toDOM(): DOMOutputSpec {
    return ['s', 0];
  },
};

// ============================================================================
// Reference Marks
// ============================================================================

/**
 * Page link mark - reference to another page via [[Page Name]] syntax.
 * Stores the page title for display and linking.
 */
const pageLink: MarkSpec = {
  attrs: {
    title: { default: '', validate: 'string' },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[data-type="page-link"]',
      getAttrs(dom): { title: string } | false {
        if (!(dom instanceof HTMLElement)) return false;
        return { title: dom.dataset.title || dom.textContent || '' };
      },
    },
  ],
  toDOM(mark): DOMOutputSpec {
    const title = mark.attrs.title as string;
    return [
      'a',
      {
        'data-type': 'page-link',
        'data-title': title,
        class: 'page-link',
        href: '#',
      },
      0,
    ];
  },
};

/**
 * Block reference mark - reference to another block via ((block_id)) syntax.
 * Stores the block ID (ULID format) for transclusion.
 */
const blockRef: MarkSpec = {
  attrs: {
    blockId: { default: '', validate: 'string' },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[data-type="block-ref"]',
      getAttrs(dom): { blockId: string } | false {
        if (!(dom instanceof HTMLElement)) return false;
        return { blockId: dom.dataset.blockId || '' };
      },
    },
  ],
  toDOM(mark): DOMOutputSpec {
    const blockId = mark.attrs.blockId as string;
    return [
      'a',
      {
        'data-type': 'block-ref',
        'data-block-id': blockId,
        class: 'block-ref',
        href: '#',
      },
      0,
    ];
  },
};

/**
 * Tag mark - hashtag reference via #tag or #[[multi word tag]] syntax.
 * Stores the tag name for filtering and linking.
 */
const tag: MarkSpec = {
  attrs: {
    tag: { default: '', validate: 'string' },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[data-type="tag"]',
      getAttrs(dom): { tag: string } | false {
        if (!(dom instanceof HTMLElement)) return false;
        return { tag: dom.dataset.tag || '' };
      },
    },
  ],
  toDOM(mark): DOMOutputSpec {
    const tagName = mark.attrs.tag as string;
    return [
      'a',
      {
        'data-type': 'tag',
        'data-tag': tagName,
        class: 'tag',
        href: '#',
      },
      0,
    ];
  },
};

// ============================================================================
// Schema Definition
// ============================================================================

/**
 * Node specifications for the outliner schema.
 */
export const nodes = {
  doc,
  text,
  paragraph,
  heading,
  code_block,
  todo_item,
  query_embed,
};

/**
 * Mark specifications for the outliner schema.
 */
export const marks = {
  // Formatting marks
  bold,
  italic,
  code,
  highlight,
  strikethrough,
  // Reference marks
  pageLink,
  blockRef,
  tag,
};

/**
 * The complete ProseMirror schema for the Double Bind outliner.
 * Use this schema when creating EditorState instances.
 *
 * @example
 * ```typescript
 * import { EditorState } from 'prosemirror-state';
 * import { EditorView } from 'prosemirror-view';
 * import { schema } from './schema';
 *
 * const state = EditorState.create({
 *   schema,
 *   doc: schema.nodes.doc.create(null, [
 *     schema.nodes.paragraph.create()
 *   ])
 * });
 *
 * const view = new EditorView(container, { state });
 * ```
 */
export const schema = new Schema({ nodes, marks });

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type representing valid heading levels.
 */
export type HeadingLevel = 1 | 2 | 3;

/**
 * Type representing node type names in the schema.
 */
export type NodeTypeName = keyof typeof nodes;

/**
 * Type representing mark type names in the schema.
 */
export type MarkTypeName = keyof typeof marks;
