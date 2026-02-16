// Integration tests for LinkRepository against real CozoDB
// Validates baseline behavior before SQLite migration

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphDB } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { PageRepository } from '../../src/repositories/page-repository.js';
import { LinkRepository } from '../../src/repositories/link-repository.js';
import { ulid } from 'ulid';

describe('LinkRepository Integration Tests', () => {
  let db: GraphDB;
  let pageRepo: PageRepository;
  let linkRepo: LinkRepository;

  beforeEach(async () => {
    // Create fresh database with migrations applied
    db = await createTestDatabase();
    pageRepo = new PageRepository(db);
    linkRepo = new LinkRepository(db);
  });

  /**
   * Helper function to create test pages and blocks for link testing.
   */
  async function createTestPages() {
    const page1Id = await pageRepo.create({ title: 'Source Page' });
    const page2Id = await pageRepo.create({ title: 'Target Page' });
    const page3Id = await pageRepo.create({ title: 'Third Page' });

    // Create blocks for link context
    const block1Id = ulid();
    const block2Id = ulid();
    const block3Id = ulid();

    const now = Date.now();

    await db.mutate(
      `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
        [$block1, $page1, null, "Link to [[Target Page]]", "text", "a0", false, false, $now, $now],
        [$block2, $page2, null, "Link to [[Third Page]]", "text", "a0", false, false, $now, $now],
        [$block3, $page3, null, "Reference to [[Source Page]]", "text", "a0", false, false, $now, $now]
      ]
      :put blocks { block_id => page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
      { block1: block1Id, block2: block2Id, block3: block3Id, page1: page1Id, page2: page2Id, page3: page3Id, now }
    );

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

      // Create same link twice
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

      // CozoDB :put should overwrite, so only one link exists
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

      // Soft delete page2
      await pageRepo.softDelete(page2Id);

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.targetId).toBe(page3Id);
    });

    it('should return all link types', async () => {
      const { page1Id, page2Id, page3Id, block1Id } = await createTestPages();
      const page4Id = await pageRepo.create({ title: 'Fourth Page' });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page3Id,
        linkType: 'embed',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page4Id,
        linkType: 'tag',
        contextBlockId: block1Id,
      });

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

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page3Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block3Id,
      });

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

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks[0]?.contextContent).toBe('Link to [[Target Page]]');
    });

    it('should exclude links from deleted blocks', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block3Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page3Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block3Id,
      });

      // Soft delete block1
      // First read the block
      const blockResult = await db.query(
        `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, created_at, updated_at] :=
          *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, created_at, updated_at },
          block_id == $block_id`,
        { block_id: block1Id }
      );
      const [blockId, pageId, parentId, content, contentType, order, isCollapsed, createdAt, updatedAt] = blockResult.rows[0] as [string, string, string | null, string, string, string, boolean, number, number];

      // Then update it with is_deleted = true
      await db.mutate(
        `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
          [$block_id, $page_id, $parent_id, $content, $content_type, $order, $is_collapsed, true, $created_at, $now]
        ]
        :put blocks { block_id => page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
        {
          block_id: blockId,
          page_id: pageId,
          parent_id: parentId,
          content,
          content_type: contentType,
          order,
          is_collapsed: isCollapsed,
          created_at: createdAt,
          now: Date.now()
        }
      );

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks.length).toBe(1);
      expect(inLinks[0]?.sourceId).toBe(page3Id);
    });

    it('should handle bidirectional links', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      // Create links in both directions
      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page2Id,
        targetId: page1Id,
        linkType: 'reference',
        contextBlockId: block2Id,
      });

      // Check page1's outlinks
      const page1OutLinks = await linkRepo.getOutLinks(page1Id);
      expect(page1OutLinks.length).toBe(1);
      expect(page1OutLinks[0]?.targetId).toBe(page2Id);

      // Check page1's inlinks
      const page1InLinks = await linkRepo.getInLinks(page1Id);
      expect(page1InLinks.length).toBe(1);
      expect(page1InLinks[0]?.sourceId).toBe(page2Id);

      // Check page2's outlinks
      const page2OutLinks = await linkRepo.getOutLinks(page2Id);
      expect(page2OutLinks.length).toBe(1);
      expect(page2OutLinks[0]?.targetId).toBe(page1Id);

      // Check page2's inlinks
      const page2InLinks = await linkRepo.getInLinks(page2Id);
      expect(page2InLinks.length).toBe(1);
      expect(page2InLinks[0]?.sourceId).toBe(page1Id);
    });

    it('should handle self-referencing links in backlinks', async () => {
      const { page1Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page1Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      const inLinks = await linkRepo.getInLinks(page1Id);
      expect(inLinks.length).toBe(1);
      expect(inLinks[0]?.sourceId).toBe(page1Id);
      expect(inLinks[0]?.targetId).toBe(page1Id);
    });
  });

  describe('createBlockRef', () => {
    it('should create a block-to-block reference', async () => {
      const { block1Id, block2Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.sourceBlockId).toBe(block1Id);
      expect(backlinks[0]?.targetBlockId).toBe(block2Id);
    });

    it('should set created_at timestamp', async () => {
      const { block1Id, block2Id } = await createTestPages();

      const beforeCreate = Date.now();
      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });
      const afterCreate = Date.now();

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks[0]?.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(backlinks[0]?.createdAt).toBeLessThanOrEqual(afterCreate);
    });

    it('should allow multiple references from same source block', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block3Id,
      });

      const backlinks2 = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks2.length).toBe(1);

      const backlinks3 = await linkRepo.getBlockBacklinks(block3Id);
      expect(backlinks3.length).toBe(1);
    });

    it('should allow self-referencing block refs', async () => {
      const { block1Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block1Id,
      });

      const backlinks = await linkRepo.getBlockBacklinks(block1Id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.sourceBlockId).toBe(block1Id);
      expect(backlinks[0]?.targetBlockId).toBe(block1Id);
    });
  });

  describe('getBlockBacklinks', () => {
    it('should retrieve all backlinks to a block', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      await linkRepo.createBlockRef({
        sourceBlockId: block3Id,
        targetBlockId: block2Id,
      });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(2);

      const sourceIds = backlinks.map((ref) => ref.sourceBlockId);
      expect(sourceIds).toContain(block1Id);
      expect(sourceIds).toContain(block3Id);
    });

    it('should return empty array for block with no backlinks', async () => {
      const { block1Id } = await createTestPages();

      const backlinks = await linkRepo.getBlockBacklinks(block1Id);
      expect(backlinks).toEqual([]);
    });

    it('should include source block content in results', async () => {
      const { block1Id, block2Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks[0]?.content).toBe('Link to [[Target Page]]');
    });

    it('should include source block page ID in results', async () => {
      const { page1Id, block1Id, block2Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks[0]?.pageId).toBe(page1Id);
    });

    it('should exclude refs from deleted blocks', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      await linkRepo.createBlockRef({
        sourceBlockId: block3Id,
        targetBlockId: block2Id,
      });

      // Soft delete block1
      // First read the block
      const blockResult = await db.query(
        `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, created_at, updated_at] :=
          *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, created_at, updated_at },
          block_id == $block_id`,
        { block_id: block1Id }
      );
      const [blockId, pageId, parentId, content, contentType, order, isCollapsed, createdAt, updatedAt] = blockResult.rows[0] as [string, string, string | null, string, string, string, boolean, number, number];

      // Then update it with is_deleted = true
      await db.mutate(
        `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
          [$block_id, $page_id, $parent_id, $content, $content_type, $order, $is_collapsed, true, $created_at, $now]
        ]
        :put blocks { block_id => page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
        {
          block_id: blockId,
          page_id: pageId,
          parent_id: parentId,
          content,
          content_type: contentType,
          order,
          is_collapsed: isCollapsed,
          created_at: createdAt,
          now: Date.now()
        }
      );

      const backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.sourceBlockId).toBe(block3Id);
    });
  });

  describe('removeLinksFromBlock', () => {
    it('should remove all page links from a block', async () => {
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

      // Verify links exist
      let outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(2);

      // Remove all links from block1
      await linkRepo.removeLinksFromBlock(block1Id);

      // Verify links are removed
      outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks).toEqual([]);
    });

    it('should remove all block refs from a block', async () => {
      const { block1Id, block2Id, block3Id } = await createTestPages();

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block3Id,
      });

      // Verify refs exist
      let backlinks2 = await linkRepo.getBlockBacklinks(block2Id);
      let backlinks3 = await linkRepo.getBlockBacklinks(block3Id);
      expect(backlinks2.length).toBe(1);
      expect(backlinks3.length).toBe(1);

      // Remove all refs from block1
      await linkRepo.removeLinksFromBlock(block1Id);

      // Verify refs are removed
      backlinks2 = await linkRepo.getBlockBacklinks(block2Id);
      backlinks3 = await linkRepo.getBlockBacklinks(block3Id);
      expect(backlinks2).toEqual([]);
      expect(backlinks3).toEqual([]);
    });

    it('should remove both page links and block refs atomically', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      // Create both page link and block ref from block1
      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createBlockRef({
        sourceBlockId: block1Id,
        targetBlockId: block2Id,
      });

      // Verify both exist
      let outLinks = await linkRepo.getOutLinks(page1Id);
      let backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(outLinks.length).toBe(1);
      expect(backlinks.length).toBe(1);

      // Remove all from block1
      await linkRepo.removeLinksFromBlock(block1Id);

      // Verify both are removed
      outLinks = await linkRepo.getOutLinks(page1Id);
      backlinks = await linkRepo.getBlockBacklinks(block2Id);
      expect(outLinks).toEqual([]);
      expect(backlinks).toEqual([]);
    });

    it('should not affect links from other blocks', async () => {
      const { page1Id, page2Id, block1Id, block2Id } = await createTestPages();

      // Create links from two different blocks
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
        contextBlockId: block2Id,
      });

      // Remove links from block1 only
      await linkRepo.removeLinksFromBlock(block1Id);

      // Verify block2's link still exists
      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(1);
      expect(outLinks[0]?.contextBlockId).toBe(block2Id);
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      const { page1Id, page2Id, block1Id } = await createTestPages();

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      // Remove once
      await linkRepo.removeLinksFromBlock(block1Id);

      // Remove again (should not throw)
      await expect(linkRepo.removeLinksFromBlock(block1Id)).resolves.not.toThrow();

      // Verify still no links
      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks).toEqual([]);
    });

    it('should handle removing from block with no links', async () => {
      const { block1Id } = await createTestPages();

      // Should not throw when removing from empty block
      await expect(linkRepo.removeLinksFromBlock(block1Id)).resolves.not.toThrow();
    });
  });

  describe('orphaned link detection', () => {
    it('should identify pages with no incoming links', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block2Id } = await createTestPages();

      // Create links: page1 -> page2 -> page3
      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page2Id,
        targetId: page3Id,
        linkType: 'reference',
        contextBlockId: block2Id,
      });

      // page1 has no incoming links (orphaned)
      const page1InLinks = await linkRepo.getInLinks(page1Id);
      expect(page1InLinks).toEqual([]);

      // page2 has incoming links
      const page2InLinks = await linkRepo.getInLinks(page2Id);
      expect(page2InLinks.length).toBe(1);

      // page3 has incoming links
      const page3InLinks = await linkRepo.getInLinks(page3Id);
      expect(page3InLinks.length).toBe(1);
    });

    it('should identify isolated pages (no incoming or outgoing links)', async () => {
      const { page1Id, page2Id, page3Id } = await createTestPages();
      const isolatedPageId = await pageRepo.create({ title: 'Isolated Page' });

      // Create link between page1 and page2 only
      const block1Id = ulid();
      await db.mutate(
        `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
          [$block1, $page1, null, "Test", "text", "a0", false, false, $now, $now]
        ]
        :put blocks { block_id => page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
        { block1: block1Id, page1: page1Id, now: Date.now() }
      );

      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      // Check isolated page
      const isolatedInLinks = await linkRepo.getInLinks(isolatedPageId);
      const isolatedOutLinks = await linkRepo.getOutLinks(isolatedPageId);
      expect(isolatedInLinks).toEqual([]);
      expect(isolatedOutLinks).toEqual([]);

      // Check page3 (also isolated from the link network)
      const page3InLinks = await linkRepo.getInLinks(page3Id);
      const page3OutLinks = await linkRepo.getOutLinks(page3Id);
      expect(page3InLinks).toEqual([]);
      expect(page3OutLinks).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle pages with many outgoing links', async () => {
      const { page1Id, block1Id } = await createTestPages();

      // Create 50 target pages
      const targetIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const targetId = await pageRepo.create({ title: `Target ${i}` });
        targetIds.push(targetId);
      }

      // Create links from page1 to all targets
      for (const targetId of targetIds) {
        await linkRepo.createLink({
          sourceId: page1Id,
          targetId,
          linkType: 'reference',
          contextBlockId: block1Id,
        });
      }

      const outLinks = await linkRepo.getOutLinks(page1Id);
      expect(outLinks.length).toBe(50);
    });

    it('should handle pages with many incoming links', async () => {
      const { page2Id, block1Id } = await createTestPages();

      // Create 50 source pages
      const sourceIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const sourceId = await pageRepo.create({ title: `Source ${i}` });
        sourceIds.push(sourceId);
      }

      // Create links from all sources to page2
      for (const sourceId of sourceIds) {
        await linkRepo.createLink({
          sourceId,
          targetId: page2Id,
          linkType: 'reference',
          contextBlockId: block1Id,
        });
      }

      const inLinks = await linkRepo.getInLinks(page2Id);
      expect(inLinks.length).toBe(50);
    });

    it('should handle circular link chains', async () => {
      const { page1Id, page2Id, page3Id, block1Id, block2Id, block3Id } = await createTestPages();

      // Create circular chain: page1 -> page2 -> page3 -> page1
      await linkRepo.createLink({
        sourceId: page1Id,
        targetId: page2Id,
        linkType: 'reference',
        contextBlockId: block1Id,
      });

      await linkRepo.createLink({
        sourceId: page2Id,
        targetId: page3Id,
        linkType: 'reference',
        contextBlockId: block2Id,
      });

      await linkRepo.createLink({
        sourceId: page3Id,
        targetId: page1Id,
        linkType: 'reference',
        contextBlockId: block3Id,
      });

      // Each page should have 1 incoming and 1 outgoing link
      const page1OutLinks = await linkRepo.getOutLinks(page1Id);
      const page1InLinks = await linkRepo.getInLinks(page1Id);
      expect(page1OutLinks.length).toBe(1);
      expect(page1InLinks.length).toBe(1);

      const page2OutLinks = await linkRepo.getOutLinks(page2Id);
      const page2InLinks = await linkRepo.getInLinks(page2Id);
      expect(page2OutLinks.length).toBe(1);
      expect(page2InLinks.length).toBe(1);

      const page3OutLinks = await linkRepo.getOutLinks(page3Id);
      const page3InLinks = await linkRepo.getInLinks(page3Id);
      expect(page3OutLinks.length).toBe(1);
      expect(page3InLinks.length).toBe(1);
    });
  });
});
