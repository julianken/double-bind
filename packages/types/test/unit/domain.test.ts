/**
 * Unit tests for domain types
 * Tests type definitions, structure validation, and edge cases
 */

import type {
  PageId,
  BlockId,
  Page,
  Block,
  BlockRef,
  Link,
  Property,
  Tag,
  BlockVersion,
} from '../../src/domain';

describe('Domain Types', () => {
  describe('PageId and BlockId', () => {
    it('should accept valid ULID strings', () => {
      const pageId: PageId = '01HQRV3K2GQWZ3ZQZQZQZQZQZQ';
      const blockId: BlockId = '01HQRV3K2GQWZ3ZQZQZQZQZQZQ';

      expect(typeof pageId).toBe('string');
      expect(typeof blockId).toBe('string');
    });

    it('should accept any string value (runtime validation elsewhere)', () => {
      const pageId: PageId = 'not-a-ulid';
      const blockId: BlockId = '';

      expect(typeof pageId).toBe('string');
      expect(typeof blockId).toBe('string');
    });
  });

  describe('Page', () => {
    it('should create a valid regular page', () => {
      const page: Page = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        title: 'My Note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        dailyNoteDate: null,
      };

      expect(page.pageId).toBeDefined();
      expect(page.title).toBe('My Note');
      expect(page.dailyNoteDate).toBeNull();
    });

    it('should create a valid daily note page', () => {
      const page: Page = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        title: 'February 5, 2026',
        createdAt: 1738800000000,
        updatedAt: 1738800000000,
        isDeleted: false,
        dailyNoteDate: '2026-02-05',
      };

      expect(page.dailyNoteDate).toBe('2026-02-05');
      expect(page.title).toContain('February');
    });

    it('should handle deleted pages', () => {
      const page: Page = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        title: 'Deleted Note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: true,
        dailyNoteDate: null,
      };

      expect(page.isDeleted).toBe(true);
    });

    it('should handle empty title', () => {
      const page: Page = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        title: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        dailyNoteDate: null,
      };

      expect(page.title).toBe('');
    });

    it('should use millisecond precision timestamps', () => {
      const now = Date.now();
      const page: Page = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        title: 'Test',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      };

      expect(page.createdAt).toBeGreaterThan(1700000000000); // After Nov 2023
      expect(page.createdAt).toBe(page.updatedAt);
    });
  });

  describe('Block', () => {
    it('should create a valid root block', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: null,
        content: 'Root block content',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.parentId).toBeNull();
      expect(block.contentType).toBe('text');
    });

    it('should create a valid child block', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        content: 'Child block content',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.parentId).toBeDefined();
      expect(block.parentId).not.toBeNull();
    });

    it('should support all content types', () => {
      const contentTypes: Array<'text' | 'heading' | 'code' | 'todo' | 'query'> = [
        'text',
        'heading',
        'code',
        'todo',
        'query',
      ];

      contentTypes.forEach((type) => {
        const block: Block = {
          blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          parentId: null,
          content: `Content for ${type}`,
          contentType: type,
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        expect(block.contentType).toBe(type);
      });
    });

    it('should handle collapsed blocks', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: null,
        content: 'Collapsed block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: true,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.isCollapsed).toBe(true);
    });

    it('should handle deleted blocks', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: null,
        content: 'Deleted block',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.isDeleted).toBe(true);
    });

    it('should handle fractional indexing order', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: null,
        content: 'Block with fractional order',
        contentType: 'text',
        order: 'a0V',
        isCollapsed: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.order).toBe('a0V');
    });

    it('should handle empty content', () => {
      const block: Block = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        parentId: null,
        content: '',
        contentType: 'text',
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(block.content).toBe('');
    });
  });

  describe('BlockRef', () => {
    it('should create a valid block reference', () => {
      const blockRef: BlockRef = {
        sourceBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        targetBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        createdAt: Date.now(),
      };

      expect(blockRef.sourceBlockId).toBeDefined();
      expect(blockRef.targetBlockId).toBeDefined();
      expect(blockRef.sourceBlockId).not.toBe(blockRef.targetBlockId);
    });

    it('should handle self-references', () => {
      const blockId = '01HQRV3K2GQWZ3ZQZQZQZQZQZQ';
      const blockRef: BlockRef = {
        sourceBlockId: blockId,
        targetBlockId: blockId,
        createdAt: Date.now(),
      };

      expect(blockRef.sourceBlockId).toBe(blockRef.targetBlockId);
    });

    it('should have timestamp', () => {
      const now = Date.now();
      const blockRef: BlockRef = {
        sourceBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        targetBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        createdAt: now,
      };

      expect(blockRef.createdAt).toBe(now);
    });
  });

  describe('Link', () => {
    it('should create a reference link', () => {
      const link: Link = {
        sourceId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        targetId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        linkType: 'reference',
        createdAt: Date.now(),
        contextBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZS',
      };

      expect(link.linkType).toBe('reference');
      expect(link.contextBlockId).toBeDefined();
    });

    it('should create an embed link', () => {
      const link: Link = {
        sourceId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        targetId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        linkType: 'embed',
        createdAt: Date.now(),
        contextBlockId: null,
      };

      expect(link.linkType).toBe('embed');
      expect(link.contextBlockId).toBeNull();
    });

    it('should create a tag link', () => {
      const link: Link = {
        sourceId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        targetId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        linkType: 'tag',
        createdAt: Date.now(),
        contextBlockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZS',
      };

      expect(link.linkType).toBe('tag');
    });

    it('should support all link types', () => {
      const linkTypes: Array<'reference' | 'embed' | 'tag'> = ['reference', 'embed', 'tag'];

      linkTypes.forEach((type) => {
        const link: Link = {
          sourceId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          targetId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
          linkType: type,
          createdAt: Date.now(),
          contextBlockId: null,
        };

        expect(link.linkType).toBe(type);
      });
    });
  });

  describe('Property', () => {
    it('should create a string property', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: 'author',
        value: 'John Doe',
        valueType: 'string',
        updatedAt: Date.now(),
      };

      expect(property.valueType).toBe('string');
      expect(typeof property.value).toBe('string');
    });

    it('should create a number property', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: 'priority',
        value: '5',
        valueType: 'number',
        updatedAt: Date.now(),
      };

      expect(property.valueType).toBe('number');
      expect(property.value).toBe('5');
    });

    it('should create a boolean property', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: 'completed',
        value: 'true',
        valueType: 'boolean',
        updatedAt: Date.now(),
      };

      expect(property.valueType).toBe('boolean');
      expect(property.value).toBe('true');
    });

    it('should create a date property', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: 'deadline',
        value: '2026-02-05',
        valueType: 'date',
        updatedAt: Date.now(),
      };

      expect(property.valueType).toBe('date');
      expect(property.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should support all value types', () => {
      const valueTypes: Array<'string' | 'number' | 'boolean' | 'date'> = [
        'string',
        'number',
        'boolean',
        'date',
      ];

      valueTypes.forEach((type) => {
        const property: Property = {
          entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          key: `test_${type}`,
          value: 'test',
          valueType: type,
          updatedAt: Date.now(),
        };

        expect(property.valueType).toBe(type);
      });
    });

    it('should handle empty key', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: '',
        value: 'test',
        valueType: 'string',
        updatedAt: Date.now(),
      };

      expect(property.key).toBe('');
    });

    it('should handle empty value', () => {
      const property: Property = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        key: 'test',
        value: '',
        valueType: 'string',
        updatedAt: Date.now(),
      };

      expect(property.value).toBe('');
    });
  });

  describe('Tag', () => {
    it('should create a valid tag', () => {
      const tag: Tag = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        tag: 'project',
        createdAt: Date.now(),
      };

      expect(tag.tag).toBe('project');
      expect(tag.entityId).toBeDefined();
    });

    it('should handle tag with special characters', () => {
      const tag: Tag = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        tag: 'project/work',
        createdAt: Date.now(),
      };

      expect(tag.tag).toContain('/');
    });

    it('should handle tag with spaces', () => {
      const tag: Tag = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        tag: 'project work',
        createdAt: Date.now(),
      };

      expect(tag.tag).toContain(' ');
    });

    it('should handle empty tag', () => {
      const tag: Tag = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        tag: '',
        createdAt: Date.now(),
      };

      expect(tag.tag).toBe('');
    });

    it('should have timestamp', () => {
      const now = Date.now();
      const tag: Tag = {
        entityId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        tag: 'test',
        createdAt: now,
      };

      expect(tag.createdAt).toBe(now);
    });
  });

  describe('BlockVersion', () => {
    it('should create a create operation version', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 1,
        content: 'Initial content',
        parentId: null,
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        operation: 'create',
        timestamp: Date.now(),
      };

      expect(version.operation).toBe('create');
      expect(version.version).toBe(1);
    });

    it('should create an update operation version', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 2,
        content: 'Updated content',
        parentId: null,
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        operation: 'update',
        timestamp: Date.now(),
      };

      expect(version.operation).toBe('update');
      expect(version.version).toBe(2);
    });

    it('should create a delete operation version', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 3,
        content: 'Deleted content',
        parentId: null,
        order: 'a0',
        isCollapsed: false,
        isDeleted: true,
        operation: 'delete',
        timestamp: Date.now(),
      };

      expect(version.operation).toBe('delete');
      expect(version.isDeleted).toBe(true);
    });

    it('should create a move operation version', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 4,
        content: 'Moved content',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        order: 'a1',
        isCollapsed: false,
        isDeleted: false,
        operation: 'move',
        timestamp: Date.now(),
      };

      expect(version.operation).toBe('move');
      expect(version.parentId).toBeDefined();
    });

    it('should create a restore operation version', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 5,
        content: 'Restored content',
        parentId: null,
        order: 'a0',
        isCollapsed: false,
        isDeleted: false,
        operation: 'restore',
        timestamp: Date.now(),
      };

      expect(version.operation).toBe('restore');
      expect(version.isDeleted).toBe(false);
    });

    it('should support all operation types', () => {
      const operations: Array<'create' | 'update' | 'delete' | 'move' | 'restore'> = [
        'create',
        'update',
        'delete',
        'move',
        'restore',
      ];

      operations.forEach((op, index) => {
        const version: BlockVersion = {
          blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          version: index + 1,
          content: `Content for ${op}`,
          parentId: null,
          order: 'a0',
          isCollapsed: false,
          isDeleted: op === 'delete',
          operation: op,
          timestamp: Date.now(),
        };

        expect(version.operation).toBe(op);
      });
    });

    it('should support incremental version numbers', () => {
      const versions = [1, 2, 3, 4, 5, 10, 100];

      versions.forEach((versionNum) => {
        const version: BlockVersion = {
          blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
          version: versionNum,
          content: 'Content',
          parentId: null,
          order: 'a0',
          isCollapsed: false,
          isDeleted: false,
          operation: 'update',
          timestamp: Date.now(),
        };

        expect(version.version).toBe(versionNum);
      });
    });

    it('should capture parent changes in move operations', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 2,
        content: 'Content',
        parentId: '01HQRV3K2GQWZ3ZQZQZQZQZQZR',
        order: 'a1V',
        isCollapsed: false,
        isDeleted: false,
        operation: 'move',
        timestamp: Date.now(),
      };

      expect(version.parentId).not.toBeNull();
      expect(version.operation).toBe('move');
    });

    it('should capture order changes', () => {
      const version: BlockVersion = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        version: 2,
        content: 'Content',
        parentId: null,
        order: 'a0V',
        isCollapsed: false,
        isDeleted: false,
        operation: 'update',
        timestamp: Date.now(),
      };

      expect(version.order).toBe('a0V');
    });
  });
});
