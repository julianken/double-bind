import { describe, it, expect } from 'vitest';
import {
  BlockRowSchema,
  BlockSchema,
  BlockVersionRowSchema,
  BlockVersionSchema,
  parseBlockRow,
  parseBlockVersionRow,
} from '../../../src/repositories/block-repository.schemas.js';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

describe('BlockRowSchema', () => {
  it('should validate a valid block row tuple', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      null,
      'Hello, world!',
      'text',
      'a0',
      false,
      false,
      1704067200000,
      1704067200000,
    ];

    const result = BlockRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate block with parent_id', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      '01HXQPARENT0000000000000',
      'Child block',
      'text',
      'a0V',
      false,
      false,
      1704067200000,
      1704067200000,
    ];

    const result = BlockRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate all content types', () => {
    const contentTypes = ['text', 'heading', 'code', 'todo', 'query'];

    for (const contentType of contentTypes) {
      const row = [
        '01HXQ123456789ABCDEFBLOCK',
        '01HXQ123456789ABCDEFGHIJK',
        null,
        'Content',
        contentType,
        'a0',
        false,
        false,
        1704067200000,
        1704067200000,
      ];

      const result = BlockRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid content type', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      null,
      'Content',
      'invalid_type', // not a valid content type
      'a0',
      false,
      false,
      1704067200000,
      1704067200000,
    ];

    const result = BlockRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with missing fields', () => {
    const invalidRow = ['01HXQ123456789ABCDEFBLOCK', 'page_id'];

    const result = BlockRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('BlockSchema', () => {
  it('should validate a valid block object', () => {
    const validBlock = {
      blockId: '01HXQ123456789ABCDEFBLOCK',
      pageId: '01HXQ123456789ABCDEFGHIJK',
      parentId: null,
      content: 'Hello, world!',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
    };

    const result = BlockSchema.safeParse(validBlock);
    expect(result.success).toBe(true);
  });

  it('should reject block with invalid contentType', () => {
    const invalidBlock = {
      blockId: '01HXQ123456789ABCDEFBLOCK',
      pageId: '01HXQ123456789ABCDEFGHIJK',
      parentId: null,
      content: 'Hello, world!',
      contentType: 'invalid',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
    };

    const result = BlockSchema.safeParse(invalidBlock);
    expect(result.success).toBe(false);
  });
});

describe('parseBlockRow', () => {
  it('should parse a valid row into a Block object', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      null,
      'Hello, world!',
      'text',
      'a0',
      false,
      false,
      1704067200000,
      1704067200000,
    ];

    const block = parseBlockRow(validRow);

    expect(block).toEqual({
      blockId: '01HXQ123456789ABCDEFBLOCK',
      pageId: '01HXQ123456789ABCDEFGHIJK',
      parentId: null,
      content: 'Hello, world!',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
    });
  });

  it('should parse a block with parent_id correctly', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      '01HXQPARENT0000000000000',
      'Child block',
      'heading',
      'a0V',
      true,
      false,
      1704067200000,
      1704153600000,
    ];

    const block = parseBlockRow(validRow);

    expect(block.parentId).toBe('01HXQPARENT0000000000000');
    expect(block.contentType).toBe('heading');
    expect(block.isCollapsed).toBe(true);
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only', 'three', 'fields'];

    expect(() => parseBlockRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError for invalid content type', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFBLOCK',
      '01HXQ123456789ABCDEFGHIJK',
      null,
      'Content',
      'invalid_type',
      'a0',
      false,
      false,
      1704067200000,
      1704067200000,
    ];

    expect(() => parseBlockRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });
});

describe('BlockVersionRowSchema', () => {
  it('should validate a valid block version row tuple', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      1,
      'Hello, world!',
      null,
      'a0',
      false,
      false,
      'create',
      1704067200000,
    ];

    const result = BlockVersionRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate all operation types', () => {
    const operations = ['create', 'update', 'delete', 'move', 'restore'];

    for (const operation of operations) {
      const row = [
        '01HXQ123456789ABCDEFBLOCK',
        1,
        'Content',
        null,
        'a0',
        false,
        false,
        operation,
        1704067200000,
      ];

      const result = BlockVersionRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid operation type', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFBLOCK',
      1,
      'Content',
      null,
      'a0',
      false,
      false,
      'invalid_op',
      1704067200000,
    ];

    const result = BlockVersionRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('BlockVersionSchema', () => {
  it('should validate a valid block version object', () => {
    const validVersion = {
      blockId: '01HXQ123456789ABCDEFBLOCK',
      version: 1,
      content: 'Hello, world!',
      parentId: null,
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      operation: 'create',
      timestamp: 1704067200000,
    };

    const result = BlockVersionSchema.safeParse(validVersion);
    expect(result.success).toBe(true);
  });
});

describe('parseBlockVersionRow', () => {
  it('should parse a valid row into a BlockVersion object', () => {
    const validRow = [
      '01HXQ123456789ABCDEFBLOCK',
      5,
      'Updated content',
      '01HXQPARENT0000000000000',
      'a0V',
      true,
      false,
      'update',
      1704153600000,
    ];

    const version = parseBlockVersionRow(validRow);

    expect(version).toEqual({
      blockId: '01HXQ123456789ABCDEFBLOCK',
      version: 5,
      content: 'Updated content',
      parentId: '01HXQPARENT0000000000000',
      order: 'a0V',
      isCollapsed: true,
      isDeleted: false,
      operation: 'update',
      timestamp: 1704153600000,
    });
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only', 'two'];

    expect(() => parseBlockVersionRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockVersionRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError for invalid operation', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFBLOCK',
      1,
      'Content',
      null,
      'a0',
      false,
      false,
      'invalid_operation',
      1704067200000,
    ];

    expect(() => parseBlockVersionRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockVersionRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parseBlockVersionRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse block version row');
    }
  });
});
