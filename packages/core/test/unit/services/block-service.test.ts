/**
 * BlockService unit tests.
 *
 * Tests the orchestration logic of BlockService including:
 * - Content parsing and syncing
 * - Block CRUD operations
 * - Indent/outdent tree operations
 * - Collapse toggling
 *
 * Uses vi.spyOn to mock repository methods for isolated unit testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockService } from '../../../src/services/block-service.js';
import { BlockRepository } from '../../../src/repositories/block-repository.js';
import { LinkRepository } from '../../../src/repositories/link-repository.js';
import { PageRepository } from '../../../src/repositories/page-repository.js';
import { TagRepository } from '../../../src/repositories/tag-repository.js';
import { PropertyRepository } from '../../../src/repositories/property-repository.js';
import { MockGraphDB } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Block, Page } from '@double-bind/types';

describe('BlockService', () => {
  let mockDb: MockGraphDB;
  let blockRepo: BlockRepository;
  let linkRepo: LinkRepository;
  let pageRepo: PageRepository;
  let tagRepo: TagRepository;
  let propertyRepo: PropertyRepository;
  let blockService: BlockService;

  // Test data
  const testPageId = '01HXQ5NF6Z8V4JQXRK4KZYYYYY';
  const testBlockId = '01HXQ5NF6Z8V4JQXRK4KZZZZZZ';
  const now = Date.now();
  const testBlock: Block = {
    blockId: testBlockId,
    pageId: testPageId,
    parentId: null,
    content: 'Test content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const testTargetPage: Page = {
    pageId: '01HXQ5NF6Z8V4JQXRK4KTARGET',
    title: 'New Page',
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    dailyNoteDate: null,
  };

  beforeEach(() => {
    mockDb = new MockGraphDB();
    blockRepo = new BlockRepository(mockDb);
    linkRepo = new LinkRepository(mockDb);
    pageRepo = new PageRepository(mockDb);
    tagRepo = new TagRepository(mockDb);
    propertyRepo = new PropertyRepository(mockDb);
    blockService = new BlockService(blockRepo, linkRepo, pageRepo, tagRepo, propertyRepo);
  });

  describe('updateContent', () => {
    it('should update block content successfully', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);

      await blockService.updateContent(testBlockId, 'New content');

      expect(updateSpy).toHaveBeenCalledWith(testBlockId, { content: 'New content' });
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.updateContent('nonexistent', 'content')).rejects.toThrow(
        DoubleBindError
      );
      await expect(blockService.updateContent('nonexistent', 'content')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });

    it('should sync tags when content contains #tags', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const addTagSpy = vi.spyOn(tagRepo, 'addTag');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      addTagSpy.mockResolvedValue(undefined);

      await blockService.updateContent(testBlockId, 'Content with #project #important');

      // Verify tags were added
      expect(addTagSpy).toHaveBeenCalledWith(testBlockId, 'project');
      expect(addTagSpy).toHaveBeenCalledWith(testBlockId, 'important');
    });

    it('should remove old tags that are no longer in content', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const addTagSpy = vi.spyOn(tagRepo, 'addTag');
      const removeTagSpy = vi.spyOn(tagRepo, 'removeTag');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([
        { entityId: testBlockId, tag: 'oldtag', createdAt: now },
      ]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      addTagSpy.mockResolvedValue(undefined);
      removeTagSpy.mockResolvedValue(undefined);

      await blockService.updateContent(testBlockId, 'Content with #newtag');

      // Verify old tag was removed
      expect(removeTagSpy).toHaveBeenCalledWith(testBlockId, 'oldtag');
      // Verify new tag was added
      expect(addTagSpy).toHaveBeenCalledWith(testBlockId, 'newtag');
    });

    it('should sync properties when content contains key:: value', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const setPropSpy = vi.spyOn(propertyRepo, 'set');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      setPropSpy.mockResolvedValue(undefined);

      await blockService.updateContent(testBlockId, 'status:: done');

      // Verify property was added
      expect(setPropSpy).toHaveBeenCalledWith(testBlockId, 'status', 'done');
    });

    it('should create block refs when content contains ((blockId))', async () => {
      const targetBlockId = '01HXQ5NF6Z8V4JQXRK4KAAAAAA';

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const createBlockRefSpy = vi.spyOn(linkRepo, 'createBlockRef');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      createBlockRefSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);

      await blockService.updateContent(testBlockId, `Reference to ((${targetBlockId}))`);

      // Verify block ref was created
      expect(createBlockRefSpy).toHaveBeenCalledWith({
        sourceBlockId: testBlockId,
        targetBlockId: targetBlockId,
      });
    });

    it('should create page links when content contains [[Page Name]]', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getOrCreateByTitleSpy = vi.spyOn(pageRepo, 'getOrCreateByTitle');
      const createLinkSpy = vi.spyOn(linkRepo, 'createLink');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getOrCreateByTitleSpy.mockResolvedValueOnce(testTargetPage);
      createLinkSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);

      await blockService.updateContent(testBlockId, 'Link to [[New Page]]');

      // Verify page was looked up or created
      expect(getOrCreateByTitleSpy).toHaveBeenCalledWith('New Page');

      // Verify link was created
      expect(createLinkSpy).toHaveBeenCalledWith({
        sourceId: testPageId,
        targetId: testTargetPage.pageId,
        linkType: 'reference',
        contextBlockId: testBlockId,
      });
    });

    it('should create multiple page links for multiple [[Page Name]] references', async () => {
      const secondTargetPage: Page = {
        pageId: '01HXQ5NF6Z8V4JQXRK4KTARGT2',
        title: 'Another Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getOrCreateByTitleSpy = vi.spyOn(pageRepo, 'getOrCreateByTitle');
      const createLinkSpy = vi.spyOn(linkRepo, 'createLink');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      updateSpy.mockResolvedValueOnce(undefined);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getOrCreateByTitleSpy.mockResolvedValueOnce(testTargetPage);
      getOrCreateByTitleSpy.mockResolvedValueOnce(secondTargetPage);
      createLinkSpy.mockResolvedValue(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);

      await blockService.updateContent(testBlockId, 'Link to [[New Page]] and [[Another Page]]');

      // Verify both pages were looked up or created
      expect(getOrCreateByTitleSpy).toHaveBeenCalledWith('New Page');
      expect(getOrCreateByTitleSpy).toHaveBeenCalledWith('Another Page');

      // Verify both links were created
      expect(createLinkSpy).toHaveBeenCalledTimes(2);
      expect(createLinkSpy).toHaveBeenCalledWith({
        sourceId: testPageId,
        targetId: testTargetPage.pageId,
        linkType: 'reference',
        contextBlockId: testBlockId,
      });
      expect(createLinkSpy).toHaveBeenCalledWith({
        sourceId: testPageId,
        targetId: secondTargetPage.pageId,
        linkType: 'reference',
        contextBlockId: testBlockId,
      });
    });
  });

  describe('createBlock', () => {
    it('should create a block with default order when no siblings', async () => {
      const createSpy = vi.spyOn(blockRepo, 'create');
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      const newBlockId = '01HXQ5NF6Z8V4JQXRK4KNEWBLK';
      createSpy.mockResolvedValueOnce(newBlockId);
      getChildrenSpy.mockResolvedValueOnce([]); // No siblings
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      getByIdSpy.mockResolvedValueOnce({
        ...testBlock,
        blockId: newBlockId,
        content: 'New block content',
      });

      const block = await blockService.createBlock(testPageId, null, 'New block content');

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: testPageId,
          parentId: undefined,
          content: 'New block content',
        })
      );
      expect(block.blockId).toBe(newBlockId);
    });

    it('should parse and sync content on creation', async () => {
      const createSpy = vi.spyOn(blockRepo, 'create');
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const addTagSpy = vi.spyOn(tagRepo, 'addTag');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const setPropSpy = vi.spyOn(propertyRepo, 'set');

      const newBlockId = '01HXQ5NF6Z8V4JQXRK4KNEWBLK';
      // Property must be at start of line (per content parser regex ^([\w][\w-]*):: (.+)$)
      const contentWithTagAndProp = 'status:: active\n#tag content';

      // Order matters: first getChildren, then create, then syncParsedContent (which calls getByEntity), then getById
      getChildrenSpy.mockResolvedValueOnce([]); // For calculateOrderForInsert
      createSpy.mockResolvedValueOnce(newBlockId);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]); // Called by syncParsedContent
      getPropsByEntitySpy.mockResolvedValueOnce([]); // Called by syncParsedContent
      addTagSpy.mockResolvedValue(undefined);
      setPropSpy.mockResolvedValue(undefined);
      getByIdSpy.mockResolvedValueOnce({
        ...testBlock,
        blockId: newBlockId,
        content: contentWithTagAndProp,
      });

      await blockService.createBlock(testPageId, null, contentWithTagAndProp);

      // Verify tag was added
      expect(addTagSpy).toHaveBeenCalledWith(newBlockId, 'tag');
      // Verify property was added
      expect(setPropSpy).toHaveBeenCalledWith(newBlockId, 'status', 'active');
    });

    it('should calculate order based on afterBlockId', async () => {
      const siblingId = '01HXQ5NF6Z8V4JQXRK4KBBBBBB';
      const sibling: Block = {
        ...testBlock,
        blockId: siblingId,
        content: 'Sibling',
        order: 'a0',
      };

      const createSpy = vi.spyOn(blockRepo, 'create');
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      const newBlockId = '01HXQ5NF6Z8V4JQXRK4KNEWBLK';
      createSpy.mockResolvedValueOnce(newBlockId);
      getChildrenSpy.mockResolvedValueOnce([sibling]); // One sibling
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      getByIdSpy.mockResolvedValueOnce({
        ...testBlock,
        blockId: newBlockId,
        content: 'After sibling',
        order: 'a1',
      });

      await blockService.createBlock(testPageId, null, 'After sibling', siblingId);

      // Verify create was called with an order that's after 'a0'
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.stringMatching(/.+/), // Order should be set
        })
      );
      const createCall = createSpy.mock.calls[0]?.[0];
      const order = createCall?.order;
      expect(order).toBeDefined();
      expect(order! > 'a0').toBe(true);
    });
  });

  describe('deleteBlock', () => {
    it('should soft delete a block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const softDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      softDeleteSpy.mockResolvedValueOnce(undefined);

      await blockService.deleteBlock(testBlockId);

      expect(softDeleteSpy).toHaveBeenCalledWith(testBlockId);
    });

    it('should remove associated tags when deleting', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const softDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const removeTagSpy = vi.spyOn(tagRepo, 'removeTag');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');

      getByIdSpy.mockResolvedValueOnce({ ...testBlock, content: '#tag content' });
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([
        { entityId: testBlockId, tag: 'tag', createdAt: now },
      ]);
      removeTagSpy.mockResolvedValue(undefined);
      getPropsByEntitySpy.mockResolvedValueOnce([]);
      softDeleteSpy.mockResolvedValueOnce(undefined);

      await blockService.deleteBlock(testBlockId);

      expect(removeTagSpy).toHaveBeenCalledWith(testBlockId, 'tag');
    });

    it('should remove associated properties when deleting', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const softDeleteSpy = vi.spyOn(blockRepo, 'softDelete');
      const removeLinksFromBlockSpy = vi.spyOn(linkRepo, 'removeLinksFromBlock');
      const getTagsByEntitySpy = vi.spyOn(tagRepo, 'getByEntity');
      const getPropsByEntitySpy = vi.spyOn(propertyRepo, 'getByEntity');
      const removePropSpy = vi.spyOn(propertyRepo, 'remove');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      removeLinksFromBlockSpy.mockResolvedValueOnce(undefined);
      getTagsByEntitySpy.mockResolvedValueOnce([]);
      getPropsByEntitySpy.mockResolvedValueOnce([
        {
          entityId: testBlockId,
          key: 'status',
          value: 'done',
          valueType: 'string',
          updatedAt: now,
        },
      ]);
      removePropSpy.mockResolvedValue(undefined);
      softDeleteSpy.mockResolvedValueOnce(undefined);

      await blockService.deleteBlock(testBlockId);

      expect(removePropSpy).toHaveBeenCalledWith(testBlockId, 'status');
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.deleteBlock('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(blockService.deleteBlock('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });
  });

  describe('moveBlock', () => {
    it('should move a block to a new parent', async () => {
      const newParentId = '01HXQ5NF6Z8V4JQXRK4KCCCCCC';

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const moveSpy = vi.spyOn(blockRepo, 'move');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');

      getByIdSpy.mockResolvedValueOnce(testBlock);
      getChildrenSpy.mockResolvedValueOnce([]); // No children in new parent
      moveSpy.mockResolvedValueOnce(undefined);

      await blockService.moveBlock(testBlockId, newParentId);

      expect(moveSpy).toHaveBeenCalledWith(testBlockId, newParentId, expect.any(String));
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.moveBlock('nonexistent', null)).rejects.toThrow(DoubleBindError);
      await expect(blockService.moveBlock('nonexistent', null)).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });
  });

  describe('indentBlock', () => {
    it('should make block a child of its previous sibling', async () => {
      const previousSiblingId = '01HXQ5NF6Z8V4JQXRK4KDDDDDD';
      const previousSibling: Block = {
        ...testBlock,
        blockId: previousSiblingId,
        content: 'Previous',
        order: 'a0',
      };
      const blockToIndent: Block = {
        ...testBlock,
        content: 'To indent',
        order: 'a1',
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      getByIdSpy.mockResolvedValueOnce(blockToIndent);
      // First getChildren for siblings
      getChildrenSpy.mockResolvedValueOnce([previousSibling, blockToIndent]);
      // Second getChildren for new parent's children
      getChildrenSpy.mockResolvedValueOnce([]);
      moveSpy.mockResolvedValueOnce(undefined);

      await blockService.indentBlock(testBlockId);

      // Verify block was moved to be a child of previous sibling
      expect(moveSpy).toHaveBeenCalledWith(testBlockId, previousSiblingId, expect.any(String));
    });

    it('should do nothing if block has no previous sibling', async () => {
      const blockToIndent: Block = {
        ...testBlock,
        content: 'First block',
        order: 'a0',
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      getByIdSpy.mockResolvedValueOnce(blockToIndent);
      getChildrenSpy.mockResolvedValueOnce([blockToIndent]); // Only this block

      await blockService.indentBlock(testBlockId);

      // Verify no move was performed
      expect(moveSpy).not.toHaveBeenCalled();
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.indentBlock('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(blockService.indentBlock('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });
  });

  describe('outdentBlock', () => {
    it('should make block a sibling of its parent', async () => {
      const parentId = '01HXQ5NF6Z8V4JQXRK4KEEEEEE';
      const parent: Block = {
        ...testBlock,
        blockId: parentId,
        parentId: null,
        content: 'Parent',
        order: 'a0',
      };
      const blockToOutdent: Block = {
        ...testBlock,
        parentId: parentId,
        content: 'To outdent',
        order: 'a0',
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      // First call for the block itself
      getByIdSpy.mockResolvedValueOnce(blockToOutdent);
      // Second call for the parent
      getByIdSpy.mockResolvedValueOnce(parent);
      // Get grandparent's children (parent's siblings)
      getChildrenSpy.mockResolvedValueOnce([parent]);
      moveSpy.mockResolvedValueOnce(undefined);

      await blockService.outdentBlock(testBlockId);

      // Verify block was moved to root level (null parent)
      expect(moveSpy).toHaveBeenCalledWith(
        testBlockId,
        null, // Grandparent is null (root level)
        expect.any(String)
      );
    });

    it('should do nothing if block is already at root level', async () => {
      const rootBlock: Block = {
        ...testBlock,
        parentId: null,
        content: 'Root block',
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      getByIdSpy.mockResolvedValueOnce(rootBlock);

      await blockService.outdentBlock(testBlockId);

      // Verify no move was performed
      expect(moveSpy).not.toHaveBeenCalled();
    });

    it('should position outdented block after its former parent', async () => {
      const parentId = '01HXQ5NF6Z8V4JQXRK4KFFFFFF';
      const anotherRootBlockId = '01HXQ5NF6Z8V4JQXRK4KGGGGGG';
      const parent: Block = {
        ...testBlock,
        blockId: parentId,
        parentId: null,
        content: 'Parent',
        order: 'a0',
      };
      const anotherRoot: Block = {
        ...testBlock,
        blockId: anotherRootBlockId,
        parentId: null,
        content: 'Another',
        order: 'a2',
      };
      const blockToOutdent: Block = {
        ...testBlock,
        parentId: parentId,
        content: 'To outdent',
        order: 'a0',
      };

      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const getChildrenSpy = vi.spyOn(blockRepo, 'getChildren');
      const moveSpy = vi.spyOn(blockRepo, 'move');

      getByIdSpy.mockResolvedValueOnce(blockToOutdent);
      getByIdSpy.mockResolvedValueOnce(parent);
      // Parent's siblings (at root level)
      getChildrenSpy.mockResolvedValueOnce([parent, anotherRoot]);
      moveSpy.mockResolvedValueOnce(undefined);

      await blockService.outdentBlock(testBlockId);

      // Verify the new order is between parent's 'a0' and next sibling's 'a2'
      expect(moveSpy).toHaveBeenCalled();
      const moveCall = moveSpy.mock.calls[0];
      const newOrder = moveCall?.[2] as string;
      expect(newOrder > 'a0').toBe(true);
      expect(newOrder < 'a2').toBe(true);
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.outdentBlock('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(blockService.outdentBlock('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });
  });

  describe('toggleCollapse', () => {
    it('should toggle collapsed state from false to true', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');

      getByIdSpy.mockResolvedValueOnce({ ...testBlock, isCollapsed: false });
      updateSpy.mockResolvedValueOnce(undefined);

      await blockService.toggleCollapse(testBlockId);

      expect(updateSpy).toHaveBeenCalledWith(testBlockId, { isCollapsed: true });
    });

    it('should toggle collapsed state from true to false', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const updateSpy = vi.spyOn(blockRepo, 'update');

      getByIdSpy.mockResolvedValueOnce({ ...testBlock, isCollapsed: true });
      updateSpy.mockResolvedValueOnce(undefined);

      await blockService.toggleCollapse(testBlockId);

      expect(updateSpy).toHaveBeenCalledWith(testBlockId, { isCollapsed: false });
    });

    it('should throw BLOCK_NOT_FOUND for non-existent block', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(blockService.toggleCollapse('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(blockService.toggleCollapse('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });
  });

  describe('getBacklinks', () => {
    it('should return blocks that reference the target block', async () => {
      const sourceBlockId = '01HXQ5NF6Z8V4JQXRK4KHHHHHH';
      const sourceBlock: Block = {
        ...testBlock,
        blockId: sourceBlockId,
        content: `Reference to ((${testBlockId}))`,
      };

      const getBlockBacklinksSpy = vi.spyOn(linkRepo, 'getBlockBacklinks');
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');

      getBlockBacklinksSpy.mockResolvedValueOnce([
        {
          sourceBlockId,
          targetBlockId: testBlockId,
          createdAt: now,
          content: sourceBlock.content,
          pageId: testPageId,
        },
      ]);
      getByIdSpy.mockResolvedValueOnce(sourceBlock);

      const backlinks = await blockService.getBacklinks(testBlockId);

      expect(backlinks.length).toBe(1);
      // getBacklinks returns BlockBacklinkResult[] which has { block, page } structure
      expect(backlinks[0]?.block.blockId).toBe(sourceBlockId);
      expect(backlinks[0]?.page.pageId).toBe(testPageId);
    });

    it('should return empty array when no backlinks exist', async () => {
      const getBlockBacklinksSpy = vi.spyOn(linkRepo, 'getBlockBacklinks');
      getBlockBacklinksSpy.mockResolvedValueOnce([]);

      const backlinks = await blockService.getBacklinks(testBlockId);

      expect(backlinks).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should wrap non-DoubleBindError with context', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const originalError = new Error('Network timeout');
      getByIdSpy.mockRejectedValueOnce(originalError);

      const error = await blockService.updateContent(testBlockId, 'content').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_MUTATION_FAILED);
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const getByIdSpy = vi.spyOn(blockRepo, 'getById');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      getByIdSpy.mockRejectedValueOnce(originalError);

      const error = await blockService.updateContent(testBlockId, 'content').catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });
  });
});
