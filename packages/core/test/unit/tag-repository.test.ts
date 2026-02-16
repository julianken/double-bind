/**
 * Unit tests for TagRepository
 *
 * These tests verify correct SQL query construction and parameter passing
 * using a spy-based mock. They do NOT execute real SQL queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Database, QueryResult, MutationResult } from '@double-bind/types';
import { TagRepository } from '../../src/repositories/tag-repository.js';

/** Create a mock Database with spy-based query/mutate */
function createMockDb() {
  const queryFn = vi.fn<(script: string, params?: Record<string, unknown>) => Promise<QueryResult>>();
  const mutateFn = vi.fn<(script: string, params?: Record<string, unknown>) => Promise<MutationResult>>();

  queryFn.mockResolvedValue({ headers: [], rows: [] });
  mutateFn.mockResolvedValue({ headers: ['affected_rows'], rows: [[1]] });

  const db = {
    query: queryFn,
    mutate: mutateFn,
    transaction: vi.fn(),
    importRelations: vi.fn(),
    exportRelations: vi.fn(),
    backup: vi.fn(),
    restore: vi.fn(),
    importRelationsFromBackup: vi.fn(),
    close: vi.fn(),
  } as unknown as Database;

  return { db, queryFn, mutateFn };
}

describe('TagRepository', () => {
  let db: Database;
  let queryFn: ReturnType<typeof vi.fn>;
  let mutateFn: ReturnType<typeof vi.fn>;
  let repo: TagRepository;

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    queryFn = mock.queryFn;
    mutateFn = mock.mutateFn;
    repo = new TagRepository(db);
  });

  describe('getByEntity', () => {
    it('should construct SQL with UNION ALL over block_tags and page_tags', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      await repo.getByEntity(entityId);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('block_tags');
      expect(script).toContain('page_tags');
      expect(script).toContain('UNION ALL');
      expect(script).toContain('$entity_id');
      expect(params).toEqual({ entity_id: entityId });
    });

    it('should return Tag[] when tags found', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'tag', 'created_at'],
        rows: [
          [entityId, 'project', now],
          [entityId, 'important', now + 1000],
        ],
      });

      const result = await repo.getByEntity(entityId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        entityId,
        tag: 'project',
        createdAt: now,
      });
      expect(result[1]).toEqual({
        entityId,
        tag: 'important',
        createdAt: now + 1000,
      });
    });

    it('should return empty array when no tags found', async () => {
      const result = await repo.getByEntity('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getByTag', () => {
    it('should construct SQL with UNION ALL filtered by tag', async () => {
      const tag = 'project';

      await repo.getByTag(tag);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('block_tags');
      expect(script).toContain('page_tags');
      expect(script).toContain('UNION ALL');
      expect(script).toContain('$tag');
      expect(params).toEqual({ tag });
    });

    it('should return all entities with the tag', async () => {
      const tag = 'project';
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'tag', 'created_at'],
        rows: [
          ['entity-1', tag, now],
          ['entity-2', tag, now + 1000],
        ],
      });

      const result = await repo.getByTag(tag);

      expect(result).toHaveLength(2);
      expect(result[0]?.entityId).toBe('entity-1');
      expect(result[1]?.entityId).toBe('entity-2');
    });

    it('should return empty array when no matches', async () => {
      const result = await repo.getByTag('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('should construct aggregation query with GROUP BY and ORDER BY', async () => {
      await repo.getAllTags();

      expect(queryFn).toHaveBeenCalledOnce();
      const [script] = queryFn.mock.calls[0]!;
      expect(script).toContain('UNION ALL');
      expect(script).toContain('GROUP BY tag');
      expect(script).toContain('ORDER BY count DESC');
      expect(script).toContain('COUNT(*)');
    });

    it('should return TagWithCount[] when tags exist', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['tag', 'count'],
        rows: [
          ['popular', 5],
          ['rare', 1],
        ],
      });

      const result = await repo.getAllTags();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tag: 'popular', count: 5 });
      expect(result[1]).toEqual({ tag: 'rare', count: 1 });
    });

    it('should return empty array when no tags exist', async () => {
      const result = await repo.getAllTags();
      expect(result).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('should check pages table first then insert into page_tags', async () => {
      const entityId = 'page-1';
      const tag = 'project';

      // First query checks pages table -- entity found
      queryFn.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      const before = Date.now();
      await repo.addTag(entityId, tag);
      const after = Date.now();

      // First call: check pages table
      expect(queryFn).toHaveBeenCalledOnce();
      expect(queryFn.mock.calls[0]![0]).toContain('pages');
      expect(queryFn.mock.calls[0]![1]).toEqual({ entity_id: entityId });

      // Mutation: INSERT into page_tags
      expect(mutateFn).toHaveBeenCalledOnce();
      const [script, params] = mutateFn.mock.calls[0]!;
      expect(script).toContain('page_tags');
      expect(script).toContain('INSERT OR REPLACE');
      expect(params.entity_id).toBe(entityId);
      expect(params.tag).toBe(tag);
      expect(params.now).toBeGreaterThanOrEqual(before);
      expect(params.now).toBeLessThanOrEqual(after);
    });

    it('should insert into block_tags when entity is a block', async () => {
      const entityId = 'block-1';
      const tag = 'todo';

      // First query checks pages -- not found
      queryFn.mockResolvedValueOnce({ headers: ['page_id'], rows: [] });
      // Second query checks blocks -- found
      queryFn.mockResolvedValueOnce({
        headers: ['block_id'],
        rows: [['block-1']],
      });

      await repo.addTag(entityId, tag);

      expect(mutateFn).toHaveBeenCalledOnce();
      const [script] = mutateFn.mock.calls[0]!;
      expect(script).toContain('block_tags');
    });

    it('should preserve case in tag names', async () => {
      // Not found in pages or blocks -- falls through to block_tags fallback
      queryFn.mockResolvedValue({ headers: [], rows: [] });

      await repo.addTag('entity-1', 'MyTag');

      expect(mutateFn.mock.calls[0]![1].tag).toBe('MyTag');
    });
  });

  describe('removeTag', () => {
    it('should issue DELETE on both block_tags and page_tags', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const tag = 'project';

      await repo.removeTag(entityId, tag);

      expect(mutateFn).toHaveBeenCalledTimes(2);

      // First DELETE targets block_tags
      const [script1, params1] = mutateFn.mock.calls[0]!;
      expect(script1).toContain('DELETE FROM block_tags');
      expect(params1).toEqual({ entity_id: entityId, tag });

      // Second DELETE targets page_tags
      const [script2, params2] = mutateFn.mock.calls[1]!;
      expect(script2).toContain('DELETE FROM page_tags');
      expect(params2).toEqual({ entity_id: entityId, tag });
    });

    it('should not include timestamp in DELETE', async () => {
      await repo.removeTag('entity-1', 'project');

      expect(mutateFn.mock.calls[0]![1]).not.toHaveProperty('now');
      expect(mutateFn.mock.calls[0]![1]).not.toHaveProperty('created_at');
    });
  });

  describe('parseTagRow type validation', () => {
    it('should throw on invalid entity_id type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'tag', 'created_at'],
        rows: [[123, 'test-tag', Date.now()]],
      });

      await expect(repo.getByTag('test-tag')).rejects.toThrow();
    });

    it('should throw on invalid tag type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'tag', 'created_at'],
        rows: [['entity-1', null, Date.now()]],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on invalid created_at type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'tag', 'created_at'],
        rows: [['entity-1', 'valid-tag', 'not-a-number']],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string tag name', async () => {
      queryFn.mockResolvedValue({ headers: [], rows: [] });
      await repo.addTag('entity-1', '');
      expect(mutateFn.mock.calls[0]![1].tag).toBe('');
    });

    it('should handle tags with special characters', async () => {
      const tag = 'tag-with-special_chars#123';
      queryFn.mockResolvedValue({ headers: [], rows: [] });
      await repo.addTag('entity-1', tag);
      expect(mutateFn.mock.calls[0]![1].tag).toBe(tag);
    });

    it('should not throw when removing non-existent tag', async () => {
      await expect(repo.removeTag('entity-1', 'nonexistent')).resolves.not.toThrow();
    });
  });
});
