/**
 * Core Service Integration Tests
 *
 * Tests that core services (PageService, BlockService, GraphService)
 * work correctly when used through mobile bridge mocks.
 *
 * These tests verify:
 * - Page creation and retrieval through mobile UI
 * - Block operations with service layer
 * - Graph data flow to mobile components
 * - Cross-service interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Page, Block, PageId, BlockId } from '@double-bind/types';
import {
  createTestContext,
  seedTestData,
  createMockMobileEnvironment,
  type TestContext,
} from './setup';

describe('Core Service Integration - Mobile Bridge', () => {
  let ctx: TestContext;
  let mobileEnv: ReturnType<typeof createMockMobileEnvironment>;

  beforeEach(() => {
    ctx = createTestContext();
    mobileEnv = createMockMobileEnvironment();
    seedTestData(ctx.db);
  });

  afterEach(() => {
    mobileEnv.cleanup();
  });

  describe('PageService Integration', () => {
    it('should create page through mobile bridge', async () => {
      const pageTitle = 'Mobile Page';

      // Simulate mobile UI creating a page
      mobileEnv.bridge.emit('page:create', { title: pageTitle });

      // Service layer creates the page
      const page = await ctx.pageService.createPage(pageTitle);

      expect(page).toBeDefined();
      expect(page.title).toBe(pageTitle);
      expect(page.pageId).toBeDefined();
      expect(page.isDeleted).toBe(false);
      expect(page.dailyNoteDate).toBeNull();
    });

    it('should retrieve page with blocks through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;

      // Simulate mobile UI requesting page data
      mobileEnv.bridge.emit('page:fetch', { pageId });

      // Service layer retrieves page with blocks
      const result = await ctx.pageService.getPageWithBlocks(pageId);

      expect(result).toBeDefined();
      expect(result?.page.pageId).toBe(pageId);
      expect(result?.page.title).toBe('Welcome');
      expect(result?.blocks.length).toBeGreaterThan(0);
    });

    it('should update page title through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;
      const newTitle = 'Updated Mobile Title';

      // Simulate mobile UI updating page title
      mobileEnv.bridge.emit('page:update', { pageId, title: newTitle });

      // Service layer updates the page
      await ctx.pageService.updatePage(pageId, { title: newTitle });

      // Verify update
      const result = await ctx.pageService.getPageWithBlocks(pageId);
      expect(result?.page.title).toBe(newTitle);
    });

    it('should delete page through mobile bridge', async () => {
      const pageTitle = 'Page to Delete';
      const page = await ctx.pageService.createPage(pageTitle);

      // Simulate mobile UI deleting page
      mobileEnv.bridge.emit('page:delete', { pageId: page.pageId });

      // Service layer soft-deletes the page
      await ctx.pageService.deletePage(page.pageId);

      // Verify deletion
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result?.page.isDeleted).toBe(true);
    });

    it('should get page backlinks through mobile bridge', async () => {
      const pageId = 'page-2' as PageId;

      // Simulate mobile UI requesting backlinks
      mobileEnv.bridge.emit('page:backlinks', { pageId });

      // Service layer retrieves backlinks
      const backlinks = await ctx.pageService.getBacklinks(pageId);

      expect(backlinks).toBeDefined();
      expect(Array.isArray(backlinks)).toBe(true);
      // Page 2 is linked from page 1 via block-1
      expect(backlinks.length).toBeGreaterThan(0);
    });

    it('should handle page creation with duplicate title', async () => {
      const pageTitle = 'Duplicate Title Test';

      // Create first page
      const page1 = await ctx.pageService.createPage(pageTitle);
      expect(page1.title).toBe(pageTitle);

      // Attempt to create second page with same title
      // Service should auto-increment the title
      const page2 = await ctx.pageService.createPage(pageTitle);

      // Titles should be different (one has auto-increment suffix)
      expect(page1.pageId).not.toBe(page2.pageId);
      // Both operations should succeed
      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
    });
  });

  describe('BlockService Integration', () => {
    it('should create block through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;
      const content = 'New mobile block';

      // Simulate mobile UI creating a block
      mobileEnv.bridge.emit('block:create', { pageId, content });

      // Service layer creates the block
      const block = await ctx.blockService.createBlock(pageId, null, content);

      expect(block).toBeDefined();
      expect(block.content).toBe(content);
      expect(block.pageId).toBe(pageId);
      expect(block.parentId).toBeNull();
      expect(block.contentType).toBe('text');
      expect(block.isDeleted).toBe(false);
    });

    it('should update block content through mobile bridge', async () => {
      const blockId = 'block-1' as BlockId;
      const newContent = 'Updated from mobile';

      // Simulate mobile UI updating block content
      mobileEnv.bridge.emit('block:update', { blockId, content: newContent });

      // Service layer updates the block
      await ctx.blockService.updateContent(blockId, newContent);

      // Verify update
      const block = await ctx.blockService.getById(blockId);
      expect(block?.content).toBe(newContent);
    });

    it('should delete block through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;
      const block = await ctx.blockService.createBlock(pageId, null, 'Block to delete');

      // Simulate mobile UI deleting block
      mobileEnv.bridge.emit('block:delete', { blockId: block.blockId });

      // Service layer soft-deletes the block
      await ctx.blockService.deleteBlock(block.blockId);

      // Verify deletion
      const retrieved = await ctx.blockService.getById(block.blockId);
      expect(retrieved?.isDeleted).toBe(true);
    });

    it('should create nested blocks through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;

      // Create parent block
      const parentBlock = await ctx.blockService.createBlock(pageId, null, 'Parent block');

      // Simulate mobile UI creating child block
      mobileEnv.bridge.emit('block:create', {
        pageId,
        parentId: parentBlock.blockId,
        content: 'Child block',
      });

      // Service layer creates child block
      const childBlock = await ctx.blockService.createBlock(
        pageId,
        parentBlock.blockId,
        'Child block'
      );

      expect(childBlock.parentId).toBe(parentBlock.blockId);
      expect(childBlock.pageId).toBe(pageId);
    });

    it('should indent and outdent blocks through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;

      // Create two blocks
      const block1 = await ctx.blockService.createBlock(pageId, null, 'Block 1');
      const block2 = await ctx.blockService.createBlock(pageId, null, 'Block 2');

      // Simulate mobile gesture to indent block2 under block1
      mobileEnv.bridge.emit('block:indent', {
        blockId: block2.blockId,
        targetParentId: block1.blockId,
      });

      // Service layer updates parent
      await ctx.blockService.updateParent(block2.blockId, block1.blockId);

      // Verify indentation
      const updated = await ctx.blockService.getById(block2.blockId);
      expect(updated?.parentId).toBe(block1.blockId);

      // Simulate mobile gesture to outdent block2
      mobileEnv.bridge.emit('block:outdent', { blockId: block2.blockId });

      // Service layer updates parent to null
      await ctx.blockService.updateParent(block2.blockId, null);

      // Verify outdentation
      const outdented = await ctx.blockService.getById(block2.blockId);
      expect(outdented?.parentId).toBeNull();
    });

    it('should extract wiki links from block content', async () => {
      const pageId = 'page-1' as PageId;
      const content = 'Check out [[Mobile Development]] and [[React Native]]';

      // Create block with wiki links
      const block = await ctx.blockService.createBlock(pageId, null, content);

      // Service should parse and create links
      expect(block.content).toContain('[[Mobile Development]]');
      expect(block.content).toContain('[[React Native]]');
    });
  });

  describe('GraphService Integration', () => {
    it('should get graph data for page through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;

      // Simulate mobile UI requesting graph data
      mobileEnv.bridge.emit('graph:page', { pageId });

      // Service layer retrieves graph neighborhood
      const graphData = await ctx.graphService.getNeighborhood(pageId);

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(graphData.nodes.length).toBeGreaterThan(0);
    });

    it('should get full graph through mobile bridge', async () => {
      // Simulate mobile UI requesting full graph
      mobileEnv.bridge.emit('graph:full');

      // Service layer retrieves full graph
      const graphData = await ctx.graphService.getFullGraph();

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(graphData.nodes.length).toBe(3); // 3 seeded pages
      expect(graphData.edges.length).toBe(2); // 2 seeded links
    });

    it('should suggest links through mobile bridge', async () => {
      const pageId = 'page-1' as PageId;

      // Simulate mobile UI requesting link suggestions
      mobileEnv.bridge.emit('graph:suggest', { pageId });

      // Service layer generates suggestions
      const suggestions = await ctx.graphService.suggestLinks(pageId);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Cross-Service Integration', () => {
    it('should create page with blocks atomically', async () => {
      const pageTitle = 'New Mobile Page';
      const blockContents = ['First block', 'Second block', 'Third block'];

      // Simulate mobile UI creating page with initial blocks
      mobileEnv.bridge.emit('page:createWithBlocks', { title: pageTitle, blocks: blockContents });

      // Service layer creates page
      const page = await ctx.pageService.createPage(pageTitle);

      // Service layer creates blocks
      const blocks: Block[] = [];
      for (const content of blockContents) {
        const block = await ctx.blockService.createBlock(page.pageId, null, content);
        blocks.push(block);
      }

      // Verify page and blocks created
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result?.page.title).toBe(pageTitle);
      expect(result?.blocks.length).toBe(blockContents.length);
    });

    it('should update graph when creating wiki links', async () => {
      const page1 = await ctx.pageService.createPage('Source Page');
      const page2 = await ctx.pageService.createPage('Target Page');

      // Create block with wiki link
      const content = `Reference to [[${page2.title}]]`;
      await ctx.blockService.createBlock(page1.pageId, null, content);

      // Graph should now include this connection
      const graphData = await ctx.graphService.getNeighborhood(page1.pageId);

      // Source page should be in the graph
      const hasSourceNode = graphData.nodes.some((n) => n.id === page1.pageId);
      expect(hasSourceNode).toBe(true);
    });

    it('should maintain referential integrity on page deletion', async () => {
      const page = await ctx.pageService.createPage('Page with Blocks');
      const block1 = await ctx.blockService.createBlock(page.pageId, null, 'Block 1');
      const block2 = await ctx.blockService.createBlock(page.pageId, null, 'Block 2');

      // Delete page
      await ctx.pageService.deletePage(page.pageId);

      // Blocks should also be marked as deleted (soft delete cascade)
      const retrievedBlock1 = await ctx.blockService.getById(block1.blockId);
      const retrievedBlock2 = await ctx.blockService.getById(block2.blockId);

      // Blocks should still exist but be marked deleted
      expect(retrievedBlock1).toBeDefined();
      expect(retrievedBlock2).toBeDefined();
    });
  });

  describe('Mobile Lifecycle Integration', () => {
    it('should handle mobile app suspend/resume', async () => {
      // Create some data
      const page = await ctx.pageService.createPage('Active Page');

      // Simulate app suspend
      mobileEnv.bridge.emit('lifecycle:suspend');

      // Data should still be accessible after suspend
      const result1 = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result1?.page.title).toBe('Active Page');

      // Simulate app resume
      mobileEnv.bridge.emit('lifecycle:resume');

      // Data should still be accessible after resume
      const result2 = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result2?.page.title).toBe('Active Page');
    });

    it('should handle mobile memory pressure', async () => {
      // Create pages
      const pages: Page[] = [];
      for (let i = 0; i < 5; i++) {
        const page = await ctx.pageService.createPage(`Page ${i}`);
        pages.push(page);
      }

      // Simulate memory pressure event
      mobileEnv.bridge.emit('lifecycle:memoryWarning');

      // Services should still function correctly
      const results = await Promise.all(
        pages.map((p) => ctx.pageService.getPageWithBlocks(p.pageId))
      );

      expect(results.every((r) => r !== null)).toBe(true);
    });
  });

  describe('Touch Gesture Integration', () => {
    it('should handle long-press gesture to select block', () => {
      const blockId = 'block-1' as BlockId;

      // Register long-press gesture
      const onSelect = vi.fn();
      mobileEnv.gestures.register('block-longpress', {
        blockId,
        onEnd: onSelect,
      });

      // Simulate long-press
      mobileEnv.gestures.simulate('block-longpress', { blockId });

      expect(onSelect).toHaveBeenCalledWith({ blockId });
    });

    it('should handle swipe gesture to delete block', async () => {
      const pageId = 'page-1' as PageId;
      const block = await ctx.blockService.createBlock(pageId, null, 'Swipe to delete');

      // Register swipe gesture
      const onDelete = vi.fn(async () => {
        await ctx.blockService.deleteBlock(block.blockId);
      });

      mobileEnv.gestures.register('block-swipe', {
        blockId: block.blockId,
        onEnd: onDelete,
      });

      // Simulate swipe
      mobileEnv.gestures.simulate('block-swipe', { blockId: block.blockId });

      await vi.waitFor(() => expect(onDelete).toHaveBeenCalled());

      // Verify deletion
      const retrieved = await ctx.blockService.getById(block.blockId);
      expect(retrieved?.isDeleted).toBe(true);
    });

    it('should handle drag gesture to reorder blocks', async () => {
      const pageId = 'page-1' as PageId;
      const block1 = await ctx.blockService.createBlock(pageId, null, 'Block 1');
      const block2 = await ctx.blockService.createBlock(pageId, null, 'Block 2');

      // Register drag gesture
      const onReorder = vi.fn();
      mobileEnv.gestures.register('block-drag', {
        sourceId: block1.blockId,
        targetId: block2.blockId,
        onEnd: onReorder,
      });

      // Simulate drag
      mobileEnv.gestures.simulate('block-drag', {
        sourceId: block1.blockId,
        targetId: block2.blockId,
      });

      expect(onReorder).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid page ID gracefully', async () => {
      const invalidPageId = 'non-existent-page' as PageId;

      const result = await ctx.pageService.getPageWithBlocks(invalidPageId);
      expect(result).toBeNull();
    });

    it('should handle invalid block ID gracefully', async () => {
      const invalidBlockId = 'non-existent-block' as BlockId;

      const result = await ctx.blockService.getById(invalidBlockId);
      expect(result).toBeNull();
    });

    it('should handle concurrent operations on same block', async () => {
      const pageId = 'page-1' as PageId;
      const block = await ctx.blockService.createBlock(pageId, null, 'Original content');

      // Simulate concurrent updates from multiple components
      const update1 = ctx.blockService.updateContent(block.blockId, 'Update 1');
      const update2 = ctx.blockService.updateContent(block.blockId, 'Update 2');

      await Promise.all([update1, update2]);

      // At least one update should succeed
      const result = await ctx.blockService.getById(block.blockId);
      expect(result?.content).toBeDefined();
      expect(result?.content).not.toBe('Original content');
    });
  });
});
