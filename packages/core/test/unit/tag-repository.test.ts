/**
 * Unit tests for TagRepository
 *
 * These tests verify correct Datalog query construction and parameter passing
 * using MockGraphDB. They do NOT execute real Datalog queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { TagRepository } from '../../src/repositories/tag-repository.js';

describe('TagRepository', () => {
  let db: MockGraphDB;
  let repo: TagRepository;

  beforeEach(() => {
    db = new MockGraphDB();
    repo = new TagRepository(db);
  });

  describe('getByEntity', () => {
    it('should construct correct parameterized query', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('tags', []);

      await repo.getByEntity(entityId);

      expect(db.lastQuery.script).toContain('*tags{');
      expect(db.lastQuery.script).toContain('entity_id: $entity_id');
      expect(db.lastQuery.params).toEqual({ entity_id: entityId });
    });

    it('should return Tag[] when tags found', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('tags', [
        [entityId, 'project', now],
        [entityId, 'important', now + 1000],
      ]);

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
      db.seed('tags', []);

      const result = await repo.getByEntity('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getByTag', () => {
    it('should construct correct parameterized query', async () => {
      const tag = 'project';
      db.seed('tags', []);

      await repo.getByTag(tag);

      expect(db.lastQuery.script).toContain('*tags{');
      expect(db.lastQuery.script).toContain('tag: $tag');
      expect(db.lastQuery.params).toEqual({ tag });
    });

    it('should return all entities with the tag', async () => {
      const tag = 'project';
      const now = Date.now();
      db.seed('tags', [
        ['entity-1', tag, now],
        ['entity-2', tag, now + 1000],
      ]);

      const result = await repo.getByTag(tag);

      expect(result).toHaveLength(2);
      expect(result[0]?.entityId).toBe('entity-1');
      expect(result[1]?.entityId).toBe('entity-2');
    });

    it('should be case-sensitive', async () => {
      const now = Date.now();
      db.seed('tags', [
        ['entity-1', 'Project', now],
        ['entity-2', 'project', now],
      ]);

      // Query for lowercase - should only match lowercase
      const result = await repo.getByTag('project');

      expect(result).toHaveLength(1);
      expect(result[0]?.entityId).toBe('entity-2');
    });

    it('should return empty array when no matches', async () => {
      db.seed('tags', []);

      const result = await repo.getByTag('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('should construct aggregation query', async () => {
      db.seed('tags', []);

      await repo.getAllTags();

      expect(db.lastQuery.script).toContain('?[tag, count(entity_id)]');
      expect(db.lastQuery.script).toContain('*tags{');
      expect(db.lastQuery.script).toContain(':order -count(entity_id)');
      // No params needed for this query
      expect(db.lastQuery.params).toEqual({});
    });

    it('should return empty array when no tags exist', async () => {
      db.seed('tags', []);

      const result = await repo.getAllTags();

      expect(result).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('should construct put mutation with timestamp', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const tag = 'project';

      const before = Date.now();
      await repo.addTag(entityId, tag);
      const after = Date.now();

      expect(db.lastMutation.script).toContain(':put tags {');
      expect(db.lastMutation.script).toContain('entity_id, tag, created_at');
      expect(db.lastMutation.params.entity_id).toBe(entityId);
      expect(db.lastMutation.params.tag).toBe(tag);
      // Verify timestamp is within test execution time
      const timestamp = db.lastMutation.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should preserve case in tag names', async () => {
      await repo.addTag('entity-1', 'MyTag');

      expect(db.lastMutation.params.tag).toBe('MyTag');
    });
  });

  describe('removeTag', () => {
    it('should construct rm mutation', async () => {
      const entityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const tag = 'project';

      await repo.removeTag(entityId, tag);

      expect(db.lastMutation.script).toContain(':rm tags {');
      expect(db.lastMutation.script).toContain('entity_id, tag');
      expect(db.lastMutation.params.entity_id).toBe(entityId);
      expect(db.lastMutation.params.tag).toBe(tag);
    });

    it('should not include timestamp in rm mutation', async () => {
      await repo.removeTag('entity-1', 'project');

      // Remove only needs entity_id and tag, not created_at
      expect(db.lastMutation.params).not.toHaveProperty('now');
      expect(db.lastMutation.params).not.toHaveProperty('created_at');
    });
  });

  describe('parseTagRow type validation', () => {
    // Note: MockGraphDB filters rows by parameter values before returning them.
    // For type validation tests, we need to ensure the seeded data matches
    // the filter criteria so invalid rows are actually returned and parsed.

    it('should throw on invalid entity_id type', async () => {
      // Seed with a row where entity_id is a number instead of string
      // Use getByTag since it filters by tag value (column index 1), not entity_id
      // @ts-expect-error - testing runtime validation
      db.seed('tags', [[123, 'test-tag', Date.now()]]);

      await expect(repo.getByTag('test-tag')).rejects.toThrow();
    });

    it('should throw on invalid tag type', async () => {
      // Seed with a row where tag is null instead of string
      // Use getByEntity since it filters by entity_id (column index 0), not tag
      // @ts-expect-error - testing runtime validation
      db.seed('tags', [['entity-1', null, Date.now()]]);

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });

    it('should throw on invalid created_at type', async () => {
      // Seed with a row where created_at is a string instead of number
      // @ts-expect-error - testing runtime validation
      db.seed('tags', [['entity-1', 'valid-tag', 'not-a-number']]);

      await expect(repo.getByEntity('entity-1')).rejects.toThrow();
    });
  });
});
