import { describe, it, expect } from 'vitest';
import {
  PropertyRowSchema,
  PropertySchema,
  parsePropertyRow,
} from '../../../src/repositories/property-repository.schemas.js';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

describe('PropertyRowSchema', () => {
  it('should validate a valid property row tuple', () => {
    const validRow = ['01HXQ123456789ABCDEFGHIJK', 'status', 'done', 'string', 1704067200000];

    const result = PropertyRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate all value types', () => {
    const valueTypes = ['string', 'number', 'boolean', 'date'];

    for (const valueType of valueTypes) {
      const row = ['01HXQ123456789ABCDEFGHIJK', 'key', 'value', valueType, 1704067200000];

      const result = PropertyRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid value type', () => {
    const invalidRow = ['01HXQ123456789ABCDEFGHIJK', 'key', 'value', 'invalid_type', 1704067200000];

    const result = PropertyRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with missing fields', () => {
    const invalidRow = ['entity_id', 'key', 'value'];

    const result = PropertyRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with wrong types', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      123, // should be string
      'value',
      'string',
      1704067200000,
    ];

    const result = PropertyRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('PropertySchema', () => {
  it('should validate a valid property object', () => {
    const validProperty = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      key: 'status',
      value: 'done',
      valueType: 'string',
      updatedAt: 1704067200000,
    };

    const result = PropertySchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it('should validate property with number value type', () => {
    const validProperty = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      key: 'priority',
      value: '5',
      valueType: 'number',
      updatedAt: 1704067200000,
    };

    const result = PropertySchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it('should validate property with boolean value type', () => {
    const validProperty = {
      entityId: '01HXQ123456789ABCDEFBLOCK',
      key: 'completed',
      value: 'true',
      valueType: 'boolean',
      updatedAt: 1704067200000,
    };

    const result = PropertySchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it('should validate property with date value type', () => {
    const validProperty = {
      entityId: '01HXQ123456789ABCDEFBLOCK',
      key: 'due-date',
      value: '2024-12-31',
      valueType: 'date',
      updatedAt: 1704067200000,
    };

    const result = PropertySchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it('should reject property with invalid valueType', () => {
    const invalidProperty = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      key: 'status',
      value: 'done',
      valueType: 'invalid',
      updatedAt: 1704067200000,
    };

    const result = PropertySchema.safeParse(invalidProperty);
    expect(result.success).toBe(false);
  });

  it('should reject property missing required fields', () => {
    const invalidProperty = {
      entityId: '01HXQ123456789ABCDEFGHIJK',
      key: 'status',
      // missing value, valueType, updatedAt
    };

    const result = PropertySchema.safeParse(invalidProperty);
    expect(result.success).toBe(false);
  });
});

describe('parsePropertyRow', () => {
  it('should parse a valid row into a Property object', () => {
    const validRow = ['01HXQ123456789ABCDEFGHIJK', 'status', 'done', 'string', 1704067200000];

    const property = parsePropertyRow(validRow);

    expect(property).toEqual({
      entityId: '01HXQ123456789ABCDEFGHIJK',
      key: 'status',
      value: 'done',
      valueType: 'string',
      updatedAt: 1704067200000,
    });
  });

  it('should parse a property on a block correctly', () => {
    const validRow = ['01HXQ123456789ABCDEFBLOCK', 'priority', '1', 'number', 1704153600000];

    const property = parsePropertyRow(validRow);

    expect(property.entityId).toBe('01HXQ123456789ABCDEFBLOCK');
    expect(property.key).toBe('priority');
    expect(property.value).toBe('1');
    expect(property.valueType).toBe('number');
    expect(property.updatedAt).toBe(1704153600000);
  });

  it('should parse a boolean property correctly', () => {
    const validRow = ['01HXQ123456789ABCDEFBLOCK', 'archived', 'false', 'boolean', 1704067200000];

    const property = parsePropertyRow(validRow);

    expect(property.valueType).toBe('boolean');
    expect(property.value).toBe('false');
  });

  it('should parse a date property correctly', () => {
    const validRow = ['01HXQ123456789ABCDEFGHIJK', 'created', '2024-01-01', 'date', 1704067200000];

    const property = parsePropertyRow(validRow);

    expect(property.valueType).toBe('date');
    expect(property.value).toBe('2024-01-01');
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only', 'three', 'fields'];

    expect(() => parsePropertyRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parsePropertyRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError for invalid value type', () => {
    const invalidRow = ['01HXQ123456789ABCDEFGHIJK', 'key', 'value', 'invalid_type', 1704067200000];

    expect(() => parsePropertyRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parsePropertyRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should throw DoubleBindError when key is not a string', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      12345, // invalid: should be string
      'value',
      'string',
      1704067200000,
    ];

    expect(() => parsePropertyRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parsePropertyRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parsePropertyRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse property row');
    }
  });
});
