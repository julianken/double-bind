/**
 * Unit tests for SavedQueryRepository Zod schemas
 *
 * Tests the validation logic for parsing CozoDB rows into domain types.
 */

import { describe, it, expect } from 'vitest';
import { SavedQueryType, ErrorCode } from '@double-bind/types';
import {
  SavedQueryRowSchema,
  SavedQuerySchema,
  parseSavedQueryRow,
} from '../../../src/repositories/saved-query-repository.schemas.js';

describe('SavedQueryRepository Schemas', () => {
  describe('SavedQueryRowSchema', () => {
    it('should accept valid row tuple', () => {
      const row = ['id-1', 'My Query', 'template', '?[x] := 1', 'Description', 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(true);
    });

    it('should accept null description', () => {
      const row = ['id-1', 'My Query', 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(true);
    });

    it('should reject non-string id', () => {
      const row = [123, 'My Query', 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });

    it('should reject non-string name', () => {
      const row = ['id-1', null, 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });

    it('should reject non-string type', () => {
      const row = ['id-1', 'My Query', 123, '?[x] := 1', null, 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });

    it('should reject non-string definition', () => {
      const row = ['id-1', 'My Query', 'raw', null, null, 1700000000, 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });

    it('should reject non-number timestamps', () => {
      const row = ['id-1', 'My Query', 'raw', '?[x] := 1', null, 'not-a-number', 1700000000];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });

    it('should reject too short tuple', () => {
      const row = ['id-1', 'My Query', 'raw'];

      const result = SavedQueryRowSchema.safeParse(row);

      expect(result.success).toBe(false);
    });
  });

  describe('SavedQuerySchema', () => {
    it('should accept valid SavedQuery object', () => {
      const query = {
        id: 'id-1',
        name: 'My Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := 1',
        description: 'A description',
        createdAt: 1700000000,
        updatedAt: 1700000000,
      };

      const result = SavedQuerySchema.safeParse(query);

      expect(result.success).toBe(true);
    });

    it('should accept null description', () => {
      const query = {
        id: 'id-1',
        name: 'My Query',
        type: SavedQueryType.RAW,
        definition: '?[x] := 1',
        description: null,
        createdAt: 1700000000,
        updatedAt: 1700000000,
      };

      const result = SavedQuerySchema.safeParse(query);

      expect(result.success).toBe(true);
    });

    it('should accept all valid query types', () => {
      for (const type of [SavedQueryType.TEMPLATE, SavedQueryType.VISUAL, SavedQueryType.RAW]) {
        const query = {
          id: 'id-1',
          name: 'My Query',
          type,
          definition: '?[x] := 1',
          description: null,
          createdAt: 1700000000,
          updatedAt: 1700000000,
        };

        const result = SavedQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid query type', () => {
      const query = {
        id: 'id-1',
        name: 'My Query',
        type: 'invalid',
        definition: '?[x] := 1',
        description: null,
        createdAt: 1700000000,
        updatedAt: 1700000000,
      };

      const result = SavedQuerySchema.safeParse(query);

      expect(result.success).toBe(false);
    });
  });

  describe('parseSavedQueryRow', () => {
    it('should parse valid row into SavedQuery', () => {
      const row = ['id-1', 'My Query', 'template', '?[x] := 1', 'Description', 1700000000, 1700000001];

      const result = parseSavedQueryRow(row);

      expect(result).toEqual({
        id: 'id-1',
        name: 'My Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := 1',
        description: 'Description',
        createdAt: 1700000000,
        updatedAt: 1700000001,
      });
    });

    it('should parse row with null description', () => {
      const row = ['id-1', 'My Query', 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      const result = parseSavedQueryRow(row);

      expect(result.description).toBeNull();
    });

    it('should parse all query types correctly', () => {
      const types = [
        ['template', SavedQueryType.TEMPLATE],
        ['visual', SavedQueryType.VISUAL],
        ['raw', SavedQueryType.RAW],
      ] as const;

      for (const [dbType, expectedType] of types) {
        const row = ['id-1', 'Query', dbType, '?[x] := 1', null, 1700000000, 1700000000];
        const result = parseSavedQueryRow(row);
        expect(result.type).toBe(expectedType);
      }
    });

    it('should throw DoubleBindError on invalid row', () => {
      const row = [123, 'My Query', 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      expect(() => parseSavedQueryRow(row)).toThrow();

      try {
        parseSavedQueryRow(row);
      } catch (error) {
        expect((error as { code: string }).code).toBe(ErrorCode.DB_QUERY_FAILED);
      }
    });

    it('should throw DoubleBindError on invalid type value', () => {
      const row = ['id-1', 'My Query', 'invalid-type', '?[x] := 1', null, 1700000000, 1700000000];

      expect(() => parseSavedQueryRow(row)).toThrow();

      try {
        parseSavedQueryRow(row);
      } catch (error) {
        expect((error as { code: string }).code).toBe(ErrorCode.DB_QUERY_FAILED);
      }
    });

    it('should include error message in thrown exception', () => {
      const row = ['id-1', null, 'raw', '?[x] := 1', null, 1700000000, 1700000000];

      expect(() => parseSavedQueryRow(row)).toThrow(/Failed to parse saved query row/);
    });
  });
});
