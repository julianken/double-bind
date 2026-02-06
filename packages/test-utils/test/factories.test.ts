import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPage,
  createBlock,
  createLink,
  createBlockRef,
  createTag,
  createProperty,
  createPageWithId,
  createBlockWithId,
  createPageWithBlocks,
  createLinkedPages,
} from '../src/factories';

describe('factories', () => {
  describe('createPage', () => {
    it('creates a page with default values', () => {
      const page = createPage();

      expect(page.pageId).toBe('page-placeholder');
      expect(page.title).toBe('Test Page');
      expect(page.isDeleted).toBe(false);
      expect(page.dailyNoteDate).toBeNull();
      expect(typeof page.createdAt).toBe('number');
      expect(typeof page.updatedAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const page = createPage({
        title: 'Custom Title',
        isDeleted: true,
      });

      expect(page.title).toBe('Custom Title');
      expect(page.isDeleted).toBe(true);
      // Non-overridden fields keep defaults
      expect(page.pageId).toBe('page-placeholder');
      expect(page.dailyNoteDate).toBeNull();
    });

    it('allows overriding all fields', () => {
      const customPage = createPage({
        pageId: 'custom-id',
        title: 'Full Override',
        createdAt: 1000,
        updatedAt: 2000,
        isDeleted: true,
        dailyNoteDate: '2024-01-15',
      });

      expect(customPage.pageId).toBe('custom-id');
      expect(customPage.title).toBe('Full Override');
      expect(customPage.createdAt).toBe(1000);
      expect(customPage.updatedAt).toBe(2000);
      expect(customPage.isDeleted).toBe(true);
      expect(customPage.dailyNoteDate).toBe('2024-01-15');
    });
  });

  describe('createBlock', () => {
    it('creates a block with default values', () => {
      const block = createBlock();

      expect(block.blockId).toBe('block-placeholder');
      expect(block.pageId).toBe('page-placeholder');
      expect(block.parentId).toBeNull();
      expect(block.content).toBe('');
      expect(block.contentType).toBe('text');
      expect(block.order).toBe('a0');
      expect(block.isCollapsed).toBe(false);
      expect(block.isDeleted).toBe(false);
      expect(typeof block.createdAt).toBe('number');
      expect(typeof block.updatedAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const block = createBlock({
        content: 'Hello world',
        contentType: 'heading',
        isCollapsed: true,
      });

      expect(block.content).toBe('Hello world');
      expect(block.contentType).toBe('heading');
      expect(block.isCollapsed).toBe(true);
      // Non-overridden fields keep defaults
      expect(block.blockId).toBe('block-placeholder');
      expect(block.order).toBe('a0');
    });

    it('supports all content types', () => {
      const contentTypes = ['text', 'heading', 'code', 'todo', 'query'] as const;

      for (const contentType of contentTypes) {
        const block = createBlock({ contentType });
        expect(block.contentType).toBe(contentType);
      }
    });
  });

  describe('createLink', () => {
    it('creates a link with default values', () => {
      const link = createLink();

      expect(link.sourceId).toBe('page-source-placeholder');
      expect(link.targetId).toBe('page-target-placeholder');
      expect(link.linkType).toBe('reference');
      expect(link.contextBlockId).toBeNull();
      expect(typeof link.createdAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const link = createLink({
        sourceId: 'page-a',
        targetId: 'page-b',
        linkType: 'embed',
        contextBlockId: 'block-1',
      });

      expect(link.sourceId).toBe('page-a');
      expect(link.targetId).toBe('page-b');
      expect(link.linkType).toBe('embed');
      expect(link.contextBlockId).toBe('block-1');
    });

    it('supports all link types', () => {
      const linkTypes = ['reference', 'embed', 'tag'] as const;

      for (const linkType of linkTypes) {
        const link = createLink({ linkType });
        expect(link.linkType).toBe(linkType);
      }
    });
  });

  describe('createBlockRef', () => {
    it('creates a block ref with default values', () => {
      const ref = createBlockRef();

      expect(ref.sourceBlockId).toBe('block-source-placeholder');
      expect(ref.targetBlockId).toBe('block-target-placeholder');
      expect(typeof ref.createdAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const ref = createBlockRef({
        sourceBlockId: 'block-a',
        targetBlockId: 'block-b',
      });

      expect(ref.sourceBlockId).toBe('block-a');
      expect(ref.targetBlockId).toBe('block-b');
    });
  });

  describe('createTag', () => {
    it('creates a tag with default values', () => {
      const tag = createTag();

      expect(tag.entityId).toBe('entity-placeholder');
      expect(tag.tag).toBe('test-tag');
      expect(typeof tag.createdAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const tag = createTag({
        entityId: 'page-123',
        tag: 'important',
      });

      expect(tag.entityId).toBe('page-123');
      expect(tag.tag).toBe('important');
    });
  });

  describe('createProperty', () => {
    it('creates a property with default values', () => {
      const prop = createProperty();

      expect(prop.entityId).toBe('entity-placeholder');
      expect(prop.key).toBe('test-key');
      expect(prop.value).toBe('test-value');
      expect(prop.valueType).toBe('string');
      expect(typeof prop.updatedAt).toBe('number');
    });

    it('allows overriding specific fields', () => {
      const prop = createProperty({
        entityId: 'block-456',
        key: 'status',
        value: 'done',
        valueType: 'string',
      });

      expect(prop.entityId).toBe('block-456');
      expect(prop.key).toBe('status');
      expect(prop.value).toBe('done');
    });

    it('supports all value types', () => {
      const valueTypes = ['string', 'number', 'boolean', 'date'] as const;

      for (const valueType of valueTypes) {
        const prop = createProperty({ valueType });
        expect(prop.valueType).toBe(valueType);
      }
    });
  });

  describe('createPageWithId', () => {
    it('creates a page with a valid ULID', () => {
      const page = createPageWithId();

      // ULID is 26 characters, alphanumeric
      expect(page.pageId).toMatch(/^[0-9A-Z]{26}$/);
      expect(page.title).toBe('Test Page');
    });

    it('generates unique IDs on each call', () => {
      const page1 = createPageWithId();
      const page2 = createPageWithId();
      const page3 = createPageWithId();

      expect(page1.pageId).not.toBe(page2.pageId);
      expect(page2.pageId).not.toBe(page3.pageId);
      expect(page1.pageId).not.toBe(page3.pageId);
    });

    it('allows overriding fields while keeping generated ID', () => {
      const page = createPageWithId({
        title: 'Custom Title',
      });

      expect(page.pageId).toMatch(/^[0-9A-Z]{26}$/);
      expect(page.title).toBe('Custom Title');
    });

    it('allows overriding the generated ID', () => {
      const page = createPageWithId({
        pageId: 'custom-override',
      });

      expect(page.pageId).toBe('custom-override');
    });
  });

  describe('createBlockWithId', () => {
    it('creates a block with a valid ULID', () => {
      const block = createBlockWithId();

      expect(block.blockId).toMatch(/^[0-9A-Z]{26}$/);
      expect(block.pageId).toBe('page-placeholder');
    });

    it('generates unique IDs on each call', () => {
      const block1 = createBlockWithId();
      const block2 = createBlockWithId();

      expect(block1.blockId).not.toBe(block2.blockId);
    });

    it('allows linking to a specific page', () => {
      const block = createBlockWithId({
        pageId: 'my-page-id',
        content: 'Hello',
      });

      expect(block.blockId).toMatch(/^[0-9A-Z]{26}$/);
      expect(block.pageId).toBe('my-page-id');
      expect(block.content).toBe('Hello');
    });
  });

  describe('createPageWithBlocks', () => {
    it('creates a page with the specified number of blocks', () => {
      const { page, blocks } = createPageWithBlocks(5);

      expect(page.pageId).toMatch(/^[0-9A-Z]{26}$/);
      expect(blocks).toHaveLength(5);
    });

    it('all blocks reference the created page', () => {
      const { page, blocks } = createPageWithBlocks(3);

      for (const block of blocks) {
        expect(block.pageId).toBe(page.pageId);
      }
    });

    it('all blocks have unique IDs', () => {
      const { blocks } = createPageWithBlocks(10);
      const ids = blocks.map((b) => b.blockId);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });

    it('blocks have sequential order values', () => {
      const { blocks } = createPageWithBlocks(5);

      expect(blocks[0].order).toBe('a0');
      expect(blocks[1].order).toBe('a1');
      expect(blocks[2].order).toBe('a2');
      expect(blocks[3].order).toBe('a3');
      expect(blocks[4].order).toBe('a4');
    });

    it('blocks have numbered content', () => {
      const { blocks } = createPageWithBlocks(3);

      expect(blocks[0].content).toBe('Block 1 content');
      expect(blocks[1].content).toBe('Block 2 content');
      expect(blocks[2].content).toBe('Block 3 content');
    });

    it('handles zero blocks', () => {
      const { page, blocks } = createPageWithBlocks(0);

      expect(page.pageId).toMatch(/^[0-9A-Z]{26}$/);
      expect(blocks).toHaveLength(0);
    });

    it('all blocks are root-level (null parentId)', () => {
      const { blocks } = createPageWithBlocks(5);

      for (const block of blocks) {
        expect(block.parentId).toBeNull();
      }
    });
  });

  describe('createLinkedPages', () => {
    it('creates the specified number of pages', () => {
      const { pages } = createLinkedPages(5, 0);

      expect(pages).toHaveLength(5);
    });

    it('all pages have unique IDs', () => {
      const { pages } = createLinkedPages(10, 0);
      const ids = pages.map((p) => p.pageId);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });

    it('pages have numbered titles', () => {
      const { pages } = createLinkedPages(3, 0);

      expect(pages[0].title).toBe('Page 1');
      expect(pages[1].title).toBe('Page 2');
      expect(pages[2].title).toBe('Page 3');
    });

    it('creates no links with density 0', () => {
      const { links } = createLinkedPages(10, 0);

      expect(links).toHaveLength(0);
    });

    it('creates links with non-zero density', () => {
      const { pages, links } = createLinkedPages(5, 0.5);

      // With 5 pages and density 0.5, we expect roughly half of 20 possible links
      expect(links.length).toBeGreaterThan(0);
      expect(links.length).toBeLessThanOrEqual(20); // Max possible directed links

      // All links reference valid page IDs
      const pageIds = new Set(pages.map((p) => p.pageId));
      for (const link of links) {
        expect(pageIds.has(link.sourceId)).toBe(true);
        expect(pageIds.has(link.targetId)).toBe(true);
      }
    });

    it('does not create self-links', () => {
      const { links } = createLinkedPages(10, 1.0);

      for (const link of links) {
        expect(link.sourceId).not.toBe(link.targetId);
      }
    });

    it('produces reproducible results (deterministic)', () => {
      const result1 = createLinkedPages(5, 0.5);
      const result2 = createLinkedPages(5, 0.5);

      // Same page count and density should produce same number of links
      expect(result1.links.length).toBe(result2.links.length);
    });

    it('throws error for invalid density', () => {
      expect(() => createLinkedPages(5, -0.1)).toThrow('linkDensity must be between 0 and 1');
      expect(() => createLinkedPages(5, 1.1)).toThrow('linkDensity must be between 0 and 1');
    });

    it('handles density of 1.0 (fully connected)', () => {
      const { pages, links } = createLinkedPages(4, 1.0);

      // With 4 pages and density 1.0, all non-self links should exist
      // That's 4 * 3 = 12 directed links
      expect(links.length).toBe(12);

      // Verify no self-links
      for (const link of links) {
        expect(link.sourceId).not.toBe(link.targetId);
      }
    });

    it('handles single page (no links possible)', () => {
      const { pages, links } = createLinkedPages(1, 1.0);

      expect(pages).toHaveLength(1);
      expect(links).toHaveLength(0);
    });
  });

  describe('timestamp handling', () => {
    it('all factories use current timestamp by default', () => {
      const before = Date.now();

      const page = createPage();
      const block = createBlock();
      const link = createLink();
      const ref = createBlockRef();
      const tag = createTag();
      const prop = createProperty();

      const after = Date.now();

      // All timestamps should be between before and after
      expect(page.createdAt).toBeGreaterThanOrEqual(before);
      expect(page.createdAt).toBeLessThanOrEqual(after);

      expect(block.createdAt).toBeGreaterThanOrEqual(before);
      expect(block.createdAt).toBeLessThanOrEqual(after);

      expect(link.createdAt).toBeGreaterThanOrEqual(before);
      expect(link.createdAt).toBeLessThanOrEqual(after);

      expect(ref.createdAt).toBeGreaterThanOrEqual(before);
      expect(ref.createdAt).toBeLessThanOrEqual(after);

      expect(tag.createdAt).toBeGreaterThanOrEqual(before);
      expect(tag.createdAt).toBeLessThanOrEqual(after);

      expect(prop.updatedAt).toBeGreaterThanOrEqual(before);
      expect(prop.updatedAt).toBeLessThanOrEqual(after);
    });
  });
});
