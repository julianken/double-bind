import { describe, it, expect } from 'vitest';
import {
  LinkRowSchema,
  LinkSchema,
  BlockRefRowSchema,
  BlockRefSchema,
  parseLinkRow,
  parseBlockRefRow,
} from '../../../src/repositories/link-repository.schemas.js';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

describe('LinkRowSchema', () => {
  it('should validate a valid link row tuple', () => {
    const validRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'reference',
      1704067200000,
      '01HXQ123456789ABCDEFBLOCK',
    ];

    const result = LinkRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate link with null context_block_id', () => {
    const validRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'embed',
      1704067200000,
      null,
    ];

    const result = LinkRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate all link types', () => {
    const linkTypes = ['reference', 'embed', 'tag'];

    for (const linkType of linkTypes) {
      const row = [
        '01HXQ123456789ABCDEFSOURC',
        '01HXQ123456789ABCDEFTARGT',
        linkType,
        1704067200000,
        null,
      ];

      const result = LinkRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid link type', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'invalid_type',
      1704067200000,
      null,
    ];

    const result = LinkRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with missing fields', () => {
    const invalidRow = ['source', 'target'];

    const result = LinkRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('LinkSchema', () => {
  it('should validate a valid link object', () => {
    const validLink = {
      sourceId: '01HXQ123456789ABCDEFSOURC',
      targetId: '01HXQ123456789ABCDEFTARGT',
      linkType: 'reference',
      createdAt: 1704067200000,
      contextBlockId: '01HXQ123456789ABCDEFBLOCK',
    };

    const result = LinkSchema.safeParse(validLink);
    expect(result.success).toBe(true);
  });

  it('should reject link with invalid linkType', () => {
    const invalidLink = {
      sourceId: '01HXQ123456789ABCDEFSOURC',
      targetId: '01HXQ123456789ABCDEFTARGT',
      linkType: 'invalid',
      createdAt: 1704067200000,
      contextBlockId: null,
    };

    const result = LinkSchema.safeParse(invalidLink);
    expect(result.success).toBe(false);
  });
});

describe('parseLinkRow', () => {
  it('should parse a valid row into a Link object', () => {
    const validRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'reference',
      1704067200000,
      '01HXQ123456789ABCDEFBLOCK',
    ];

    const link = parseLinkRow(validRow);

    expect(link).toEqual({
      sourceId: '01HXQ123456789ABCDEFSOURC',
      targetId: '01HXQ123456789ABCDEFTARGT',
      linkType: 'reference',
      createdAt: 1704067200000,
      contextBlockId: '01HXQ123456789ABCDEFBLOCK',
    });
  });

  it('should parse a link with null contextBlockId', () => {
    const validRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'tag',
      1704067200000,
      null,
    ];

    const link = parseLinkRow(validRow);

    expect(link.contextBlockId).toBeNull();
    expect(link.linkType).toBe('tag');
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['source', 'target'];

    expect(() => parseLinkRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseLinkRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError for invalid link type', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      'invalid_type',
      1704067200000,
      null,
    ];

    expect(() => parseLinkRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseLinkRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parseLinkRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse link row');
    }
  });
});

describe('BlockRefRowSchema', () => {
  it('should validate a valid block ref row tuple', () => {
    const validRow = ['01HXQ123456789ABCDEFSOURC', '01HXQ123456789ABCDEFTARGT', 1704067200000];

    const result = BlockRefRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should reject row with wrong number of fields', () => {
    const invalidRow = ['source', 'target'];

    const result = BlockRefRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with non-number timestamp', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFSOURC',
      '01HXQ123456789ABCDEFTARGT',
      '2024-01-01', // should be number
    ];

    const result = BlockRefRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('BlockRefSchema', () => {
  it('should validate a valid block ref object', () => {
    const validBlockRef = {
      sourceBlockId: '01HXQ123456789ABCDEFSOURC',
      targetBlockId: '01HXQ123456789ABCDEFTARGT',
      createdAt: 1704067200000,
    };

    const result = BlockRefSchema.safeParse(validBlockRef);
    expect(result.success).toBe(true);
  });

  it('should reject block ref missing required fields', () => {
    const invalidBlockRef = {
      sourceBlockId: '01HXQ123456789ABCDEFSOURC',
      // missing targetBlockId, createdAt
    };

    const result = BlockRefSchema.safeParse(invalidBlockRef);
    expect(result.success).toBe(false);
  });
});

describe('parseBlockRefRow', () => {
  it('should parse a valid row into a BlockRef object', () => {
    const validRow = ['01HXQ123456789ABCDEFSOURC', '01HXQ123456789ABCDEFTARGT', 1704067200000];

    const blockRef = parseBlockRefRow(validRow);

    expect(blockRef).toEqual({
      sourceBlockId: '01HXQ123456789ABCDEFSOURC',
      targetBlockId: '01HXQ123456789ABCDEFTARGT',
      createdAt: 1704067200000,
    });
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only'];

    expect(() => parseBlockRefRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockRefRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError for non-number timestamp', () => {
    const invalidRow = ['01HXQ123456789ABCDEFSOURC', '01HXQ123456789ABCDEFTARGT', 'not-a-number'];

    expect(() => parseBlockRefRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parseBlockRefRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parseBlockRefRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse block ref row');
    }
  });
});
