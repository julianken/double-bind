import { describe, it, expect } from 'vitest';
import {
  PageRowSchema,
  PageSchema,
  parsePageRow,
} from '../../../src/repositories/page-repository.schemas.js';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

describe('PageRowSchema', () => {
  it('should validate a valid page row tuple', () => {
    const validRow = [
      '01HXQ123456789ABCDEFGHIJK',
      'Test Page',
      1704067200000,
      1704067200000,
      false,
      null,
    ];

    const result = PageRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('should validate a daily note page row', () => {
    const dailyNoteRow = [
      '01HXQ123456789ABCDEFGHIJK',
      '2024-01-01',
      1704067200000,
      1704067200000,
      false,
      '2024-01-01',
    ];

    const result = PageRowSchema.safeParse(dailyNoteRow);
    expect(result.success).toBe(true);
  });

  it('should reject row with missing fields', () => {
    const invalidRow = ['01HXQ123456789ABCDEFGHIJK', 'Test Page'];

    const result = PageRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with wrong types', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      123, // should be string
      1704067200000,
      1704067200000,
      false,
      null,
    ];

    const result = PageRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });

  it('should reject row with non-boolean isDeleted', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      'Test Page',
      1704067200000,
      1704067200000,
      'false', // should be boolean
      null,
    ];

    const result = PageRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});

describe('PageSchema', () => {
  it('should validate a valid page object', () => {
    const validPage = {
      pageId: '01HXQ123456789ABCDEFGHIJK',
      title: 'Test Page',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      isDeleted: false,
      dailyNoteDate: null,
    };

    const result = PageSchema.safeParse(validPage);
    expect(result.success).toBe(true);
  });

  it('should reject page missing required fields', () => {
    const invalidPage = {
      pageId: '01HXQ123456789ABCDEFGHIJK',
      title: 'Test Page',
      // missing createdAt, updatedAt, isDeleted, dailyNoteDate
    };

    const result = PageSchema.safeParse(invalidPage);
    expect(result.success).toBe(false);
  });
});

describe('parsePageRow', () => {
  it('should parse a valid row into a Page object', () => {
    const validRow = [
      '01HXQ123456789ABCDEFGHIJK',
      'Test Page',
      1704067200000,
      1704067200000,
      false,
      null,
    ];

    const page = parsePageRow(validRow);

    expect(page).toEqual({
      pageId: '01HXQ123456789ABCDEFGHIJK',
      title: 'Test Page',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      isDeleted: false,
      dailyNoteDate: null,
    });
  });

  it('should parse a daily note row correctly', () => {
    const dailyNoteRow = [
      '01HXQ123456789ABCDEFGHIJK',
      '2024-01-01',
      1704067200000,
      1704153600000,
      false,
      '2024-01-01',
    ];

    const page = parsePageRow(dailyNoteRow);

    expect(page.dailyNoteDate).toBe('2024-01-01');
    expect(page.title).toBe('2024-01-01');
  });

  it('should throw DoubleBindError with DB_QUERY_FAILED for invalid row', () => {
    const invalidRow = ['only', 'two', 'fields'];

    expect(() => parsePageRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parsePageRow(invalidRow);
    } catch (error) {
      expect(error).toBeInstanceOf(DoubleBindError);
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect((error as DoubleBindError).cause).toBeDefined();
    }
  });

  it('should throw DoubleBindError when title is not a string', () => {
    const invalidRow = [
      '01HXQ123456789ABCDEFGHIJK',
      12345, // invalid: should be string
      1704067200000,
      1704067200000,
      false,
      null,
    ];

    expect(() => parsePageRow(invalidRow)).toThrow(DoubleBindError);
    try {
      parsePageRow(invalidRow);
    } catch (error) {
      expect((error as DoubleBindError).code).toBe(ErrorCode.DB_QUERY_FAILED);
    }
  });

  it('should preserve Zod error details in cause', () => {
    const invalidRow: unknown[] = [];

    try {
      parsePageRow(invalidRow);
      expect.fail('Should have thrown');
    } catch (error) {
      const dbError = error as DoubleBindError;
      expect(dbError.cause).toBeDefined();
      expect(dbError.message).toContain('Failed to parse page row');
    }
  });
});
