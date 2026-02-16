/**
 * Unit tests for PropertyRepository
 *
 * These tests verify correct SQL query construction and parameter passing
 * using a spy-based mock. They do NOT execute real SQL queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Database, QueryResult, MutationResult } from '@double-bind/types';
import { PropertyRepository } from '../../src/repositories/property-repository.js';

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

describe('PropertyRepository', () => {
  let db: Database;
  let queryFn: ReturnType<typeof vi.fn>;
  let mutateFn: ReturnType<typeof vi.fn>;
  let repo: PropertyRepository;

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    queryFn = mock.queryFn;
    mutateFn = mock.mutateFn;
    repo = new PropertyRepository(db);
  });

  describe('getByEntity', () => {
    it('should construct SQL with UNION ALL over block_properties and page_properties', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      await repo.getByEntity(entityId);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('block_properties');
      expect(script).toContain('page_properties');
      expect(script).toContain('UNION ALL');
      expect(script).toContain('$entity_id');
      expect(params).toEqual({ entity_id: entityId });
    });

    it('should return Property[] when properties found', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [
          [entityId, 'status', 'done', 'string', now],
          [entityId, 'priority', '1', 'number', now + 1000],
        ],
      });

      const result = await repo.getByEntity(entityId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        entityId,
        key: 'status',
        value: 'done',
        valueType: 'string',
        updatedAt: now,
      });
      expect(result[1]).toEqual({
        entityId,
        key: 'priority',
        value: '1',
        valueType: 'number',
        updatedAt: now + 1000,
      });
    });

    it('should return empty array when no properties found', async () => {
      const result = await repo.getByEntity('nonexistent');
      expect(result).toEqual([]);
    });

    it('should only return properties for the requested entity', async () => {
      const entityId = 'entity-1';
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [[entityId, 'key1', 'val1', 'string', now]],
      });

      const result = await repo.getByEntity(entityId);

      expect(result).toHaveLength(1);
      expect(result[0]?.entityId).toBe(entityId);
    });

    it('should return properties with all value types', async () => {
      const entityId = 'entity-1';
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [
          [entityId, 'name', 'Alice', 'string', now],
          [entityId, 'age', '30', 'number', now],
          [entityId, 'active', 'true', 'boolean', now],
          [entityId, 'created', '2024-01-01', 'date', now],
        ],
      });

      const result = await repo.getByEntity(entityId);

      expect(result).toHaveLength(4);
      expect(result[0]?.valueType).toBe('string');
      expect(result[1]?.valueType).toBe('number');
      expect(result[2]?.valueType).toBe('boolean');
      expect(result[3]?.valueType).toBe('date');
    });
  });

  describe('set', () => {
    it('should check pages table first and insert into page_properties', async () => {
      const entityId = 'page-1';

      // Entity found in pages
      queryFn.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      const before = Date.now();
      await repo.set(entityId, 'status', 'done', 'string');
      const after = Date.now();

      // First call: check pages
      expect(queryFn).toHaveBeenCalledOnce();
      expect(queryFn.mock.calls[0]![0]).toContain('pages');

      // Mutation: INSERT into page_properties
      expect(mutateFn).toHaveBeenCalledOnce();
      const [script, params] = mutateFn.mock.calls[0]!;
      expect(script).toContain('page_properties');
      expect(script).toContain('INSERT OR REPLACE');
      expect(params.entity_id).toBe(entityId);
      expect(params.key).toBe('status');
      expect(params.value).toBe('done');
      expect(params.value_type).toBe('string');
      expect(params.now).toBeGreaterThanOrEqual(before);
      expect(params.now).toBeLessThanOrEqual(after);
    });

    it('should insert into block_properties when entity is a block', async () => {
      const entityId = 'block-1';

      // Not found in pages
      queryFn.mockResolvedValueOnce({ headers: ['page_id'], rows: [] });
      // Found in blocks
      queryFn.mockResolvedValueOnce({
        headers: ['block_id'],
        rows: [['block-1']],
      });

      await repo.set(entityId, 'status', 'done');

      expect(mutateFn).toHaveBeenCalledOnce();
      const [script] = mutateFn.mock.calls[0]!;
      expect(script).toContain('block_properties');
    });

    it('should default value_type to string', async () => {
      // Not found in pages or blocks -- falls through to block_properties
      queryFn.mockResolvedValue({ headers: [], rows: [] });

      await repo.set('entity-1', 'key', 'value');

      expect(mutateFn.mock.calls[0]![1].value_type).toBe('string');
    });
  });

  describe('remove', () => {
    it('should issue DELETE on both block_properties and page_properties', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const key = 'status';

      await repo.remove(entityId, key);

      expect(mutateFn).toHaveBeenCalledTimes(2);

      // First DELETE targets block_properties
      const [script1, params1] = mutateFn.mock.calls[0]!;
      expect(script1).toContain('DELETE FROM block_properties');
      expect(params1).toEqual({ entity_id: entityId, key });

      // Second DELETE targets page_properties
      const [script2, params2] = mutateFn.mock.calls[1]!;
      expect(script2).toContain('DELETE FROM page_properties');
      expect(params2).toEqual({ entity_id: entityId, key });
    });
  });

  describe('parsePropertyRow type validation', () => {
    it('should throw on invalid key type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [['entity-1', 123, 'value', 'string', Date.now()]],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on invalid value type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [['entity-1', 'key', 123, 'string', Date.now()]],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on invalid valueType enum value', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [['entity-1', 'key', 'value', 'invalid_type', Date.now()]],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on invalid updated_at type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
        rows: [['entity-1', 'key', 'value', 'string', 'not-a-number']],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on missing fields', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['entity_id', 'key'],
        rows: [['entity-1', 'key']],
      });

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });
  });
});
