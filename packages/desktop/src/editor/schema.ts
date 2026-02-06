/**
 * ProseMirror schema definition for Double Bind editor.
 *
 * This schema defines the structure of documents in the block editor,
 * including node types (block, pageLink, blockRef, codeBlock) and
 * marks (bold, italic, code, highlight).
 *
 * Security: All attributes use validators to prevent type confusion attacks
 * (CVE-2024-40626). The schema structurally rejects dangerous elements.
 *
 * @see docs/frontend/prosemirror.md for full specification
 */

import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model';

/**
 * Node specifications for the Double Bind schema.
 */
const nodes: Record<string, NodeSpec> = {
  /**
   * Document root - contains one or more blocks.
   */
  doc: {
    content: 'block+',
  },

  /**
   * Block node - the primary content container.
   * Corresponds to a single block in the database.
   */
  block: {
    content: 'inline*',
    group: 'block',
    attrs: {
      blockId: {
        default: null,
        validate: (value: unknown) => {
          if (value !== null && typeof value !== 'string') {
            throw new RangeError('blockId must be a string or null');
          }
        },
      },
      indentLevel: {
        default: 0,
        validate: (value: unknown) => {
          if (typeof value !== 'number' || value < 0) {
            throw new RangeError('indentLevel must be a non-negative number');
          }
        },
      },
    },
    parseDOM: [{ tag: 'div[data-block]' }],
    toDOM(node) {
      return [
        'div',
        {
          'data-block': '',
          'data-block-id': node.attrs.blockId,
          'data-indent-level': String(node.attrs.indentLevel),
        },
        0,
      ];
    },
  },

  /**
   * Text node - inline text content.
   */
  text: {
    group: 'inline',
  },

  /**
   * Page link node - a link to another page.
   * Rendered from [[Page Title]] syntax.
   */
  pageLink: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      pageId: {
        validate: (v: unknown) => {
          if (typeof v !== 'string') {
            throw new RangeError('pageId must be a string');
          }
        },
      },
      title: {
        validate: (v: unknown) => {
          if (typeof v !== 'string') {
            throw new RangeError('title must be a string');
          }
        },
      },
    },
    parseDOM: [
      {
        tag: 'a[data-page-link]',
        getAttrs(dom) {
          const element = dom as HTMLElement;
          return {
            pageId: element.getAttribute('data-page-id'),
            title: element.textContent || '',
          };
        },
      },
    ],
    toDOM(node) {
      return [
        'a',
        {
          'data-page-link': '',
          'data-page-id': node.attrs.pageId,
          class: 'page-link',
        },
        node.attrs.title,
      ];
    },
  },

  /**
   * Block reference node - a reference to another block.
   * Rendered from ((block-id)) syntax.
   */
  blockRef: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      blockId: {
        validate: (v: unknown) => {
          if (typeof v !== 'string') {
            throw new RangeError('blockId must be a string');
          }
        },
      },
      preview: {
        default: '',
        validate: (v: unknown) => {
          if (typeof v !== 'string') {
            throw new RangeError('preview must be a string');
          }
        },
      },
    },
    parseDOM: [
      {
        tag: 'span[data-block-ref]',
        getAttrs(dom) {
          const element = dom as HTMLElement;
          return {
            blockId: element.getAttribute('data-ref-block-id'),
            preview: element.textContent || '',
          };
        },
      },
    ],
    toDOM(node) {
      return [
        'span',
        {
          'data-block-ref': '',
          'data-ref-block-id': node.attrs.blockId,
          class: 'block-ref',
        },
        node.attrs.preview,
      ];
    },
  },

  /**
   * Code block node - multi-line code with optional language.
   */
  codeBlock: {
    content: 'text*',
    group: 'block',
    marks: '',
    code: true,
    defining: true,
    attrs: {
      language: {
        default: '',
        validate: (v: unknown) => {
          if (typeof v !== 'string') {
            throw new RangeError('language must be a string');
          }
        },
      },
    },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full' as const,
        getAttrs(dom) {
          const element = dom as HTMLElement;
          const code = element.querySelector('code');
          const language = code?.getAttribute('data-language') || '';
          return { language };
        },
      },
    ],
    toDOM(node) {
      return ['pre', {}, ['code', { 'data-language': node.attrs.language }, 0]];
    },
  },

  /**
   * Hard break node - line break within a block (Shift+Enter).
   */
  hardBreak: {
    group: 'inline',
    inline: true,
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() {
      return ['br'];
    },
  },
};

/**
 * Mark specifications for the Double Bind schema.
 */
const marks: Record<string, MarkSpec> = {
  /**
   * Bold mark - rendered from **text** syntax.
   */
  bold: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b' },
      {
        style: 'font-weight',
        getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
      },
    ],
    toDOM() {
      return ['strong', 0];
    },
  },

  /**
   * Italic mark - rendered from *text* or _text_ syntax.
   */
  italic: {
    parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
    toDOM() {
      return ['em', 0];
    },
  },

  /**
   * Inline code mark - rendered from `code` syntax.
   */
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM() {
      return ['code', 0];
    },
  },

  /**
   * Highlight mark - rendered from ==text== syntax.
   */
  highlight: {
    parseDOM: [{ tag: 'mark' }],
    toDOM() {
      return ['mark', 0];
    },
  },

  /**
   * Strikethrough mark - rendered from ~~text~~ syntax.
   */
  strikethrough: {
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { tag: 'del' },
      { style: 'text-decoration=line-through' },
    ],
    toDOM() {
      return ['s', 0];
    },
  },
};

/**
 * The Double Bind ProseMirror schema.
 *
 * Use this schema for all editor instances to ensure consistent
 * document structure and security validation.
 */
export const schema = new Schema({ nodes, marks });

/**
 * Export individual node and mark types for type-safe access.
 */
export const nodeTypes = schema.nodes;
export const markTypes = schema.marks;
