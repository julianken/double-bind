/**
 * Tests for SyncImportService
 *
 * Covers full import, incremental merge, conflict detection,
 * and rollback scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncImportService } from '../../src/sync/SyncImportService';
import { InMemoryConflictStore } from '../../src/sync/InMemoryConflictStore';
import type {
  Database,
  SyncData,
  ImportOptions,
} from '@double-bind/types';

// Mock Database implementation
class MockDatabase implements Database {
  private pages = new Map<string, unknown[]>();
  private blocks = new Map<string, unknown[]>();
  private links: unknown[] = [];
  private blockRefs: unknown[] = [];
  private properties: unknown[] = [];
  private tags: unknown[] = [];
  private backupCalled = false;

  async query(script: string, _params?: Record<string, unknown>) {
    // Parse simple queries
    if (script.includes('*pages[')) {
      return {
        headers: ['pageId', 'title', 'createdAt', 'updatedAt', 'isDeleted', 'dailyNoteDate'],
        rows: Array.from(this.pages.values()),
      };
    }
    if (script.includes('*blocks[')) {
      return {
        headers: [
          'blockId',
          'pageId',
          'parentId',
          'content',
          'contentType',
          'order',
          'isCollapsed',
          'isDeleted',
          'createdAt',
          'updatedAt',
        ],
        rows: Array.from(this.blocks.values()),
      };
    }
    return { headers: [], rows: [] };
  }

  async mutate(script: string, params?: Record<string, unknown>) {
    if (script.includes(':delete pages')) {
      this.pages.clear();
    }
    if (script.includes(':delete blocks')) {
      this.blocks.clear();
    }
    if (script.includes(':delete links')) {
      this.links = [];
    }
    if (script.includes(':put pages')) {
      const pageId = params?.pageId as string;
      this.pages.set(pageId, [
        pageId,
        params?.title,
        params?.createdAt,
        params?.updatedAt,
        params?.isDeleted,
        params?.dailyNoteDate,
      ]);
    }
    if (script.includes(':put blocks')) {
      const blockId = params?.blockId as string;
      this.blocks.set(blockId, [
        blockId,
        params?.pageId,
        params?.parentId,
        params?.content,
        params?.contentType,
        params?.order,
        params?.isCollapsed,
        params?.isDeleted,
        params?.createdAt,
        params?.updatedAt,
      ]);
    }
    if (script.includes(':put links')) {
      this.links.push([
        params?.sourceId,
        params?.targetId,
        params?.linkType,
        params?.createdAt,
        params?.contextBlockId,
      ]);
    }
    return { headers: [], rows: [] };
  }

  async importRelations(data: Record<string, unknown[][]>) {
    if (data.pages) {
      for (const row of data.pages) {
        this.pages.set(row[0] as string, row);
      }
    }
    if (data.blocks) {
      for (const row of data.blocks) {
        this.blocks.set(row[0] as string, row);
      }
    }
    if (data.links) {
      this.links.push(...data.links);
    }
    if (data.block_refs) {
      this.blockRefs.push(...data.block_refs);
    }
    if (data.properties) {
      this.properties.push(...data.properties);
    }
    if (data.tags) {
      this.tags.push(...data.tags);
    }
  }

  async exportRelations(relations: string[]) {
    const result: Record<string, unknown[][]> = {};
    if (relations.includes('pages')) {
      result.pages = Array.from(this.pages.values());
    }
    if (relations.includes('blocks')) {
      result.blocks = Array.from(this.blocks.values());
    }
    if (relations.includes('links')) {
      result.links = this.links;
    }
    return result;
  }

  async backup(_path: string) {
    this.backupCalled = true;
  }

  async restore(_path: string) {}
  async importRelationsFromBackup(_path: string, _relations: string[]) {}
  async close() {}

  // Test helpers
  getPageCount() {
    return this.pages.size;
  }
  getBlockCount() {
    return this.blocks.size;
  }
  getLinkCount() {
    return this.links.length;
  }
  wasBackupCalled() {
    return this.backupCalled;
  }
}

describe('SyncImportService', () => {
  let db: MockDatabase;
  let conflictStore: InMemoryConflictStore;
  let service: SyncImportService;

  beforeEach(() => {
    db = new MockDatabase();
    conflictStore = new InMemoryConflictStore();
    service = new SyncImportService(db, conflictStore);
  });

  describe('validateSyncData', () => {
    it('should validate correct sync data', async () => {
      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Test Page',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '1000-0-node1',
            versionVector: { node1: '1000-0-node1' },
            nodeId: 'node1',
            timestamp: Date.now(),
          },
        ],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'page1',
              parentId: null,
              content: 'Test content',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            version: '1000-0-node1',
            versionVector: { node1: '1000-0-node1' },
            nodeId: 'node1',
            timestamp: Date.now(),
          },
        ],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const result = await service.validateSyncData(syncData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid schema version', async () => {
      const syncData: SyncData = {
        schemaVersion: 999,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const result = await service.validateSyncData(syncData);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('invalid-version');
    });

    it('should detect blocks referencing non-existent pages', async () => {
      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'nonexistent',
              parentId: null,
              content: 'Test',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            version: '1000-0-node1',
            versionVector: { node1: '1000-0-node1' },
            nodeId: 'node1',
            timestamp: Date.now(),
          },
        ],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const result = await service.validateSyncData(syncData);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing-page');
    });

    it('should warn about orphan blocks', async () => {
      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Test',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '1000-0-node1',
            versionVector: { node1: '1000-0-node1' },
            nodeId: 'node1',
            timestamp: Date.now(),
          },
        ],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'page1',
              parentId: 'nonexistent',
              content: 'Test',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            version: '1000-0-node1',
            versionVector: { node1: '1000-0-node1' },
            nodeId: 'node1',
            timestamp: Date.now(),
          },
        ],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const result = await service.validateSyncData(syncData);
      expect(result.valid).toBe(true); // Warnings don't fail validation
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('orphan-block');
    });
  });

  describe('full import', () => {
    it('should perform full import replacing all data', async () => {
      // Pre-populate database
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'old-page',
          title: 'Old Page',
          createdAt: 1000,
          updatedAt: 1000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'New Page',
              createdAt: 2000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'page1',
              parentId: null,
              content: 'New Block',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: 2000,
              updatedAt: 2000,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        links: [
          {
            sourceId: 'page1',
            targetId: 'page1',
            linkType: 'reference',
            createdAt: 2000,
            contextBlockId: null,
          },
        ],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'full',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.pagesImported).toBe(1);
      expect(result.stats.blocksImported).toBe(1);
      expect(result.stats.linksImported).toBe(1);
      expect(db.getPageCount()).toBe(1);
      expect(db.getBlockCount()).toBe(1);
      expect(db.getLinkCount()).toBe(1);
    });

    it('should create backup when requested', async () => {
      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'full',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
        createBackup: true,
      };

      await service.import(syncData, options);
      expect(db.wasBackupCalled()).toBe(true);
    });
  });

  describe('incremental import', () => {
    it('should import new entities without conflicts', async () => {
      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'New Page',
              createdAt: 2000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'page1',
              parentId: null,
              content: 'New Block',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: 2000,
              updatedAt: 2000,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.pagesImported).toBe(1);
      expect(result.stats.blocksImported).toBe(1);
      expect(result.stats.conflictsDetected).toBe(0);
      expect(db.getPageCount()).toBe(1);
      expect(db.getBlockCount()).toBe(1);
    });

    it('should update entities when remote is newer', async () => {
      // Pre-populate with older data
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Old Title',
          createdAt: 1000,
          updatedAt: 1000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'New Title',
              createdAt: 1000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.pagesImported).toBe(1);
      expect(result.stats.conflictsDetected).toBe(0);
    });

    it('should detect conflicts when local is newer with auto strategy', async () => {
      // Pre-populate with newer data
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Local Title',
          createdAt: 1000,
          updatedAt: 3000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Remote Title',
              createdAt: 1000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.stats.conflictsAutoResolved).toBe(1);
      expect(result.conflicts[0].comparison).toBe('local-newer');
      expect(result.conflicts[0].resolution).toBe('keep-local');
    });

    it('should create conflict objects for manual resolution', async () => {
      // Pre-populate with local data (same timestamp as remote but different content)
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Local Title',
          createdAt: 1000,
          updatedAt: 2500,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Remote Title',
              createdAt: 1000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'manual',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.stats.conflictsAutoResolved).toBe(0);
      expect(result.conflicts[0].autoResolved).toBe(false);
      expect(result.conflictIds).toBeDefined();
      expect(result.conflictIds!.length).toBe(1);

      // Verify conflict was saved
      const savedConflict = await conflictStore.getConflict(result.conflictIds![0]);
      expect(savedConflict).toBeDefined();
      expect(savedConflict!.entityId).toBe('page1');
      expect(savedConflict!.state).toBe('detected');
    });

    it('should accept all remote changes with accept-remote strategy', async () => {
      // Pre-populate with newer local data
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Local Title',
          createdAt: 1000,
          updatedAt: 3000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Remote Title',
              createdAt: 1000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'accept-remote',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.stats.conflictsAutoResolved).toBe(1);
      expect(result.conflicts[0].resolution).toBe('accept-remote');
      expect(result.stats.pagesImported).toBe(1);
    });

    it('should reject all remote changes with reject strategy', async () => {
      // Pre-populate with local data
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Local Title',
          createdAt: 1000,
          updatedAt: 1000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [
          {
            data: {
              pageId: 'page1',
              title: 'Remote Title',
              createdAt: 1000,
              updatedAt: 2000,
              isDeleted: false,
              dailyNoteDate: null,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'reject',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.stats.conflictsAutoResolved).toBe(1);
      expect(result.conflicts[0].resolution).toBe('keep-local');
      expect(result.stats.pagesImported).toBe(0); // No import
    });

    it('should handle block conflicts independently of page conflicts', async () => {
      // Pre-populate
      await db.mutate(
        ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
        {
          pageId: 'page1',
          title: 'Page',
          createdAt: 1000,
          updatedAt: 1000,
          isDeleted: false,
          dailyNoteDate: null,
        }
      );
      await db.mutate(
        ':put blocks {blockId => pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt}',
        {
          blockId: 'block1',
          pageId: 'page1',
          parentId: null,
          content: 'Local Content',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: 1000,
          updatedAt: 3000,
        }
      );

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [
          {
            data: {
              blockId: 'block1',
              pageId: 'page1',
              parentId: null,
              content: 'Remote Content',
              contentType: 'text',
              order: 'a0',
              isCollapsed: false,
              isDeleted: false,
              createdAt: 1000,
              updatedAt: 2000,
            },
            version: '2000-0-node1',
            versionVector: { node1: '2000-0-node1' },
            nodeId: 'node1',
            timestamp: 2000,
          },
        ],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(true);
      expect(result.stats.conflictsDetected).toBe(1);
      expect(result.conflicts[0].entityType).toBe('block');
      expect(result.conflicts[0].comparison).toBe('local-newer');
    });

    it('should fail when max conflicts exceeded', async () => {
      // Pre-populate with conflicting data
      for (let i = 1; i <= 10; i++) {
        await db.mutate(
          ':put pages {pageId => title, createdAt, updatedAt, isDeleted, dailyNoteDate}',
          {
            pageId: `page${i}`,
            title: 'Local',
            createdAt: 1000,
            updatedAt: 3000,
            isDeleted: false,
            dailyNoteDate: null,
          }
        );
      }

      const pages = [];
      for (let i = 1; i <= 10; i++) {
        pages.push({
          data: {
            pageId: `page${i}`,
            title: 'Remote',
            createdAt: 1000,
            updatedAt: 2000,
            isDeleted: false,
            dailyNoteDate: null,
          },
          version: '2000-0-node1',
          versionVector: { node1: '2000-0-node1' },
          nodeId: 'node1',
          timestamp: 2000,
        });
      }

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages,
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'incremental',
        conflictStrategy: 'manual',
        nodeId: 'node-2',
        maxConflicts: 5,
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many conflicts');
    });
  });

  describe('validation', () => {
    it('should fail import if validation is enabled and data is invalid', async () => {
      const syncData: SyncData = {
        schemaVersion: 999, // Invalid
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'full',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
        validate: true,
      };

      const result = await service.import(syncData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('rollback on failure', () => {
    it('should return error result when mutation fails', async () => {
      // Create a mock that throws
      const failingDb = new MockDatabase();
      failingDb.mutate = vi.fn().mockRejectedValue(new Error('Database error'));

      const failingService = new SyncImportService(failingDb, conflictStore);

      const syncData: SyncData = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        exportedBy: 'node-1',
        pages: [],
        blocks: [],
        links: [],
        blockRefs: [],
        properties: [],
        tags: [],
      };

      const options: ImportOptions = {
        mode: 'full',
        conflictStrategy: 'auto',
        nodeId: 'node-2',
      };

      const result = await failingService.import(syncData, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
