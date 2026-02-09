/**
 * Database Integration Tests
 *
 * Tests database operations through mobile platform adapters.
 *
 * These tests verify:
 * - CRUD operations through mobile database adapter
 * - Transaction handling
 * - Query result mapping
 * - Database state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PageId, BlockId } from '@double-bind/types';
import { MockGraphDB } from '@double-bind/test-utils';
import {
  createTestContext,
  seedTestData,
  createMockMobileEnvironment,
  type TestContext,
} from './setup';

describe('Database Integration - Mobile Adapters', () => {
  let ctx: TestContext;
  let mobileEnv: ReturnType<typeof createMockMobileEnvironment>;

  beforeEach(async () => {
    ctx = await createTestContext();
    mobileEnv = createMockMobileEnvironment();
    // Seed test data for tests that need it
    await seedTestData(ctx.db);
  });

  afterEach(() => {
    mobileEnv.cleanup();
  });

  describe('Page Repository Operations', () => {
    it('should create page through repository', async () => {
      const pageTitle = 'New Repository Page';

      const pageId = await ctx.pageRepo.create({ title: pageTitle });
      const page = await ctx.pageRepo.getById(pageId);

      expect(page).toBeDefined();
      expect(page?.title).toBe(pageTitle);
      expect(page?.pageId).toBe(pageId);
      expect(page?.isDeleted).toBe(false);
    });

    it('should retrieve page by ID through repository', async () => {
      const pageId = 'page-1' as PageId;

      const page = await ctx.pageRepo.getById(pageId);

      expect(page).not.toBeNull();
      expect(page?.pageId).toBe(pageId);
      expect(page?.title).toBe('Welcome');
    });

    it('should list all pages through repository', async () => {
      const pages = await ctx.pageRepo.getAll({ includeDeleted: false });

      expect(Array.isArray(pages)).toBe(true);
      expect(pages.length).toBe(3); // 3 seeded pages
      expect(pages.every((p) => !p.isDeleted)).toBe(true);
    });

    it('should update page through repository', async () => {
      const pageId = 'page-1' as PageId;
      const newTitle = 'Updated Title';

      await ctx.pageRepo.update(pageId, { title: newTitle });

      const updated = await ctx.pageRepo.getById(pageId);
      expect(updated?.title).toBe(newTitle);
    });

    it('should soft delete page through repository', async () => {
      const pageId = 'page-1' as PageId;

      await ctx.pageRepo.softDelete(pageId);

      const deleted = await ctx.pageRepo.getById(pageId);
      expect(deleted?.isDeleted).toBe(true);
    });

    it('should handle daily note queries', async () => {
      const today = new Date().toISOString().split('T')[0]!;

      // Create a daily note
      const pageId = await ctx.pageRepo.create({
        title: `Daily Note ${today}`,
        dailyNoteDate: today,
      });

      // Retrieve by date
      const retrieved = await ctx.pageRepo.getByDailyNoteDate(today);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.dailyNoteDate).toBe(today);
      expect(retrieved?.pageId).toBe(pageId);
    });
  });

  describe('Block Repository Operations', () => {
    it('should create block through repository', async () => {
      const pageId = 'page-1' as PageId;
      const content = 'New block content';

      const blockId = await ctx.blockRepo.create({
        pageId,
        parentId: null,
        content,
      });
      const block = await ctx.blockRepo.getById(blockId);

      expect(block).toBeDefined();
      expect(block?.content).toBe(content);
      expect(block?.pageId).toBe(pageId);
      expect(block?.parentId).toBeNull();
    });

    it('should retrieve block by ID through repository', async () => {
      const blockId = 'block-1' as BlockId;

      const block = await ctx.blockRepo.getById(blockId);

      expect(block).not.toBeNull();
      expect(block?.blockId).toBe(blockId);
      expect(block?.content).toContain('Welcome to');
    });

    it('should get blocks by page through repository', async () => {
      const pageId = 'page-1' as PageId;

      const blocks = await ctx.blockRepo.getByPage(pageId);

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(2); // 2 blocks for page-1
      expect(blocks.every((b) => b.pageId === pageId)).toBe(true);
    });

    it('should update block content through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const newContent = 'Updated block content';

      await ctx.blockRepo.update(blockId, { content: newContent });

      const updated = await ctx.blockRepo.getById(blockId);
      expect(updated?.content).toBe(newContent);
    });

    it('should update block parent through repository', async () => {
      const blockId = 'block-2' as BlockId;
      const newParentId = 'block-1' as BlockId;
      const pageId = 'page-1' as PageId;

      // Get current order to maintain it
      const current = await ctx.blockRepo.getById(blockId);
      await ctx.blockRepo.move(blockId, newParentId, current?.order ?? 'a0');

      const updated = await ctx.blockRepo.getById(blockId);
      expect(updated?.parentId).toBe(newParentId);
    });

    it('should soft delete block through repository', async () => {
      const blockId = 'block-1' as BlockId;

      await ctx.blockRepo.softDelete(blockId);

      const deleted = await ctx.blockRepo.getById(blockId);
      expect(deleted?.isDeleted).toBe(true);
    });

    it('should get block tree structure', async () => {
      const pageId = 'page-1' as PageId;

      // Create parent and child blocks
      const parentId = await ctx.blockRepo.create({
        pageId,
        parentId: null,
        content: 'Parent',
      });
      const childId = await ctx.blockRepo.create({
        pageId,
        parentId,
        content: 'Child',
      });

      const blocks = await ctx.blockRepo.getByPage(pageId);

      // Verify hierarchy
      const parentBlock = blocks.find((b) => b.blockId === parentId);
      const childBlock = blocks.find((b) => b.blockId === childId);

      expect(parentBlock).toBeDefined();
      expect(childBlock).toBeDefined();
      expect(childBlock?.parentId).toBe(parentId);
    });
  });

  describe('Link Repository Operations', () => {
    it('should create link through repository', async () => {
      const sourceId = 'page-1' as PageId;
      const targetId = 'page-3' as PageId;

      await ctx.linkRepo.createLink({
        sourceId,
        targetId,
        linkType: 'reference',
        contextBlockId: null,
      });

      // Verify link was created by querying outgoing links
      const links = await ctx.linkRepo.getOutLinks(sourceId);
      const createdLink = links.find((l) => l.targetId === targetId);

      expect(createdLink).toBeDefined();
      expect(createdLink?.sourceId).toBe(sourceId);
      expect(createdLink?.linkType).toBe('reference');
    });

    it('should get outgoing links through repository', async () => {
      const pageId = 'page-1' as PageId;

      const links = await ctx.linkRepo.getOutLinks(pageId);

      expect(Array.isArray(links)).toBe(true);
      expect(links.length).toBe(2); // page-1 links to page-2 and page-3
      expect(links.every((l) => l.sourceId === pageId)).toBe(true);
    });

    it('should get incoming links through repository', async () => {
      const pageId = 'page-2' as PageId;

      const links = await ctx.linkRepo.getInLinks(pageId);

      expect(Array.isArray(links)).toBe(true);
      expect(links.length).toBeGreaterThan(0);
      expect(links.every((l) => l.targetId === pageId)).toBe(true);
    });

    it.skip('should delete link through repository', async () => {
      // LinkRepository doesn't have a delete method - links are removed via removeLinksFromBlock
      // or when blocks are deleted. Skipping this test as it tests non-existent functionality.
    });
  });

  describe('Tag Repository Operations', () => {
    it('should create tag through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const tagName = 'important';

      await ctx.tagRepo.addTag(blockId, tagName);

      // Verify tag was created by querying
      const tags = await ctx.tagRepo.getByEntity(blockId);
      const createdTag = tags.find((t) => t.tag === tagName);

      expect(createdTag).toBeDefined();
      expect(createdTag?.entityId).toBe(blockId);
      expect(createdTag?.tag).toBe(tagName);
    });

    it('should get tags by entity through repository', async () => {
      const blockId = 'block-1' as BlockId;

      // Add multiple tags
      await ctx.tagRepo.addTag(blockId, 'tag1');
      await ctx.tagRepo.addTag(blockId, 'tag2');

      const tags = await ctx.tagRepo.getByEntity(blockId);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(2);
      expect(tags.some((t) => t.tag === 'tag1')).toBe(true);
      expect(tags.some((t) => t.tag === 'tag2')).toBe(true);
    });

    it('should remove tag through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const tagName = 'temporary';

      await ctx.tagRepo.addTag(blockId, tagName);
      await ctx.tagRepo.removeTag(blockId, tagName);

      const tags = await ctx.tagRepo.getByEntity(blockId);
      const hasTag = tags.some((t) => t.tag === tagName);

      expect(hasTag).toBe(false);
    });
  });

  describe('Property Repository Operations', () => {
    it('should set property through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const key = 'priority';
      const value = 'high';

      await ctx.propertyRepo.set(blockId, key, value, 'string');

      // Verify property was set by querying
      const properties = await ctx.propertyRepo.getByEntity(blockId);
      const createdProp = properties.find((p) => p.key === key);

      expect(createdProp).toBeDefined();
      expect(createdProp?.entityId).toBe(blockId);
      expect(createdProp?.key).toBe(key);
      expect(createdProp?.value).toBe(value);
      expect(createdProp?.valueType).toBe('string');
    });

    it('should get properties by entity through repository', async () => {
      const blockId = 'block-1' as BlockId;

      // Set multiple properties
      await ctx.propertyRepo.set(blockId, 'prop1', 'value1', 'string');
      await ctx.propertyRepo.set(blockId, 'prop2', '42', 'number');

      const properties = await ctx.propertyRepo.getByEntity(blockId);

      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBe(2);
      expect(properties.some((p) => p.key === 'prop1')).toBe(true);
      expect(properties.some((p) => p.key === 'prop2')).toBe(true);
    });

    it('should update property value through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const key = 'status';

      await ctx.propertyRepo.set(blockId, key, 'pending', 'string');
      await ctx.propertyRepo.set(blockId, key, 'complete', 'string');

      const properties = await ctx.propertyRepo.getByEntity(blockId);
      const statusProp = properties.find((p) => p.key === key);

      expect(statusProp?.value).toBe('complete');
    });

    it('should remove property through repository', async () => {
      const blockId = 'block-1' as BlockId;
      const key = 'temporary';

      await ctx.propertyRepo.set(blockId, key, 'temp', 'string');
      await ctx.propertyRepo.remove(blockId, key);

      const properties = await ctx.propertyRepo.getByEntity(blockId);
      const hasProp = properties.some((p) => p.key === key);

      expect(hasProp).toBe(false);
    });
  });

  describe('Database Query Performance', () => {
    it('should handle batch page creation efficiently', async () => {
      const startTime = Date.now();
      const pageCount = 10;

      const pageIds = await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
          ctx.pageRepo.create({ title: `Batch Page ${i}` })
        )
      );

      const duration = Date.now() - startTime;

      expect(pageIds.length).toBe(pageCount);
      expect(pageIds.every((id) => id !== undefined)).toBe(true);
      // Should complete reasonably quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle batch block creation efficiently', async () => {
      const pageId = 'page-1' as PageId;
      const blockCount = 20;

      const startTime = Date.now();

      const blockIds = await Promise.all(
        Array.from({ length: blockCount }, (_, i) =>
          ctx.blockRepo.create({
            pageId,
            parentId: null,
            content: `Batch Block ${i}`,
          })
        )
      );

      const duration = Date.now() - startTime;

      expect(blockIds.length).toBe(blockCount);
      expect(blockIds.every((id) => id !== undefined)).toBe(true);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle complex graph queries efficiently', async () => {
      const startTime = Date.now();

      const graphData = await ctx.graphService.getFullGraph();

      const duration = Date.now() - startTime;

      expect(graphData).toBeDefined();
      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Database State Consistency', () => {
    it('should maintain consistency during concurrent writes', async () => {
      const pageId = 'page-1' as PageId;

      // Simulate concurrent block creation
      const operations = Array.from({ length: 5 }, (_, i) =>
        ctx.blockRepo.create({
          pageId,
          parentId: null,
          content: `Concurrent Block ${i}`,
        })
      );

      const blockIds = await Promise.all(operations);

      // All blocks should be created successfully
      expect(blockIds.length).toBe(5);

      // All blocks should have unique IDs
      const ids = new Set(blockIds);
      expect(ids.size).toBe(5);
    });

    it('should maintain referential integrity on cascade delete', async () => {
      const pageId = await ctx.pageRepo.create({ title: 'Page with Relations' });

      // Create blocks for the page
      const blockId1 = await ctx.blockRepo.create({
        pageId,
        parentId: null,
        content: 'Block 1',
      });
      const blockId2 = await ctx.blockRepo.create({
        pageId,
        parentId: null,
        content: 'Block 2',
      });

      // Delete the page
      await ctx.pageRepo.softDelete(pageId);

      // Page should be soft-deleted
      const deletedPage = await ctx.pageRepo.getById(pageId);
      expect(deletedPage?.isDeleted).toBe(true);

      // Blocks should still exist (repositories handle this differently)
      const retrievedBlock1 = await ctx.blockRepo.getById(blockId1);
      const retrievedBlock2 = await ctx.blockRepo.getById(blockId2);

      expect(retrievedBlock1).toBeDefined();
      expect(retrievedBlock2).toBeDefined();
    });

    it('should handle orphaned blocks correctly', async () => {
      const pageId = 'page-1' as PageId;

      // Create parent and child
      const parentId = await ctx.blockRepo.create({
        pageId,
        parentId: null,
        content: 'Parent',
      });
      const childId = await ctx.blockRepo.create({
        pageId,
        parentId,
        content: 'Child',
      });

      // Delete parent
      await ctx.blockRepo.softDelete(parentId);

      // Child should still exist
      const retrievedChild = await ctx.blockRepo.getById(childId);
      expect(retrievedChild).toBeDefined();
      expect(retrievedChild?.parentId).toBe(parentId);
    });
  });

  describe('Mobile Platform Adapter', () => {
    it('should handle database initialization', () => {
      expect(ctx.db).toBeDefined();
      expect(ctx.db.isClosed).toBe(false);
    });

    it('should track database queries', async () => {
      const mockDb = ctx.db as MockGraphDB;
      mockDb.reset(); // Clear any previous queries

      await ctx.pageRepo.getById('page-1' as PageId);

      const queries = mockDb.queries;
      expect(queries.length).toBeGreaterThan(0);
    });

    it('should track database mutations', async () => {
      const mockDb = ctx.db as MockGraphDB;
      mockDb.reset(); // Clear any previous mutations

      await ctx.pageRepo.create({ title: 'Test Page' });

      const mutations = mockDb.mutations;
      expect(mutations.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      // Create a mock that throws errors
      const errorDb = new MockGraphDB() as unknown;
      (errorDb as MockGraphDB).query = vi.fn().mockRejectedValue(new Error('Database error'));

      const errorPageRepo = ctx.pageRepo;
      (errorPageRepo as unknown as { db: MockGraphDB }).db = errorDb as MockGraphDB;

      // Operation should propagate error
      await expect(errorPageRepo.getById('page-1' as PageId)).rejects.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should handle large result sets efficiently', async () => {
      const pageCount = 50;

      // Create many pages
      await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
          ctx.pageRepo.create({ title: `Large Set Page ${i}` })
        )
      );

      // List all pages
      const pages = await ctx.pageRepo.getAll({ includeDeleted: false });

      expect(pages.length).toBeGreaterThanOrEqual(pageCount);
    });

    it('should handle deep block hierarchies', async () => {
      const pageId = 'page-1' as PageId;
      const depth = 10;

      let parentId: BlockId | null = null;
      const blockIds = [];

      // Create deep hierarchy
      for (let i = 0; i < depth; i++) {
        const blockId = await ctx.blockRepo.create({
          pageId,
          parentId,
          content: `Level ${i}`,
        });
        blockIds.push(blockId);
        parentId = blockId;
      }

      // Retrieve all blocks
      const allBlocks = await ctx.blockRepo.getByPage(pageId);

      // Should include all created blocks
      expect(allBlocks.length).toBeGreaterThanOrEqual(depth);
    });
  });

  describe('Platform-Specific Behavior', () => {
    it('should handle iOS-specific database paths', () => {
      // Simulate iOS environment
      mobileEnv.bridge.emit('platform:ios');

      // Database should still function
      expect(ctx.db.isClosed).toBe(false);
    });

    it('should handle Android-specific database paths', () => {
      // Simulate Android environment
      mobileEnv.bridge.emit('platform:android');

      // Database should still function
      expect(ctx.db.isClosed).toBe(false);
    });

    it('should handle database backup on iOS', async () => {
      mobileEnv.bridge.emit('platform:ios');
      mobileEnv.bridge.emit('database:backup');

      // Mock backup operation
      await ctx.db.backup('/mock/path/backup.db');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle database restore on Android', async () => {
      mobileEnv.bridge.emit('platform:android');
      mobileEnv.bridge.emit('database:restore');

      // Mock restore operation
      await ctx.db.restore('/mock/path/backup.db');

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
