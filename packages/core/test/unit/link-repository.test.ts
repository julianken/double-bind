/**
 * Unit tests for LinkRepository
 *
 * These tests verify correct SQL query construction and parameter passing
 * using a spy-based mock. They do NOT execute real SQL queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Database, QueryResult, MutationResult } from '@double-bind/types';
import { LinkRepository } from '../../src/repositories/link-repository.js';

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

describe('LinkRepository', () => {
  let db: Database;
  let queryFn: ReturnType<typeof vi.fn>;
  let mutateFn: ReturnType<typeof vi.fn>;
  let repo: LinkRepository;

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    queryFn = mock.queryFn;
    mutateFn = mock.mutateFn;
    repo = new LinkRepository(db);
  });

  describe('getOutLinks', () => {
    it('should construct correct SQL with JOIN and is_deleted filter', async () => {
      const pageId = 'page-1';

      await repo.getOutLinks(pageId);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('SELECT');
      expect(script).toContain('FROM links l');
      expect(script).toContain('JOIN pages p ON l.target_id = p.page_id');
      expect(script).toContain('l.source_id = $page_id');
      expect(script).toContain('p.is_deleted = 0');
      expect(params).toEqual({ page_id: pageId });
    });

    it('should parse link rows correctly when data exists', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [
          ['page-1', 'page-2', 'reference', now, 'block-1', 'Target Page'],
        ],
      });

      const result = await repo.getOutLinks('page-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sourceId: 'page-1',
        targetId: 'page-2',
        linkType: 'reference',
        createdAt: now,
        contextBlockId: 'block-1',
        targetTitle: 'Target Page',
      });
    });

    it('should handle null contextBlockId', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [
          ['page-1', 'page-2', 'reference', now, null, 'Target Page'],
        ],
      });

      const result = await repo.getOutLinks('page-1');

      expect(result[0]?.contextBlockId).toBeNull();
    });

    it('should handle different link types', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [
          ['page-1', 'page-2', 'embed', now, null, 'Embedded'],
          ['page-1', 'page-3', 'tag', now, null, 'Tagged'],
        ],
      });

      const result = await repo.getOutLinks('page-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.linkType).toBe('embed');
      expect(result[1]?.linkType).toBe('tag');
    });

    it('should return empty array for page with no links', async () => {
      const result = await repo.getOutLinks('page-no-links');
      expect(result).toEqual([]);
    });
  });

  describe('getOutLinks edge cases', () => {
    it('should filter by source_id correctly', async () => {
      await repo.getOutLinks('specific-page');

      const [, params] = queryFn.mock.calls[0]!;
      expect(params).toEqual({ page_id: 'specific-page' });
    });

    it('should handle multiple links to same target', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [
          ['page-1', 'page-2', 'reference', now, 'block-1', 'Page 2'],
          ['page-1', 'page-2', 'embed', now, 'block-2', 'Page 2'],
        ],
      });

      const result = await repo.getOutLinks('page-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getInLinks', () => {
    it('should construct correct SQL with block JOIN for context content', async () => {
      const pageId = 'page-2';

      await repo.getInLinks(pageId);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('FROM links l');
      expect(script).toContain('JOIN blocks b ON l.context_block_id = b.block_id');
      expect(script).toContain('l.target_id = $page_id');
      expect(script).toContain('b.is_deleted = 0');
      expect(params).toEqual({ page_id: pageId });
    });

    it('should parse InLink results with context content', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'content'],
        rows: [
          ['page-1', 'page-2', 'reference', now, 'block-1', 'Link to [[Target]]'],
        ],
      });

      const result = await repo.getInLinks('page-2');

      expect(result).toHaveLength(1);
      expect(result[0]?.sourceId).toBe('page-1');
      expect(result[0]?.contextContent).toBe('Link to [[Target]]');
    });

    it('should return empty array for page with no backlinks', async () => {
      const result = await repo.getInLinks('isolated-page');
      expect(result).toEqual([]);
    });
  });

  describe('getInLinks edge cases', () => {
    it('should filter by target_id correctly', async () => {
      await repo.getInLinks('target-page');
      expect(queryFn.mock.calls[0]![1]).toEqual({ page_id: 'target-page' });
    });

    it('should join with non-deleted blocks only', async () => {
      await repo.getInLinks('page-1');
      const [script] = queryFn.mock.calls[0]!;
      expect(script).toContain('b.is_deleted = 0');
    });
  });

  describe('getBlockBacklinks', () => {
    it('should construct SQL with block JOIN for source context', async () => {
      const blockId = 'block-target';

      await repo.getBlockBacklinks(blockId);

      expect(queryFn).toHaveBeenCalledOnce();
      const [script, params] = queryFn.mock.calls[0]!;
      expect(script).toContain('FROM block_refs br');
      expect(script).toContain('JOIN blocks b ON br.source_block_id = b.block_id');
      expect(script).toContain('br.target_block_id = $target');
      expect(script).toContain('b.is_deleted = 0');
      expect(params).toEqual({ target: blockId });
    });

    it('should parse BlockBacklink results', async () => {
      const now = Date.now();
      queryFn.mockResolvedValueOnce({
        headers: ['source_block_id', 'target_block_id', 'created_at', 'content', 'page_id'],
        rows: [
          ['block-src', 'block-tgt', now, 'Reference content', 'page-1'],
        ],
      });

      const result = await repo.getBlockBacklinks('block-tgt');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sourceBlockId: 'block-src',
        targetBlockId: 'block-tgt',
        createdAt: now,
        content: 'Reference content',
        pageId: 'page-1',
      });
    });

    it('should return empty array for block with no backlinks', async () => {
      const result = await repo.getBlockBacklinks('isolated-block');
      expect(result).toEqual([]);
    });
  });

  describe('getBlockBacklinks edge cases', () => {
    it('should filter by target block correctly', async () => {
      await repo.getBlockBacklinks('block-99');
      expect(queryFn.mock.calls[0]![1]).toEqual({ target: 'block-99' });
    });

    it('should join with non-deleted blocks only', async () => {
      await repo.getBlockBacklinks('block-1');
      const [script] = queryFn.mock.calls[0]!;
      expect(script).toContain('b.is_deleted = 0');
    });
  });

  describe('createLink', () => {
    it('should construct INSERT OR REPLACE with auto timestamp', async () => {
      const before = Date.now();
      await repo.createLink({
        sourceId: 'page-1',
        targetId: 'page-2',
        linkType: 'reference',
        contextBlockId: 'block-1',
      });
      const after = Date.now();

      expect(mutateFn).toHaveBeenCalledOnce();
      const [script, params] = mutateFn.mock.calls[0]!;
      expect(script).toContain('INSERT OR REPLACE INTO links');
      expect(params.source_id).toBe('page-1');
      expect(params.target_id).toBe('page-2');
      expect(params.link_type).toBe('reference');
      expect(params.context_block_id).toBe('block-1');
      expect(params.now).toBeGreaterThanOrEqual(before);
      expect(params.now).toBeLessThanOrEqual(after);
    });

    it('should handle null context block', async () => {
      await repo.createLink({
        sourceId: 'page-1',
        targetId: 'page-2',
        linkType: 'reference',
        contextBlockId: null,
      });

      expect(mutateFn.mock.calls[0]![1].context_block_id).toBeNull();
    });
  });

  describe('createBlockRef', () => {
    it('should construct INSERT OR REPLACE with auto timestamp', async () => {
      const before = Date.now();
      await repo.createBlockRef({
        sourceBlockId: 'block-1',
        targetBlockId: 'block-2',
      });
      const after = Date.now();

      expect(mutateFn).toHaveBeenCalledOnce();
      const [script, params] = mutateFn.mock.calls[0]!;
      expect(script).toContain('INSERT OR REPLACE INTO block_refs');
      expect(params.source_block_id).toBe('block-1');
      expect(params.target_block_id).toBe('block-2');
      expect(params.now).toBeGreaterThanOrEqual(before);
      expect(params.now).toBeLessThanOrEqual(after);
    });
  });

  describe('removeLinksFromBlock', () => {
    it('should execute two DELETE mutations for links and block_refs', async () => {
      await repo.removeLinksFromBlock('block-1');

      expect(mutateFn).toHaveBeenCalledTimes(2);

      // First DELETE: links where context_block_id matches
      const [script1, params1] = mutateFn.mock.calls[0]!;
      expect(script1).toContain('DELETE FROM links');
      expect(script1).toContain('context_block_id = $block_id');
      expect(params1).toEqual({ block_id: 'block-1' });

      // Second DELETE: block_refs where source_block_id matches
      const [script2, params2] = mutateFn.mock.calls[1]!;
      expect(script2).toContain('DELETE FROM block_refs');
      expect(script2).toContain('source_block_id = $block_id');
      expect(params2).toEqual({ block_id: 'block-1' });
    });

    it('should construct atomic removal query for both links and block refs', async () => {
      await repo.removeLinksFromBlock('block-x');

      // Both deletions should reference the same block_id
      expect(mutateFn.mock.calls[0]![1]).toEqual({ block_id: 'block-x' });
      expect(mutateFn.mock.calls[1]![1]).toEqual({ block_id: 'block-x' });
    });

    it('should not throw when removing from block with no links', async () => {
      await expect(repo.removeLinksFromBlock('empty-block')).resolves.not.toThrow();
    });
  });

  describe('removeLinksFromBlock edge cases', () => {
    it('should execute both removals atomically', async () => {
      await repo.removeLinksFromBlock('block-1');
      expect(mutateFn).toHaveBeenCalledTimes(2);
    });

    it('should not throw when removing links from block with no links', async () => {
      await expect(repo.removeLinksFromBlock('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('row parsing validation', () => {
    it('should throw on invalid link_type', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [['p1', 'p2', 'invalid_type', Date.now(), null, 'Title']],
      });

      await expect(repo.getOutLinks('p1')).rejects.toThrow();
    });

    it('should throw on invalid created_at type for links', async () => {
      queryFn.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id', 'title'],
        rows: [['p1', 'p2', 'reference', 'not-a-number', null, 'Title']],
      });

      await expect(repo.getOutLinks('p1')).rejects.toThrow();
    });
  });
});
