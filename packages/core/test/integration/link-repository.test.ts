// Integration tests for LinkRepository against real SQLite
// Validates SQL-based link operations

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphDB } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { LinkRepository } from '../../src/repositories/link-repository.js';
import { ulid } from 'ulid';

describe('LinkRepository Integration Tests', () => {
  let db: GraphDB;
  let linkRepo: LinkRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    linkRepo = new LinkRepository(db);
  });

  /** Helper: create a page directly via SQL */
  async function createPage(title: string): Promise<string> {
    const pageId = ulid();
    const now = Date.now();
    await db.mutate(
      `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
       VALUES ($id, $title, $now, $now, 0, NULL)`,
      { id: pageId, title, now }
    );
    return pageId;
  }

  /** Helper: create a block directly via SQL */
  async function createBlock(pageId: string, content: string): Promise<string> {
    const blockId = ulid();
    const now = Date.now();
    await db.mutate(
      `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
       VALUES ($id, $page_id, NULL, $content, 'text', 'a0', 0, 0, $now, $now)`,
      { id: blockId, page_id: pageId, content, now }
    );
    return blockId;
  }

  /** Helper: soft-delete a page */
  async function softDeletePage(pageId: string): Promise<void> {
    await db.mutate(
      `UPDATE pages SET is_deleted = 1, updated_at = $now WHERE page_id = $id`,
      { id: pageId, now: Date.now() }
    );
  }

  /**
   * Helper function to create test pages and blocks for link testing.
   */
  async function createTestPages() {
    const page1Id = await createPage('Source Page');
    const page2Id = await createPage('Target Page');
    const page3Id = await createPage('Third Page');

    const block1Id = await createBlock(page1Id, 'Link to [[Target Page]]');
    const block2Id = await createBlock(page2Id, 'Link to [[Third Page]]');
    const block3Id = await createBlock(page3Id, 'Reference to [[Source Page]]');

    return { page1Id, page2Id, page3Id, block1Id, block2Id, block3Id };
  }

  describe('createLink', () => {
    it('should create a page-to-page link', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.sourceId).toBe(page1Id);
      expect(outLinks[0]?.targetId).toBe(page2Id);
      expect(outLinks[0]?.linkType).toBe('reference');
      expect(outLinks[0]?.contextBlockId).toBe(block1Id);
    });

    it('should create link with embed type', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'embed',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks[0]?.linkType).toBe('embed');
    });

    it('should create link with tag type', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'tag',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks[0]?.linkType).toBe('tag');
    });

    it('should create link with null context block', async () => {
      const { page1Id, page2Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: null,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks[0]?.contextBlockId).toBeNull();
    });

    it('should set created_at timestamp', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      const beforeCreate = Date.now();
      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });
      const afterCreate = Date.now();

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks[0]?.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(outLinks[0]?.createdAt).toBeLessThanOrEqual(afterCreate);
    });

    it('should allow multiple links from same source', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page3Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(2);
    });

    it('should allow self-referencing links', async () => {
      const { page1Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page1Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.sourceId).toBe(page1Id);
      expect(outLinks[0]?.targetId).toBe(page1Id);
    });

    it('should handle duplicate links (overwrite behavior)', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
    });
  });

  describe('getOutLinks', () => {
    it('should retrieve all outgoing links from a page', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page3Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(2);

      const targetIds = outLinks.map((link) => link.targetId);
      expect(targetIds).toContain(page2Id);
      expect(targetIds).toContain(page3Id);
    });

    it('should return empty array for page with no outgoing links', async () => {
      const { page1Id } = await createTestPages();

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks).toEqual([]);
    });

    it('should include target page title in results', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks[0]?.targetTitle).toBe('Target Page');
    });

    it('should exclude links to deleted pages', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page3Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await softDeletePage(page2Id);

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.targetId).toBe(page3Id);
    });

    it('should return all link types', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();
      const page4Id = await createPage('Fourth Page');

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page1Id, targetId: page3Id, linkType: 'embed', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page1Id, targetId: page4Id, linkType: 'tag', contextBlockId: block1Id });

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(3);

      const linkTypes = outLinks.map((link) => link.linkType);
      expect(linkTypes).toContain('reference');
      expect(linkTypes).toContain('embed');
      expect(linkTypes).toContain('tag');
    });
  });

  describe('getInLinks', () => {
    it('should retrieve all incoming links (backlinks) to a page', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block3Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page3Id, targetId: page2Id, linkType: 'reference', contextBlockId: block3Id });

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks.length).toBe(2);

      const sourceIds = inLinks.map((link) => link.sourceId);
      expect(sourceIds).toContain(page1Id);
      expect(sourceIds).toContain(page3Id);
    });

    it('should return empty array for page with no incoming links', async () => {
      const { page1Id } = await createTestPages();
      const inLinks = await linkRepo.getInLinks(page1Id);
      expect(inLinks).toEqual([]);
    });

    it('should include context block content in results', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks[0]?.contextContent).toBe('Link to [[Target Page]]');
    });

    it('should exclude links from deleted blocks', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block3Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page3Id, targetId: page2Id, linkType: 'reference', contextBlockId: block3Id });

      // Soft delete block1
      await db.mutate(
        `UPDATE blocks SET is_deleted = 1, updated_at = $now WHERE block_id = $block_id`,
        { block_id: block1Id, now: Date.now() }
      );

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks.length).toBe(1);
      expect(inLinks[0]?.sourceId).toBe(page3Id);
    });

    it('should handle bidirectional links', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page2Id, targetId: page1Id, linkType: 'reference', contextBlockId: block2Id });

      expect((await linkRepo.getOutLinks(page1Id)).length).toBe(1);
      expect((await linkRepo.getInLinks(page1Id)).length).toBe(1);
      expect((await linkRepo.getOutLinks(page2Id)).length).toBe(1);
      expect((await linkRepo.getInLinks(page2Id)).length).toBe(1);
    });

    it('should handle self-referencing links in backlinks', async () => {
      const { page1Id, block1Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page1Id, linkType: 'reference', contextBlockId: block1Id });

      const inLinks = await linkRepo.getInLinks(page1Id);
      expect(inLinks.length).toBe(1);
      expect(inLinks[0]?.sourceId).toBe(page1Id);
      expect(inLinks[0]?.targetId).toBe(page1Id);
    });
  });

  describe('createBlockRef', () => {
    it('should create a block-to-block reference', async () => {
      const { block1Id, block2Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.sourceBlockId).toBe(block1Id);
      expect(backlinks[0]?.targetBlockId).toBe(block2Id);
    });

    it('should set created_at timestamp', async () => {
      const { block1Id, block2Id } = await createTestPages();

      const beforeCreate = Date.now();
      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });
      const afterCreate = Date.now();

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks[0]?.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(backlinks[0]?.createdAt).toBeLessThanOrEqual(afterCreate);
    });

    it('should allow self-referencing block refs', async () => {
      const { block1Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block1Id });

      const backlinks = await linkRepo.getBlockBacklinks(block1Id);
      expect(backlinks.length).toBe(1);
    });
  });

  describe('getBlockBacklinks', () => {
    it('should retrieve all backlinks to a block', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });
      await linkRepo.createBlockRef({ sourceBlockId: block3Id, targetBlockId: block2Id });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(2);
    });

    it('should return empty array for block with no backlinks', async () => {
      const { block1Id } = await createTestPages();
      expect(await linkRepo.getBlockBacklinks(block1Id)).toEqual([]);
    });

    it('should include source block content and page ID', async () => {
      const { page1Id, block1Id, block2Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks[0]?.content).toBe('Link to [[Target Page]]');
      expect(backlinks[0]?.pageId).toBe(page1Id);
    });

    it('should exclude refs from deleted blocks', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });
      await linkRepo.createBlockRef({ sourceBlockId: block3Id, targetBlockId: block2Id });

      await db.mutate(
        `UPDATE blocks SET is_deleted = 1, updated_at = $now WHERE block_id = $block_id`,
        { block_id: block1Id, now: Date.now() }
      );

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.sourceBlockId).toBe(block3Id);
    });
  });

  describe('removeLinksFromBlock', () => {
    it('should remove all page links from a block', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page1Id, targetId: page3Id, linkType: 'reference', contextBlockId: block1Id });

      expect((await linkRepo.getOutLinks(page1Id)).length).toBe(2);

      await linkRepo.removeLinksFromBlock(block1Id);

      expect(await linkRepo.getOutLinks(page1Id)).toEqual([]);
    });

    it('should remove all block refs from a block', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });
      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block3Id });

      await linkRepo.removeLinksFromBlock(block1Id);

      expect(await linkRepo.getBlockBacklinks(block2Id)).toEqual([]);
      expect(await linkRepo.getBlockBacklinks(block3Id)).toEqual([]);
    });

    it('should remove both page links and block refs', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createBlockRef({ sourceBlockId: block1Id, targetBlockId: block2Id });

      await linkRepo.removeLinksFromBlock(block1Id);

      expect(await linkRepo.getOutLinks(page1Id)).toEqual([]);
      expect(await linkRepo.getBlockBacklinks(block2Id)).toEqual([]);
    });

    it('should not affect links from other blocks', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block2Id });

      await linkRepo.removeLinksFromBlock(block1Id);

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.contextBlockId).toBe(block2Id);
    });

    it('should be idempotent', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });

      await linkRepo.removeLinksFromBlock(block1Id);
      await expect(linkRepo.removeLinksFromBlock(block1Id)).resolves.not.toThrow();

      expect(await linkRepo.getOutLinks(page1Id)).toEqual([]);
    });

    it('should handle removing from block with no links', async () => {
      const { block1Id } = await createTestPages();
      await expect(linkRepo.removeLinksFromBlock(block1Id)).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle pages with many outgoing links', async () => {
      const { page1Id, block1Id } = await createTestPages();

      const targetIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const targetId = await createPage(`Target ${i}`);
        targetIds.push(targetId);
      }

      for (const targetId of targetIds) {
        await linkRepo.createLink({ sourceId: page1Id, targetId, linkType: 'reference', contextBlockId: block1Id });
      }

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(50);
    });

    it('should handle pages with many incoming links', async () => {
      const { page2Id, block1Id } = await createTestPages();

      for (let i = 0; i < 50; i++) {
        const sourceId = await createPage(`Source ${i}`);
        await linkRepo.createLink({ sourceId, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      }

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks.length).toBe(50);
    });

    it('should handle circular link chains', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createLink({ sourceId: page1Id, targetId: page2Id, linkType: 'reference', contextBlockId: block1Id });
      await linkRepo.createLink({ sourceId: page2Id, targetId: page3Id, linkType: 'reference', contextBlockId: block2Id });
      await linkRepo.createLink({ sourceId: page3Id, targetId: page1Id, linkType: 'reference', contextBlockId: block3Id });

      for (const pageId of [page1Id, page2Id, page3Id]) {
        expect((await linkRepo.getOutLinks(pageId)).length).toBe(1);
        expect((await linkRepo.getInLinks(pageId)).length).toBe(1);
      }
    });
  });
});
