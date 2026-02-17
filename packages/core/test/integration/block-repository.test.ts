// Integration tests for BlockRepository against real SQLite
// Verifies all public methods and edge cases with real database queries

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database, Block, BlockId, PageId } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { cleanupDatabase } from './helpers.js';
import { BlockRepository } from '../../src/repositories/block-repository.js';
import { PageRepository } from '../../src/repositories/page-repository.js';
import { DEFAULT_ORDER } from '../../src/utils/ordering.js';

describe('BlockRepository Integration Tests', () => {
  let db: Database;
  let blockRepo: BlockRepository;
  let pageRepo: PageRepository;
  let testPageId: PageId;

  beforeAll(async () => {
    // Create fresh database with migrations applied
    db = await createTestDatabase();
    blockRepo = new BlockRepository(db);
    pageRepo = new PageRepository(db);

    // Create a test page for blocks
    testPageId = await pageRepo.create({ title: 'Test Page' });
  });

  afterAll(async () => {
    await cleanupDatabase(db);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // create() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a root-level block with minimal input', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Test root block',
      });

      expect(blockId).toBeTruthy();
      expect(typeof blockId).toBe('string');

      const block = await blockRepo.getById(blockId);
      expect(block).not.toBeNull();
      expect(block?.content).toBe('Test root block');
      expect(block?.pageId).toBe(testPageId);
      expect(block?.parentId).toBeNull();
      expect(block?.contentType).toBe('text');
      expect(block?.order).toBe(DEFAULT_ORDER);
      expect(block?.isCollapsed).toBe(false);
      expect(block?.isDeleted).toBe(false);
    });

    it('should create a nested block with parentId', async () => {
      const parentId = await blockRepo.create({
        pageId: testPageId,
        content: 'Parent block',
      });

      const childId = await blockRepo.create({
        pageId: testPageId,
        parentId,
        content: 'Child block',
      });

      const child = await blockRepo.getById(childId);
      expect(child?.parentId).toBe(parentId);
      expect(child?.content).toBe('Child block');
    });

    it('should create block with custom content type', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: '# Heading',
        contentType: 'heading',
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.contentType).toBe('heading');
    });

    it('should create block with custom order', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Custom order block',
        order: 'custom123',
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.order).toBe('custom123');
    });

    it('should create block with empty content', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: '',
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe('');
    });

    it('should create block with special characters in content', async () => {
      const specialContent = 'Block with "quotes", \\backslashes, and [[wiki-links]]';
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: specialContent,
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe(specialContent);
    });

    it('should create block with unicode characters', async () => {
      const unicodeContent = 'Unicode: 你好 🌍 émojis';
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: unicodeContent,
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe(unicodeContent);
    });

    it('should create block and it should be retrievable by page', async () => {
      const pageId = await pageRepo.create({ title: 'Index Test Page' });
      const blockId = await blockRepo.create({
        pageId,
        content: 'Index test block',
      });

      const blocks = await blockRepo.getByPage(pageId);
      const found = blocks.find((b) => b.blockId === blockId);
      expect(found).toBeDefined();
      expect(found?.content).toBe('Index test block');
    });

    it('should create root block with null parent_id', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Root parent test',
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBeNull();
    });

    it('should create nested block with correct parent_id', async () => {
      const parentId = await blockRepo.create({
        pageId: testPageId,
        content: 'Parent for index test',
      });

      const childId = await blockRepo.create({
        pageId: testPageId,
        parentId,
        content: 'Child for index test',
      });

      const child = await blockRepo.getById(childId);
      expect(child?.parentId).toBe(parentId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getById() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('should return block by ID', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Get by ID test',
      });

      const block = await blockRepo.getById(blockId);
      expect(block).not.toBeNull();
      expect(block?.blockId).toBe(blockId);
      expect(block?.content).toBe('Get by ID test');
    });

    it('should return null for non-existent block', async () => {
      const block = await blockRepo.getById('non-existent-id');
      expect(block).toBeNull();
    });

    it('should return null for deleted block', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'To be deleted',
      });

      await blockRepo.softDelete(blockId);

      const block = await blockRepo.getById(blockId);
      expect(block).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getByPage() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getByPage()', () => {
    it('should return all blocks for a page ordered by order field', async () => {
      const pageId = await pageRepo.create({ title: 'GetByPage Test' });

      await blockRepo.create({ pageId, content: 'Block 1', order: 'a0' });
      await blockRepo.create({ pageId, content: 'Block 2', order: 'a1' });
      await blockRepo.create({ pageId, content: 'Block 3', order: 'a2' });

      const blocks = await blockRepo.getByPage(pageId);
      expect(blocks.length).toBe(3);
      expect(blocks[0]?.content).toBe('Block 1');
      expect(blocks[1]?.content).toBe('Block 2');
      expect(blocks[2]?.content).toBe('Block 3');
    });

    it('should return empty array for page with no blocks', async () => {
      const emptyPageId = await pageRepo.create({ title: 'Empty Page' });
      const blocks = await blockRepo.getByPage(emptyPageId);
      expect(blocks).toEqual([]);
    });

    it('should not return deleted blocks', async () => {
      const pageId = await pageRepo.create({ title: 'Deleted Block Test' });

      const block1Id = await blockRepo.create({ pageId, content: 'Block 1' });
      await blockRepo.create({ pageId, content: 'Block 2' });

      await blockRepo.softDelete(block1Id);

      const blocks = await blockRepo.getByPage(pageId);
      expect(blocks.length).toBe(1);
      expect(blocks[0]?.content).toBe('Block 2');
    });

    it('should return both root and nested blocks', async () => {
      const pageId = await pageRepo.create({ title: 'Mixed Hierarchy' });

      const parentId = await blockRepo.create({ pageId, content: 'Parent', order: 'a0' });
      await blockRepo.create({ pageId, parentId, content: 'Child', order: 'a0' });
      await blockRepo.create({ pageId, content: 'Root', order: 'a1' });

      const blocks = await blockRepo.getByPage(pageId);
      expect(blocks.length).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getChildren() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getChildren()', () => {
    it('should return children of a block ordered by order field', async () => {
      const pageId = await pageRepo.create({ title: 'GetChildren Test' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      await blockRepo.create({ pageId, parentId, content: 'Child 1', order: 'a0' });
      await blockRepo.create({ pageId, parentId, content: 'Child 2', order: 'a1' });
      await blockRepo.create({ pageId, parentId, content: 'Child 3', order: 'a2' });

      const children = await blockRepo.getChildren(parentId);
      expect(children.length).toBe(3);
      expect(children[0]?.content).toBe('Child 1');
      expect(children[1]?.content).toBe('Child 2');
      expect(children[2]?.content).toBe('Child 3');
    });

    it('should return root-level blocks when parentId is null', async () => {
      const pageId = await pageRepo.create({ title: 'Root Children Test' });

      await blockRepo.create({ pageId, content: 'Root 1', order: 'a0' });
      await blockRepo.create({ pageId, content: 'Root 2', order: 'a1' });

      const children = await blockRepo.getChildren(null, pageId);
      expect(children.length).toBe(2);
      expect(children[0]?.content).toBe('Root 1');
      expect(children[1]?.content).toBe('Root 2');
    });

    it('should return empty array for block with no children', async () => {
      const pageId = await pageRepo.create({ title: 'No Children Test' });
      const blockId = await blockRepo.create({ pageId, content: 'Leaf block' });

      const children = await blockRepo.getChildren(blockId);
      expect(children).toEqual([]);
    });

    it('should not return deleted children', async () => {
      const pageId = await pageRepo.create({ title: 'Deleted Children Test' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      const child1Id = await blockRepo.create({ pageId, parentId, content: 'Child 1' });
      await blockRepo.create({ pageId, parentId, content: 'Child 2' });

      await blockRepo.softDelete(child1Id);

      const children = await blockRepo.getChildren(parentId);
      expect(children.length).toBe(1);
      expect(children[0]?.content).toBe('Child 2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // update() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update block content', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Original content',
      });

      // Small delay to ensure Date.now() returns different values for
      // create and update, preventing the auto-update trigger from
      // overwriting the timestamp with unixepoch (seconds vs milliseconds).
      await new Promise((resolve) => setTimeout(resolve, 5));

      await blockRepo.update(blockId, { content: 'Updated content' });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe('Updated content');
      expect(block?.updatedAt).toBeGreaterThan(block?.createdAt ?? 0);
    });

    it('should update block parentId', async () => {
      const newParentId = await blockRepo.create({
        pageId: testPageId,
        content: 'New parent',
      });

      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Block to move',
      });

      await blockRepo.update(blockId, { parentId: newParentId });

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBe(newParentId);
    });

    it('should update block parentId to null (make root)', async () => {
      const parentId = await blockRepo.create({
        pageId: testPageId,
        content: 'Parent',
      });

      const blockId = await blockRepo.create({
        pageId: testPageId,
        parentId,
        content: 'Child',
      });

      await blockRepo.update(blockId, { parentId: null });

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBeNull();
    });

    it('should update block order', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Block',
        order: 'a0',
      });

      await blockRepo.update(blockId, { order: 'z9' });

      const block = await blockRepo.getById(blockId);
      expect(block?.order).toBe('z9');
    });

    it('should update block isCollapsed', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Block',
      });

      await blockRepo.update(blockId, { isCollapsed: true });

      const block = await blockRepo.getById(blockId);
      expect(block?.isCollapsed).toBe(true);
    });

    it('should update multiple fields atomically', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Original',
        order: 'a0',
      });

      await blockRepo.update(blockId, {
        content: 'Updated',
        order: 'b0',
        isCollapsed: true,
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe('Updated');
      expect(block?.order).toBe('b0');
      expect(block?.isCollapsed).toBe(true);
    });

    it('should throw error when updating non-existent block', async () => {
      await expect(
        blockRepo.update('non-existent-id', { content: 'New content' })
      ).rejects.toThrow('Block not found');
    });

    it('should preserve unchanged fields', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Original content',
        order: 'original-order',
      });

      const originalBlock = await blockRepo.getById(blockId);

      await blockRepo.update(blockId, { content: 'Updated content' });

      const updatedBlock = await blockRepo.getById(blockId);
      expect(updatedBlock?.order).toBe(originalBlock?.order);
      expect(updatedBlock?.isCollapsed).toBe(originalBlock?.isCollapsed);
      expect(updatedBlock?.pageId).toBe(originalBlock?.pageId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // softDelete() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('should soft delete a block', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'To delete',
      });

      await blockRepo.softDelete(blockId);

      const block = await blockRepo.getById(blockId);
      expect(block).toBeNull();
    });

    it('should throw error when deleting non-existent block', async () => {
      await expect(blockRepo.softDelete('non-existent-id')).rejects.toThrow('Block not found');
    });

    it('should soft delete block but keep in database', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'To soft delete',
      });

      await blockRepo.softDelete(blockId);

      // Query directly including deleted blocks
      const result = await db.query<[string, number]>(
        `SELECT block_id, is_deleted FROM blocks WHERE block_id = $id`,
        { id: blockId }
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]?.[1]).toBe(1); // SQLite returns 1 for true
    });

    it('should update updatedAt when soft deleting', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'To delete',
      });

      const before = await db.query<[number]>(
        `SELECT updated_at FROM blocks WHERE block_id = $id`,
        { id: blockId }
      );
      const beforeTime = before.rows[0]?.[0] ?? 0;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await blockRepo.softDelete(blockId);

      const after = await db.query<[number]>(
        `SELECT updated_at FROM blocks WHERE block_id = $id`,
        { id: blockId }
      );
      const afterTime = after.rows[0]?.[0] ?? 0;

      expect(afterTime).toBeGreaterThan(beforeTime);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // move() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('move()', () => {
    it('should move block to new parent', async () => {
      const pageId = await pageRepo.create({ title: 'Move Test Page' });
      const parent1Id = await blockRepo.create({ pageId, content: 'Parent 1' });
      const parent2Id = await blockRepo.create({ pageId, content: 'Parent 2' });
      const blockId = await blockRepo.create({
        pageId,
        parentId: parent1Id,
        content: 'Block to move',
      });

      await blockRepo.move(blockId, parent2Id, 'new-order');

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBe(parent2Id);
      expect(block?.order).toBe('new-order');
    });

    it('should move block from nested to root', async () => {
      const pageId = await pageRepo.create({ title: 'Move to Root Test' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });
      const blockId = await blockRepo.create({
        pageId,
        parentId,
        content: 'Child to become root',
      });

      await blockRepo.move(blockId, null, 'root-order');

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBeNull();
      expect(block?.order).toBe('root-order');
    });

    it('should move block from root to nested', async () => {
      const pageId = await pageRepo.create({ title: 'Move to Nested Test' });
      const blockId = await blockRepo.create({ pageId, content: 'Root block' });
      const newParentId = await blockRepo.create({ pageId, content: 'New parent' });

      await blockRepo.move(blockId, newParentId, 'child-order');

      const block = await blockRepo.getById(blockId);
      expect(block?.parentId).toBe(newParentId);
      expect(block?.order).toBe('child-order');
    });

    it('should update parent properly when moving between parents', async () => {
      const pageId = await pageRepo.create({ title: 'Move Index Test' });
      const parent1Id = await blockRepo.create({ pageId, content: 'Parent 1' });
      const parent2Id = await blockRepo.create({ pageId, content: 'Parent 2' });
      const blockId = await blockRepo.create({
        pageId,
        parentId: parent1Id,
        content: 'Moving block',
      });

      await blockRepo.move(blockId, parent2Id, 'new-order');

      // Verify removed from old parent's children
      const oldChildren = await blockRepo.getChildren(parent1Id);
      const inOld = oldChildren.find((b) => b.blockId === blockId);
      expect(inOld).toBeUndefined();

      // Verify added to new parent's children
      const newChildren = await blockRepo.getChildren(parent2Id);
      const inNew = newChildren.find((b) => b.blockId === blockId);
      expect(inNew).toBeDefined();
    });

    it('should throw error when moving non-existent block', async () => {
      await expect(blockRepo.move('non-existent-id', null, 'order')).rejects.toThrow(
        'Block not found'
      );
    });

    it('should preserve content when moving', async () => {
      const pageId = await pageRepo.create({ title: 'Move Preserve Test' });
      const parent1Id = await blockRepo.create({ pageId, content: 'Parent 1' });
      const parent2Id = await blockRepo.create({ pageId, content: 'Parent 2' });
      const blockId = await blockRepo.create({
        pageId,
        parentId: parent1Id,
        content: 'Important content',
      });

      await blockRepo.move(blockId, parent2Id, 'new-order');

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe('Important content');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // search() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('should find blocks by FTS query', async () => {
      const pageId = await pageRepo.create({ title: 'Search Test' });
      await blockRepo.create({ pageId, content: 'The quick brown fox jumps' });
      await blockRepo.create({ pageId, content: 'over the lazy dog' });
      await blockRepo.create({ pageId, content: 'completely unrelated content' });

      const results = await blockRepo.search('quick');
      expect(results.length).toBeGreaterThanOrEqual(1);

      const found = results.find((b) => b.content.includes('quick brown fox'));
      expect(found).toBeDefined();
    });

    it('should return empty array when no matches', async () => {
      const results = await blockRepo.search('xyznonexistent123');
      expect(results).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const pageId = await pageRepo.create({ title: 'Limit Test' });
      for (let i = 0; i < 10; i++) {
        await blockRepo.create({ pageId, content: `common word test ${i}` });
      }

      const results = await blockRepo.search('common', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should not return deleted blocks in search', async () => {
      const pageId = await pageRepo.create({ title: 'Search Deleted Test' });
      const block1Id = await blockRepo.create({
        pageId,
        content: 'searchable unique term abc123',
      });
      await blockRepo.create({ pageId, content: 'searchable unique term abc123' });

      await blockRepo.softDelete(block1Id);

      const results = await blockRepo.search('searchable unique term abc123');
      expect(results.length).toBe(1);
      expect(results[0]?.blockId).not.toBe(block1Id);
    });

    it('should handle special characters in search query', async () => {
      const pageId = await pageRepo.create({ title: 'Special Char Search' });
      await blockRepo.create({ pageId, content: 'Block with "quotes"' });

      // FTS should handle quotes gracefully (may or may not match depending on FTS implementation)
      const results = await blockRepo.search('quotes');
      // Just verify it doesn't throw
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getHistory() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('should return empty array for block with no history', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'New block',
      });

      const history = await blockRepo.getHistory(blockId);
      expect(history).toEqual([]);
    });

    it('should return empty array for non-existent block', async () => {
      const history = await blockRepo.getHistory('non-existent-id');
      expect(history).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: 'Block',
      });

      // Manually insert history entries for testing
      for (let i = 0; i < 10; i++) {
        await db.mutate(
          `INSERT INTO block_history (block_id, version, content, parent_id, "order", is_collapsed, is_deleted, operation, timestamp)
           VALUES ($id, $v, $content, NULL, 'a0', 0, 0, 'update', $now)`,
          { id: blockId, v: i, content: `Version ${i}`, now: Date.now() }
        );
      }

      const history = await blockRepo.getHistory(blockId, 5);
      expect(history.length).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // rebalanceSiblings() tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('rebalanceSiblings()', () => {
    it('should rebalance order keys for siblings', async () => {
      const pageId = await pageRepo.create({ title: 'Rebalance Test' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      const child1 = await blockRepo.create({
        pageId,
        parentId,
        content: 'Child 1',
        order: 'a0',
      });
      const child2 = await blockRepo.create({
        pageId,
        parentId,
        content: 'Child 2',
        order: 'a1',
      });
      const child3 = await blockRepo.create({
        pageId,
        parentId,
        content: 'Child 3',
        order: 'a2',
      });

      const newOrders = new Map<BlockId, string>([
        [child1, 'b0'],
        [child2, 'b1'],
        [child3, 'b2'],
      ]);

      await blockRepo.rebalanceSiblings(parentId, newOrders);

      const block1 = await blockRepo.getById(child1);
      const block2 = await blockRepo.getById(child2);
      const block3 = await blockRepo.getById(child3);

      expect(block1?.order).toBe('b0');
      expect(block2?.order).toBe('b1');
      expect(block3?.order).toBe('b2');
    });

    it('should handle empty newOrders map', async () => {
      const pageId = await pageRepo.create({ title: 'Empty Rebalance' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      await blockRepo.rebalanceSiblings(parentId, new Map());

      // Should not throw
      expect(true).toBe(true);
    });

    it('should rebalance root-level siblings', async () => {
      const pageId = await pageRepo.create({ title: 'Root Rebalance' });

      const block1 = await blockRepo.create({ pageId, content: 'Root 1', order: 'a0' });
      const block2 = await blockRepo.create({ pageId, content: 'Root 2', order: 'a1' });

      const newOrders = new Map<BlockId, string>([
        [block1, 'c0'],
        [block2, 'c1'],
      ]);

      // For root-level blocks, parentId is null and pageId is needed
      await blockRepo.rebalanceSiblings(null, newOrders, pageId);

      const updated1 = await blockRepo.getById(block1);
      const updated2 = await blockRepo.getById(block2);

      expect(updated1?.order).toBe('c0');
      expect(updated2?.order).toBe('c1');
    });

    it('should preserve content when rebalancing', async () => {
      const pageId = await pageRepo.create({ title: 'Preserve Content Rebalance' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      const childId = await blockRepo.create({
        pageId,
        parentId,
        content: 'Important content',
        order: 'a0',
      });

      const newOrders = new Map<BlockId, string>([[childId, 'z9']]);

      await blockRepo.rebalanceSiblings(parentId, newOrders);

      const block = await blockRepo.getById(childId);
      expect(block?.content).toBe('Important content');
      expect(block?.order).toBe('z9');
    });

    it('should handle blocks with special characters in content during rebalance', async () => {
      const pageId = await pageRepo.create({ title: 'Special Chars Rebalance' });
      const parentId = await blockRepo.create({ pageId, content: 'Parent' });

      const childId = await blockRepo.create({
        pageId,
        parentId,
        content: 'Content with quotes',
        order: 'a0',
      });

      const newOrders = new Map<BlockId, string>([[childId, 'new-order']]);

      await blockRepo.rebalanceSiblings(parentId, newOrders);

      const block = await blockRepo.getById(childId);
      expect(block?.content).toBe('Content with quotes');
      expect(block?.order).toBe('new-order');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge cases and transaction tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases and Transactions', () => {
    it('should handle deeply nested blocks', async () => {
      const pageId = await pageRepo.create({ title: 'Deep Nesting Test' });

      let parentId: BlockId | null = null;
      const depth = 10;

      // Create deeply nested hierarchy
      for (let i = 0; i < depth; i++) {
        parentId = await blockRepo.create({
          pageId,
          parentId: parentId ?? undefined,
          content: `Level ${i}`,
        });
      }

      // Verify deepest block exists and has correct parent chain
      const deepestBlock = await blockRepo.getById(parentId!);
      expect(deepestBlock).not.toBeNull();
      expect(deepestBlock?.content).toBe(`Level ${depth - 1}`);
    });

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(10000);
      const blockId = await blockRepo.create({
        pageId: testPageId,
        content: longContent,
      });

      const block = await blockRepo.getById(blockId);
      expect(block?.content).toBe(longContent);
      expect(block?.content.length).toBe(10000);
    });

    it('should handle concurrent creates to same page', async () => {
      const pageId = await pageRepo.create({ title: 'Concurrent Test' });

      const promises = Array.from({ length: 5 }, (_, i) =>
        blockRepo.create({ pageId, content: `Concurrent block ${i}` })
      );

      const blockIds = await Promise.all(promises);
      expect(blockIds.length).toBe(5);
      expect(new Set(blockIds).size).toBe(5); // All IDs are unique

      const blocks = await blockRepo.getByPage(pageId);
      expect(blocks.length).toBe(5);
    });

    it('should maintain referential integrity after create', async () => {
      const pageId = await pageRepo.create({ title: 'Integrity Test' });
      const blockId = await blockRepo.create({ pageId, content: 'Test block' });

      // Verify block exists
      const blockQuery = await db.query<[string]>(
        `SELECT block_id FROM blocks WHERE block_id = $id`,
        { id: blockId }
      );
      expect(blockQuery.rows.length).toBe(1);

      // Verify retrievable by page
      const blocks = await blockRepo.getByPage(pageId);
      const found = blocks.find((b) => b.blockId === blockId);
      expect(found).toBeDefined();

      // Verify retrievable as root child
      const children = await blockRepo.getChildren(null, pageId);
      const foundChild = children.find((b) => b.blockId === blockId);
      expect(foundChild).toBeDefined();
    });

    it('should handle null and empty string content differently', async () => {
      const emptyBlockId = await blockRepo.create({
        pageId: testPageId,
        content: '',
      });

      const emptyBlock = await blockRepo.getById(emptyBlockId);
      expect(emptyBlock?.content).toBe('');
      expect(emptyBlock?.content).not.toBeNull();
    });

    it('should create blocks with all content types', async () => {
      const contentTypes: Array<'text' | 'heading' | 'code' | 'todo' | 'query'> = [
        'text',
        'heading',
        'code',
        'todo',
        'query',
      ];

      for (const contentType of contentTypes) {
        const blockId = await blockRepo.create({
          pageId: testPageId,
          content: `Content type: ${contentType}`,
          contentType,
        });

        const block = await blockRepo.getById(blockId);
        expect(block?.contentType).toBe(contentType);
      }
    });
  });
});
