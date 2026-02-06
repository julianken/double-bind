/**
 * Unit tests for LinkRepository
 *
 * These tests verify correct Datalog query construction and parameter passing
 * using MockGraphDB. They do NOT execute real Datalog queries - that's for
 * Layer 2 integration tests.
 *
 * Note: MockGraphDB only parses the first *relation{ pattern, so join queries
 * cannot be fully tested here. Integration tests verify the actual data flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { LinkRepository } from '../../src/repositories/link-repository.js';

describe('LinkRepository', () => {
  let db: MockGraphDB;
  let repo: LinkRepository;

  beforeEach(() => {
    db = new MockGraphDB();
    repo = new LinkRepository(db);
  });

  describe('getOutLinks', () => {
    it('should construct correct parameterized query', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('links', []);

      await repo.getOutLinks(pageId);

      expect(db.lastQuery.script).toContain('*links{');
      expect(db.lastQuery.script).toContain('source_id: $page_id');
      expect(db.lastQuery.script).toContain('*pages{');
      expect(db.lastQuery.script).toContain('page_id: target_id');
      expect(db.lastQuery.script).toContain('is_deleted: false');
      expect(db.lastQuery.params).toEqual({ page_id: pageId });
    });

    it('should return empty array when no links exist', async () => {
      db.seed('links', []);

      const result = await repo.getOutLinks('nonexistent');

      expect(result).toEqual([]);
    });

    it('should parse link rows correctly when data exists', async () => {
      const sourceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const targetId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
      const now = Date.now();
      const contextBlockId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

      // Seed with full row data including title (simulating join result)
      db.seed('links', [[sourceId, targetId, 'reference', now, contextBlockId, 'Target Page']]);

      const result = await repo.getOutLinks(sourceId);

      expect(result).toHaveLength(1);
      expect(result[0]?.sourceId).toBe(sourceId);
      expect(result[0]?.targetId).toBe(targetId);
      expect(result[0]?.linkType).toBe('reference');
      expect(result[0]?.createdAt).toBe(now);
      expect(result[0]?.contextBlockId).toBe(contextBlockId);
      // Note: targetTitle comes from position 5 in the row, which MockGraphDB
      // returns as the 6th element since it doesn't actually do joins
    });

    it('should handle null contextBlockId', async () => {
      const sourceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const targetId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
      const now = Date.now();

      db.seed('links', [[sourceId, targetId, 'embed', now, null, 'Target Page']]);

      const result = await repo.getOutLinks(sourceId);

      expect(result[0]?.contextBlockId).toBeNull();
      expect(result[0]?.linkType).toBe('embed');
    });

    it('should handle different link types', async () => {
      const sourceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();

      db.seed('links', [
        [sourceId, 'target-1', 'reference', now, null, 'Page 1'],
        [sourceId, 'target-2', 'embed', now, null, 'Page 2'],
        [sourceId, 'target-3', 'tag', now, null, 'Page 3'],
      ]);

      const result = await repo.getOutLinks(sourceId);

      expect(result).toHaveLength(3);
      expect(result[0]?.linkType).toBe('reference');
      expect(result[1]?.linkType).toBe('embed');
      expect(result[2]?.linkType).toBe('tag');
    });
  });

  describe('getInLinks', () => {
    it('should construct correct parameterized query for backlinks', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('links', []);

      await repo.getInLinks(pageId);

      expect(db.lastQuery.script).toContain('*links{');
      expect(db.lastQuery.script).toContain('target_id: $page_id');
      expect(db.lastQuery.script).toContain('*blocks{');
      expect(db.lastQuery.script).toContain('block_id: context_block_id');
      expect(db.lastQuery.script).toContain('is_deleted: false');
      expect(db.lastQuery.params).toEqual({ page_id: pageId });
    });

    it('should return empty array when no backlinks exist', async () => {
      db.seed('links', []);

      const result = await repo.getInLinks('nonexistent');

      expect(result).toEqual([]);
    });

    // Note: Data parsing tests for InLinks are handled by Layer 2 integration tests
    // because MockGraphDB cannot simulate joins. The schema validation tests in
    // link-repository.schemas.test.ts verify the row parsing logic.
  });

  describe('getBlockBacklinks', () => {
    it('should construct correct parameterized query', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('block_refs', []);

      await repo.getBlockBacklinks(blockId);

      expect(db.lastQuery.script).toContain('*block_refs{');
      expect(db.lastQuery.script).toContain('target_block_id: $target');
      expect(db.lastQuery.script).toContain('*blocks{');
      expect(db.lastQuery.script).toContain('block_id: source_block_id');
      expect(db.lastQuery.script).toContain('is_deleted: false');
      expect(db.lastQuery.params).toEqual({ target: blockId });
    });

    it('should return empty array when no block backlinks exist', async () => {
      db.seed('block_refs', []);

      const result = await repo.getBlockBacklinks('nonexistent');

      expect(result).toEqual([]);
    });

    // Note: Data parsing tests for BlockBacklinks are handled by Layer 2 integration tests
    // because MockGraphDB cannot simulate joins. The schema validation tests in
    // link-repository.schemas.test.ts verify the row parsing logic.
  });

  describe('createLink', () => {
    it('should construct put mutation with auto timestamp', async () => {
      const before = Date.now();

      await repo.createLink({
        sourceId: 'source-page',
        targetId: 'target-page',
        linkType: 'reference',
        contextBlockId: 'block-1',
      });

      const after = Date.now();

      expect(db.lastMutation.script).toContain(':put links {');
      expect(db.lastMutation.script).toContain(
        'source_id, target_id, link_type, created_at, context_block_id'
      );
      expect(db.lastMutation.params.source_id).toBe('source-page');
      expect(db.lastMutation.params.target_id).toBe('target-page');
      expect(db.lastMutation.params.link_type).toBe('reference');
      expect(db.lastMutation.params.context_block_id).toBe('block-1');

      const timestamp = db.lastMutation.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle null contextBlockId', async () => {
      await repo.createLink({
        sourceId: 'source-page',
        targetId: 'target-page',
        linkType: 'embed',
        contextBlockId: null,
      });

      expect(db.lastMutation.params.context_block_id).toBeNull();
    });

    it('should handle different link types', async () => {
      await repo.createLink({
        sourceId: 'source',
        targetId: 'target',
        linkType: 'tag',
        contextBlockId: null,
      });

      expect(db.lastMutation.params.link_type).toBe('tag');
    });
  });

  describe('createBlockRef', () => {
    it('should construct put mutation with auto timestamp', async () => {
      const before = Date.now();

      await repo.createBlockRef({
        sourceBlockId: 'source-block',
        targetBlockId: 'target-block',
      });

      const after = Date.now();

      expect(db.lastMutation.script).toContain(':put block_refs {');
      expect(db.lastMutation.script).toContain('source_block_id, target_block_id, created_at');
      expect(db.lastMutation.params.source_block_id).toBe('source-block');
      expect(db.lastMutation.params.target_block_id).toBe('target-block');

      const timestamp = db.lastMutation.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('removeLinksFromBlock', () => {
    it('should execute two removal mutations', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      await repo.removeLinksFromBlock(blockId);

      expect(db.mutations).toHaveLength(2);
    });

    it('should construct correct removal query for links', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      await repo.removeLinksFromBlock(blockId);

      const linksRemoval = db.mutations[0]!;
      expect(linksRemoval.script).toContain('*links{');
      expect(linksRemoval.script).toContain('context_block_id: $block_id');
      expect(linksRemoval.script).toContain(':rm links { source_id, target_id, link_type }');
      expect(linksRemoval.params).toEqual({ block_id: blockId });
    });

    it('should construct correct removal query for block refs', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      await repo.removeLinksFromBlock(blockId);

      const blockRefsRemoval = db.mutations[1]!;
      expect(blockRefsRemoval.script).toContain('*block_refs{');
      expect(blockRefsRemoval.script).toContain('source_block_id: $block_id');
      expect(blockRefsRemoval.script).toContain(
        ':rm block_refs { source_block_id, target_block_id }'
      );
      expect(blockRefsRemoval.params).toEqual({ block_id: blockId });
    });
  });

  describe('row parsing validation', () => {
    it('should throw on invalid link_type', async () => {
      const sourceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      // @ts-expect-error - testing runtime validation
      db.seed('links', [[sourceId, 'target', 'invalid_type', Date.now(), null, 'Title']]);

      await expect(repo.getOutLinks(sourceId)).rejects.toThrow();
    });

    it('should throw on invalid created_at type for links', async () => {
      const sourceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      // @ts-expect-error - testing runtime validation
      db.seed('links', [[sourceId, 'target', 'reference', 'not-a-number', null, 'Title']]);

      await expect(repo.getOutLinks(sourceId)).rejects.toThrow();
    });
  });
});
