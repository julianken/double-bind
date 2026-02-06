/**
 * Unit tests for ProseMirror serialization utilities.
 *
 * Tests cover:
 * - textToDoc: Converting plain text to ProseMirror documents
 * - docToText: Converting ProseMirror documents back to plain text
 * - Round-trip fidelity: Ensuring text is preserved through serialization
 * - Inline marks (bold, italic, code, highlight, strikethrough)
 */

import { describe, it, expect } from 'vitest';
import {
  textToDoc,
  docToText,
  validateRoundTrip,
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
      expect(doc.firstChild?.type.name).toBe('paragraph');
      expect(doc.firstChild?.childCount).toBe(0);
    });

    it('converts plain text to document', () => {
      const doc = textToDoc('Hello world');
      expect(doc.type.name).toBe('doc');
      expect(doc.childCount).toBe(1);

      const paragraph = doc.firstChild!;
      expect(paragraph.type.name).toBe('paragraph');
      expect(paragraph.childCount).toBe(1);
      expect(paragraph.firstChild?.isText).toBe(true);
      expect(paragraph.firstChild?.text).toBe('Hello world');
    });

    it('preserves whitespace', () => {
      const doc = textToDoc('  Hello   world  ');
      const paragraph = doc.firstChild!;
      expect(paragraph.firstChild?.text).toBe('  Hello   world  ');
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
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(2);
      expect(paragraph.child(0).text).toBe('Hello ');
      expect(paragraph.child(0).marks.length).toBe(0);
      expect(paragraph.child(1).text).toBe('world');
      expect(paragraph.child(1).marks[0].type.name).toBe('bold');
    });

    it('parses italic text with *', () => {
      const doc = textToDoc('Hello *world*');
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(2);
      expect(paragraph.child(0).text).toBe('Hello ');
      expect(paragraph.child(1).text).toBe('world');
      expect(paragraph.child(1).marks[0].type.name).toBe('italic');
    });

    it('parses italic text with _', () => {
      const doc = textToDoc('Hello _world_');
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(2);
      expect(paragraph.child(1).text).toBe('world');
      expect(paragraph.child(1).marks[0].type.name).toBe('italic');
    });

    it('parses inline code with `', () => {
      const doc = textToDoc('Use `const` keyword');
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(3);
      expect(paragraph.child(0).text).toBe('Use ');
      expect(paragraph.child(1).text).toBe('const');
      expect(paragraph.child(1).marks[0].type.name).toBe('code');
      expect(paragraph.child(2).text).toBe(' keyword');
    });

    it('parses highlight with ==', () => {
      const doc = textToDoc('This is ==highlighted== text');
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(3);
      expect(paragraph.child(1).text).toBe('highlighted');
      expect(paragraph.child(1).marks[0].type.name).toBe('highlight');
    });

    it('parses strikethrough with ~~', () => {
      const doc = textToDoc('This is ~~deleted~~ text');
      const paragraph = doc.firstChild!;

      expect(paragraph.childCount).toBe(3);
      expect(paragraph.child(1).text).toBe('deleted');
      expect(paragraph.child(1).marks[0].type.name).toBe('strikethrough');
    });

    it('handles multiple different marks', () => {
      const doc = textToDoc('**bold** and *italic* and `code`');
      const paragraph = doc.firstChild!;

      // [0] bold text, [1] " and ", [2] italic text, [3] " and ", [4] code text
      expect(paragraph.childCount).toBe(5);
      expect(paragraph.child(0).marks[0].type.name).toBe('bold');
      expect(paragraph.child(2).marks[0].type.name).toBe('italic');
      expect(paragraph.child(4).marks[0].type.name).toBe('code');
    });

    it('distinguishes bold from italic asterisks', () => {
      const doc = textToDoc('This is **bold** not *italic*');
      const paragraph = doc.firstChild!;

      const boldNode = paragraph.child(1);
      const italicNode = paragraph.child(3);

      expect(boldNode.text).toBe('bold');
      expect(boldNode.marks[0].type.name).toBe('bold');
      expect(italicNode.text).toBe('italic');
      expect(italicNode.marks[0].type.name).toBe('italic');
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

    it('preserves multiple marks of same type', () => {
      const text = '**bold1** and **bold2**';
      expect(validateRoundTrip(text)).toBe(true);
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

    it('handles adjacent different marks with space', () => {
      const text = '**bold** *italic*';
      const doc = textToDoc(text);
      const paragraph = doc.firstChild!;

      expect(paragraph.child(0).marks[0].type.name).toBe('bold');
      expect(paragraph.child(1).text).toBe(' ');
      expect(paragraph.child(2).marks[0].type.name).toBe('italic');
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
  });
});
