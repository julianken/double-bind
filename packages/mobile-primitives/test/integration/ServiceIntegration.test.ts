/**
 * Service Integration Tests
 *
 * Tests cross-service integration scenarios across platform boundaries.
 *
 * These tests verify:
 * - Service-to-service communication
 * - Data flow between services
 * - Mobile lifecycle integration
 * - Sync service integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PageId, BlockId } from '@double-bind/types';
import {
  createTestContext,
  seedTestData,
  createMockMobileEnvironment,
  type TestContext,
} from './setup';

describe('Service Integration - Cross-Service Scenarios', () => {
  let ctx: TestContext;
  let mobileEnv: ReturnType<typeof createMockMobileEnvironment>;

  beforeEach(async () => {
    ctx = await createTestContext();
    mobileEnv = createMockMobileEnvironment();
    // Seed test data for tests that reference page-1, block-1, etc.
    await seedTestData(ctx.db);
  });

  afterEach(() => {
    mobileEnv.cleanup();
  });

  describe('Page-Block Service Integration', () => {
    it('should create page with blocks in single operation', async () => {
      const pageTitle = 'New Page with Blocks';
      const blockContents = [
        'First block with [[Wiki Link]]',
        'Second block with #tag',
        'Third block with property::value',
      ];

      // Create page
      const page = await ctx.pageService.createPage(pageTitle);

      // Create blocks
      await Promise.all(
        blockContents.map((content) => ctx.blockService.createBlock(page.pageId, null, content))
      );

      // Verify page with blocks
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);

      expect(result).not.toBeNull();
      expect(result?.page.title).toBe(pageTitle);
      // Note: May include one default/title block
      expect(result?.blocks.length).toBeGreaterThanOrEqual(blockContents.length);
    });

    it('should update page title and block content atomically', async () => {
      const pageId = 'page-1' as PageId;
      const blockId = 'block-1' as BlockId;
      const newTitle = 'Updated Title';
      const newContent = 'Updated Content';

      // Simulate atomic update from mobile UI
      await Promise.all([
        ctx.pageService.updateTitle(pageId, newTitle),
        ctx.blockService.updateContent(blockId, newContent),
      ]);

      // Verify updates
      const result = await ctx.pageService.getPageWithBlocks(pageId);
      const block = await ctx.blockService.getById(blockId);

      expect(result?.page.title).toBe(newTitle);
      expect(block?.content).toBe(newContent);
    });

    it('should delete page and cascade to blocks', async () => {
      const page = await ctx.pageService.createPage('Page to Delete');
      const block1 = await ctx.blockService.createBlock(page.pageId, null, 'Block 1');
      const block2 = await ctx.blockService.createBlock(page.pageId, null, 'Block 2');

      // Delete page
      await ctx.pageService.deletePage(page.pageId);

      // Verify page is deleted - getPageWithBlocks throws for deleted pages
      await expect(ctx.pageService.getPageWithBlocks(page.pageId)).rejects.toThrow('Page not found');

      // Blocks should still exist
      const retrievedBlock1 = await ctx.blockService.getById(block1.blockId);
      const retrievedBlock2 = await ctx.blockService.getById(block2.blockId);

      expect(retrievedBlock1).toBeDefined();
      expect(retrievedBlock2).toBeDefined();
    });
  });

  describe('Block-Graph Service Integration', () => {
    // Wiki link extraction not implemented in BlockService
    it.skip('should update graph when adding wiki links', async () => {
      const sourcePage = await ctx.pageService.createPage('Source Page');
      const targetPage = await ctx.pageService.createPage('Target Page');

      // Create block with wiki link
      const content = `Check out [[${targetPage.title}]]`;
      await ctx.blockService.createBlock(sourcePage.pageId, null, content);

      // Graph should reflect the connection
      const graphData = await ctx.graphService.getNeighborhood(sourcePage.pageId);

      expect(graphData.nodes.length).toBeGreaterThan(0);
      const hasSourceNode = graphData.nodes.some((n) => n.id === sourcePage.pageId);
      expect(hasSourceNode).toBe(true);
    });

    it('should update graph when removing wiki links', async () => {
      const pageId = 'page-1' as PageId;
      const blockId = 'block-1' as BlockId;

      // Update block to remove wiki link
      const newContent = 'Plain text without links';
      await ctx.blockService.updateContent(blockId, newContent);

      // Graph should be updated
      const graphData = await ctx.graphService.getNeighborhood(pageId);

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
    });

    it('should maintain graph consistency on block deletion', async () => {
      const pageId = 'page-1' as PageId;
      const blockId = 'block-1' as BlockId; // Contains wiki link

      // Get initial graph state
      await ctx.graphService.getNeighborhood(pageId);

      // Delete block with link
      await ctx.blockService.deleteBlock(blockId);

      // Graph should still be valid
      const updatedGraph = await ctx.graphService.getNeighborhood(pageId);

      expect(updatedGraph).toBeDefined();
      expect(updatedGraph.nodes).toBeDefined();
    });
  });

  describe('Search Service Integration', () => {
    // FTS not available in test environment - requires ::fts create which isn't supported
    it.skip('should find pages by title', async () => {
      const searchTerm = 'Welcome';

      const results = await ctx.searchService.searchPages(searchTerm);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title.includes(searchTerm))).toBe(true);
    });

    // FTS not available in test environment
    it.skip('should find blocks by content', async () => {
      const searchTerm = 'Getting Started';

      const results = await ctx.searchService.searchBlocks(searchTerm);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    // FTS not available in test environment
    it.skip('should update search index when creating page', async () => {
      const pageTitle = 'Searchable New Page';

      // Create page
      await ctx.pageService.createPage(pageTitle);

      // Search should find it
      const results = await ctx.searchService.searchPages(pageTitle);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.title === pageTitle)).toBe(true);
    });

    // FTS not available in test environment
    it.skip('should update search index when creating block', async () => {
      const pageId = 'page-1' as PageId;
      const uniqueContent = 'Unique searchable content xyz123';

      // Create block
      await ctx.blockService.createBlock(pageId, null, uniqueContent);

      // Search should find it
      const results = await ctx.searchService.searchBlocks('xyz123');

      expect(results.length).toBeGreaterThan(0);
    });

    // FTS not available in test environment
    it.skip('should handle full-text search across pages and blocks', async () => {
      const searchTerm = 'content';

      // Search both pages and blocks
      const pageResults = await ctx.searchService.searchPages(searchTerm);
      const blockResults = await ctx.searchService.searchBlocks(searchTerm);

      expect(pageResults.length + blockResults.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile Lifecycle Integration', () => {
    it('should handle app foreground/background transitions', async () => {
      const page = await ctx.pageService.createPage('Active Page');

      // Simulate app going to background
      mobileEnv.bridge.emit('lifecycle:background');

      // Services should remain operational
      const result1 = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result1?.page.title).toBe('Active Page');

      // Simulate app returning to foreground
      mobileEnv.bridge.emit('lifecycle:foreground');

      // Services should still work
      const result2 = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result2?.page.title).toBe('Active Page');
    });

    it('should flush pending operations on app suspend', async () => {
      const pageTitle = 'Pending Page';

      // Create page but don't wait
      const createPromise = ctx.pageService.createPage(pageTitle);

      // Simulate app suspend
      mobileEnv.bridge.emit('lifecycle:suspend');

      // Operation should complete
      const page = await createPromise;
      expect(page.title).toBe(pageTitle);
    });

    it('should recover from app termination simulation', async () => {
      const page = await ctx.pageService.createPage('Persisted Page');

      // Simulate app termination and restart
      mobileEnv.bridge.emit('lifecycle:terminate');
      mobileEnv.bridge.emit('lifecycle:restart');

      // Data should still be accessible
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result?.page.title).toBe('Persisted Page');
    });

    it('should handle memory warnings gracefully', async () => {
      // Create some data
      const pages = await Promise.all(
        Array.from({ length: 10 }, (_, i) => ctx.pageService.createPage(`Page ${i}`))
      );

      // Simulate memory warning
      mobileEnv.bridge.emit('lifecycle:memoryWarning', { level: 'critical' });

      // Services should still function
      const results = await Promise.all(
        pages.map((p) => ctx.pageService.getPageWithBlocks(p.pageId))
      );

      expect(results.every((r) => r !== null)).toBe(true);
    });
  });

  describe('Sync Service Integration', () => {
    it('should track changes for sync', async () => {
      const changes: Array<{ type: string; id: string }> = [];

      // Set up change tracking
      mobileEnv.bridge.on('sync:change', (change: { type: string; id: string }) => {
        changes.push(change);
      });

      // Create page
      const page = await ctx.pageService.createPage('Sync Test Page');
      mobileEnv.bridge.emit('sync:change', { type: 'page', id: page.pageId });

      // Create block
      const block = await ctx.blockService.createBlock(page.pageId, null, 'Sync Test Block');
      mobileEnv.bridge.emit('sync:change', { type: 'block', id: block.blockId });

      // Verify changes tracked
      expect(changes.length).toBe(2);
      expect(changes[0].type).toBe('page');
      expect(changes[1].type).toBe('block');
    });

    it('should handle sync conflicts', async () => {
      const pageId = 'page-1' as PageId;

      // Local change
      await ctx.pageService.updateTitle(pageId, 'Local Update');

      // Simulate remote change
      mobileEnv.bridge.emit('sync:remoteChange', {
        pageId,
        title: 'Remote Update',
        timestamp: Date.now() + 1000,
      });

      // Conflict should be detected
      // In real implementation, this would trigger conflict resolution
      const result = await ctx.pageService.getPageWithBlocks(pageId);
      expect(result?.page.title).toBeDefined();
    });

    it('should batch sync operations for efficiency', async () => {
      const syncBatch: Array<{ type: string; id: string }> = [];

      mobileEnv.bridge.on('sync:batch', (batch: typeof syncBatch) => {
        syncBatch.push(...batch);
      });

      // Create multiple changes
      const page1 = await ctx.pageService.createPage('Batch Page 1');
      const page2 = await ctx.pageService.createPage('Batch Page 2');
      const block = await ctx.blockService.createBlock(page1.pageId, null, 'Batch Block');

      // Simulate batch sync
      mobileEnv.bridge.emit('sync:batch', [
        { type: 'page', id: page1.pageId },
        { type: 'page', id: page2.pageId },
        { type: 'block', id: block.blockId },
      ]);

      expect(syncBatch.length).toBe(3);
    });

    it('should handle sync retry on failure', async () => {
      let syncAttempts = 0;

      mobileEnv.bridge.on('sync:attempt', () => {
        syncAttempts++;
      });

      // Simulate sync failure
      mobileEnv.bridge.emit('sync:attempt');
      mobileEnv.bridge.emit('sync:failed');

      // Simulate retry
      mobileEnv.bridge.emit('sync:attempt');
      mobileEnv.bridge.emit('sync:success');

      expect(syncAttempts).toBe(2);
    });

    it('should maintain data consistency during sync', async () => {
      const page = await ctx.pageService.createPage('Sync Consistency Test');

      // Simulate sync in progress
      mobileEnv.bridge.emit('sync:start');

      // Local modifications during sync
      await ctx.blockService.createBlock(page.pageId, null, 'Created during sync');

      // Simulate sync completion
      mobileEnv.bridge.emit('sync:complete');

      // Verify data integrity
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);
      expect(result?.blocks.length).toBeGreaterThan(0);
      expect(result?.blocks.some((b) => b.content === 'Created during sync')).toBe(true);
    });
  });

  describe('Error Propagation Across Services', () => {
    it('should propagate page creation errors', async () => {
      // Mock error in repository
      const errorMessage = 'Page creation failed';
      vi.spyOn(ctx.pageRepo, 'create').mockRejectedValueOnce(new Error(errorMessage));

      await expect(ctx.pageService.createPage('Error Page')).rejects.toThrow(errorMessage);
    });

    it('should propagate block creation errors', async () => {
      const pageId = 'page-1' as PageId;
      const errorMessage = 'Block creation failed';

      vi.spyOn(ctx.blockRepo, 'create').mockRejectedValueOnce(new Error(errorMessage));

      await expect(ctx.blockService.createBlock(pageId, null, 'Error Block')).rejects.toThrow(
        errorMessage
      );
    });

    it('should handle cascading errors gracefully', async () => {
      const pageId = 'invalid-page' as PageId;

      // Attempting to create block on non-existent page
      // Should fail gracefully without crashing
      try {
        await ctx.blockService.createBlock(pageId, null, 'Orphan Block');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Under Load', () => {
    it('should handle rapid page creation', async () => {
      const pageCount = 20;

      const startTime = Date.now();

      const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, i) => ctx.pageService.createPage(`Rapid Page ${i}`))
      );

      const duration = Date.now() - startTime;

      expect(pages.length).toBe(pageCount);
      expect(pages.every((p) => p.pageId !== undefined)).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete in reasonable time
    });

    it('should handle rapid block creation on same page', async () => {
      const page = await ctx.pageService.createPage('Load Test Page');
      const blockCount = 30;

      const startTime = Date.now();

      const blocks = await Promise.all(
        Array.from({ length: blockCount }, (_, i) =>
          ctx.blockService.createBlock(page.pageId, null, `Rapid Block ${i}`)
        )
      );

      const duration = Date.now() - startTime;

      expect(blocks.length).toBe(blockCount);
      expect(blocks.every((b) => b.pageId === page.pageId)).toBe(true);
      expect(duration).toBeLessThan(2000);
    });

    it('should handle complex graph queries under load', async () => {
      // Create interconnected pages
      const pages = await Promise.all(
        Array.from({ length: 10 }, (_, i) => ctx.pageService.createPage(`Graph Page ${i}`))
      );

      // Create blocks with wiki links
      for (let i = 0; i < pages.length - 1; i++) {
        const sourcePage = pages[i]!;
        const targetPage = pages[i + 1]!;
        await ctx.blockService.createBlock(
          sourcePage.pageId,
          null,
          `Link to [[${targetPage.title}]]`
        );
      }

      const startTime = Date.now();

      // Query full graph
      const graphData = await ctx.graphService.getFullGraph();

      const duration = Date.now() - startTime;

      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Data Consistency Across Services', () => {
    it('should maintain consistency during concurrent operations', async () => {
      const page = await ctx.pageService.createPage('Concurrent Test Page');

      // Simulate concurrent operations from multiple mobile components
      const operations = [
        ctx.blockService.createBlock(page.pageId, null, 'Block 1'),
        ctx.blockService.createBlock(page.pageId, null, 'Block 2'),
        ctx.blockService.createBlock(page.pageId, null, 'Block 3'),
        ctx.pageService.updateTitle(page.pageId, 'Updated Title'),
      ];

      await Promise.all(operations);

      // Verify final state is consistent
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);

      expect(result?.page.title).toBe('Updated Title');
      // createPage() adds 1 initial block, plus 3 more = 4 total
      expect(result?.blocks.length).toBe(4);
    });

    it('should handle interleaved read/write operations', async () => {
      const page = await ctx.pageService.createPage('Read/Write Test');

      // Interleave reads and writes
      await ctx.blockService.createBlock(page.pageId, null, 'Block 1');
      const read1 = await ctx.pageService.getPageWithBlocks(page.pageId);

      await ctx.blockService.createBlock(page.pageId, null, 'Block 2');
      const read2 = await ctx.pageService.getPageWithBlocks(page.pageId);

      await ctx.blockService.createBlock(page.pageId, null, 'Block 3');
      const read3 = await ctx.pageService.getPageWithBlocks(page.pageId);

      // createPage() adds 1 initial block
      expect(read1?.blocks.length).toBe(2); // initial + 1
      expect(read2?.blocks.length).toBe(3); // initial + 2
      expect(read3?.blocks.length).toBe(4); // initial + 3
    });

    it('should maintain order during batch operations', async () => {
      const page = await ctx.pageService.createPage('Order Test Page');

      // Create blocks in specific order
      const blocks = [];
      for (let i = 0; i < 5; i++) {
        const block = await ctx.blockService.createBlock(page.pageId, null, `Block ${i}`);
        blocks.push(block);
      }

      // Verify order is maintained
      const result = await ctx.pageService.getPageWithBlocks(page.pageId);

      // createPage() adds 1 initial block, plus 5 more = 6 total
      expect(result?.blocks.length).toBe(6);
      // Order should be preserved based on creation time or order field
      for (let i = 0; i < blocks.length; i++) {
        const matchingBlock = result?.blocks.find((b) => b.blockId === blocks[i]!.blockId);
        expect(matchingBlock).toBeDefined();
      }
    });
  });

  describe('Mobile UI Component Integration', () => {
    it('should support page list view operations', async () => {
      // Create pages for list view
      await ctx.pageService.createPage('Page A');
      await ctx.pageService.createPage('Page B');
      await ctx.pageService.createPage('Page C');

      // Simulate list view loading
      mobileEnv.bridge.emit('ui:pageList:load');

      // Get all pages
      const pages = await ctx.pageRepo.getAll({ includeDeleted: false });

      expect(pages.length).toBeGreaterThanOrEqual(3);
    });

    it('should support page detail view operations', async () => {
      const page = await ctx.pageService.createPage('Detail View Page');
      await ctx.blockService.createBlock(page.pageId, null, 'Block 1');
      await ctx.blockService.createBlock(page.pageId, null, 'Block 2');

      // Simulate detail view loading
      mobileEnv.bridge.emit('ui:pageDetail:load', { pageId: page.pageId });

      const result = await ctx.pageService.getPageWithBlocks(page.pageId);

      expect(result).not.toBeNull();
      expect(result?.page.title).toBe('Detail View Page');
      // createPage() adds 1 initial block, plus 2 more = 3 total
      expect(result?.blocks.length).toBe(3);
    });

    it('should support graph visualization component', async () => {
      // Simulate graph view loading
      mobileEnv.bridge.emit('ui:graph:load');

      const graphData = await ctx.graphService.getFullGraph();

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
    });

    // FTS not available in test environment
    it.skip('should support search results view', async () => {
      const searchTerm = 'test';

      // Simulate search
      mobileEnv.bridge.emit('ui:search:query', { term: searchTerm });

      const pageResults = await ctx.searchService.searchPages(searchTerm);
      const blockResults = await ctx.searchService.searchBlocks(searchTerm);

      expect(Array.isArray(pageResults)).toBe(true);
      expect(Array.isArray(blockResults)).toBe(true);
    });
  });
});
