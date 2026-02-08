/**
 * Unit tests for the highlight-references ProseMirror plugin.
 *
 * Tests decoration creation for [[page links]], ((block refs)), and #tags,
 * as well as the mark-skip logic that prevents double-highlighting.
 */

import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';
import {
  highlightReferencesPlugin,
  highlightReferencesPluginKey,
  buildDecorations,
} from '../../../../src/editor/plugins/highlight-references.js';

// ============================================================================
// Test Schema
// ============================================================================

/**
 * Create a schema with reference marks matching the production schema.
 */
function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        parseDOM: [{ tag: 'p' }],
        toDOM() {
          return ['p', 0];
        },
      },
      text: { group: 'inline' },
    },
    marks: {
      pageLink: {
        attrs: { pageId: { default: '' }, title: { default: '' } },
        inclusive: false,
        toDOM() {
          return ['a', { class: 'page-link' }, 0];
        },
      },
      blockRef: {
        attrs: { blockId: { default: '' } },
        inclusive: false,
        toDOM() {
          return ['a', { class: 'block-ref' }, 0];
        },
      },
      tag: {
        attrs: { tag: { default: '' } },
        inclusive: false,
        toDOM() {
          return ['a', { class: 'tag' }, 0];
        },
      },
    },
  });
}

/**
 * Create a minimal schema without reference marks.
 */
function createPlainSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        parseDOM: [{ tag: 'p' }],
        toDOM() {
          return ['p', 0];
        },
      },
      text: { group: 'inline' },
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a ProseMirror doc with plain text content.
 */
function createDoc(schema: Schema, text: string) {
  const textNode = text ? schema.text(text) : null;
  return schema.node('doc', null, [schema.node('paragraph', null, textNode ? [textNode] : [])]);
}

/**
 * Create a ProseMirror doc with a text node that has a mark applied.
 */
function createDocWithMark(
  schema: Schema,
  text: string,
  markName: string,
  attrs: Record<string, unknown> = {}
) {
  const mark = schema.marks[markName]!.create(attrs);
  const textNode = schema.text(text, [mark]);
  return schema.node('doc', null, [schema.node('paragraph', null, [textNode])]);
}

/**
 * Extract decoration specs from a DecorationSet for testing.
 * Returns an array of { from, to, class } objects.
 */
function getDecorationSpecs(decos: DecorationSet, doc: ReturnType<typeof createDoc>) {
  const results: { from: number; to: number; class: string }[] = [];
  // Find all decorations in the document range
  const found = decos.find(0, doc.content.size);
  for (const deco of found) {
    const spec = deco as unknown as {
      from: number;
      to: number;
      type: { attrs: { class: string } };
    };
    results.push({
      from: spec.from,
      to: spec.to,
      class: spec.type.attrs.class,
    });
  }
  return results;
}

// ============================================================================
// Tests
// ============================================================================

describe('Highlight References Plugin', () => {
  // ==========================================================================
  // Page link decorations
  // ==========================================================================

  describe('page link decorations', () => {
    it('creates decorations for [[page links]]', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, 'See [[My Page]] for details');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(1);
      expect(specs[0]!.class).toBe('highlight-page-link');
      // "See " = 4 chars, so [[My Page]] starts at offset 4 within paragraph
      // paragraph starts at pos 1 (after doc open), so from = 1+4 = 5
      expect(specs[0]!.from).toBe(5);
      // [[My Page]] = 11 chars, so to = 5 + 11 = 16
      expect(specs[0]!.to).toBe(16);
    });

    it('creates decorations for multiple page links', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, '[[Page A]] and [[Page B]]');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(2);
      expect(specs[0]!.class).toBe('highlight-page-link');
      expect(specs[1]!.class).toBe('highlight-page-link');
    });

    it('does not match #[[tag]] as a page link', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, '#[[multi word tag]]');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      // Should find a tag decoration, not a page link decoration
      const pageLinkDecos = specs.filter((s) => s.class === 'highlight-page-link');
      expect(pageLinkDecos).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Block reference decorations
  // ==========================================================================

  describe('block reference decorations', () => {
    it('creates decorations for ((block refs))', () => {
      const schema = createPlainSchema();
      // Valid ULID: 26 Crockford Base32 characters
      const doc = createDoc(schema, 'Ref ((01HXQ5N2C3G4H5J6K7M8N9P0QR))');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(1);
      expect(specs[0]!.class).toBe('highlight-block-ref');
    });

    it('does not match invalid block refs', () => {
      const schema = createPlainSchema();
      // Too short (not 26 chars)
      const doc = createDoc(schema, '((SHORT))');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Tag decorations
  // ==========================================================================

  describe('tag decorations', () => {
    it('creates decorations for simple #tags', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, 'Hello #project world');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(1);
      expect(specs[0]!.class).toBe('highlight-tag');
    });

    it('creates decorations for #[[multi word tags]]', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, 'Hello #[[multi word]] world');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(1);
      expect(specs[0]!.class).toBe('highlight-tag');
    });

    it('creates decorations for tags with hyphens', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, '#my-tag');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(1);
      expect(specs[0]!.class).toBe('highlight-tag');
    });
  });

  // ==========================================================================
  // No references
  // ==========================================================================

  describe('no references', () => {
    it('creates no decorations for plain text', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, 'Just plain text, nothing special.');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(0);
    });

    it('creates no decorations for empty document', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, '');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Decoration caching (doc unchanged)
  // ==========================================================================

  describe('decoration caching', () => {
    it('does not rebuild decorations when doc has not changed', () => {
      const schema = createPlainSchema();
      const plugin = highlightReferencesPlugin();
      const doc = createDoc(schema, '[[My Page]]');

      const state = EditorState.create({ doc, plugins: [plugin] });
      const decos1 = highlightReferencesPluginKey.getState(state);

      // Apply a transaction that does NOT change the doc (e.g., selection only)
      const tr = state.tr; // empty transaction
      const newState = state.apply(tr);
      const decos2 = highlightReferencesPluginKey.getState(newState);

      // Should be the exact same object reference (not rebuilt)
      expect(decos1).toBe(decos2);
    });

    it('rebuilds decorations when doc changes', () => {
      const schema = createPlainSchema();
      const plugin = highlightReferencesPlugin();
      const doc = createDoc(schema, '[[My Page]]');

      const state = EditorState.create({ doc, plugins: [plugin] });
      const decos1 = highlightReferencesPluginKey.getState(state);

      // Apply a transaction that changes the doc
      const tr = state.tr.insertText(' more', 12);
      const newState = state.apply(tr);
      const decos2 = highlightReferencesPluginKey.getState(newState);

      // Should be a different DecorationSet (rebuilt)
      expect(decos1).not.toBe(decos2);
    });
  });

  // ==========================================================================
  // Mark-skip logic (no double-highlighting)
  // ==========================================================================

  describe('mark-skip logic (no double-highlighting)', () => {
    it('does not add page link decoration when pageLink mark exists', () => {
      const schema = createTestSchema();
      const doc = createDocWithMark(schema, '[[My Page]]', 'pageLink', {
        pageId: 'p1',
        title: 'My Page',
      });
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      const pageLinkDecos = specs.filter((s) => s.class === 'highlight-page-link');
      expect(pageLinkDecos).toHaveLength(0);
    });

    it('does not add block ref decoration when blockRef mark exists', () => {
      const schema = createTestSchema();
      const doc = createDocWithMark(schema, '((01HXQ5N2C3G4H5J6K7M8N9P0QR))', 'blockRef', {
        blockId: '01HXQ5N2C3G4H5J6K7M8N9P0QR',
      });
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      const blockRefDecos = specs.filter((s) => s.class === 'highlight-block-ref');
      expect(blockRefDecos).toHaveLength(0);
    });

    it('does not add tag decoration when tag mark exists', () => {
      const schema = createTestSchema();
      const doc = createDocWithMark(schema, '#project', 'tag', { tag: 'project' });
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      const tagDecos = specs.filter((s) => s.class === 'highlight-tag');
      expect(tagDecos).toHaveLength(0);
    });

    it('adds decoration for unmarked text alongside marked text', () => {
      const schema = createTestSchema();
      // Create a doc with two text nodes: one marked, one not
      const mark = schema.marks.pageLink!.create({ pageId: 'p1', title: 'Page A' });
      const markedText = schema.text('[[Page A]]', [mark]);
      const plainText = schema.text(' and [[Page B]]');
      const doc = schema.node('doc', null, [
        schema.node('paragraph', null, [markedText, plainText]),
      ]);

      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      // Should have decoration only for [[Page B]] (the unmarked one)
      const pageLinkDecos = specs.filter((s) => s.class === 'highlight-page-link');
      expect(pageLinkDecos).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Mixed content
  // ==========================================================================

  describe('mixed content', () => {
    it('creates decorations for all reference types in one text', () => {
      const schema = createPlainSchema();
      const doc = createDoc(schema, '[[Page]] with ((01HXQ5N2C3G4H5J6K7M8N9P0QR)) and #tag');
      const decos = buildDecorations(doc);
      const specs = getDecorationSpecs(decos, doc);

      expect(specs).toHaveLength(3);

      const classes = specs.map((s) => s.class);
      expect(classes).toContain('highlight-page-link');
      expect(classes).toContain('highlight-block-ref');
      expect(classes).toContain('highlight-tag');
    });
  });

  // ==========================================================================
  // Plugin integration
  // ==========================================================================

  describe('plugin integration', () => {
    it('plugin provides decorations to EditorState', () => {
      const schema = createPlainSchema();
      const plugin = highlightReferencesPlugin();
      const doc = createDoc(schema, '[[My Page]] and #tag');

      const state = EditorState.create({ doc, plugins: [plugin] });
      const decos = highlightReferencesPluginKey.getState(state);

      expect(decos).toBeInstanceOf(DecorationSet);
      const specs = getDecorationSpecs(decos!, doc);
      expect(specs.length).toBeGreaterThan(0);
    });
  });
});
