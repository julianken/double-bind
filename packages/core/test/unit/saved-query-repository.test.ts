/**
 * Unit tests for SavedQueryRepository
 *
 * These tests verify correct SQL query construction and parameter passing
 * using MockDatabase. They do NOT execute real SQL queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode, SavedQueryType } from '@double-bind/types';
import { SavedQueryRepository } from '../../src/repositories/saved-query-repository.js';

describe('SavedQueryRepository', () => {
  let db: MockDatabase;
  let repo: SavedQueryRepository;

  beforeEach(() => {
    db = new MockDatabase();
    repo = new SavedQueryRepository(db);
  });

  describe('getById', () => {
    it('should construct correct parameterized query', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('saved_queries', [
        [id, 'My Query', 'template', '?[x] := *blocks{x}', null, 1700000000, 1700000000],
      ]);

      await repo.getById(id);

      expect(db.lastQuery.script).toContain('FROM saved_queries');
      expect(db.lastQuery.script).toContain('id = $id');
      expect(db.lastQuery.params).toEqual({ id });
    });

    it('should return SavedQuery when found', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [
        [id, 'My Query', 'template', '?[x] := *blocks{x}', 'Find all blocks', now, now],
      ]);

      const result = await repo.getById(id);

      expect(result).toEqual({
        id,
        name: 'My Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := *blocks{x}',
        description: 'Find all blocks',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should return null when not found', async () => {
      db.seed('saved_queries', []);

      const result = await repo.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle null description', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'Query', 'raw', '?[x] := 1', null, now, now]]);

      const result = await repo.getById(id);

      expect(result?.description).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should construct query with default options', async () => {
      db.seed('saved_queries', []);

      await repo.getAll();

      expect(db.lastQuery.script).toContain('FROM saved_queries');
      expect(db.lastQuery.script).toContain('ORDER BY updated_at DESC');
      expect(db.lastQuery.script).toContain('LIMIT $limit');
      expect(db.lastQuery.script).toContain('OFFSET $offset');
      expect(db.lastQuery.params).toEqual({ limit: 100, offset: 0 });
    });

    it('should accept custom limit and offset', async () => {
      db.seed('saved_queries', []);

      await repo.getAll({ limit: 50, offset: 10 });

      expect(db.lastQuery.params).toEqual({ limit: 50, offset: 10 });
    });

    it('should filter by type when provided', async () => {
      db.seed('saved_queries', []);

      await repo.getAll({ type: SavedQueryType.TEMPLATE });

      expect(db.lastQuery.script).toContain('type = $type');
      expect(db.lastQuery.params).toEqual({ type: 'template', limit: 100, offset: 0 });
    });

    it('should return array of SavedQuery', async () => {
      const now = Date.now();
      db.seed('saved_queries', [
        ['query-1', 'Query One', 'template', '?[x] := 1', null, now, now],
        ['query-2', 'Query Two', 'raw', '?[x] := 2', null, now, now],
      ]);

      const result = await repo.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Query One');
      expect(result[1]?.name).toBe('Query Two');
    });
  });

  describe('search', () => {
    it('should construct FTS query with parameters', async () => {
      db.seed('saved_queries', []);

      await repo.search('test query');

      expect(db.lastQuery.script).toContain('saved_queries_fts');
      expect(db.lastQuery.script).toContain('MATCH $query');
      expect(db.lastQuery.script).toContain('LIMIT $limit');
      expect(db.lastQuery.script).toContain('ORDER BY');
      expect(db.lastQuery.script).toContain('rank');
      expect(db.lastQuery.params).toEqual({ query: 'test query', limit: 50 });
    });

    it('should accept custom limit', async () => {
      db.seed('saved_queries', []);

      await repo.search('test', 25);

      expect(db.lastQuery.params).toEqual({ query: 'test', limit: 25 });
    });
  });

  describe('create', () => {
    it('should construct put mutation with ULID', async () => {
      await repo.create({
        name: 'New Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := *blocks{x}',
      });

      expect(db.lastMutation.script).toContain('INSERT INTO saved_queries');
      expect(db.lastMutation.script).toContain(
        'id, name, type, definition, description, created_at, updated_at'
      );
      expect(db.lastMutation.params.name).toBe('New Query');
      expect(db.lastMutation.params.type).toBe('template');
      expect(db.lastMutation.params.definition).toBe('?[x] := *blocks{x}');
      expect(db.lastMutation.params.description).toBeNull();
      // Verify ULID format (26 chars, valid ULID chars)
      expect(db.lastMutation.params.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('should return generated ID', async () => {
      const id = await repo.create({
        name: 'New Query',
        type: SavedQueryType.RAW,
        definition: '?[x] := 1',
      });

      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(db.lastMutation.params.id).toBe(id);
    });

    it('should include description when provided', async () => {
      await repo.create({
        name: 'Query with desc',
        type: SavedQueryType.VISUAL,
        definition: '{}',
        description: 'This is a test query',
      });

      expect(db.lastMutation.params.description).toBe('This is a test query');
    });

    it('should set timestamps', async () => {
      const before = Date.now();
      await repo.create({
        name: 'Query',
        type: SavedQueryType.RAW,
        definition: '?[x] := 1',
      });
      const after = Date.now();

      const timestamp = db.lastMutation.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('update', () => {
    it('should perform read-modify-write', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'Original', 'template', '?[x] := 1', null, now, now]]);

      await repo.update(id, { name: 'Updated Name' });

      // First call should be the read (query)
      expect(db.queries).toHaveLength(1);
      // Second call should be the write (mutation)
      expect(db.mutations).toHaveLength(1);
      expect(db.lastMutation.params.name).toBe('Updated Name');
    });

    it('should throw SAVED_QUERY_NOT_FOUND if query does not exist', async () => {
      db.seed('saved_queries', []);

      await expect(repo.update('nonexistent', { name: 'New' })).rejects.toThrow(DoubleBindError);
      await expect(repo.update('nonexistent', { name: 'New' })).rejects.toMatchObject({
        code: ErrorCode.SAVED_QUERY_NOT_FOUND,
      });
    });

    it('should preserve existing fields when not updated', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const createdAt = 1700000000;
      db.seed('saved_queries', [
        [id, 'Original', 'template', '?[x] := 1', 'My description', createdAt, createdAt],
      ]);

      await repo.update(id, { name: 'Updated' });

      expect(db.lastMutation.params.type).toBe('template');
      expect(db.lastMutation.params.definition).toBe('?[x] := 1');
      expect(db.lastMutation.params.description).toBe('My description');
    });

    it('should allow updating all fields', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'Original', 'template', '?[x] := 1', null, now, now]]);

      await repo.update(id, {
        name: 'New Name',
        type: SavedQueryType.RAW,
        definition: '?[y] := 2',
        description: 'New description',
      });

      expect(db.lastMutation.params.name).toBe('New Name');
      expect(db.lastMutation.params.type).toBe('raw');
      expect(db.lastMutation.params.definition).toBe('?[y] := 2');
      expect(db.lastMutation.params.description).toBe('New description');
    });

    it('should allow clearing description', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [
        [id, 'Query', 'template', '?[x] := 1', 'Some description', now, now],
      ]);

      await repo.update(id, { description: null });

      expect(db.lastMutation.params.description).toBeNull();
    });
  });

  describe('delete', () => {
    it('should construct rm mutation', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'To Delete', 'raw', '?[x] := 1', null, now, now]]);

      await repo.delete(id);

      expect(db.lastMutation.script).toContain('DELETE FROM saved_queries');
      expect(db.lastMutation.params).toEqual({ id });
    });

    it('should throw SAVED_QUERY_NOT_FOUND if query does not exist', async () => {
      db.seed('saved_queries', []);

      await expect(repo.delete('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(repo.delete('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.SAVED_QUERY_NOT_FOUND,
      });
    });
  });

  describe('getByName', () => {
    it('should construct correct query with name parameter', async () => {
      db.seed('saved_queries', []);

      await repo.getByName('Test Query');

      expect(db.lastQuery.script).toContain('name = $name');
      expect(db.lastQuery.params).toEqual({ name: 'Test Query' });
    });

    it('should return null when name not found', async () => {
      db.seed('saved_queries', []);

      const result = await repo.getByName('nonexistent');

      expect(result).toBeNull();
    });

    it('should return query when name exists', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'My Query', 'template', '?[x] := 1', null, now, now]]);

      const result = await repo.getByName('My Query');

      expect(result?.id).toBe(id);
      expect(result?.name).toBe('My Query');
    });
  });

  describe('existsByName', () => {
    it('should return true when name exists', async () => {
      const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('saved_queries', [[id, 'Existing Query', 'raw', '?[x] := 1', null, now, now]]);

      const result = await repo.existsByName('Existing Query');

      expect(result).toBe(true);
    });

    it('should return false when name does not exist', async () => {
      db.seed('saved_queries', []);

      const result = await repo.existsByName('Nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('row validation', () => {
    it('should throw on invalid id type', async () => {
      db.seed('saved_queries', [[123, 'Name', 'raw', '?[x] := 1', null, 1700000000, 1700000000]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid name type', async () => {
      db.seed('saved_queries', [['id-1', null, 'raw', '?[x] := 1', null, 1700000000, 1700000000]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid type type', async () => {
      db.seed('saved_queries', [['id-1', 'Name', 123, '?[x] := 1', null, 1700000000, 1700000000]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid timestamp type', async () => {
      db.seed('saved_queries', [['id-1', 'Name', 'raw', '?[x] := 1', null, 'not-a-number', 1700000000]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });
  });

  describe('edge cases', () => {
    it('should handle empty name', async () => {
      await repo.create({
        name: '',
        type: SavedQueryType.RAW,
        definition: '?[x] := 1',
      });

      expect(db.lastMutation.params.name).toBe('');
    });

    it('should handle very long definitions', async () => {
      const longDefinition = '?[x] := ' + 'a'.repeat(10000);
      await repo.create({
        name: 'Long Query',
        type: SavedQueryType.RAW,
        definition: longDefinition,
      });

      expect(db.lastMutation.params.definition).toBe(longDefinition);
    });

    it('should handle special characters in name', async () => {
      const name = 'Query with "quotes" and \'apostrophes\' and `backticks`';
      await repo.create({
        name,
        type: SavedQueryType.RAW,
        definition: '?[x] := 1',
      });

      expect(db.lastMutation.params.name).toBe(name);
    });

    it('should handle newlines in definition', async () => {
      const definition = '?[x] :=\n    *blocks{x},\n    x == 1';
      await repo.create({
        name: 'Multiline',
        type: SavedQueryType.RAW,
        definition,
      });

      expect(db.lastMutation.params.definition).toBe(definition);
    });

    it('should handle all query types', async () => {
      for (const type of Object.values(SavedQueryType)) {
        await repo.create({
          name: `Query ${type}`,
          type,
          definition: '?[x] := 1',
        });

        expect(db.lastMutation.params.type).toBe(type);
      }
    });
  });
});
