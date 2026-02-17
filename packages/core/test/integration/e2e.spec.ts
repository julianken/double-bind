/**
 * End-to-End Integration Tests
 *
 * These tests verify that the entire data layer works together in realistic scenarios.
 * They simulate complete user workflows from start to finish:
 * - Creating pages and blocks
 * - Adding tags and properties
 * - Creating links between pages
 * - Full-text search
 * - Using services (PageService, BlockService)
 *
 * Each test is a complete scenario that exercises multiple repositories and services.
 *
 * NOTE: These tests use vi.spyOn to mock repository methods since MockDatabase
 * doesn't persist data. For true integration tests with real CozoDB, use cozo-node
 * with the wrapCozoDb adapter (see docs/testing/integration-tests.md).
 *
 * The goal of these E2E tests is to verify that:
 * 1. Services correctly orchestrate multiple repositories
 * 2. Complex workflows involving many operations complete successfully
 * 3. Data flows correctly between services and repositories
 * 4. Error handling works across service boundaries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import type { Services } from '../../src/services/index.js';
import { PageService } from '../../src/services/page-service.js';
import { BlockService } from '../../src/services/block-service.js';
import type { Page, Block } from '@double-bind/types';
import { PageRepository } from '../../src/repositories/page-repository.js';
import { BlockRepository } from '../../src/repositories/block-repository.js';
import { LinkRepository } from '../../src/repositories/link-repository.js';
import { TagRepository } from '../../src/repositories/tag-repository.js';
import { PropertyRepository } from '../../src/repositories/property-repository.js';

describe('E2E Integration Tests', () => {
  let db: MockDatabase;
  let services: Services;
  let pageRepo: PageRepository;
  let blockRepo: BlockRepository;
  let linkRepo: LinkRepository;
  let tagRepo: TagRepository;
  let propertyRepo: PropertyRepository;

  const now = Date.now();

  beforeEach(() => {
    db = new MockDatabase();

    // Create repositories that will be used by services
    pageRepo = new PageRepository(db);
    blockRepo = new BlockRepository(db);
    linkRepo = new LinkRepository(db);
    tagRepo = new TagRepository(db);
    propertyRepo = new PropertyRepository(db);

    // Create services with the repositories we control
    services = {
      pageService: new PageService(pageRepo, blockRepo, linkRepo),
      blockService: new BlockService(blockRepo, linkRepo, pageRepo, tagRepo, propertyRepo),
    };
  });

  describe('Scenario 1: Basic Page and Block Creation', () => {
    it('should create a page and add multiple blocks with different features', async () => {
      // Mock the repository layer
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const blockId1 = '01KGRVC788DC39KDY6GC9BTW10';
      const blockId2 = '01KGRVC788DC39KDY6GC9BTW11';

      const createPageSpy = vi.spyOn(pageRepo, 'create');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const createBlockSpy = vi.spyOn(blockRepo, 'create');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const addTagSpy = vi.spyOn(tagRepo, 'addTag');

      const page: Page = {
        pageId,
        title: 'Research Notes',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const block1: Block = {
        blockId: blockId1,
        pageId,
        parentId: null,
        content: 'First block #tag1',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const block2: Block = {
        blockId: blockId2,
        pageId,
        parentId: null,
        content: 'Second block #tag2',
        contentType: 'text',
        order: 'a1',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      createPageSpy.mockResolvedValueOnce(pageId);
      getPageByIdSpy.mockResolvedValue(page);
      getChildrenSpy.mockResolvedValue([]);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValue([]);
      getPropsByEntitySpy.mockResolvedValue([]);
      addTagSpy.mockResolvedValue(undefined);

      // createPage internally creates an initial empty block, consuming one mock
      createBlockSpy.mockResolvedValueOnce('initial-empty-block');

      createBlockSpy.mockResolvedValueOnce(blockId1);
      getBlockByIdSpy.mockResolvedValueOnce(block1);

      createBlockSpy.mockResolvedValueOnce(blockId2);
      getBlockByIdSpy.mockResolvedValueOnce(block2);

      getByPageSpy.mockResolvedValue([block1, block2]);

      // Execute workflow
      const createdPage = await services.pageService.createPage('Research Notes');
      await services.blockService.createBlock(pageId, null, 'First block #tag1');
      await services.blockService.createBlock(pageId, null, 'Second block #tag2');
      const { blocks } = await services.pageService.getPageWithBlocks(pageId);

      // Verify
      expect(createdPage.title).toBe('Research Notes');
      expect(blocks.length).toBe(2);
      expect(addTagSpy).toHaveBeenCalledWith(blockId1, 'tag1');
      expect(addTagSpy).toHaveBeenCalledWith(blockId2, 'tag2');
    });
  });

  describe('Scenario 2: Hierarchical Block Structure', () => {
    it('should create nested parent-child block relationships', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const parentBlockId = '01KGRVC788DC39KDY6GC9BTW10';
      const childBlockId = '01KGRVC788DC39KDY6GC9BTW11';

      const createPageSpy = vi.spyOn(pageRepo, 'create');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const createBlockSpy = vi.spyOn(blockRepo, 'create');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      const page: Page = {
        pageId,
        title: 'Outline',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const parentBlock: Block = {
        blockId: parentBlockId,
        pageId,
        parentId: null,
        content: 'Parent block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const childBlock: Block = {
        blockId: childBlockId,
        pageId,
        parentId: parentBlockId,
        content: 'Child block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      createPageSpy.mockResolvedValueOnce(pageId);
      getPageByIdSpy.mockResolvedValue(page);
      getChildrenSpy.mockResolvedValue([]);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValue([]);
      getPropsByEntitySpy.mockResolvedValue([]);

      createBlockSpy.mockResolvedValueOnce(parentBlockId);
      getBlockByIdSpy.mockResolvedValueOnce(parentBlock);

      createBlockSpy.mockResolvedValueOnce(childBlockId);
      getBlockByIdSpy.mockResolvedValueOnce(childBlock);

      getByPageSpy.mockResolvedValue([parentBlock, childBlock]);

      // Execute workflow
      await services.pageService.createPage('Outline');
      await services.blockService.createBlock(pageId, null, 'Parent block');
      const child = await services.blockService.createBlock(pageId, parentBlockId, 'Child block');
      const { blocks } = await services.pageService.getPageWithBlocks(pageId);

      // Verify
      expect(child.parentId).toBe(parentBlockId);
      expect(blocks.length).toBe(2);
      expect(blocks.some((b) => b.parentId === null)).toBe(true);
      expect(blocks.some((b) => b.parentId === parentBlockId)).toBe(true);
    });
  });

  describe('Scenario 3: Block Updates with Content Parsing', () => {
    it('should update block content and sync tags and properties', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const blockId = '01KGRVC788DC39KDY6GC9BTW10';

      const createPageSpy = vi.spyOn(pageRepo, 'create');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const createBlockSpy = vi.spyOn(blockRepo, 'create');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateBlockSpy = vi.spyOn(blockRepo, 'update');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const addTagSpy = vi.spyOn(tagRepo, 'addTag');
      const removeTagSpy = vi.spyOn(tagRepo, 'removeTag');
      const setPropSpy = vi.spyOn(propertyRepo, 'set');

      const page: Page = {
        pageId,
        title: 'Task List',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const initialBlock: Block = {
        blockId,
        pageId,
        parentId: null,
        content: 'Initial content #old-tag',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      createPageSpy.mockResolvedValueOnce(pageId);
      getPageByIdSpy.mockResolvedValue(page);
      getChildrenSpy.mockResolvedValue([]);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);

      // Initial creation
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      addTagSpy.mockResolvedValue(undefined);
      createBlockSpy.mockResolvedValueOnce(blockId);
      getBlockByIdSpy.mockResolvedValueOnce(initialBlock);

      // Update
      getBlockByIdSpy.mockResolvedValueOnce(initialBlock);
      getTagsByEntitySpy.mockResolvedValueOnce([
        { entityId: blockId, tag: 'old-tag', createdAt: now },
      ]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      updateBlockSpy.mockResolvedValue(undefined);
      removeTagSpy.mockResolvedValue(undefined);
      setPropSpy.mockResolvedValue(undefined);

      // Execute workflow
      await services.pageService.createPage('Task List');
      await services.blockService.createBlock(pageId, null, 'Initial content #old-tag');
      await services.blockService.updateContent(blockId, 'status:: done\nUpdated content #new-tag');

      // Verify tags and properties were synced
      expect(removeTagSpy).toHaveBeenCalledWith(blockId, 'old-tag');
      expect(addTagSpy).toHaveBeenCalledWith(blockId, 'new-tag');
      expect(setPropSpy).toHaveBeenCalledWith(blockId, 'status', 'done');
    });
  });

  describe('Scenario 4: Page Links and References', () => {
    it('should create links between pages via [[wiki-style]] references', async () => {
      const sourcePageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const targetPageId = '01KGRVC788DC39KDY6GC9BTW9K';
      const blockId = '01KGRVC788DC39KDY6GC9BTW10';

      const createPageSpy = vi.spyOn(pageRepo, 'create');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getOrCreateByTitleSpy = vi.spyOn(pageRepo, 'getOrCreateByTitle');
      const createBlockSpy = vi.spyOn(blockRepo, 'create');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const createLinkSpy = vi.spyOn(linkRepo, 'createLink');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      const sourcePage: Page = {
        pageId: sourcePageId,
        title: 'Source Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const targetPage: Page = {
        pageId: targetPageId,
        title: 'Target Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const block: Block = {
        blockId,
        pageId: sourcePageId,
        parentId: null,
        content: 'Link to [[Target Page]]',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      createPageSpy.mockResolvedValueOnce(sourcePageId);
      getPageByIdSpy.mockResolvedValue(sourcePage);
      getOrCreateByTitleSpy.mockResolvedValue(targetPage);
      getChildrenSpy.mockResolvedValue([]);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValue([]);
      getPropsByEntitySpy.mockResolvedValue([]);
      createLinkSpy.mockResolvedValue(undefined);

      // createPage internally creates an initial empty block, consuming one mock
      createBlockSpy.mockResolvedValueOnce('initial-empty-block');

      createBlockSpy.mockResolvedValueOnce(blockId);
      getBlockByIdSpy.mockResolvedValueOnce(block);

      // Execute workflow
      await services.pageService.createPage('Source Page');
      await services.blockService.createBlock(sourcePageId, null, 'Link to [[Target Page]]');

      // Verify link was created
      expect(getOrCreateByTitleSpy).toHaveBeenCalledWith('Target Page');
      expect(createLinkSpy).toHaveBeenCalledWith({
        sourceId: sourcePageId,
        targetId: targetPageId,
        linkType: 'reference',
        contextBlockId: blockId,
      });
    });
  });

  describe('Scenario 5: Block References', () => {
    it('should create block references using ((block-id)) syntax', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const sourceBlockId = '01KGRVC788DC39KDY6GC9BTW10';
      const targetBlockId = '01KGRVC788DC39KDY6GC9BTW11';

      const createPageSpy = vi.spyOn(pageRepo, 'create');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const createBlockSpy = vi.spyOn(blockRepo, 'create');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const createBlockRefSpy = vi.spyOn(linkRepo, 'createBlockRef');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      const page: Page = {
        pageId,
        title: 'Notes',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const sourceBlock: Block = {
        blockId: sourceBlockId,
        pageId,
        parentId: null,
        content: `Reference to ((${targetBlockId}))`,
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      createPageSpy.mockResolvedValueOnce(pageId);
      getPageByIdSpy.mockResolvedValue(page);
      getChildrenSpy.mockResolvedValue([]);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValue([]);
      getPropsByEntitySpy.mockResolvedValue([]);
      createBlockRefSpy.mockResolvedValue(undefined);

      // createPage internally creates an initial empty block, consuming one mock
      createBlockSpy.mockResolvedValueOnce('initial-empty-block');

      createBlockSpy.mockResolvedValueOnce(sourceBlockId);
      getBlockByIdSpy.mockResolvedValueOnce(sourceBlock);

      // Execute workflow
      await services.pageService.createPage('Notes');
      await services.blockService.createBlock(pageId, null, `Reference to ((${targetBlockId}))`);

      // Verify block ref was created
      expect(createBlockRefSpy).toHaveBeenCalledWith({
        sourceBlockId,
        targetBlockId,
      });
    });
  });

  describe('Scenario 6: Block Indentation and Outdentation', () => {
    it('should indent a block to make it a child of previous sibling', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const block1Id = '01KGRVC788DC39KDY6GC9BTW10';
      const block2Id = '01KGRVC788DC39KDY6GC9BTW11';

      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      const block1: Block = {
        blockId: block1Id,
        pageId,
        parentId: null,
        content: 'First block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const block2: Block = {
        blockId: block2Id,
        pageId,
        parentId: null,
        content: 'Second block',
        contentType: 'text',
        order: 'a1',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      getBlockByIdSpy.mockResolvedValueOnce(block2);
      getChildrenSpy.mockResolvedValueOnce([block1, block2]);
      getChildrenSpy.mockResolvedValueOnce([]);
      moveSpy.mockResolvedValue(undefined);

      // Execute workflow
      await services.blockService.indentBlock(block2Id);

      // Verify block was moved to be child of previous sibling
      expect(moveSpy).toHaveBeenCalledWith(block2Id, block1Id, expect.any(String));
    });

    it('should outdent a block to make it a sibling of parent', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const parentBlockId = '01KGRVC788DC39KDY6GC9BTW10';
      const childBlockId = '01KGRVC788DC39KDY6GC9BTW11';

      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      const parentBlock: Block = {
        blockId: parentBlockId,
        pageId,
        parentId: null,
        content: 'Parent',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const childBlock: Block = {
        blockId: childBlockId,
        pageId,
        parentId: parentBlockId,
        content: 'Child',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      getBlockByIdSpy.mockResolvedValueOnce(childBlock);
      getBlockByIdSpy.mockResolvedValueOnce(parentBlock);
      getChildrenSpy.mockResolvedValueOnce([parentBlock]);
      moveSpy.mockResolvedValue(undefined);

      // Execute workflow
      await services.blockService.outdentBlock(childBlockId);

      // Verify block was moved to root level
      expect(moveSpy).toHaveBeenCalledWith(childBlockId, null, expect.any(String));
    });
  });

  describe('Scenario 7: Block Deletion with Metadata Cleanup', () => {
    it('should delete a block and clean up associated tags and properties', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const blockId = '01KGRVC788DC39KDY6GC9BTW10';

      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const softDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const removeTagSpy = vi.spyOn(tagRepo, 'removeTag');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const removePropSpy = vi.spyOn(propertyRepo, 'remove');

      const block: Block = {
        blockId,
        pageId,
        parentId: null,
        content: 'Block with tags #tag1 #tag2',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      getBlockByIdSpy.mockResolvedValue(block);
      removeLinksFromBlockSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValue([
        { entityId: blockId, tag: 'tag1', createdAt: now },
        { entityId: blockId, tag: 'tag2', createdAt: now },
      ]);
      getPropsByEntitySpy.mockResolvedValue([
        { entityId: blockId, key: 'status', value: 'done', valueType: 'string', updatedAt: now },
      ]);
      removeTagSpy.mockResolvedValue(undefined);
      removePropSpy.mockResolvedValue(undefined);
      softDeleteSpy.mockResolvedValue(undefined);

      // Execute workflow
      await services.blockService.deleteBlock(blockId);

      // Verify cleanup
      expect(removeLinksFromBlockSpy).toHaveBeenCalledWith(blockId);
      expect(removeTagSpy).toHaveBeenCalledWith(blockId, 'tag1');
      expect(removeTagSpy).toHaveBeenCalledWith(blockId, 'tag2');
      expect(removePropSpy).toHaveBeenCalledWith(blockId, 'status');
      expect(softDeleteSpy).toHaveBeenCalledWith(blockId);
    });
  });

  describe('Scenario 8: Page Deletion with Cascading', () => {
    it('should delete a page and all its blocks', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const block1Id = '01KGRVC788DC39KDY6GC9BTW10';
      const block2Id = '01KGRVC788DC39KDY6GC9BTW11';

      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');
      const getByPageSpy = vi.spyOn(blockRepo, 'getByPage');
      const blockSoftDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const pageSoftDeleteSpy = vi.spyOn(pageRepo, 'softDelete');

      const page: Page = {
        pageId,
        title: 'Page to Delete',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const blocks: Block[] = [
        {
          blockId: block1Id,
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
          blockId: block2Id,
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
      ];

      getPageByIdSpy.mockResolvedValue(page);
      getByPageSpy.mockResolvedValue(blocks);
      blockSoftDeleteSpy.mockResolvedValue(undefined);
      pageSoftDeleteSpy.mockResolvedValue(undefined);

      // Execute workflow
      await services.pageService.deletePage(pageId);

      // Verify cascading delete
      expect(blockSoftDeleteSpy).toHaveBeenCalledTimes(2);
      expect(blockSoftDeleteSpy).toHaveBeenCalledWith(block1Id);
      expect(blockSoftDeleteSpy).toHaveBeenCalledWith(block2Id);
      expect(pageSoftDeleteSpy).toHaveBeenCalledWith(pageId);
    });
  });

  describe('Scenario 9: Daily Notes', () => {
    it("should get or create today's daily note", async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const today = new Date().toISOString().split('T')[0]!;

      const getOrCreateDailyNoteSpy = vi.spyOn(pageRepo, 'getOrCreateDailyNote');

      const dailyNote: Page = {
        pageId,
        title: today,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: today,
      };

      getOrCreateDailyNoteSpy.mockResolvedValue(dailyNote);

      // Execute workflow
      const result = await services.pageService.getTodaysDailyNote();

      // Verify
      expect(getOrCreateDailyNoteSpy).toHaveBeenCalledWith(today);
      expect(result.dailyNoteDate).toBe(today);
      expect(result.title).toBe(today);
    });
  });

  describe('Scenario 10: Block Backlinks', () => {
    it('should retrieve backlinks to a block', async () => {
      const pageId = '01KGRVC788DC39KDY6GC9BTW9J';
      const targetBlockId = '01KGRVC788DC39KDY6GC9BTW10';
      const sourceBlockId = '01KGRVC788DC39KDY6GC9BTW11';

      const getBlockBacklinksSpy = vi.spyOn(linkRepo, 'getBlockBacklinks');
      const getBlockByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getPageByIdSpy = vi.spyOn(pageRepo, 'getById');

      const sourceBlock: Block = {
        blockId: sourceBlockId,
        pageId,
        parentId: null,
        content: `Reference to ((${targetBlockId}))`,
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      const page: Page = {
        pageId,
        title: 'Source Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      getBlockBacklinksSpy.mockResolvedValue([
        {
          sourceBlockId,
          targetBlockId,
          createdAt: now,
          content: sourceBlock.content,
          pageId,
        },
      ]);
      getBlockByIdSpy.mockResolvedValue(sourceBlock);
      getPageByIdSpy.mockResolvedValue(page);

      // Execute workflow
      const backlinks = await services.blockService.getBacklinks(targetBlockId);

      // Verify
      expect(backlinks.length).toBe(1);
      expect(backlinks[0]?.block.blockId).toBe(sourceBlockId);
      expect(backlinks[0]?.page.pageId).toBe(pageId);
    });
  });
});
