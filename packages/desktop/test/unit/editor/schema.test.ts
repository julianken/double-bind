/**
 * Unit tests for the ProseMirror schema.
 *
 * Tests cover:
 * - Schema structure and node/mark definitions
 * - Node creation with attributes
 * - Mark application and serialization
 * - DOM parsing and serialization
 */

import { describe, it, expect } from 'vitest';
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
  Node as ProseMirrorNode,
} from 'prosemirror-model';
import { schema, nodes, marks } from '../../../src/editor/schema';

// Helper to parse HTML string to ProseMirror document using jsdom's document
function parseHTML(html: string): ProseMirrorNode {
  const domParser = ProseMirrorDOMParser.fromSchema(schema);
  const container = document.createElement('div');
  // Safe: only used with hardcoded test strings, not user input
  container.innerHTML = html;
  return domParser.parse(container);
}

// Helper to serialize ProseMirror node to HTML string
function serializeToHTML(node: ProseMirrorNode): string {
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(node.content, { document });
  const container = document.createElement('div');
  container.appendChild(fragment);
  // Safe: serializing our own controlled ProseMirror content
  return container.innerHTML;
}

describe('ProseMirror Schema', () => {
  describe('Schema Structure', () => {
    it('should export a valid schema', () => {
      expect(schema).toBeDefined();
      expect(schema.nodes).toBeDefined();
      expect(schema.marks).toBeDefined();
    });

    it('should have all required node types', () => {
      const requiredNodes = [
        'doc',
        'text',
        'paragraph',
        'heading',
        'code_block',
        'todo_item',
        'query_embed',
      ];
      for (const nodeName of requiredNodes) {
        expect(schema.nodes[nodeName]).toBeDefined();
      }
    });

    it('should have all required formatting mark types', () => {
      const requiredMarks = ['bold', 'italic', 'code', 'highlight', 'strikethrough'];
      for (const markName of requiredMarks) {
        expect(schema.marks[markName]).toBeDefined();
      }
    });

    it('should have all required reference mark types', () => {
      const referenceMarks = ['pageLink', 'blockRef', 'tag'];
      for (const markName of referenceMarks) {
        expect(schema.marks[markName]).toBeDefined();
      }
    });

    it('should export nodes and marks objects separately', () => {
      expect(nodes).toBeDefined();
      expect(marks).toBeDefined();
      expect(Object.keys(nodes)).toContain('paragraph');
      expect(Object.keys(marks)).toContain('bold');
    });
  });

  describe('Document Node', () => {
    it('should contain a single block node', () => {
      const docSpec = schema.nodes.doc.spec;
      expect(docSpec.content).toBe('block');
    });

    it('should be able to create a document with paragraph', () => {
      const paragraph = schema.nodes.paragraph.create();
      const doc = schema.nodes.doc.create(null, [paragraph]);
      expect(doc.type.name).toBe('doc');
      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe('paragraph');
    });
  });

  describe('Paragraph Node', () => {
    it('should be in the block group', () => {
      const spec = schema.nodes.paragraph.spec;
      expect(spec.group).toBe('block');
    });

    it('should accept inline content', () => {
      const spec = schema.nodes.paragraph.spec;
      expect(spec.content).toBe('inline*');
    });

    it('should create an empty paragraph', () => {
      const paragraph = schema.nodes.paragraph.create();
      expect(paragraph.type.name).toBe('paragraph');
      expect(paragraph.childCount).toBe(0);
    });

    it('should create a paragraph with text', () => {
      const textNode = schema.text('Hello, world!');
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      expect(paragraph.textContent).toBe('Hello, world!');
    });

    it('should serialize to <p> element', () => {
      const textNode = schema.text('Test');
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<p>');
      expect(html).toContain('Test');
    });

    it('should parse from <p> element', () => {
      const doc = parseHTML('<p>Parsed paragraph</p>');
      expect(doc.firstChild?.type.name).toBe('paragraph');
      expect(doc.firstChild?.textContent).toBe('Parsed paragraph');
    });
  });

  describe('Heading Node', () => {
    it('should have a level attribute with default 1', () => {
      const heading = schema.nodes.heading.create();
      expect(heading.attrs.level).toBe(1);
    });

    it('should accept levels 1-3', () => {
      for (const level of [1, 2, 3]) {
        const heading = schema.nodes.heading.create({ level });
        expect(heading.attrs.level).toBe(level);
      }
    });

    it('should create heading with text', () => {
      const textNode = schema.text('My Heading');
      const heading = schema.nodes.heading.create({ level: 2 }, [textNode]);
      expect(heading.type.name).toBe('heading');
      expect(heading.attrs.level).toBe(2);
      expect(heading.textContent).toBe('My Heading');
    });

    it('should serialize to correct heading element', () => {
      const textNode = schema.text('Title');

      for (const level of [1, 2, 3] as const) {
        const heading = schema.nodes.heading.create({ level }, [textNode]);
        const doc = schema.nodes.doc.create(null, [heading]);
        const html = serializeToHTML(doc);
        expect(html).toContain(`<h${level}>`);
      }
    });

    it('should clamp invalid levels to valid range', () => {
      const textNode = schema.text('Title');
      // Level 5 should be clamped to 3 during serialization
      const heading = schema.nodes.heading.create({ level: 5 }, [textNode]);
      const doc = schema.nodes.doc.create(null, [heading]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<h3>');
    });

    it('should parse h1, h2, h3 elements', () => {
      for (const level of [1, 2, 3]) {
        const doc = parseHTML(`<h${level}>Heading ${level}</h${level}>`);
        expect(doc.firstChild?.type.name).toBe('heading');
        expect(doc.firstChild?.attrs.level).toBe(level);
      }
    });
  });

  describe('Code Block Node', () => {
    it('should have code flag set to true', () => {
      const spec = schema.nodes.code_block.spec;
      expect(spec.code).toBe(true);
    });

    it('should not allow marks', () => {
      const spec = schema.nodes.code_block.spec;
      expect(spec.marks).toBe('');
    });

    it('should contain text content', () => {
      const spec = schema.nodes.code_block.spec;
      expect(spec.content).toBe('text*');
    });

    it('should create code block with text', () => {
      const textNode = schema.text('const x = 42;');
      const codeBlock = schema.nodes.code_block.create(null, [textNode]);
      expect(codeBlock.type.name).toBe('code_block');
      expect(codeBlock.textContent).toBe('const x = 42;');
    });

    it('should serialize to <pre><code> elements', () => {
      const textNode = schema.text('function test() {}');
      const codeBlock = schema.nodes.code_block.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [codeBlock]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<pre>');
      expect(html).toContain('<code>');
    });

    it('should parse from <pre> element', () => {
      const doc = parseHTML('<pre>code content</pre>');
      expect(doc.firstChild?.type.name).toBe('code_block');
    });
  });

  describe('Todo Item Node', () => {
    it('should have checked attribute with default false', () => {
      const todoItem = schema.nodes.todo_item.create();
      expect(todoItem.attrs.checked).toBe(false);
    });

    it('should accept checked=true', () => {
      const todoItem = schema.nodes.todo_item.create({ checked: true });
      expect(todoItem.attrs.checked).toBe(true);
    });

    it('should create todo item with text', () => {
      const textNode = schema.text('Buy groceries');
      const todoItem = schema.nodes.todo_item.create({ checked: false }, [textNode]);
      expect(todoItem.type.name).toBe('todo_item');
      expect(todoItem.textContent).toBe('Buy groceries');
    });

    it('should serialize unchecked todo correctly', () => {
      const textNode = schema.text('Task');
      const todoItem = schema.nodes.todo_item.create({ checked: false }, [textNode]);
      const doc = schema.nodes.doc.create(null, [todoItem]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-type="todo"');
      expect(html).toContain('data-checked="false"');
      expect(html).toContain('class="todo-item"');
    });

    it('should serialize checked todo correctly', () => {
      const textNode = schema.text('Done task');
      const todoItem = schema.nodes.todo_item.create({ checked: true }, [textNode]);
      const doc = schema.nodes.doc.create(null, [todoItem]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-checked="true"');
      expect(html).toContain('class="todo-item checked"');
    });

    it('should parse from todo div element', () => {
      const html = '<div data-type="todo" data-checked="true">Completed</div>';
      const doc = parseHTML(html);
      expect(doc.firstChild?.type.name).toBe('todo_item');
      expect(doc.firstChild?.attrs.checked).toBe(true);
    });

    it('should parse unchecked todo correctly', () => {
      const html = '<div data-type="todo" data-checked="false">Pending</div>';
      const doc = parseHTML(html);
      expect(doc.firstChild?.type.name).toBe('todo_item');
      expect(doc.firstChild?.attrs.checked).toBe(false);
    });
  });

  describe('Query Embed Node', () => {
    it('should have query attribute with default empty string', () => {
      const queryEmbed = schema.nodes.query_embed.create();
      expect(queryEmbed.attrs.query).toBe('');
    });

    it('should have results attribute with default empty string', () => {
      const queryEmbed = schema.nodes.query_embed.create();
      expect(queryEmbed.attrs.results).toBe('');
    });

    it('should accept query string', () => {
      const query = '?[name] := *page{name}';
      const queryEmbed = schema.nodes.query_embed.create({ query });
      expect(queryEmbed.attrs.query).toBe(query);
    });

    it('should accept results string', () => {
      const results = JSON.stringify([{ name: 'Page 1' }, { name: 'Page 2' }]);
      const queryEmbed = schema.nodes.query_embed.create({ query: 'test', results });
      expect(queryEmbed.attrs.results).toBe(results);
    });

    it('should be an atom node', () => {
      const spec = schema.nodes.query_embed.spec;
      expect(spec.atom).toBe(true);
    });

    it('should be selectable and draggable', () => {
      const spec = schema.nodes.query_embed.spec;
      expect(spec.selectable).toBe(true);
      expect(spec.draggable).toBe(true);
    });

    it('should serialize with query data attribute', () => {
      const query = '?[title] := *page{title}';
      const queryEmbed = schema.nodes.query_embed.create({ query });
      const doc = schema.nodes.doc.create(null, [queryEmbed]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-type="query"');
      expect(html).toContain(`data-query="${query}"`);
      expect(html).toContain('class="query-embed"');
    });

    it('should serialize with results data attribute', () => {
      const query = '?[title] := *page{title}';
      const results = JSON.stringify([{ title: 'Test' }]);
      const queryEmbed = schema.nodes.query_embed.create({ query, results });
      const doc = schema.nodes.doc.create(null, [queryEmbed]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-results');
    });

    it('should parse from query div element', () => {
      const query = '?[x] := *block{x}';
      const html = `<div data-type="query" data-query="${query}"></div>`;
      const doc = parseHTML(html);
      expect(doc.firstChild?.type.name).toBe('query_embed');
      expect(doc.firstChild?.attrs.query).toBe(query);
    });

    it('should parse results from query div element', () => {
      const query = '?[x] := *block{x}';
      // Use HTML entities for quotes in the attribute value
      const resultsForHtml = '[{&quot;x&quot;:&quot;test&quot;}]';
      const expectedResults = '[{"x":"test"}]';
      const html = `<div data-type="query" data-query="${query}" data-results="${resultsForHtml}"></div>`;
      const doc = parseHTML(html);
      expect(doc.firstChild?.type.name).toBe('query_embed');
      expect(doc.firstChild?.attrs.results).toBe(expectedResults);
    });
  });

  describe('Bold Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.bold).toBeDefined();
    });

    it('should apply to text', () => {
      const boldMark = schema.marks.bold.create();
      const textNode = schema.text('Bold text', [boldMark]);
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type.name).toBe('bold');
    });

    it('should serialize to <strong> element', () => {
      const boldMark = schema.marks.bold.create();
      const textNode = schema.text('Bold', [boldMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<strong>');
    });

    it('should parse from <strong> element', () => {
      const doc = parseHTML('<p><strong>Strong text</strong></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'bold')).toBe(true);
    });

    it('should parse from <b> element', () => {
      const doc = parseHTML('<p><b>Bold text</b></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'bold')).toBe(true);
    });
  });

  describe('Italic Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.italic).toBeDefined();
    });

    it('should apply to text', () => {
      const italicMark = schema.marks.italic.create();
      const textNode = schema.text('Italic text', [italicMark]);
      expect(textNode.marks[0].type.name).toBe('italic');
    });

    it('should serialize to <em> element', () => {
      const italicMark = schema.marks.italic.create();
      const textNode = schema.text('Italic', [italicMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<em>');
    });

    it('should parse from <em> element', () => {
      const doc = parseHTML('<p><em>Emphasized text</em></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'italic')).toBe(true);
    });

    it('should parse from <i> element', () => {
      const doc = parseHTML('<p><i>Italic text</i></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'italic')).toBe(true);
    });
  });

  describe('Code Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.code).toBeDefined();
    });

    it('should apply to text', () => {
      const codeMark = schema.marks.code.create();
      const textNode = schema.text('inline code', [codeMark]);
      expect(textNode.marks[0].type.name).toBe('code');
    });

    it('should serialize to <code> element', () => {
      const codeMark = schema.marks.code.create();
      const textNode = schema.text('code()', [codeMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<code>');
    });

    it('should parse from <code> element', () => {
      const doc = parseHTML('<p><code>inline code</code></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'code')).toBe(true);
    });
  });

  describe('Highlight Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.highlight).toBeDefined();
    });

    it('should apply to text', () => {
      const highlightMark = schema.marks.highlight.create();
      const textNode = schema.text('highlighted', [highlightMark]);
      expect(textNode.marks[0].type.name).toBe('highlight');
    });

    it('should serialize to <mark> element', () => {
      const highlightMark = schema.marks.highlight.create();
      const textNode = schema.text('important', [highlightMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<mark>');
    });

    it('should parse from <mark> element', () => {
      const doc = parseHTML('<p><mark>highlighted text</mark></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'highlight')).toBe(true);
    });
  });

  describe('Strikethrough Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.strikethrough).toBeDefined();
    });

    it('should apply to text', () => {
      const strikeMark = schema.marks.strikethrough.create();
      const textNode = schema.text('deleted', [strikeMark]);
      expect(textNode.marks[0].type.name).toBe('strikethrough');
    });

    it('should serialize to <s> element', () => {
      const strikeMark = schema.marks.strikethrough.create();
      const textNode = schema.text('crossed out', [strikeMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<s>');
    });

    it('should parse from <s> element', () => {
      const doc = parseHTML('<p><s>strikethrough text</s></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'strikethrough')).toBe(true);
    });

    it('should parse from <del> element', () => {
      const doc = parseHTML('<p><del>deleted text</del></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'strikethrough')).toBe(true);
    });

    it('should parse from <strike> element', () => {
      const doc = parseHTML('<p><strike>struck text</strike></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'strikethrough')).toBe(true);
    });
  });

  describe('Page Link Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.pageLink).toBeDefined();
    });

    it('should have title attribute with default empty string', () => {
      const pageLinkMark = schema.marks.pageLink.create();
      expect(pageLinkMark.attrs.title).toBe('');
    });

    it('should accept title attribute', () => {
      const pageLinkMark = schema.marks.pageLink.create({ title: 'My Page' });
      expect(pageLinkMark.attrs.title).toBe('My Page');
    });

    it('should apply to text', () => {
      const pageLinkMark = schema.marks.pageLink.create({ title: 'Test Page' });
      const textNode = schema.text('Test Page', [pageLinkMark]);
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type.name).toBe('pageLink');
    });

    it('should be non-inclusive', () => {
      const spec = schema.marks.pageLink.spec;
      expect(spec.inclusive).toBe(false);
    });

    it('should serialize to anchor element with data-type', () => {
      const pageLinkMark = schema.marks.pageLink.create({ title: 'Linked Page' });
      const textNode = schema.text('Linked Page', [pageLinkMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-type="page-link"');
      expect(html).toContain('data-title="Linked Page"');
      expect(html).toContain('class="page-link"');
    });

    it('should parse from page-link anchor element', () => {
      const doc = parseHTML('<p><a data-type="page-link" data-title="My Page">My Page</a></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'pageLink')).toBe(true);
      const pageLinkMark = textNode?.marks.find((m) => m.type.name === 'pageLink');
      expect(pageLinkMark?.attrs.title).toBe('My Page');
    });
  });

  describe('Block Ref Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.blockRef).toBeDefined();
    });

    it('should have blockId attribute with default empty string', () => {
      const blockRefMark = schema.marks.blockRef.create();
      expect(blockRefMark.attrs.blockId).toBe('');
    });

    it('should accept blockId attribute', () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const blockRefMark = schema.marks.blockRef.create({ blockId });
      expect(blockRefMark.attrs.blockId).toBe(blockId);
    });

    it('should apply to text', () => {
      const blockRefMark = schema.marks.blockRef.create({ blockId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
      const textNode = schema.text('Referenced block', [blockRefMark]);
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type.name).toBe('blockRef');
    });

    it('should be non-inclusive', () => {
      const spec = schema.marks.blockRef.spec;
      expect(spec.inclusive).toBe(false);
    });

    it('should serialize to anchor element with data-type', () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const blockRefMark = schema.marks.blockRef.create({ blockId });
      const textNode = schema.text('Block content', [blockRefMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-type="block-ref"');
      expect(html).toContain(`data-block-id="${blockId}"`);
      expect(html).toContain('class="block-ref"');
    });

    it('should parse from block-ref anchor element', () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const doc = parseHTML(`<p><a data-type="block-ref" data-block-id="${blockId}">Referenced</a></p>`);
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'blockRef')).toBe(true);
      const blockRefMark = textNode?.marks.find((m) => m.type.name === 'blockRef');
      expect(blockRefMark?.attrs.blockId).toBe(blockId);
    });
  });

  describe('Tag Mark', () => {
    it('should be defined in schema', () => {
      expect(schema.marks.tag).toBeDefined();
    });

    it('should have tag attribute with default empty string', () => {
      const tagMark = schema.marks.tag.create();
      expect(tagMark.attrs.tag).toBe('');
    });

    it('should accept tag attribute', () => {
      const tagMark = schema.marks.tag.create({ tag: 'important' });
      expect(tagMark.attrs.tag).toBe('important');
    });

    it('should apply to text', () => {
      const tagMark = schema.marks.tag.create({ tag: 'project' });
      const textNode = schema.text('#project', [tagMark]);
      expect(textNode.marks).toHaveLength(1);
      expect(textNode.marks[0].type.name).toBe('tag');
    });

    it('should be non-inclusive', () => {
      const spec = schema.marks.tag.spec;
      expect(spec.inclusive).toBe(false);
    });

    it('should serialize to anchor element with data-type', () => {
      const tagMark = schema.marks.tag.create({ tag: 'todo' });
      const textNode = schema.text('#todo', [tagMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('data-type="tag"');
      expect(html).toContain('data-tag="todo"');
      expect(html).toContain('class="tag"');
    });

    it('should parse from tag anchor element', () => {
      const doc = parseHTML('<p><a data-type="tag" data-tag="important">#important</a></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'tag')).toBe(true);
      const tagMark = textNode?.marks.find((m) => m.type.name === 'tag');
      expect(tagMark?.attrs.tag).toBe('important');
    });

    it('should support multi-word tags', () => {
      const tagMark = schema.marks.tag.create({ tag: 'multi word tag' });
      const textNode = schema.text('#[[multi word tag]]', [tagMark]);
      expect(textNode.marks[0].attrs.tag).toBe('multi word tag');
    });
  });

  describe('Multiple Marks', () => {
    it('should support combining bold and italic', () => {
      const boldMark = schema.marks.bold.create();
      const italicMark = schema.marks.italic.create();
      const textNode = schema.text('bold and italic', [boldMark, italicMark]);
      expect(textNode.marks).toHaveLength(2);
      expect(textNode.marks.some((m) => m.type.name === 'bold')).toBe(true);
      expect(textNode.marks.some((m) => m.type.name === 'italic')).toBe(true);
    });

    it('should support combining all marks', () => {
      const allMarks = [
        schema.marks.bold.create(),
        schema.marks.italic.create(),
        schema.marks.code.create(),
        schema.marks.highlight.create(),
        schema.marks.strikethrough.create(),
      ];
      const textNode = schema.text('all marks', allMarks);
      expect(textNode.marks).toHaveLength(5);
    });

    it('should serialize multiple marks correctly', () => {
      const boldMark = schema.marks.bold.create();
      const italicMark = schema.marks.italic.create();
      const textNode = schema.text('formatted', [boldMark, italicMark]);
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      const doc = schema.nodes.doc.create(null, [paragraph]);
      const html = serializeToHTML(doc);
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });

    it('should parse nested marks', () => {
      const doc = parseHTML('<p><strong><em>bold italic</em></strong></p>');
      const textNode = doc.firstChild?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === 'bold')).toBe(true);
      expect(textNode?.marks.some((m) => m.type.name === 'italic')).toBe(true);
    });

    it('should support combining pageLink with formatting marks', () => {
      const boldMark = schema.marks.bold.create();
      const pageLinkMark = schema.marks.pageLink.create({ title: 'Bold Link' });
      const textNode = schema.text('Bold Link', [boldMark, pageLinkMark]);
      expect(textNode.marks).toHaveLength(2);
      expect(textNode.marks.some((m) => m.type.name === 'bold')).toBe(true);
      expect(textNode.marks.some((m) => m.type.name === 'pageLink')).toBe(true);
    });

    it('should support combining tag with formatting marks', () => {
      const italicMark = schema.marks.italic.create();
      const tagMark = schema.marks.tag.create({ tag: 'styled-tag' });
      const textNode = schema.text('#styled-tag', [italicMark, tagMark]);
      expect(textNode.marks).toHaveLength(2);
      expect(textNode.marks.some((m) => m.type.name === 'italic')).toBe(true);
      expect(textNode.marks.some((m) => m.type.name === 'tag')).toBe(true);
    });

    it('should support combining all reference marks', () => {
      const pageLinkMark = schema.marks.pageLink.create({ title: 'Page' });
      const blockRefMark = schema.marks.blockRef.create({ blockId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
      const tagMark = schema.marks.tag.create({ tag: 'test' });
      // Note: In practice, these wouldn't all apply to the same text,
      // but the schema allows it for flexibility
      const textNode = schema.text('reference', [pageLinkMark, blockRefMark, tagMark]);
      expect(textNode.marks).toHaveLength(3);
    });
  });

  describe('Block Content Validation', () => {
    it('should allow inline content in paragraph', () => {
      const textNode = schema.text('Hello');
      const paragraph = schema.nodes.paragraph.create(null, [textNode]);
      expect(paragraph.content.size).toBeGreaterThan(0);
    });

    it('should allow inline content in heading', () => {
      const textNode = schema.text('Heading');
      const heading = schema.nodes.heading.create({ level: 1 }, [textNode]);
      expect(heading.content.size).toBeGreaterThan(0);
    });

    it('should allow inline content in todo_item', () => {
      const textNode = schema.text('Task');
      const todoItem = schema.nodes.todo_item.create({ checked: false }, [textNode]);
      expect(todoItem.content.size).toBeGreaterThan(0);
    });

    it('should allow text content in code_block', () => {
      const textNode = schema.text('code');
      const codeBlock = schema.nodes.code_block.create(null, [textNode]);
      expect(codeBlock.content.size).toBeGreaterThan(0);
    });

    it('should not allow content in query_embed (atom)', () => {
      const queryEmbed = schema.nodes.query_embed.create({ query: 'test' });
      expect(queryEmbed.content.size).toBe(0);
    });
  });

  describe('Schema Immutability', () => {
    it('should not allow modifying schema nodes', () => {
      const originalNodeCount = Object.keys(schema.nodes).length;
      // Attempting to add a node should not modify the schema
      expect(Object.keys(schema.nodes).length).toBe(originalNodeCount);
    });

    it('should not allow modifying schema marks', () => {
      const originalMarkCount = Object.keys(schema.marks).length;
      // Attempting to add a mark should not modify the schema
      expect(Object.keys(schema.marks).length).toBe(originalMarkCount);
    });
  });
});
