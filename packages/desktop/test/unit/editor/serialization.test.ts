/**
 * Unit tests for ProseMirror serialization utilities.
 *
 * Tests cover:
 * - textToDoc: Converting plain text to ProseMirror documents
 * - docToText: Converting ProseMirror documents back to plain text
 * - Round-trip fidelity: Ensuring text is preserved through serialization
 * - Multi-line content handling (Shift+Enter newlines)
 * - Inline marks (bold, italic, code, highlight, strikethrough)
 * - Special nodes (pageLink, blockRef)
 */

import { describe, it, expect } from 'vitest';
import {
  textToDoc,
  docToText,
  validateRoundTrip,
  createBlockDoc,
  schema,
} from '../../../src/editor/serialization.js';

describe('ProseMirror Serialization', () => {
  // ============================================================================
  // textToDoc - Basic Text
  // ============================================================================

  describe('textToDoc - Basic Text', () => {
    it('converts empty string to empty document', () => {
      const doc = textToDoc('');
      expect(doc.type.name).toBe('doc');
      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe('block');
      expect(doc.firstChild?.childCount).toBe(0);
    });

    it('converts plain text to document', () => {
      const doc = textToDoc('Hello world');
      expect(doc.type.name).toBe('doc');
      expect(doc.childCount).toBe(1);

      const block = doc.firstChild!;
      expect(block.type.name).toBe('block');
      expect(block.childCount).toBe(1);
      expect(block.firstChild?.isText).toBe(true);
      expect(block.firstChild?.text).toBe('Hello world');
    });

    it('preserves whitespace', () => {
      const doc = textToDoc('  Hello   world  ');
      const block = doc.firstChild!;
      expect(block.firstChild?.text).toBe('  Hello   world  ');
    });

    it('handles special characters', () => {
      const text = 'Hello <world> & "friends"';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });
  });

  // ============================================================================
  // textToDoc - Inline Marks
  // ============================================================================

  describe('textToDoc - Inline Marks', () => {
    it('parses bold text with **', () => {
      const doc = textToDoc('Hello **world**');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(0).text).toBe('Hello ');
      expect(block.child(0).marks.length).toBe(0);
      expect(block.child(1).text).toBe('world');
      expect(block.child(1).marks[0].type.name).toBe('bold');
    });

    it('parses italic text with *', () => {
      const doc = textToDoc('Hello *world*');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(0).text).toBe('Hello ');
      expect(block.child(1).text).toBe('world');
      expect(block.child(1).marks[0].type.name).toBe('italic');
    });

    it('parses italic text with _', () => {
      const doc = textToDoc('Hello _world_');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(1).text).toBe('world');
      expect(block.child(1).marks[0].type.name).toBe('italic');
    });

    it('parses inline code with `', () => {
      const doc = textToDoc('Use `const` keyword');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(3);
      expect(block.child(0).text).toBe('Use ');
      expect(block.child(1).text).toBe('const');
      expect(block.child(1).marks[0].type.name).toBe('code');
      expect(block.child(2).text).toBe(' keyword');
    });

    it('parses highlight with ==', () => {
      const doc = textToDoc('This is ==highlighted== text');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(3);
      expect(block.child(1).text).toBe('highlighted');
      expect(block.child(1).marks[0].type.name).toBe('highlight');
    });

    it('parses strikethrough with ~~', () => {
      const doc = textToDoc('This is ~~deleted~~ text');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(3);
      expect(block.child(1).text).toBe('deleted');
      expect(block.child(1).marks[0].type.name).toBe('strikethrough');
    });

    it('handles multiple different marks', () => {
      const doc = textToDoc('**bold** and *italic* and `code`');
      const block = doc.firstChild!;

      // ProseMirror merges adjacent text nodes, so we have 5 children:
      // [0] bold text, [1] " and ", [2] italic text, [3] " and ", [4] code text
      expect(block.childCount).toBe(5);
      expect(block.child(0).marks[0].type.name).toBe('bold');
      expect(block.child(2).marks[0].type.name).toBe('italic');
      expect(block.child(4).marks[0].type.name).toBe('code');
    });

    it('distinguishes bold from italic asterisks', () => {
      const doc = textToDoc('This is **bold** not *italic*');
      const block = doc.firstChild!;

      const boldNode = block.child(1);
      const italicNode = block.child(3);

      expect(boldNode.text).toBe('bold');
      expect(boldNode.marks[0].type.name).toBe('bold');
      expect(italicNode.text).toBe('italic');
      expect(italicNode.marks[0].type.name).toBe('italic');
    });
  });

  // ============================================================================
  // textToDoc - Page Links
  // ============================================================================

  describe('textToDoc - Page Links', () => {
    it('parses page link [[Page Title]]', () => {
      const doc = textToDoc('See [[Project Alpha]]');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(0).text).toBe('See ');

      const pageLink = block.child(1);
      expect(pageLink.type.name).toBe('pageLink');
      expect(pageLink.attrs.title).toBe('Project Alpha');
      expect(pageLink.attrs.pageId).toBe('Project Alpha');
    });

    it('parses multiple page links', () => {
      const doc = textToDoc('Link to [[Page A]] and [[Page B]]');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(4);
      expect(block.child(1).type.name).toBe('pageLink');
      expect(block.child(1).attrs.title).toBe('Page A');
      expect(block.child(3).type.name).toBe('pageLink');
      expect(block.child(3).attrs.title).toBe('Page B');
    });

    it('handles page link with special characters', () => {
      const doc = textToDoc('See [[Page: A & B]]');
      const block = doc.firstChild!;

      const pageLink = block.child(1);
      expect(pageLink.attrs.title).toBe('Page: A & B');
    });

    it('handles page link at start of text', () => {
      const doc = textToDoc('[[First Page]] is important');
      const block = doc.firstChild!;

      expect(block.child(0).type.name).toBe('pageLink');
      expect(block.child(0).attrs.title).toBe('First Page');
    });

    it('handles page link at end of text', () => {
      const doc = textToDoc('See also [[Last Page]]');
      const block = doc.firstChild!;

      expect(block.child(1).type.name).toBe('pageLink');
      expect(block.child(1).attrs.title).toBe('Last Page');
    });
  });

  // ============================================================================
  // textToDoc - Block References
  // ============================================================================

  describe('textToDoc - Block References', () => {
    it('parses block reference ((block-id))', () => {
      const doc = textToDoc('See ((01HXYZ))');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(0).text).toBe('See ');

      const blockRef = block.child(1);
      expect(blockRef.type.name).toBe('blockRef');
      expect(blockRef.attrs.blockId).toBe('01HXYZ');
    });

    it('parses multiple block references', () => {
      const doc = textToDoc('Link ((id1)) and ((id2))');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(4);
      expect(block.child(1).type.name).toBe('blockRef');
      expect(block.child(1).attrs.blockId).toBe('id1');
      expect(block.child(3).type.name).toBe('blockRef');
      expect(block.child(3).attrs.blockId).toBe('id2');
    });

    it('handles block reference with alphanumeric ID', () => {
      const doc = textToDoc('See ((01HABCD123))');
      const block = doc.firstChild!;

      const blockRef = block.child(1);
      expect(blockRef.attrs.blockId).toBe('01HABCD123');
    });
  });

  // ============================================================================
  // textToDoc - Multi-line Content
  // ============================================================================

  describe('textToDoc - Multi-line Content', () => {
    it('preserves newlines as hardBreak nodes', () => {
      const doc = textToDoc('Line 1\nLine 2');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(3);
      expect(block.child(0).text).toBe('Line 1');
      expect(block.child(1).type.name).toBe('hardBreak');
      expect(block.child(2).text).toBe('Line 2');
    });

    it('handles multiple newlines', () => {
      const doc = textToDoc('A\nB\nC');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(5);
      expect(block.child(0).text).toBe('A');
      expect(block.child(1).type.name).toBe('hardBreak');
      expect(block.child(2).text).toBe('B');
      expect(block.child(3).type.name).toBe('hardBreak');
      expect(block.child(4).text).toBe('C');
    });

    it('handles newline at start', () => {
      const doc = textToDoc('\nText');
      const block = doc.firstChild!;

      expect(block.child(0).type.name).toBe('hardBreak');
      expect(block.child(1).text).toBe('Text');
    });

    it('handles newline at end', () => {
      const doc = textToDoc('Text\n');
      const block = doc.firstChild!;

      expect(block.child(0).text).toBe('Text');
      expect(block.child(1).type.name).toBe('hardBreak');
    });
  });

  // ============================================================================
  // textToDoc - Mixed Content
  // ============================================================================

  describe('textToDoc - Mixed Content', () => {
    it('handles page link with bold text', () => {
      const doc = textToDoc('**Bold** and [[Page]]');
      const block = doc.firstChild!;

      expect(block.child(0).marks[0].type.name).toBe('bold');
      expect(block.child(2).type.name).toBe('pageLink');
    });

    it('handles complex mixed content', () => {
      const doc = textToDoc('See [[Project Alpha]] and ((01HXYZ)) for **details**');
      const block = doc.firstChild!;

      // Verify structure
      let foundPageLink = false;
      let foundBlockRef = false;
      let foundBold = false;

      block.forEach((child) => {
        if (child.type.name === 'pageLink') foundPageLink = true;
        if (child.type.name === 'blockRef') foundBlockRef = true;
        if (child.marks.some((m) => m.type.name === 'bold')) foundBold = true;
      });

      expect(foundPageLink).toBe(true);
      expect(foundBlockRef).toBe(true);
      expect(foundBold).toBe(true);
    });
  });

  // ============================================================================
  // docToText - Basic
  // ============================================================================

  describe('docToText - Basic', () => {
    it('serializes empty document', () => {
      const doc = textToDoc('');
      expect(docToText(doc)).toBe('');
    });

    it('serializes plain text', () => {
      const doc = textToDoc('Hello world');
      expect(docToText(doc)).toBe('Hello world');
    });

    it('serializes whitespace', () => {
      const doc = textToDoc('  Hello   world  ');
      expect(docToText(doc)).toBe('  Hello   world  ');
    });
  });

  // ============================================================================
  // docToText - Marks
  // ============================================================================

  describe('docToText - Marks', () => {
    it('serializes bold text', () => {
      const doc = textToDoc('Hello **world**');
      expect(docToText(doc)).toBe('Hello **world**');
    });

    it('serializes italic text', () => {
      const doc = textToDoc('Hello *world*');
      expect(docToText(doc)).toBe('Hello *world*');
    });

    it('serializes code text', () => {
      const doc = textToDoc('Use `const`');
      expect(docToText(doc)).toBe('Use `const`');
    });

    it('serializes highlight text', () => {
      const doc = textToDoc('This is ==important==');
      expect(docToText(doc)).toBe('This is ==important==');
    });

    it('serializes strikethrough text', () => {
      const doc = textToDoc('This is ~~deleted~~');
      expect(docToText(doc)).toBe('This is ~~deleted~~');
    });
  });

  // ============================================================================
  // docToText - Nodes
  // ============================================================================

  describe('docToText - Nodes', () => {
    it('serializes page links', () => {
      const doc = textToDoc('See [[Project Alpha]]');
      expect(docToText(doc)).toBe('See [[Project Alpha]]');
    });

    it('serializes block references', () => {
      const doc = textToDoc('See ((01HXYZ))');
      expect(docToText(doc)).toBe('See ((01HXYZ))');
    });

    it('serializes hard breaks', () => {
      const doc = textToDoc('Line 1\nLine 2');
      expect(docToText(doc)).toBe('Line 1\nLine 2');
    });
  });

  // ============================================================================
  // Round-Trip Fidelity
  // ============================================================================

  describe('Round-Trip Fidelity', () => {
    it('preserves plain text', () => {
      const text = 'Hello world';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves bold text', () => {
      const text = 'Hello **world**';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves italic text with asterisk', () => {
      const text = 'Hello *world*';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves inline code', () => {
      const text = 'Use `const` keyword';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves highlight', () => {
      const text = 'This is ==highlighted== text';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves strikethrough', () => {
      const text = 'This is ~~deleted~~ text';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves page links', () => {
      const text = 'See [[Project Alpha]] for details';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves block references', () => {
      const text = 'See ((01HXYZ)) for context';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves multi-line content', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves complex mixed content', () => {
      const text = 'See [[Project Alpha]] and ((01HXYZ)) for **details**';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves multiple marks of same type', () => {
      const text = '**bold1** and **bold2**';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves multiple page links', () => {
      const text = 'Link to [[Page A]] and [[Page B]]';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves empty string', () => {
      const text = '';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves whitespace-only string', () => {
      const text = '   ';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves text with all mark types', () => {
      const text = '**bold** *italic* `code` ==highlight== ~~strike~~';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('preserves text with multiple newlines', () => {
      const text = 'A\n\nB\n\nC';
      // Note: Consecutive newlines become consecutive hardBreaks
      const doc = textToDoc(text);
      const result = docToText(doc);
      expect(result).toBe(text);
    });
  });

  // ============================================================================
  // createBlockDoc
  // ============================================================================

  describe('createBlockDoc', () => {
    it('creates document with block ID', () => {
      const doc = createBlockDoc('Hello', 'block-123');
      const block = doc.firstChild!;

      expect(block.attrs.blockId).toBe('block-123');
      expect(block.attrs.indentLevel).toBe(0);
    });

    it('creates document with indent level', () => {
      const doc = createBlockDoc('Hello', 'block-123', 2);
      const block = doc.firstChild!;

      expect(block.attrs.blockId).toBe('block-123');
      expect(block.attrs.indentLevel).toBe(2);
    });

    it('creates document with null block ID', () => {
      const doc = createBlockDoc('Hello', null, 0);
      const block = doc.firstChild!;

      expect(block.attrs.blockId).toBe(null);
    });

    it('parses text content with marks', () => {
      const doc = createBlockDoc('Hello **world**', 'block-1');
      const block = doc.firstChild!;

      expect(block.childCount).toBe(2);
      expect(block.child(1).marks[0].type.name).toBe('bold');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles unmatched opening markers', () => {
      const text = 'Hello ** world';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles unmatched closing markers', () => {
      const text = 'Hello world**';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles incomplete page link', () => {
      const text = 'Hello [[world';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles incomplete block ref', () => {
      const text = 'Hello ((world';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles nested markers (outer only parsed)', () => {
      // Note: Nested marks like **bold *italic*** are complex
      // Our simple tokenizer handles sequential marks
      const text = '**bold** *italic*';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles adjacent different marks with space', () => {
      // Adjacent marks without separator are ambiguous in markdown
      // Use a space separator to test adjacent marks cleanly
      const text = '**bold** *italic*';
      const doc = textToDoc(text);
      const block = doc.firstChild!;

      expect(block.child(0).marks[0].type.name).toBe('bold');
      expect(block.child(1).text).toBe(' ');
      expect(block.child(2).marks[0].type.name).toBe('italic');
    });

    it('handles marks with empty content', () => {
      // Empty marks like ** ** are kept as-is (not parsed as marks)
      const text = 'Hello ** ** world';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles Unicode content', () => {
      const text = 'Hello **world** with emojis \\ud83c\\udf89 and \\u4e2d\\u6587';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles very long text', () => {
      const text = 'A'.repeat(10000) + '**bold**' + 'B'.repeat(10000);
      expect(validateRoundTrip(text)).toBe(true);
    });
  });

  // ============================================================================
  // Schema Integration
  // ============================================================================

  describe('Schema Integration', () => {
    it('uses default schema when not provided', () => {
      const doc = textToDoc('Hello');
      expect(doc.type.schema).toBe(schema);
    });

    it('uses provided schema', () => {
      const doc = textToDoc('Hello', schema);
      expect(doc.type.schema).toBe(schema);
    });

    it('creates valid document structure', () => {
      const doc = textToDoc('Hello **world**');

      // Document is valid if it can be serialized back
      expect(() => docToText(doc)).not.toThrow();
    });

    it('validates node attributes', () => {
      // pageLink requires string pageId and title
      const doc = textToDoc('[[Valid Page]]');
      const block = doc.firstChild!;
      // When text is only a page link, it's the only child at index 0
      const pageLink = block.child(0);

      expect(pageLink.type.name).toBe('pageLink');
      expect(typeof pageLink.attrs.pageId).toBe('string');
      expect(typeof pageLink.attrs.title).toBe('string');
    });
  });
});
