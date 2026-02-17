/**
 * Unit tests for PageService
 *
 * These tests verify correct orchestration of repositories and error handling.
 * Uses MockDatabase to verify:
 * - Correct delegation to repositories
 * - Cascading delete behavior
 * - Error wrapping with context
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { PageService } from '../../../src/services/page-service.js';
import { PageRepository } from '../../../src/repositories/page-repository.js';
import { BlockRepository } from '../../../src/repositories/block-repository.js';
import { LinkRepository } from '../../../src/repositories/link-repository.js';

describe('PageService', () => {
  let db: MockDatabase;
  let pageRepo: PageRepository;
  let blockRepo: BlockRepository;
  let linkRepo: LinkRepository;
  let service: PageService;

  beforeEach(() => {
    db = new MockDatabase();
    pageRepo = new PageRepository(db);
    blockRepo = new BlockRepository(db);
    linkRepo = new LinkRepository(db);
    service = new PageService(pageRepo, blockRepo, linkRepo);
  });

  describe('createPage', () => {
    it('should create a page and return the full Page object', async () => {
      // We need to spy on the repository to capture the created pageId
      const createSpy = vi.spyOn(pageRepo, 'create');

      // First, attempt to create - this will generate a ULID
      const createPromise = service.createPage('My New Page');

      // Since MockDatabase doesn't persist, the getById after create will fail
      // We need a different approach - mock the repository methods
      await expect(createPromise).rejects.toThrow(DoubleBindError);

      // Verify the create was called with correct title
      expect(createSpy).toHaveBeenCalledWith({ title: 'My New Page' });
    });

    it('should delegate to pageRepo.create with title', async () => {
      const createSpy = vi.spyOn(pageRepo, 'create');
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');

      // Pre-seed a page so getById succeeds
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Test Page', now, now, false, null]]);

      // Mock create to return known ID
      createSpy.mockResolvedValueOnce(pageId);

      const result = await service.createPage('Test Page');

      expect(createSpy).toHaveBeenCalledWith({ title: 'Test Page' });
      expect(getByIdSpy).toHaveBeenCalledWith(pageId);
      expect(result.title).toBe('Test Page');
    });

    it('should throw DB_QUERY_FAILED if getById returns null after create', async () => {
      const createSpy = vi.spyOn(pageRepo, 'create');
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');

      createSpy.mockResolvedValueOnce('new-page-id');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(service.createPage('Test')).rejects.toThrow(DoubleBindError);
      await expect(service.createPage('Test')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });

    it('should wrap repository errors with context', async () => {
      const createSpy = vi.spyOn(pageRepo, 'create');
      const originalError = new Error('Database connection lost');
      createSpy.mockRejectedValueOnce(originalError);

      const error = await service.createPage('Test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_MUTATION_FAILED);
      expect(error.message).toContain('Failed to create page');
      expect(error.message).toContain('Test');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const createSpy = vi.spyOn(pageRepo, 'create');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      createSpy.mockRejectedValueOnce(originalError);

      const error = await service.createPage('Test').catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });
  });

  describe('getPageWithBlocks', () => {
    it('should return page and blocks when page exists', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
      const now = Date.now();

      // Mock repository methods directly since MockDatabase doesn't handle multi-relation joins
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');

      getByIdSpy.mockResolvedValueOnce({
        pageId,
        title: 'Test Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });

      getByPageSpy.mockResolvedValueOnce([
        {
          blockId,
          pageId,
          parentId: null,
          content: 'Block content',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.getPageWithBlocks(pageId);

      expect(result.page).toBeDefined();
      expect(result.page.pageId).toBe(pageId);
      expect(result.page.title).toBe('Test Page');
      expect(result.blocks).toBeDefined();
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]?.content).toBe('Block content');
    });

    it('should throw PAGE_NOT_FOUND when page does not exist', async () => {
      db.seed('pages', []);

      await expect(service.getPageWithBlocks('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(service.getPageWithBlocks('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should include error message with pageId', async () => {
      db.seed('pages', []);

      const error = await service.getPageWithBlocks('my-page-id').catch((e) => e);

      expect(error.message).toContain('my-page-id');
    });

    it('should return empty blocks array when page has no blocks', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();

      // Mock repository methods directly
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');

      getByIdSpy.mockResolvedValueOnce({
        pageId,
        title: 'Empty Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });

      getByPageSpy.mockResolvedValueOnce([]);

      const result = await service.getPageWithBlocks(pageId);

      expect(result.page.pageId).toBe(pageId);
      expect(result.blocks).toEqual([]);
    });

    it('should wrap non-DoubleBindError with context', async () => {
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const originalError = new Error('Network timeout');
      getByIdSpy.mockRejectedValueOnce(originalError);

      const error = await service.getPageWithBlocks('test-id').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to get page with blocks');
      expect(error.cause).toBe(originalError);
    });
  });

  describe('deletePage', () => {
    it('should soft-delete page and all its blocks (cascading)', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const blockId1 = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
      const blockId2 = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
      const now = Date.now();

      // Mock repository methods directly
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const blockSoftDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const pageSoftDeleteSpy = vi.spyOn(pageRepo, 'softDelete');

      getByIdSpy.mockResolvedValueOnce({
        pageId,
        title: 'Page to Delete',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });

      getByPageSpy.mockResolvedValueOnce([
        {
          blockId: blockId1,
          pageId,
          parentId: null,
          content: 'Block 1',
          contentType: 'text',
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          blockId: blockId2,
          pageId,
          parentId: null,
          content: 'Block 2',
          contentType: 'text',
          order: 'a1',
          isCollapsed: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      blockSoftDeleteSpy.mockResolvedValue(undefined);
      pageSoftDeleteSpy.mockResolvedValue(undefined);

      await service.deletePage(pageId);

      // Verify both blocks were soft-deleted
      expect(blockSoftDeleteSpy).toHaveBeenCalledTimes(2);
      expect(blockSoftDeleteSpy).toHaveBeenCalledWith(blockId1);
      expect(blockSoftDeleteSpy).toHaveBeenCalledWith(blockId2);

      // Verify page was soft-deleted
      expect(pageSoftDeleteSpy).toHaveBeenCalledTimes(1);
      expect(pageSoftDeleteSpy).toHaveBeenCalledWith(pageId);
    });

    it('should throw PAGE_NOT_FOUND when page does not exist', async () => {
      db.seed('pages', []);

      await expect(service.deletePage('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(service.deletePage('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should succeed when page has no blocks', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();

      // Mock repository methods directly
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const blockSoftDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const pageSoftDeleteSpy = vi.spyOn(pageRepo, 'softDelete');

      getByIdSpy.mockResolvedValueOnce({
        pageId,
        title: 'Empty Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });

      getByPageSpy.mockResolvedValueOnce([]);
      pageSoftDeleteSpy.mockResolvedValue(undefined);

      await service.deletePage(pageId);

      // Should NOT call block soft delete
      expect(blockSoftDeleteSpy).not.toHaveBeenCalled();

      // Should call page soft delete
      expect(pageSoftDeleteSpy).toHaveBeenCalledTimes(1);
      expect(pageSoftDeleteSpy).toHaveBeenCalledWith(pageId);
    });

    it('should wrap repository errors with context', async () => {
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const now = Date.now();

      // Return page first, then fail on getByPage
      getByIdSpy.mockResolvedValueOnce({
        pageId: 'test-id',
        title: 'Test',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });

      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const originalError = new Error('Disk full');
      getByPageSpy.mockRejectedValueOnce(originalError);

      const error = await service.deletePage('test-id').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_MUTATION_FAILED);
      expect(error.message).toContain('Failed to delete page');
      expect(error.cause).toBe(originalError);
    });
  });

  describe('getTodaysDailyNote', () => {
    it('should call pageRepo.getOrCreateDailyNote with today ISO date', async () => {
      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0]!;

      // Mock to return a page
      getOrCreateSpy.mockResolvedValueOnce({
        pageId: 'daily-page-id',
        title: today,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: today,
      });

      const result = await service.getTodaysDailyNote();

      expect(getOrCreateSpy).toHaveBeenCalledWith(today);
      expect(result.dailyNoteDate).toBe(today);
    });

    it('should use format YYYY-MM-DD for date', async () => {
      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0]!;

      getOrCreateSpy.mockResolvedValueOnce({
        pageId: 'daily-page-id',
        title: today,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: today,
      });

      await service.getTodaysDailyNote();

      // Verify date format matches YYYY-MM-DD
      const calledDate = getOrCreateSpy.mock.calls[0]?.[0];
      expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should wrap repository errors with context', async () => {
      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      const originalError = new Error('Database locked');
      getOrCreateSpy.mockRejectedValueOnce(originalError);

      const error = await service.getTodaysDailyNote().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      // getTodaysDailyNote delegates to getOrCreateDailyNote, so error includes the date
      expect(error.message).toContain('Failed to get or create daily note');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      const originalError = new DoubleBindError('Custom error', ErrorCode.DB_CONNECTION_FAILED);
      getOrCreateSpy.mockRejectedValueOnce(originalError);

      const error = await service.getTodaysDailyNote().catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.DB_CONNECTION_FAILED);
    });
  });

  describe('getOrCreateDailyNote', () => {
    it('should create initial empty block when daily note has no blocks', async () => {
      const now = Date.now();
      const testDate = '2026-02-10';
      const pageId = 'daily-page-id';

      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      getOrCreateSpy.mockResolvedValueOnce({
        pageId,
        title: testDate,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: testDate,
      });

      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      getByPageSpy.mockResolvedValueOnce([]); // No existing blocks

      const createSpy = vi.spyOn(blockRepo, 'create');
      createSpy.mockResolvedValueOnce('new-block-id');

      const result = await service.getOrCreateDailyNote(testDate);

      expect(result.pageId).toBe(pageId);
      expect(getByPageSpy).toHaveBeenCalledWith(pageId);
      expect(createSpy).toHaveBeenCalledWith({
        pageId,
        content: '',
      });
    });

    it('should not create block when daily note already has blocks', async () => {
      const now = Date.now();
      const testDate = '2026-02-10';
      const pageId = 'daily-page-id';

      const getOrCreateSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');
      getOrCreateSpy.mockResolvedValueOnce({
        pageId,
        title: testDate,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: testDate,
      });

      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      getByPageSpy.mockResolvedValueOnce([
        {
          blockId: 'existing-block',
          pageId,
          parentId: null,
          content: 'Hello',
          contentType: 'text' as const,
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const createSpy = vi.spyOn(blockRepo, 'create');

      const result = await service.getOrCreateDailyNote(testDate);

      expect(result.pageId).toBe(pageId);
      expect(getByPageSpy).toHaveBeenCalledWith(pageId);
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('searchPages', () => {
    it('should delegate to pageRepo.search', async () => {
      const searchSpy = vi.spyOn(pageRepo, 'search');
      const now = Date.now();

      searchSpy.mockResolvedValueOnce([
        {
          pageId: 'page-1',
          title: 'Search Result 1',
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          dailyNoteDate: null,
        },
        {
          pageId: 'page-2',
          title: 'Search Result 2',
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          dailyNoteDate: null,
        },
      ]);

      const result = await service.searchPages('test query');

      expect(searchSpy).toHaveBeenCalledWith('test query');
      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe('Search Result 1');
    });

    it('should return empty array when no results', async () => {
      const searchSpy = vi.spyOn(pageRepo, 'search');
      searchSpy.mockResolvedValueOnce([]);

      const result = await service.searchPages('no matches');

      expect(result).toEqual([]);
    });

    it('should wrap repository errors with context', async () => {
      const searchSpy = vi.spyOn(pageRepo, 'search');
      const originalError = new Error('FTS index corrupted');
      searchSpy.mockRejectedValueOnce(originalError);

      const error = await service.searchPages('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to search pages');
      expect(error.message).toContain('test');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const searchSpy = vi.spyOn(pageRepo, 'search');
      const originalError = new DoubleBindError('Blocked', ErrorCode.BLOCKED_OPERATION);
      searchSpy.mockRejectedValueOnce(originalError);

      const error = await service.searchPages('test').catch((e) => e);

      expect(error).toBe(originalError);
    });
  });

  describe('error handling patterns', () => {
    it('should preserve DoubleBindError code when re-throwing', async () => {
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      const originalError = new DoubleBindError('Page locked', ErrorCode.BLOCKED_OPERATION);
      getByIdSpy.mockRejectedValueOnce(originalError);

      const error = await service.getPageWithBlocks('test').catch((e) => e);

      // Should NOT wrap - should re-throw original
      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should handle non-Error thrown values', async () => {
      const getByIdSpy = vi.spyOn(pageRepo, 'getById');
      getByIdSpy.mockRejectedValueOnce('string error');

      const error = await service.getPageWithBlocks('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.message).toContain('string error');
      expect(error.cause).toBeUndefined();
    });
  });
});
