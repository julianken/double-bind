/**
 * Tests for CozoDB pagination query helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPaginatedQuery,
  extractPaginatedResult,
  buildQueryParams,
  createPageFetcher,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../src/pagination/queryHelpers';
import type { PaginationOptions } from '@double-bind/types';

describe('buildPaginatedQuery', () => {
  const baseQuery = `
?[page_id, title, created_at, updated_at] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted },
    is_deleted == false
  `.trim();

  it('should build query without cursor', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'updated_at',
      sortOrder: 'desc',
      pageSize: 20,
    });

    expect(query).toContain(':order -updated_at');
    expect(query).toContain(':limit 21'); // +1 for hasMore detection
    expect(query).not.toContain('$cursor');
  });

  it('should build query with cursor (desc order)', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'updated_at',
      sortOrder: 'desc',
      pageSize: 20,
      cursor: '1234567890',
    });

    expect(query).toContain('updated_at < $cursor');
    expect(query).toContain(':order -updated_at');
    expect(query).toContain(':limit 21');
  });

  it('should build query with cursor (asc order)', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'created_at',
      sortOrder: 'asc',
      pageSize: 20,
      cursor: '1234567890',
    });

    expect(query).toContain('created_at > $cursor');
    expect(query).toContain(':order created_at');
    expect(query).toContain(':limit 21');
  });

  it('should clamp page size to maximum', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'updated_at',
      pageSize: 500,
    });

    expect(query).toContain(`:limit ${MAX_PAGE_SIZE + 1}`);
  });

  it('should clamp page size to minimum', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'updated_at',
      pageSize: 0,
    });

    expect(query).toContain(':limit 2'); // 1 + 1 for hasMore
  });

  it('should use default page size if not provided', () => {
    const query = buildPaginatedQuery({
      baseQuery,
      cursorColumn: 'updated_at',
    });

    expect(query).toContain(`:limit ${DEFAULT_PAGE_SIZE + 1}`);
  });
});

describe('extractPaginatedResult', () => {
  type TestRow = [string, string, number, number];

  const createRow = (id: string, title: string, created: number, updated: number): TestRow => [
    id,
    title,
    created,
    updated,
  ];

  it('should extract result with more pages (string cursor)', () => {
    const rows: TestRow[] = [
      createRow('id1', 'Page 1', 100, 200),
      createRow('id2', 'Page 2', 101, 199),
      createRow('id3', 'Page 3', 102, 198),
    ];

    const result = extractPaginatedResult<TestRow>(rows, 3, 2);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(rows[0]);
    expect(result.items[1]).toEqual(rows[1]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('198'); // From 3rd row's updated_at
    expect(result.pageSize).toBe(2);
    expect(result.totalCount).toBeNull();
  });

  it('should extract result without more pages', () => {
    const rows: TestRow[] = [createRow('id1', 'Page 1', 100, 200)];

    const result = extractPaginatedResult<TestRow>(rows, 3, 2);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should handle empty results', () => {
    const rows: TestRow[] = [];

    const result = extractPaginatedResult<TestRow>(rows, 3, 2);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should handle exact page size', () => {
    const rows: TestRow[] = [
      createRow('id1', 'Page 1', 100, 200),
      createRow('id2', 'Page 2', 101, 199),
    ];

    const result = extractPaginatedResult<TestRow>(rows, 3, 2);

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should convert number cursor to string', () => {
    const rows: TestRow[] = [
      createRow('id1', 'Page 1', 100, 200),
      createRow('id2', 'Page 2', 101, 199),
      createRow('id3', 'Page 3', 102, 198),
    ];

    const result = extractPaginatedResult<TestRow>(rows, 3, 2);

    expect(result.nextCursor).toBe('198');
    expect(typeof result.nextCursor).toBe('string');
  });
});

describe('buildQueryParams', () => {
  it('should build params without cursor', () => {
    const params = buildQueryParams(undefined, { foo: 'bar' });

    expect(params).toEqual({ foo: 'bar' });
    expect(params.cursor).toBeUndefined();
  });

  it('should build params with cursor', () => {
    const params = buildQueryParams('abc123', { foo: 'bar' });

    expect(params).toEqual({ foo: 'bar', cursor: 'abc123' });
  });

  it('should handle empty additional params', () => {
    const params = buildQueryParams('abc123');

    expect(params).toEqual({ cursor: 'abc123' });
  });

  it('should not mutate additional params', () => {
    const additionalParams = { foo: 'bar' };
    const params = buildQueryParams('abc123', additionalParams);

    expect(additionalParams).toEqual({ foo: 'bar' });
    expect(params).toEqual({ foo: 'bar', cursor: 'abc123' });
  });
});

describe('createPageFetcher', () => {
  type TestItem = { id: string; name: string; score: number };

  it('should create a working page fetcher', async () => {
    const mockQueryExecutor = async (
      _query: string,
      _params: Record<string, unknown>
    ): Promise<{ rows: unknown[][] }> => {
      return {
        rows: [
          ['id1', 'Item 1', 100],
          ['id2', 'Item 2', 90],
          ['id3', 'Item 3', 80],
        ],
      };
    };

    const mockQueryBuilder = (options: PaginationOptions): string => {
      return `?[id, name, score] := *items{ id, name, score } :limit ${(options.pageSize ?? 20) + 1}`;
    };

    const fetcher = createPageFetcher<TestItem>(mockQueryBuilder, mockQueryExecutor, 2);

    const result = await fetcher({ pageSize: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('80');
  });

  it('should handle cursor in page fetcher', async () => {
    let lastQuery = '';
    let lastParams: Record<string, unknown> = {};

    const mockQueryExecutor = async (
      query: string,
      params: Record<string, unknown>
    ): Promise<{ rows: unknown[][] }> => {
      lastQuery = query;
      lastParams = params;
      return { rows: [['id4', 'Item 4', 70]] };
    };

    const mockQueryBuilder = (options: PaginationOptions): string => {
      return options.cursor ? 'query with cursor' : 'query without cursor';
    };

    const fetcher = createPageFetcher<TestItem>(mockQueryBuilder, mockQueryExecutor, 2);

    await fetcher({ pageSize: 20, cursor: 'abc123' });

    expect(lastQuery).toBe('query with cursor');
    expect(lastParams.cursor).toBe('abc123');
  });
});
