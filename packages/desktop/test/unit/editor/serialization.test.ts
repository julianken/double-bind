/**
 * Unit tests for ProseMirror serialization utilities.
 *
 * Tests cover:
 * - textToDoc: Converting plain text to ProseMirror documents
 * - docToText: Converting ProseMirror documents back to plain text
 * - Round-trip fidelity: Ensuring text is preserved through serialization
 * - Inline marks (bold, italic, code, highlight, strikethrough)
 * - Multi-line content with newlines
 * - Reference syntax as plain text ([[links]], ((refs)), #tags)
 * - Edge cases: whitespace, special characters, Unicode
 *
 * @see DBB-190 for acceptance criteria
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
  // Multi-Line Content (Newlines)
  // ============================================================================

  describe('Multi-Line Content', () => {
    it('preserves newline characters in round-trip', () => {
      // Note: textToDoc creates a single paragraph, so newlines become part of text content
      const text = 'Line 1\nLine 2';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles text with multiple newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles text with consecutive newlines', () => {
      const text = 'Before\n\n\nAfter';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });

    it('handles newline at start of text', () => {
      const text = '\nStarting with newline';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles newline at end of text', () => {
      const text = 'Ending with newline\n';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles only newlines', () => {
      const text = '\n\n\n';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles carriage return and newline (CRLF)', () => {
      const text = 'Line 1\r\nLine 2';
      expect(validateRoundTrip(text)).toBe(true);
    });

    it('handles marks across newlines', () => {
      // Bold text containing a newline should preserve both the mark and newline
      const text = '**bold\ntext**';
      const doc = textToDoc(text);
      expect(docToText(doc)).toBe(text);
    });
  });

  // ============================================================================
  // Reference Syntax (Treated as Plain Text)
  // ============================================================================

  describe('Reference Syntax as Plain Text', () => {
    describe('Page Links [[...]]', () => {
      it('preserves [[page link]] syntax as plain text', () => {
        const text = 'Link to [[My Page]]';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves multiple page links', () => {
        const text = '[[Page 1]] and [[Page 2]]';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves page link with special characters', () => {
        const text = 'Check [[My Page: Notes & Ideas]]';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves nested brackets in page link', () => {
        const text = 'See [[Page with [brackets]]]';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves empty page link', () => {
        const text = 'Empty [[]] link';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves page link combined with marks', () => {
        const text = '**bold [[page]]** and *italic [[page]]*';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Block References ((...))', () => {
      it('preserves ((block ref)) syntax as plain text', () => {
        const text = 'Reference ((01ARZ3NDEKTSV4RRFFQ69G5FAV))';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves multiple block references', () => {
        const text = '((ref1)) and ((ref2))';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves block ref with content', () => {
        const text = 'See ((some-block-content))';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves empty block reference', () => {
        const text = 'Empty (()) ref';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves nested parentheses in block ref', () => {
        const text = 'See ((ref (with parens)))';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves block ref combined with marks', () => {
        const text = '`code ((ref))` and **bold ((ref))**';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Tags #...', () => {
      it('preserves #tag syntax as plain text', () => {
        const text = 'Tagged with #important';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves multiple tags', () => {
        const text = '#tag1 #tag2 #tag3';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves multi-word tag #[[...]]', () => {
        const text = 'See #[[multi word tag]]';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves tag with numbers', () => {
        const text = '#tag123 and #123tag';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves tag with hyphens and underscores', () => {
        const text = '#my-tag #my_tag';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves tag combined with marks', () => {
        const text = '**bold #tag** and ==highlighted #tag==';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves standalone hash', () => {
        const text = 'The # symbol alone';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Mixed Reference Syntax', () => {
      it('preserves mixed [[link]], ((ref)), and #tag', () => {
        const text = '[[Page]] with ((ref)) and #tag';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves complex mixed content with marks', () => {
        const text = '**[[Bold Page]]** and *((italic ref))* and `#code-tag`';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves adjacent references', () => {
        const text = '[[Page]]((ref))#tag';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('Additional Edge Cases', () => {
    describe('Whitespace Variations', () => {
      it('preserves tabs', () => {
        const text = 'Hello\tworld';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves mixed whitespace', () => {
        const text = '  \t  spaces and tabs  \t  ';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves non-breaking spaces', () => {
        const text = 'Hello\u00A0world'; // Non-breaking space
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Special Characters', () => {
      it('preserves backslashes', () => {
        const text = 'Path: C:\\Users\\file';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves forward slashes', () => {
        const text = 'Path: /usr/local/bin';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves quotes', () => {
        const text = 'She said "Hello" and \'Goodbye\'';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves mathematical symbols', () => {
        const text = 'Formula: a + b = c * d / e';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves currency symbols', () => {
        const text = 'Prices: $100, \u20AC200, \u00A3300';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves punctuation', () => {
        const text = 'Sentence! Question? Comma, period.';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves angle brackets', () => {
        const text = '<tag> and </tag>';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves ampersand', () => {
        const text = 'Tom & Jerry';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Unicode Content', () => {
      it('preserves actual emoji characters', () => {
        const text = 'Party \uD83C\uDF89 time!';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves Chinese characters', () => {
        const text = '\u4E2D\u6587\u6D4B\u8BD5';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves Japanese characters', () => {
        const text = '\u3053\u3093\u306B\u3061\u306F';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves Arabic characters', () => {
        const text = '\u0645\u0631\u062D\u0628\u0627';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves combined emoji sequences', () => {
        const text = '\uD83D\uDC68\u200D\uD83D\uDCBB Developer';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves accented characters', () => {
        const text = 'caf\u00E9 na\u00EFve r\u00E9sum\u00E9';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves mixed scripts', () => {
        const text = 'Hello \u4E16\u754C \u03BA\u03CC\u03C3\u03BC\u03BF\u03C2';
        expect(validateRoundTrip(text)).toBe(true);
      });
    });

    describe('Mark Edge Cases', () => {
      it('preserves mark at start of text', () => {
        const text = '**bold** at start';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves mark at end of text', () => {
        const text = 'End with **bold**';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves only marked text', () => {
        const text = '**only bold**';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves consecutive marks without space', () => {
        // Note: This tests that **bold**`code` works correctly
        const text = '**bold**`code`';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves marks with punctuation inside', () => {
        const text = '**bold, text!** and *italic: words*';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves marks with numbers', () => {
        const text = '**123** and *456*';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('preserves single character in mark', () => {
        const text = '**a** *b* `c`';
        expect(validateRoundTrip(text)).toBe(true);
      });

      it('parses underscores as italic even mid-word', () => {
        // Current behavior: _case_ is parsed as italic even in snake_case_variable
        // This documents the actual serialization behavior
        const text = 'snake_case_variable';
        const doc = textToDoc(text);
        // The regex matches _case_ as italic, resulting in different serialization
        expect(docToText(doc)).toBe('snake*case*variable');
      });
    });

    describe('Marker Character Escaping', () => {
      it('preserves asterisks that do not form marks', () => {
        const text = 'Math: 2 * 3 = 6';
        const doc = textToDoc(text);
        expect(docToText(doc)).toBe(text);
      });

      it('preserves backticks that do not form marks', () => {
        const text = 'Quote: `incomplete';
        const doc = textToDoc(text);
        expect(docToText(doc)).toBe(text);
      });

      it('preserves tildes that do not form marks', () => {
        const text = 'Home directory: ~/projects';
        const doc = textToDoc(text);
        expect(docToText(doc)).toBe(text);
      });

      it('preserves equals that do not form marks', () => {
        const text = 'Equation: a = b';
        const doc = textToDoc(text);
        expect(docToText(doc)).toBe(text);
      });
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
