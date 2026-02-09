/**
 * Unit tests for SyncExportService.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncExportService } from '../../src/sync/SyncExportService';
import type { GraphDB, Page, Block, Link, QueryResult } from '@double-bind/types';

// ============================================================================
// Mock GraphDB
// ============================================================================

class MockGraphDB implements GraphDB {
  private pages: Page[] = [];
  private blocks: Block[] = [];
  private links: Link[] = [];

  constructor() {}

  // Seed test data
  seedPages(pages: Page[]): void {
    this.pages = pages;
  }

  seedBlocks(blocks: Block[]): void {
    this.blocks = blocks;
  }

  seedLinks(links: Link[]): void {
    this.links = links;
  }

  async query(script: string, params?: Record<string, unknown>): Promise<QueryResult> {
    // Parse which relation is being queried
    if (script.includes('*pages')) {
      return this.queryPages(script, params);
    } else if (script.includes('*blocks')) {
      return this.queryBlocks(script, params);
    } else if (script.includes('*links')) {
      return this.queryLinks(script, params);
    }

    return { headers: [], rows: [] };
  }

  private queryPages(script: string, params?: Record<string, unknown>): QueryResult {
    let filtered = [...this.pages]; // Make a copy

    // Handle incremental filter (updated_at > $last_sync)
    // Apply this FIRST before is_deleted filter
    if (script.includes('updated_at > $last_sync') && params?.last_sync) {
      const lastSync = params.last_sync as number;
      filtered = filtered.filter((p) => p.updatedAt > lastSync);
    }

    // Handle is_deleted filter
    // Apply this SECOND after incremental filter
    if (script.includes('is_deleted == false')) {
      filtered = filtered.filter((p) => !p.isDeleted);
    }

    const rows = filtered.map((p) => [
      p.pageId,
      p.title,
      p.createdAt,
      p.updatedAt,
      p.isDeleted,
      p.dailyNoteDate,
    ]);

    return {
      headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
      rows,
    };
  }

  private queryBlocks(script: string, params?: Record<string, unknown>): QueryResult {
    let filtered = [...this.blocks]; // Make a copy

    // Handle incremental filter (updated_at > $last_sync)
    // Apply this FIRST before is_deleted filter
    if (script.includes('updated_at > $last_sync') && params?.last_sync) {
      const lastSync = params.last_sync as number;
      filtered = filtered.filter((b) => b.updatedAt > lastSync);
    }

    // Handle is_deleted filter
    // Apply this SECOND after incremental filter
    if (script.includes('is_deleted == false')) {
      filtered = filtered.filter((b) => !b.isDeleted);
    }

    const rows = filtered.map((b) => [
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
    ]);

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
      rows,
    };
  }

  private queryLinks(script: string, params?: Record<string, unknown>): QueryResult {
    let filtered = [...this.links]; // Make a copy

    // Handle incremental filter (created_at > $last_sync)
    if (script.includes('created_at > $last_sync') && params?.last_sync) {
      const lastSync = params.last_sync as number;
      filtered = filtered.filter((l) => l.createdAt > lastSync);
    }

    const rows = filtered.map((l) => [
      l.sourceId,
      l.targetId,
      l.linkType,
      l.createdAt,
      l.contextBlockId,
    ]);

    return {
      headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
      rows,
    };
  }

  // Unimplemented methods
  async mutate(): Promise<never> {
    throw new Error('Not implemented');
  }
  async importRelations(): Promise<never> {
    throw new Error('Not implemented');
  }
  async exportRelations(): Promise<never> {
    throw new Error('Not implemented');
  }
  async backup(): Promise<never> {
    throw new Error('Not implemented');
  }
  async restore(): Promise<never> {
    throw new Error('Not implemented');
  }
  async importRelationsFromBackup(): Promise<never> {
    throw new Error('Not implemented');
  }
  async close(): Promise<never> {
    throw new Error('Not implemented');
  }
}

// ============================================================================
// Test Data Fixtures
// ============================================================================

function createTestPages(): Page[] {
  const now = Date.now();
  return [
    {
      pageId: 'page-1',
      title: 'Test Page 1',
      createdAt: now - 10000,
      updatedAt: now - 10000,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: 'page-2',
      title: 'Test Page 2',
      createdAt: now - 5000,
      updatedAt: now - 5000,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: 'page-3',
      title: 'Deleted Page',
      createdAt: now - 8000,
      updatedAt: now - 2000,
      isDeleted: true,
      dailyNoteDate: null,
    },
    {
      pageId: 'page-4',
      title: 'Daily Note',
      createdAt: now - 3000,
      updatedAt: now - 3000,
      isDeleted: false,
      dailyNoteDate: '2024-01-15',
    },
  ];
}

function createTestBlocks(): Block[] {
  const now = Date.now();
  return [
    {
      blockId: 'block-1',
      pageId: 'page-1',
      parentId: null,
      content: 'Root block 1',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: now - 10000,
      updatedAt: now - 10000,
    },
    {
      blockId: 'block-2',
      pageId: 'page-1',
      parentId: 'block-1',
      content: 'Child block',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: now - 9000,
      updatedAt: now - 4000,
    },
    {
      blockId: 'block-3',
      pageId: 'page-2',
      parentId: null,
      content: 'Root block 2',
      contentType: 'heading',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: now - 5000,
      updatedAt: now - 5000,
    },
    {
      blockId: 'block-4',
      pageId: 'page-1',
      parentId: null,
      content: 'Deleted block',
      contentType: 'text',
      order: 'a1',
      isCollapsed: false,
      isDeleted: true,
      createdAt: now - 7000,
      updatedAt: now - 2000,
    },
  ];
}

function createTestLinks(): Link[] {
  const now = Date.now();
  return [
    {
      sourceId: 'page-1',
      targetId: 'page-2',
      linkType: 'reference',
      createdAt: now - 10000,
      contextBlockId: 'block-1',
    },
    {
      sourceId: 'page-2',
      targetId: 'page-1',
      linkType: 'reference',
      createdAt: now - 4000,
      contextBlockId: 'block-3',
    },
    {
      sourceId: 'page-1',
      targetId: 'page-4',
      linkType: 'embed',
      createdAt: now - 3000,
      contextBlockId: 'block-2',
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncExportService', () => {
  let db: MockGraphDB;
  let service: SyncExportService;
  const deviceId = 'test-device-1';

  beforeEach(() => {
    db = new MockGraphDB();
    service = new SyncExportService(db);
  });

  describe('Full Export', () => {
    it('should export all non-deleted pages, blocks, and links', async () => {
      // Seed test data
      const pages = createTestPages();
      const blocks = createTestBlocks();
      const links = createTestLinks();

      db.seedPages(pages);
      db.seedBlocks(blocks);
      db.seedLinks(links);

      // Perform full export
      const result = await service.export({ deviceId });

      // Verify metadata
      expect(result.version).toBe('1.0.0');
      expect(result.deviceId).toBe(deviceId);
      expect(result.exportedAt).toBeTruthy();
      expect(result.lastSyncAt).toBeUndefined();
      expect(result.metadata.isIncremental).toBe(false);

      // Verify pages (should exclude deleted)
      expect(result.data.pages).toHaveLength(3);
      expect(result.metadata.pageCount).toBe(3);
      expect(result.data.pages.find((p) => p.pageId === 'page-3')).toBeUndefined();

      // Verify blocks (should exclude deleted)
      expect(result.data.blocks).toHaveLength(3);
      expect(result.metadata.blockCount).toBe(3);
      expect(result.data.blocks.find((b) => b.blockId === 'block-4')).toBeUndefined();

      // Verify links
      expect(result.data.links).toHaveLength(3);
      expect(result.metadata.linkCount).toBe(3);
    });

    it('should include deleted items when includeDeleted is true', async () => {
      const pages = createTestPages();
      const blocks = createTestBlocks();

      db.seedPages(pages);
      db.seedBlocks(blocks);

      const result = await service.export({
        deviceId,
        includeDeleted: true,
      });

      // Should include all pages (including deleted)
      expect(result.data.pages).toHaveLength(4);
      expect(result.data.pages.find((p) => p.pageId === 'page-3')).toBeTruthy();

      // Should include all blocks (including deleted)
      expect(result.data.blocks).toHaveLength(4);
      expect(result.data.blocks.find((b) => b.blockId === 'block-4')).toBeTruthy();
    });

    it('should handle empty database', async () => {
      const result = await service.export({ deviceId });

      expect(result.data.pages).toHaveLength(0);
      expect(result.data.blocks).toHaveLength(0);
      expect(result.data.links).toHaveLength(0);
      expect(result.metadata.pageCount).toBe(0);
      expect(result.metadata.blockCount).toBe(0);
      expect(result.metadata.linkCount).toBe(0);
      expect(result.metadata.isIncremental).toBe(false);
    });
  });

  describe('Incremental Export', () => {
    it('should export only changes since lastSyncAt', async () => {
      const baseTime = 1000000000000; // Fixed base timestamp

      // Create pages with explicit timestamps relative to base time
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Test Page 1',
          createdAt: baseTime - 10000,
          updatedAt: baseTime - 10000,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: 'Test Page 2',
          createdAt: baseTime - 5000,
          updatedAt: baseTime - 5000,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-4',
          title: 'Daily Note',
          createdAt: baseTime - 3000,
          updatedAt: baseTime - 3000,
          isDeleted: false,
          dailyNoteDate: '2024-01-15',
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-2',
          pageId: 'page-1',
          parentId: 'block-1',
          content: 'Child block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: baseTime - 9000,
          updatedAt: baseTime - 4000,
        },
        {
          blockId: 'block-3',
          pageId: 'page-2',
          parentId: null,
          content: 'Root block 2',
          contentType: 'heading',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: baseTime - 5000,
          updatedAt: baseTime - 5000,
        },
      ];

      const links: Link[] = [
        {
          sourceId: 'page-2',
          targetId: 'page-1',
          linkType: 'reference',
          createdAt: baseTime - 4000,
          contextBlockId: 'block-3',
        },
        {
          sourceId: 'page-1',
          targetId: 'page-4',
          linkType: 'embed',
          createdAt: baseTime - 3000,
          contextBlockId: 'block-2',
        },
      ];

      db.seedPages(pages);
      db.seedBlocks(blocks);
      db.seedLinks(links);

      // Create lastSyncAt timestamp (6000ms before base time)
      // Manually construct HLC string to avoid state issues with generateHLC
      const lastSyncPhysical = baseTime - 6000;
      const lastSyncAt = `${lastSyncPhysical}-0-${deviceId}`;

      // Perform incremental export
      const result = await service.export({
        deviceId,
        lastSyncAt,
      });

      // Verify metadata
      expect(result.metadata.isIncremental).toBe(true);
      expect(result.lastSyncAt).toBe(lastSyncAt);

      // Should only include pages updated after lastSyncAt
      // page-2 (updated 5000ms before base) and page-4 (updated 3000ms before base)
      expect(result.data.pages).toHaveLength(2);
      const pageIds = result.data.pages.map((p) => p.pageId);
      expect(pageIds).toContain('page-2');
      expect(pageIds).toContain('page-4');

      // Should only include blocks updated after lastSyncAt
      // block-2 (updated 4000ms before base) and block-3 (updated 5000ms before base)
      expect(result.data.blocks).toHaveLength(2);
      const blockIds = result.data.blocks.map((b) => b.blockId);
      expect(blockIds).toContain('block-2');
      expect(blockIds).toContain('block-3');

      // Should only include links created after lastSyncAt
      // 2 links created after lastSync
      expect(result.data.links).toHaveLength(2);
    });

    it('should include deleted items in incremental export when includeDeleted is true', async () => {
      const baseTime = 1000000000000;

      const pages: Page[] = [
        {
          pageId: 'page-3',
          title: 'Deleted Page',
          createdAt: baseTime - 8000,
          updatedAt: baseTime - 2000,
          isDeleted: true,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-4',
          pageId: 'page-1',
          parentId: null,
          content: 'Deleted block',
          contentType: 'text',
          order: 'a1',
          isCollapsed: false,
          isDeleted: true,
          createdAt: baseTime - 7000,
          updatedAt: baseTime - 2000,
        },
      ];

      db.seedPages(pages);
      db.seedBlocks(blocks);

      // Create lastSyncAt timestamp (6000ms before base time)
      // Manually construct HLC string to avoid state issues with generateHLC
      const lastSyncPhysical = baseTime - 6000;
      const lastSyncAt = `${lastSyncPhysical}-0-${deviceId}`;

      const result = await service.export({
        deviceId,
        lastSyncAt,
        includeDeleted: true,
      });

      // Should include deleted page-3 (updated 2000ms before base, after lastSync)
      expect(result.data.pages.find((p) => p.pageId === 'page-3')).toBeTruthy();

      // Should include deleted block-4 (updated 2000ms before base, after lastSync)
      expect(result.data.blocks.find((b) => b.blockId === 'block-4')).toBeTruthy();
    });

    it('should handle no changes since lastSyncAt', async () => {
      const now = Date.now();
      const pages = createTestPages();
      const blocks = createTestBlocks();
      const links = createTestLinks();

      db.seedPages(pages);
      db.seedBlocks(blocks);
      db.seedLinks(links);

      // Create lastSyncAt timestamp in the future
      // Manually construct HLC string to avoid state issues with generateHLC
      const lastSyncPhysical = now + 10000;
      const lastSyncAt = `${lastSyncPhysical}-0-${deviceId}`;

      const result = await service.export({
        deviceId,
        lastSyncAt,
      });

      expect(result.data.pages).toHaveLength(0);
      expect(result.data.blocks).toHaveLength(0);
      expect(result.data.links).toHaveLength(0);
      expect(result.metadata.isIncremental).toBe(true);
    });
  });

  describe('Export Format', () => {
    it('should produce valid export package structure', async () => {
      const pages = createTestPages();
      db.seedPages(pages);

      const result = await service.export({ deviceId });

      // Verify top-level structure
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('deviceId');
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      // Verify data structure
      expect(result.data).toHaveProperty('pages');
      expect(result.data).toHaveProperty('blocks');
      expect(result.data).toHaveProperty('links');

      // Verify metadata structure
      expect(result.metadata).toHaveProperty('pageCount');
      expect(result.metadata).toHaveProperty('blockCount');
      expect(result.metadata).toHaveProperty('linkCount');
      expect(result.metadata).toHaveProperty('isIncremental');
    });

    it('should generate valid HLC timestamp for exportedAt', async () => {
      const result = await service.export({ deviceId });

      // HLC format: physical-logical-nodeId
      const parts = result.exportedAt.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(3);

      const physical = parseInt(parts[0], 10);
      expect(physical).toBeGreaterThan(0);
      // Physical time should be reasonable (within last minute and not too far in future)
      const now = Date.now();
      expect(physical).toBeGreaterThan(now - 60000); // Not more than 1 minute ago
      expect(physical).toBeLessThan(now + 60000); // Not more than 1 minute in future

      const logical = parseInt(parts[1], 10);
      expect(logical).toBeGreaterThanOrEqual(0);

      const nodeId = parts.slice(2).join('-');
      expect(nodeId).toBe(deviceId);
    });

    it('should preserve page data structure', async () => {
      const pages = createTestPages();
      db.seedPages(pages);

      const result = await service.export({ deviceId });

      const page = result.data.pages[0];
      expect(page).toHaveProperty('pageId');
      expect(page).toHaveProperty('title');
      expect(page).toHaveProperty('createdAt');
      expect(page).toHaveProperty('updatedAt');
      expect(page).toHaveProperty('isDeleted');
      expect(page).toHaveProperty('dailyNoteDate');
    });

    it('should preserve block data structure', async () => {
      const blocks = createTestBlocks();
      db.seedBlocks(blocks);

      const result = await service.export({ deviceId });

      const block = result.data.blocks[0];
      expect(block).toHaveProperty('blockId');
      expect(block).toHaveProperty('pageId');
      expect(block).toHaveProperty('parentId');
      expect(block).toHaveProperty('content');
      expect(block).toHaveProperty('contentType');
      expect(block).toHaveProperty('order');
      expect(block).toHaveProperty('isCollapsed');
      expect(block).toHaveProperty('isDeleted');
      expect(block).toHaveProperty('createdAt');
      expect(block).toHaveProperty('updatedAt');
    });

    it('should preserve link data structure', async () => {
      const links = createTestLinks();
      db.seedLinks(links);

      const result = await service.export({ deviceId });

      const link = result.data.links[0];
      expect(link).toHaveProperty('sourceId');
      expect(link).toHaveProperty('targetId');
      expect(link).toHaveProperty('linkType');
      expect(link).toHaveProperty('createdAt');
      expect(link).toHaveProperty('contextBlockId');
    });
  });

  describe('Metadata Counts', () => {
    it('should accurately count exported entities', async () => {
      const pages = createTestPages();
      const blocks = createTestBlocks();
      const links = createTestLinks();

      db.seedPages(pages);
      db.seedBlocks(blocks);
      db.seedLinks(links);

      const result = await service.export({ deviceId });

      expect(result.metadata.pageCount).toBe(result.data.pages.length);
      expect(result.metadata.blockCount).toBe(result.data.blocks.length);
      expect(result.metadata.linkCount).toBe(result.data.links.length);
    });

    it('should report correct isIncremental flag', async () => {
      const pages = createTestPages();
      db.seedPages(pages);

      // Full export
      const fullExport = await service.export({ deviceId });
      expect(fullExport.metadata.isIncremental).toBe(false);
      expect(fullExport.lastSyncAt).toBeUndefined();

      // Incremental export
      // Manually construct HLC string to avoid state issues
      const lastSyncAt = `${Date.now()}-0-${deviceId}`;
      const incrementalExport = await service.export({ deviceId, lastSyncAt });
      expect(incrementalExport.metadata.isIncremental).toBe(true);
      expect(incrementalExport.lastSyncAt).toBe(lastSyncAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in content', async () => {
      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Special chars: [[link]] {{embed}} #tag @mention "quotes" \'apostrophe\'',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      db.seedBlocks(blocks);

      const result = await service.export({ deviceId });

      expect(result.data.blocks[0].content).toBe(blocks[0].content);
    });

    it('should handle null values correctly', async () => {
      const pages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Regular Page',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          dailyNoteDate: null,
        },
      ];

      const blocks: Block[] = [
        {
          blockId: 'block-1',
          pageId: 'page-1',
          parentId: null,
          content: 'Root block',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      db.seedPages(pages);
      db.seedBlocks(blocks);

      const result = await service.export({ deviceId });

      expect(result.data.pages[0].dailyNoteDate).toBeNull();
      expect(result.data.blocks[0].parentId).toBeNull();
    });

    it('should handle very large exports', async () => {
      // Create 1000 pages
      const pages: Page[] = [];
      const now = Date.now();
      for (let i = 0; i < 1000; i++) {
        pages.push({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          createdAt: now - i * 1000,
          updatedAt: now - i * 1000,
          isDeleted: false,
          dailyNoteDate: null,
        });
      }

      db.seedPages(pages);

      const result = await service.export({ deviceId });

      expect(result.data.pages).toHaveLength(1000);
      expect(result.metadata.pageCount).toBe(1000);
    });
  });
});
