/**
 * Serialization utilities for converting between plain text (stored in CozoDB)
 * and ProseMirror document format.
 *
 * Text Format Markers:
 * - [[Page Title]] -> pageLink node
 * - ((block-id)) -> blockRef node
 * - **text** -> bold mark
 * - *text* or _text_ -> italic mark
 * - `code` -> code mark
 * - ==text== -> highlight mark
 * - ~~text~~ -> strikethrough mark
 *
 * Round-trip fidelity: docToText(textToDoc(text)) preserves original text content.
 *
 * @see docs/frontend/prosemirror.md for specification
 */

import type { Node, Schema, Mark } from 'prosemirror-model';
import { schema as defaultSchema } from './schema.js';

/**
 * Token types for parsing text content.
 */
type TokenType =
  | 'text'
  | 'pageLink'
  | 'blockRef'
  | 'bold'
  | 'italic'
  | 'code'
  | 'highlight'
  | 'strikethrough'
  | 'newline';

/**
 * Parsed token from text content.
 */
interface Token {
  type: TokenType;
  content: string;
  attrs?: Record<string, string>;
}

// Regex patterns are documented inline in COMBINED_PATTERN below.
// Individual patterns for reference:
// - Page link: [[Page Title]] -> \[\[([^\]]+)\]\]
// - Block reference: ((block-id)) -> \(\(([^)]+)\)\)
// - Bold: **text** -> \*\*([^*]+)\*\*
// - Italic: *text* -> (?<!\*)\*([^*]+)\*(?!\*)
// - Italic: _text_ -> _([^_]+)_
// - Code: `code` -> `([^`]+)`
// - Highlight: ==text== -> ==([^=]+)==
// - Strikethrough: ~~text~~ -> ~~([^~]+)~~

/**
 * Combined regex for tokenization.
 * Named groups are used to identify which pattern matched.
 */
const COMBINED_PATTERN = new RegExp(
  [
    `(?<pageLink>\\[\\[[^\\]]+\\]\\])`,
    `(?<blockRef>\\(\\([^)]+\\)\\))`,
    `(?<bold>\\*\\*[^*]+\\*\\*)`,
    `(?<code>\`[^\`]+\`)`,
    `(?<highlight>==[^=]+==)`,
    `(?<strikethrough>~~[^~]+~~)`,
    `(?<italicAsterisk>(?<!\\*)\\*[^*]+\\*(?!\\*))`,
    `(?<italicUnderscore>_[^_]+_)`,
    `(?<newline>\\n)`,
  ].join('|'),
  'g'
);

/**
 * Tokenizes text content into a sequence of tokens.
 * This is the first pass of parsing - splitting text into recognizable parts.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  // Reset regex state
  COMBINED_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMBINED_PATTERN.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Determine which pattern matched
    const groups = match.groups!;
    if (groups.pageLink) {
      const title = groups.pageLink.slice(2, -2); // Remove [[ and ]]
      tokens.push({
        type: 'pageLink',
        content: groups.pageLink,
        attrs: { title, pageId: title }, // pageId defaults to title for now
      });
    } else if (groups.blockRef) {
      const blockId = groups.blockRef.slice(2, -2); // Remove (( and ))
      tokens.push({
        type: 'blockRef',
        content: groups.blockRef,
        attrs: { blockId, preview: '' },
      });
    } else if (groups.bold) {
      const innerText = groups.bold.slice(2, -2); // Remove ** and **
      tokens.push({
        type: 'bold',
        content: innerText,
      });
    } else if (groups.code) {
      const innerText = groups.code.slice(1, -1); // Remove ` and `
      tokens.push({
        type: 'code',
        content: innerText,
      });
    } else if (groups.highlight) {
      const innerText = groups.highlight.slice(2, -2); // Remove == and ==
      tokens.push({
        type: 'highlight',
        content: innerText,
      });
    } else if (groups.strikethrough) {
      const innerText = groups.strikethrough.slice(2, -2); // Remove ~~ and ~~
      tokens.push({
        type: 'strikethrough',
        content: innerText,
      });
    } else if (groups.italicAsterisk) {
      const innerText = groups.italicAsterisk.slice(1, -1); // Remove * and *
      tokens.push({
        type: 'italic',
        content: innerText,
      });
    } else if (groups.italicUnderscore) {
      const innerText = groups.italicUnderscore.slice(1, -1); // Remove _ and _
      tokens.push({
        type: 'italic',
        content: innerText,
      });
    } else if (groups.newline) {
      tokens.push({
        type: 'newline',
        content: '\n',
      });
    }

    lastIndex = COMBINED_PATTERN.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Converts tokens to ProseMirror nodes.
 * Uses non-null assertions since we control the schema and know these types exist.
 */
function tokensToNodes(tokens: Token[], pmSchema: Schema): Node[] {
  const nodes: Node[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        if (token.content) {
          nodes.push(pmSchema.text(token.content));
        }
        break;

      case 'pageLink':
        nodes.push(
          pmSchema.nodes.pageLink!.create({
            pageId: token.attrs!.pageId,
            title: token.attrs!.title,
          })
        );
        break;

      case 'blockRef':
        nodes.push(
          pmSchema.nodes.blockRef!.create({
            blockId: token.attrs!.blockId,
            preview: token.attrs!.preview,
          })
        );
        break;

      case 'bold':
        if (token.content) {
          const mark = pmSchema.marks.bold!.create();
          nodes.push(pmSchema.text(token.content, [mark]));
        }
        break;

      case 'italic':
        if (token.content) {
          const mark = pmSchema.marks.italic!.create();
          nodes.push(pmSchema.text(token.content, [mark]));
        }
        break;

      case 'code':
        if (token.content) {
          const mark = pmSchema.marks.code!.create();
          nodes.push(pmSchema.text(token.content, [mark]));
        }
        break;

      case 'highlight':
        if (token.content) {
          const mark = pmSchema.marks.highlight!.create();
          nodes.push(pmSchema.text(token.content, [mark]));
        }
        break;

      case 'strikethrough':
        if (token.content) {
          const mark = pmSchema.marks.strikethrough!.create();
          nodes.push(pmSchema.text(token.content, [mark]));
        }
        break;

      case 'newline':
        nodes.push(pmSchema.nodes.hardBreak!.create());
        break;
    }
  }

  return nodes;
}

/**
 * Converts plain text content to a ProseMirror document node.
 *
 * The text format uses markers:
 * - [[Page Title]] for page links
 * - ((block-id)) for block references
 * - **text** for bold
 * - *text* or _text_ for italic
 * - `code` for inline code
 * - ==text== for highlight
 * - ~~text~~ for strikethrough
 *
 * Multi-line content (Shift+Enter newlines) is preserved using hardBreak nodes.
 *
 * @param text - Plain text content with markers
 * @param pmSchema - ProseMirror schema to use (defaults to Double Bind schema)
 * @returns ProseMirror document node
 *
 * @example
 * const doc = textToDoc('Hello **world**', schema);
 * // Creates: doc > block > [text("Hello "), text("world", [bold])]
 */
export function textToDoc(text: string, pmSchema: Schema = defaultSchema): Node {
  // Handle empty text
  if (!text) {
    return pmSchema.nodes.doc!.create(null, pmSchema.nodes.block!.create(null, []));
  }

  // Tokenize the text
  const tokens = tokenize(text);

  // Convert tokens to nodes
  const inlineNodes = tokensToNodes(tokens, pmSchema);

  // Create a single block containing all inline content
  const block = pmSchema.nodes.block!.create(null, inlineNodes);

  // Wrap in doc
  return pmSchema.nodes.doc!.create(null, [block]);
}

/**
 * Gets the mark name for serialization.
 */
function getMarkName(mark: Mark): string {
  return mark.type.name;
}

/**
 * Converts a ProseMirror document node back to plain text.
 *
 * This function serializes the document structure back to the
 * text format used in CozoDB storage, preserving all markers.
 *
 * @param doc - ProseMirror document node
 * @returns Plain text content with markers
 *
 * @example
 * const text = docToText(doc);
 * // Returns: 'Hello **world**'
 */
export function docToText(doc: Node): string {
  const parts: string[] = [];

  // Walk the document tree
  doc.descendants((node, _pos, _parent) => {
    // Handle block nodes - just process their children
    if (node.type.name === 'block') {
      return true; // Continue to children
    }

    // Handle code blocks
    if (node.type.name === 'codeBlock') {
      const language = node.attrs.language || '';
      const code = node.textContent;
      if (language) {
        parts.push('```' + language + '\n' + code + '\n```');
      } else {
        parts.push('```\n' + code + '\n```');
      }
      return false; // Don't process children
    }

    // Handle text nodes
    if (node.isText) {
      let text = node.text || '';

      // Apply marks in reverse order (outermost first)
      const marks = node.marks.slice().reverse();
      for (const mark of marks) {
        const markName = getMarkName(mark);
        switch (markName) {
          case 'bold':
            text = '**' + text + '**';
            break;
          case 'italic':
            text = '*' + text + '*';
            break;
          case 'code':
            text = '`' + text + '`';
            break;
          case 'highlight':
            text = '==' + text + '==';
            break;
          case 'strikethrough':
            text = '~~' + text + '~~';
            break;
        }
      }

      parts.push(text);
      return false;
    }

    // Handle page links
    if (node.type.name === 'pageLink') {
      parts.push('[[' + node.attrs.title + ']]');
      return false;
    }

    // Handle block references
    if (node.type.name === 'blockRef') {
      parts.push('((' + node.attrs.blockId + '))');
      return false;
    }

    // Handle hard breaks (Shift+Enter newlines)
    if (node.type.name === 'hardBreak') {
      parts.push('\n');
      return false;
    }

    // For doc node, continue to children
    if (node.type.name === 'doc') {
      return true;
    }

    return true;
  });

  return parts.join('');
}

/**
 * Validates that a text can be round-tripped through serialization.
 *
 * This is primarily useful for testing and debugging to ensure
 * that the serialization is lossless.
 *
 * @param text - Text to validate
 * @param pmSchema - ProseMirror schema to use
 * @returns True if round-trip preserves the text
 */
export function validateRoundTrip(text: string, pmSchema: Schema = defaultSchema): boolean {
  const doc = textToDoc(text, pmSchema);
  const result = docToText(doc);
  return result === text;
}

/**
 * Creates a ProseMirror document with a single block from text.
 * This is a convenience function for creating editor state.
 *
 * @param text - Plain text content with markers
 * @param blockId - Optional block ID attribute
 * @param indentLevel - Optional indent level
 * @param pmSchema - ProseMirror schema to use
 * @returns ProseMirror document node
 */
export function createBlockDoc(
  text: string,
  blockId: string | null = null,
  indentLevel: number = 0,
  pmSchema: Schema = defaultSchema
): Node {
  const tokens = tokenize(text);
  const inlineNodes = tokensToNodes(tokens, pmSchema);

  const block = pmSchema.nodes.block!.create({ blockId, indentLevel }, inlineNodes);

  return pmSchema.nodes.doc!.create(null, [block]);
}

// Re-export schema for convenience
export { schema } from './schema.js';
