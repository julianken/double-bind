/**
 * Serialization utilities for converting between plain text
 * and ProseMirror document format.
 *
 * These utilities support simple text-to-document conversion
 * using the outliner schema (paragraph, heading, code_block, etc.).
 *
 * Text Format:
 * - Multiple lines create multiple paragraphs
 * - **text** for bold
 * - *text* or _text_ for italic
 * - `code` for inline code
 * - ==text== for highlight
 * - ~~text~~ for strikethrough
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
  | 'bold'
  | 'italic'
  | 'code'
  | 'highlight'
  | 'strikethrough';

/**
 * Parsed token from text content.
 */
interface Token {
  type: TokenType;
  content: string;
}

/**
 * Combined regex for tokenization.
 * Named groups identify which pattern matched.
 */
const COMBINED_PATTERN = new RegExp(
  [
    `(?<bold>\\*\\*[^*]+\\*\\*)`,
    `(?<code>\`[^\`]+\`)`,
    `(?<highlight>==[^=]+==)`,
    `(?<strikethrough>~~[^~]+~~)`,
    `(?<italicAsterisk>(?<!\\*)\\*[^*]+\\*(?!\\*))`,
    `(?<italicUnderscore>_[^_]+_)`,
  ].join('|'),
  'g'
);

/**
 * Tokenizes text content into a sequence of tokens.
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
    if (groups.bold) {
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
 * Converts tokens to ProseMirror inline nodes with marks.
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
    }
  }

  return nodes;
}

/**
 * Converts plain text content to a ProseMirror document node.
 *
 * Creates a document with a single paragraph containing the text.
 * Inline formatting marks are preserved (**bold**, *italic*, `code`, etc.).
 *
 * @param text - Plain text content with optional markdown formatting
 * @param pmSchema - ProseMirror schema to use (defaults to outliner schema)
 * @returns ProseMirror document node
 *
 * @example
 * const doc = textToDoc('Hello **world**', schema);
 * // Creates: doc > paragraph > [text("Hello "), text("world", [bold])]
 */
export function textToDoc(text: string, pmSchema: Schema = defaultSchema): Node {
  // Handle empty text
  if (!text) {
    return pmSchema.nodes.doc!.create(null, pmSchema.nodes.paragraph!.create(null, []));
  }

  // Tokenize the text
  const tokens = tokenize(text);

  // Convert tokens to nodes
  const inlineNodes = tokensToNodes(tokens, pmSchema);

  // Create a paragraph containing all inline content
  const paragraph = pmSchema.nodes.paragraph!.create(null, inlineNodes);

  // Wrap in doc
  return pmSchema.nodes.doc!.create(null, [paragraph]);
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
 * This function serializes the document structure back to plain text,
 * preserving inline formatting marks.
 *
 * @param doc - ProseMirror document node
 * @returns Plain text content with markdown formatting
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
    if (
      node.type.name === 'paragraph' ||
      node.type.name === 'heading' ||
      node.type.name === 'todo_item'
    ) {
      return true; // Continue to children
    }

    // Handle code blocks
    if (node.type.name === 'code_block') {
      parts.push(node.textContent);
      return false; // Don't process children
    }

    // Handle query embeds
    if (node.type.name === 'query_embed') {
      parts.push(node.attrs.query || '');
      return false;
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

// Re-export schema for convenience
export { schema } from './schema.js';
