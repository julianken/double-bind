/**
 * Unit tests for SyncExportService.
 *
 * Tests full and incremental export functionality including:
 * - Full export with all entities
 * - Incremental export with timestamp filtering
 * - Metadata validation
 * - HLC timestamp handling
 * - Edge cases (empty database, no changes since last sync)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncExportService } from '../../src/sync/SyncExportService';
import type { GraphDB, Page, Block, Link } from '@double-bind/types';
import { serializeHLC, generateHLC } from '../../src/sync/hlc';

/**
 * Mock GraphDB implementation for testing.
 *
 * Stores data in memory and provides query interface that matches
 * expected Datalog query patterns.
 */
class MockGraphDB implements GraphDB {
  private pages: Page[] = [];
  private blocks: Block[] = [];
  private links: Link[] = [];

  async query(script: string, params?: Record<string, unknown>) {
    // Parse query to determine what data to return
    if (script.includes('*pages')) {
      let filteredPages = [...this.pages];

      // Apply filters - order matters!
      // First apply timestamp filter (incremental export)
      if (params?.last_sync !== undefined) {
        const lastSync = params.last_sync as number;
        filteredPages = filteredPages.filter((p) => p.updatedAt > lastSync);
      }
      // Then apply is_deleted filter (full export only)
      else if (script.includes('is_deleted == false')) {
        filteredPages = filteredPages.filter((p) => !p.isDeleted);
      }

      return {
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: filteredPages.map((p) => [
          p.pageId,
          p.title,
          p.createdAt,
          p.updatedAt,
          p.isDeleted,
          p.dailyNoteDate,
        ]),
      };
    }

    if (script.includes('*blocks')) {
      let filteredBlocks = [...this.blocks];

      // Apply filters - order matters!
      // First apply timestamp filter (incremental export)
      if (params?.last_sync !== undefined) {
        const lastSync = params.last_sync as number;
        filteredBlocks = filteredBlocks.filter((b) => b.updatedAt > lastSync);
      }
      // Then apply is_deleted filter (full export only)
      else if (script.includes('is_deleted == false')) {
        filteredBlocks = filteredBlocks.filter((b) => !b.isDeleted);
      }

      return {
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: filteredBlocks.map((b) => [
          b.blockId,
          b.pageId,
          b.parentId,
          b.content,
          b.contentType,
          b.order,
          b.isCollapsed,
          b.isDeleted,
          b.createdAt,
          b.updatedAt,
        ]),
      };
    }

    if (script.includes('*links')) {
      let filteredLinks = [...this.links];

      if (params?.last_sync !== undefined) {
        const lastSync = params.last_sync as number;
        filteredLinks = filteredLinks.filter((l) => l.createdAt > lastSync);
      }

      return {
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: filteredLinks.map((l) => [
          l.sourceId,
          l.targetId,
          l.linkType,
          l.createdAt,
          l.contextBlockId,
        ]),
      };
    }

    return { headers: [], rows: [] };
  }

  async mutate() {
    return { headers: [], rows: [] };
  }

  async importRelations() {}
  async exportRelations() {
    return {};
  }
  async backup() {}
  async restore() {}
  async importRelationsFromBackup() {}
  async close() {}

  // Test helpers
  setPages(pages: Page[]) {
    this.pages = pages;
  }

  setBlocks(blocks: Block[]) {
    this.blocks = blocks;
  }

  setLinks(links: Link[]) {
    this.links = links;
  }

  clear() {
    this.pages = [];
    this.blocks = [];
    this.links = [];
  }
}

describe('SyncExportService', () => {
  let db: MockGraphDB;
  let service: SyncExportService;
  let deviceId: string;

  beforeEach(() => {
    // Use unique device ID per test to avoid HLC state contamination
    deviceId = `test-device-${Date.now()}-${Math.random()}`;
    db = new MockGraphDB();
    service = new SyncExportService(db, deviceId);
  });

  describe('constructor', () => {
    it('should initialize with device ID', () => {
      expect(service.getDeviceId()).toBe(deviceId);
    });
  });

  describe('exportFull', () => {
    it('should export all non-deleted pages, blocks, and links', async () => {
      // Setup test data
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Test Page 1',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: 'Test Page 2',
          createdAt: 1500,
          updatedAt: 2500,
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Block content 1',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: 'block-1',
          content: 'Block content 2',
          contentType: 'text',
          order: 'a1',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1100,
          updatedAt: 2100,
        },
      ];

      const links: Link[] = [
        {
          sourceId: 'page-1',
          targetId: 'page-2',
          linkType: 'reference',
          createdAt: 1200,
          contextBlockId: 'block-1',
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);
      db.setLinks(links);

      const exportPkg = await service.exportFull();

      // Validate structure
      expect(exportPkg.version).toBe('1.0.0');
      expect(exportPkg.deviceId).toBe(deviceId);
      expect(exportPkg.exportedAt).toMatch(/^\d+-\d+-test-device-/);
      expect(exportPkg.exportedAt).toContain(deviceId);
      expect(exportPkg.lastSyncAt).toBeUndefined();

      // Validate data
      expect(exportPkg.data.pages).toHaveLength(2);
      expect(exportPkg.data.pages).toEqual(pages);

      expect(exportPkg.data.blocks).toHaveLength(2);
      expect(exportPkg.data.blocks).toEqual(blocks);

      expect(exportPkg.data.links).toHaveLength(1);
      expect(exportPkg.data.links).toEqual(links);

      // Validate metadata
      expect(exportPkg.metadata).toEqual({
        pageCount: 2,
        blockCount: 2,
        linkCount: 1,
        isIncremental: false,
      });
    });

    it('should exclude deleted pages and blocks', async () => {
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Active Page',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: 'Deleted Page',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: true,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Active block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: null,
          content: 'Deleted block',
          contentType: 'text',
          order: 'a1',
          isCollapsed: false,
          isDeleted: true,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);

      const exportPkg = await service.exportFull();

      // Only non-deleted entities
      expect(exportPkg.data.pages).toHaveLength(1);
      expect(exportPkg.data.pages[0]!.pageId).toBe('page-1');

      expect(exportPkg.data.blocks).toHaveLength(1);
      expect(exportPkg.data.blocks[0]!.blockId).toBe('block-1');

      expect(exportPkg.metadata.pageCount).toBe(1);
      expect(exportPkg.metadata.blockCount).toBe(1);
    });

    it('should handle empty database', async () => {
      const exportPkg = await service.exportFull();

      expect(exportPkg.data.pages).toHaveLength(0);
      expect(exportPkg.data.blocks).toHaveLength(0);
      expect(exportPkg.data.links).toHaveLength(0);

      expect(exportPkg.metadata).toEqual({
        pageCount: 0,
        blockCount: 0,
        linkCount: 0,
        isIncremental: false,
      });
    });

    it('should include daily note pages', async () => {
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Regular Page',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: '2024-02-09',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: false,
          dailyNoteDate: '2024-02-09',
        },
      ];

      db.setPages(pages);

      const exportPkg = await service.exportFull();

      expect(exportPkg.data.pages).toHaveLength(2);
      expect(exportPkg.data.pages.find((p) => p.dailyNoteDate === '2024-02-09')).toBeDefined();
    });
  });

  describe('exportIncremental', () => {
    it('should export only entities changed since last sync', async () => {
      const lastSyncTime = 2000;
      const lastSyncHLC = serializeHLC(generateHLC(deviceId, lastSyncTime));

      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Old Page',
          createdAt: 1000,
          updatedAt: 1500, // Before lastSyncTime
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: 'New Page',
          createdAt: 2500,
          updatedAt: 2500, // After lastSyncTime
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-3',
          title: 'Updated Page',
          createdAt: 1000,
          updatedAt: 3000, // After lastSyncTime
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Old block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 1500, // Before lastSyncTime
        },
        {
          blockId: 'block-2',
          pageId: 'page-2',
          parentId: null,
          content: 'New block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 2500,
          updatedAt: 2500, // After lastSyncTime
        },
      ];

      const links: Link[] = [
        {
          sourceId: 'page-1',
          targetId: 'page-2',
          linkType: 'reference',
          createdAt: 1500, // Before lastSyncTime
          contextBlockId: 'block-1',
        },
        {
          sourceId: 'page-2',
          targetId: 'page-3',
          linkType: 'reference',
          createdAt: 2500, // After lastSyncTime
          contextBlockId: 'block-2',
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);
      db.setLinks(links);

      const exportPkg = await service.exportIncremental(lastSyncHLC);

      // Validate structure
      expect(exportPkg.version).toBe('1.0.0');
      expect(exportPkg.deviceId).toBe(deviceId);
      expect(exportPkg.lastSyncAt).toBe(lastSyncHLC);

      // Only entities changed after lastSyncTime
      expect(exportPkg.data.pages).toHaveLength(2);
      expect(exportPkg.data.pages.map((p) => p.pageId)).toEqual(['page-2', 'page-3']);

      expect(exportPkg.data.blocks).toHaveLength(1);
      expect(exportPkg.data.blocks[0]!.blockId).toBe('block-2');

      expect(exportPkg.data.links).toHaveLength(1);
      expect(exportPkg.data.links[0]!.sourceId).toBe('page-2');

      // Validate metadata
      expect(exportPkg.metadata).toEqual({
        pageCount: 2,
        blockCount: 1,
        linkCount: 1,
        isIncremental: true,
      });
    });

    it('should include deleted entities in incremental export', async () => {
      const lastSyncTime = 2000;
      const lastSyncHLC = serializeHLC(generateHLC(deviceId, lastSyncTime));

      // Entity that was deleted after last sync
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Deleted Page',
          createdAt: 1000,
          updatedAt: 2500, // Updated (deleted) after lastSyncTime
          isDeleted: true,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Deleted block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: true,
          createdAt: 1000,
          updatedAt: 2500, // Updated (deleted) after lastSyncTime
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);

      const exportPkg = await service.exportIncremental(lastSyncHLC);

      // Incremental exports include deleted entities if they changed
      expect(exportPkg.data.pages).toHaveLength(1);
      expect(exportPkg.data.pages[0]!.isDeleted).toBe(true);

      expect(exportPkg.data.blocks).toHaveLength(1);
      expect(exportPkg.data.blocks[0]!.isDeleted).toBe(true);
    });

    it('should return empty export when no changes since last sync', async () => {
      const lastSyncTime = 3000;
      const lastSyncHLC = serializeHLC(generateHLC(deviceId, lastSyncTime));

      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Old Page',
          createdAt: 1000,
          updatedAt: 2000, // Before lastSyncTime
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Old block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 2000, // Before lastSyncTime
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);

      const exportPkg = await service.exportIncremental(lastSyncHLC);

      expect(exportPkg.data.pages).toHaveLength(0);
      expect(exportPkg.data.blocks).toHaveLength(0);
      expect(exportPkg.data.links).toHaveLength(0);

      expect(exportPkg.metadata).toEqual({
        pageCount: 0,
        blockCount: 0,
        linkCount: 0,
        isIncremental: true,
      });
    });

    it('should parse HLC timestamp correctly', async () => {
      // Test with various HLC formats
      const hlcFormats = [
        '1707456123456-0-device-123',
        '1707456123456-5-device-mobile-abc',
        '1000000000000-99-simple-device',
      ];

      for (const hlcString of hlcFormats) {
        // Should not throw
        await service.exportIncremental(hlcString);
      }
    });

    it('should throw on invalid HLC format', async () => {
      const invalidFormats = ['invalid', '123', 'abc-def', '123-abc-device'];

      for (const invalid of invalidFormats) {
        await expect(service.exportIncremental(invalid)).rejects.toThrow(/Invalid HLC/);
      }
    });
  });

  describe('export consistency', () => {
    it('should generate unique export timestamps', async () => {
      const export1 = await service.exportFull();
      const export2 = await service.exportFull();

      // Timestamps should be different (unless generated at exact same millisecond)
      // HLC ensures monotonicity via logical counter
      expect(export1.exportedAt).not.toBe(export2.exportedAt);
    });

    it('should use consistent device ID across exports', async () => {
      const fullExport = await service.exportFull();
      const lastSyncHLC = serializeHLC(generateHLC(deviceId, Date.now()));
      const incrementalExport = await service.exportIncremental(lastSyncHLC);

      expect(fullExport.deviceId).toBe(deviceId);
      expect(incrementalExport.deviceId).toBe(deviceId);
    });

    it('should maintain entity relationships in export', async () => {
      const pages: Page[] = [
        {
          pageId: 'p1',
          title: 'Page 1',
          createdAt: 1,
          updatedAt: 1,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'p2',
          title: 'Page 2',
          createdAt: 1,
          updatedAt: 1,
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'b1',
          pageId: 'p1',
          parentId: null,
          content: 'Root block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          blockId: 'b2',
          pageId: 'p1',
          parentId: 'b1',
          content: 'Child block',
          contentType: 'text',
          order: 'a1',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ];

      const links: Link[] = [
        {
          sourceId: 'p1',
          targetId: 'p2',
          linkType: 'reference',
          createdAt: 1,
          contextBlockId: 'b1',
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);
      db.setLinks(links);

      const exportPkg = await service.exportFull();

      // Verify parent-child relationship
      const childBlock = exportPkg.data.blocks.find((b) => b.blockId === 'b2');
      expect(childBlock?.parentId).toBe('b1');

      // Verify link relationship
      const link = exportPkg.data.links[0];
      expect(link?.sourceId).toBe('p1');
      expect(link?.targetId).toBe('p2');
      expect(link?.contextBlockId).toBe('b1');
    });
  });

  describe('metadata accuracy', () => {
    it('should provide accurate counts in metadata', async () => {
      const pages: Page[] = Array.from({ length: 10 }, (_, i) => ({
        pageId: `page-${i}`,
        title: `Page ${i}`,
        createdAt: 1000,
        updatedAt: 2000,
        isDeleted: false,
        dailyNoteDate: null,
      }));

      const blocks: Block[] = Array.from({ length: 25 }, (_, i) => ({
        blockId: `block-${i}`,
        pageId: 'page-0',
        parentId: null,
        content: `Block ${i}`,
        contentType: 'text' as const,
        order: `a${i}`,
        isCollapsed: false,
        isDeleted: false,
        createdAt: 1000,
        updatedAt: 2000,
      }));

      const links: Link[] = Array.from({ length: 5 }, (_, i) => ({
        sourceId: 'page-0',
        targetId: `page-${i + 1}`,
        linkType: 'reference' as const,
        createdAt: 1000,
        contextBlockId: 'block-0',
      }));

      db.setPages(pages);
      db.setBlocks(blocks);
      db.setLinks(links);

      const exportPkg = await service.exportFull();

      expect(exportPkg.metadata.pageCount).toBe(10);
      expect(exportPkg.metadata.blockCount).toBe(25);
      expect(exportPkg.metadata.linkCount).toBe(5);

      expect(exportPkg.data.pages).toHaveLength(exportPkg.metadata.pageCount);
      expect(exportPkg.data.blocks).toHaveLength(exportPkg.metadata.blockCount);
      expect(exportPkg.data.links).toHaveLength(exportPkg.metadata.linkCount);
    });

    it('should correctly mark export as incremental', async () => {
      const fullExport = await service.exportFull();
      expect(fullExport.metadata.isIncremental).toBe(false);

      const lastSyncHLC = serializeHLC(generateHLC(deviceId, Date.now()));
      const incrementalExport = await service.exportIncremental(lastSyncHLC);
      expect(incrementalExport.metadata.isIncremental).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very large timestamps', async () => {
      const largeTimestamp = Number.MAX_SAFE_INTEGER;
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Future Page',
          createdAt: largeTimestamp,
          updatedAt: largeTimestamp,
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      db.setPages(pages);

      const exportPkg = await service.exportFull();
      expect(exportPkg.data.pages[0]!.createdAt).toBe(largeTimestamp);
      expect(exportPkg.data.pages[0]!.updatedAt).toBe(largeTimestamp);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Content with [[links]] and #tags and "quotes" and \'apostrophes\'';
      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: specialContent,
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];

      db.setBlocks(blocks);

      const exportPkg = await service.exportFull();
      expect(exportPkg.data.blocks[0]!.content).toBe(specialContent);
    });

    it('should handle null values correctly', async () => {
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Page',
          createdAt: 1000,
          updatedAt: 2000,
          isDeleted: false,
          dailyNoteDate: null, // Null for regular pages
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null, // Null for root blocks
          content: '',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ];

      const links: Link[] = [
        {
          sourceId: 'page-1',
          targetId: 'page-2',
          linkType: 'reference',
          createdAt: 1000,
          contextBlockId: null, // Can be null
        },
      ];

      db.setPages(pages);
      db.setBlocks(blocks);
      db.setLinks(links);

      const exportPkg = await service.exportFull();

      expect(exportPkg.data.pages[0]!.dailyNoteDate).toBeNull();
      expect(exportPkg.data.blocks[0]!.parentId).toBeNull();
      expect(exportPkg.data.links[0]!.contextBlockId).toBeNull();
    });
  });
});
