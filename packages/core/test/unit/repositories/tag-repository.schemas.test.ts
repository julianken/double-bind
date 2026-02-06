import { describe, it, expect } from 'vitest';
import {
  TagRowSchema,
  TagSchema,
  parseTagRow,
} from '../../../src/repositories/tag-repository.schemas.js';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

describe('TagRowSchema', () => {
  it('should validate a valid tag row tuple', () => {
    const validRow = ['01HXQ123456789ABCDEFGHIJK', 'project', 1704067200000];

    const result = TagRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate tag with multi-word value', () => {
    const validRow = ['01HXQ123456789ABCDEFBLOCK', 'important-task', 1704067200000];

    const result = TagRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should reject row with missing fields', () => {
    const invalidRow = ['entity_id', 'tag'];

    const result = TagRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with wrong types', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      123, // should be string
      1704067200000,
    ];

    const result = TagRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with non-number timestamp', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      'tag',
      '2024-01-01', // should be number
    ];

    const result = TagRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('TagSchema', () => {
  it('should validate a valid tag object', () => {
    const validTag = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      tag: 'project',
      createdAt: 1704067200000,
    };

    const result = TagSchema.safeParse(validTag);
    expect(result.success).toBe(true);
  });

  it('should reject tag missing required fields', () => {
    const invalidTag = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      // missing tag, createdAt
    };

    const result = TagSchema.safeParse(invalidTag);
    expect(result.success).toBe(false);
  });

  it('should reject tag with non-string entityId', () => {
    const invalidTag = {
      entityId: 12345,
      tag: 'project',
      createdAt: 1704067200000,
    };

    const result = TagSchema.safeParse(invalidTag);
    expect(result.success).toBe(false);
  });
});

describe('parseTagRow', () => {
  it('should parse a valid row into a Tag object', () => {
    const validRow = ['01HXQ123456789ABCDEFGHIJK', 'project', 1704067200000];

    const tag = parseTagRow(validRow);

    expect(tag).toEqual({
      entityId: '01HXQ123456789ABCDEFGHIJK',
      tag: 'project',
      createdAt: 1704067200000,
    });
  });

  it('should parse a tag on a block correctly', () => {
    const validRow = ['01HXQ123456789ABCDEFBLOCK', 'status-done', 1704153600000];

    const tag = parseTagRow(validRow);

    expect(tag.entityId).toBe('01HXQ123456789ABCDEFBLOCK');
    expect(tag.tag).toBe('status-done');
    expect(tag.createdAt).toBe(1704153600000);
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only', 'two'];

    expect(() => parseTagRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseTagRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError when tag is not a string', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      12345, // invalid: should be string
      1704067200000,
    ];

    expect(() => parseTagRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseTagRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should throw DoubleBindError when timestamp is not a number', () => {
    const invalidRow = ['01HXQ123456789ABCDEFGHIJK', 'tag', 'not-a-number'];

    expect(() => parseTagRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseTagRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parseTagRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse tag row');
    }
  });
});
