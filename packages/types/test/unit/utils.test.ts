/**
 * Unit tests for type utilities
 * Tests DeepPartial utility type
 */

import type { DeepPartial } from '../../src/utils';
import type { Page, Block, Property } from '../../src/domain';

describe('Type Utils', () => {
  describe('DeepPartial', () => {
    it('should make all properties optional for flat objects', () => {
      interface FlatType {
        id: string;
        name: string;
        count: number;
      }

      const partial: DeepPartial<FlatType> = {};
      expect(partial).toBeDefined();

      const partialWithId: DeepPartial<FlatType> = { id: '123' };
      expect(partialWithId.id).toBe('123');

      const partialWithName: DeepPartial<FlatType> = { name: 'test' };
      expect(partialWithName.name).toBe('test');
    });

    it('should work with Page type', () => {
      const emptyPage: DeepPartial<Page> = {};
      expect(emptyPage).toBeDefined();

      const partialPage: DeepPartial<Page> = {
        pageId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
      };
      expect(partialPage.pageId).toBe('01HQRV3K2GQWZ3ZQZQZQZQZQZQ');

      const pageWithTitle: DeepPartial<Page> = {
        title: 'My Note',
        isDeleted: false,
      };
      expect(pageWithTitle.title).toBe('My Note');
      expect(pageWithTitle.isDeleted).toBe(false);
    });

    it('should work with Block type', () => {
      const emptyBlock: DeepPartial<Block> = {};
      expect(emptyBlock).toBeDefined();

      const partialBlock: DeepPartial<Block> = {
        blockId: '01HQRV3K2GQWZ3ZQZQZQZQZQZQ',
        content: 'Partial content',
      };
      expect(partialBlock.blockId).toBeDefined();
      expect(partialBlock.content).toBe('Partial content');
      expect(partialBlock.pageId).toBeUndefined();
    });

    it('should work with nested objects', () => {
      interface NestedType {
        id: string;
        metadata: {
          created: number;
          updated: number;
          author: {
            name: string;
            email: string;
          };
        };
      }

      const partial: DeepPartial<NestedType> = {
        metadata: {
          author: {
            name: 'John',
          },
        },
      };

      expect(partial.metadata?.author?.name).toBe('John');
      expect(partial.metadata?.author?.email).toBeUndefined();
      expect(partial.metadata?.created).toBeUndefined();
      expect(partial.id).toBeUndefined();
    });

    it('should work with deeply nested objects', () => {
      interface DeeplyNested {
        level1: {
          level2: {
            level3: {
              level4: {
                value: string;
              };
            };
          };
        };
      }

      const partial: DeepPartial<DeeplyNested> = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      expect(partial.level1?.level2?.level3?.level4?.value).toBe('deep');

      const sparsePartial: DeepPartial<DeeplyNested> = {
        level1: {},
      };

      expect(sparsePartial.level1).toBeDefined();
      expect(sparsePartial.level1?.level2).toBeUndefined();
    });

    it('should preserve primitive types', () => {
      const stringPartial: DeepPartial<string> = 'test';
      expect(stringPartial).toBe('test');

      const numberPartial: DeepPartial<number> = 42;
      expect(numberPartial).toBe(42);

      const booleanPartial: DeepPartial<boolean> = true;
      expect(booleanPartial).toBe(true);
    });

    it('should work with arrays', () => {
      interface TypeWithArray {
        items: string[];
        count: number;
      }

      const partial: DeepPartial<TypeWithArray> = {
        items: ['item1', 'item2'],
      };

      expect(partial.items).toHaveLength(2);
      expect(partial.count).toBeUndefined();
    });

    it('should work with optional properties', () => {
      interface TypeWithOptional {
        required: string;
        optional?: number;
      }

      const partial: DeepPartial<TypeWithOptional> = {};
      expect(partial).toBeDefined();

      const withRequired: DeepPartial<TypeWithOptional> = {
        required: 'value',
      };
      expect(withRequired.required).toBe('value');
    });

    it('should work with union types', () => {
      interface TypeWithUnion {
        value: string | number;
        status: 'active' | 'inactive';
      }

      const partial: DeepPartial<TypeWithUnion> = {
        value: 'string value',
      };
      expect(partial.value).toBe('string value');

      const partialWithNumber: DeepPartial<TypeWithUnion> = {
        value: 42,
      };
      expect(partialWithNumber.value).toBe(42);
    });

    it('should work with null values', () => {
      interface TypeWithNull {
        id: string;
        parentId: string | null;
      }

      const partial: DeepPartial<TypeWithNull> = {
        parentId: null,
      };
      expect(partial.parentId).toBeNull();

      const partialWithValue: DeepPartial<TypeWithNull> = {
        parentId: '123',
      };
      expect(partialWithValue.parentId).toBe('123');
    });

    it('should work with Property type', () => {
      const partial: DeepPartial<Property> = {
        key: 'status',
        value: 'done',
      };

      expect(partial.key).toBe('status');
      expect(partial.value).toBe('done');
      expect(partial.entityId).toBeUndefined();
      expect(partial.valueType).toBeUndefined();
    });

    it('should allow building objects incrementally', () => {
      const page: DeepPartial<Page> = {};

      // Add properties one by one
      page.pageId = '01HQRV3K2GQWZ3ZQZQZQZQZQZQ';
      page.title = 'My Page';
      page.isDeleted = false;

      expect(page.pageId).toBe('01HQRV3K2GQWZ3ZQZQZQZQZQZQ');
      expect(page.title).toBe('My Page');
      expect(page.isDeleted).toBe(false);
    });

    it('should work with readonly properties', () => {
      interface ReadonlyType {
        readonly id: string;
        readonly created: number;
        name: string;
      }

      const partial: DeepPartial<ReadonlyType> = {
        name: 'test',
      };

      expect(partial.name).toBe('test');
      expect(partial.id).toBeUndefined();
    });

    it('should work with mixed nested structures', () => {
      interface MixedType {
        id: string;
        metadata: {
          tags: string[];
          properties: {
            key: string;
            value: string;
          };
        };
        count: number;
      }

      const partial: DeepPartial<MixedType> = {
        metadata: {
          tags: ['tag1', 'tag2'],
        },
      };

      expect(partial.metadata?.tags).toHaveLength(2);
      expect(partial.metadata?.properties).toBeUndefined();
      expect(partial.count).toBeUndefined();
    });

    it('should allow empty objects for nested properties', () => {
      interface NestedType {
        data: {
          inner: {
            value: string;
          };
        };
      }

      const partial: DeepPartial<NestedType> = {
        data: {},
      };

      expect(partial.data).toBeDefined();
      expect(partial.data?.inner).toBeUndefined();
    });

    it('should be useful for test fixtures', () => {
      // Common use case: creating test fixtures
      const minimalPage: DeepPartial<Page> = {
        pageId: 'test-id',
        title: 'Test Page',
      };

      expect(minimalPage.pageId).toBe('test-id');
      expect(minimalPage.title).toBe('Test Page');
      // Other fields are optional, useful for tests
      expect(minimalPage.createdAt).toBeUndefined();
    });

    it('should be useful for partial updates', () => {
      // Common use case: partial update payloads
      const updatePayload: DeepPartial<Block> = {
        content: 'Updated content',
        updatedAt: Date.now(),
      };

      expect(updatePayload.content).toBe('Updated content');
      expect(updatePayload.updatedAt).toBeDefined();
      // Other fields not needed for update
      expect(updatePayload.blockId).toBeUndefined();
      expect(updatePayload.pageId).toBeUndefined();
    });
  });
});
