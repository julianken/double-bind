import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '../src/mock-graph-db.js';

describe('MockGraphDB', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  describe('seed()', () => {
    it('stores data for the specified relation', async () => {
      db.seed('pages', [
        ['page-1', 'My Page', 1700000000, 1700000000, false, null],
        ['page-2', 'Other Page', 1700000001, 1700000001, false, null],
      ]);

      const result = await db.exportRelations(['pages']);
      expect(result['pages']).toHaveLength(2);
    });

    it('replaces existing data when seeded again', async () => {
      db.seed('pages', [['page-1', 'First']]);
      db.seed('pages', [['page-2', 'Second']]);

      const result = await db.exportRelations(['pages']);
      expect(result['pages']).toEqual([['page-2', 'Second']]);
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      db.seed('pages', [
        ['page-1', 'My Page', 1700000000, 1700000000, false, null],
        ['page-2', 'Other Page', 1700000001, 1700000001, false, null],
      ]);
      db.seed('blocks', [
        ['block-1', 'page-1', null, 'Hello world', 'text', 1.0],
        ['block-2', 'page-1', 'block-1', 'Nested block', 'text', 2.0],
        ['block-3', 'page-2', null, 'Other page block', 'text', 1.0],
      ]);
    });

    it('returns empty result for unrecognized query patterns', async () => {
      const result = await db.query('some random query');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('returns empty result for unseeded relation', async () => {
      const result = await db.query('?[x] := *unknownrelation{ x }');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('returns all seeded data when relation is matched', async () => {
      const result = await db.query(
        '?[page_id, title, created_at, updated_at, deleted, uid] := *pages{ page_id, title, created_at, updated_at, deleted, uid }',
      );
      expect(result.rows).toHaveLength(2);
    });

    it('extracts relation name from *relation{ pattern', async () => {
      const result = await db.query('?[block_id] := *blocks{ block_id }');
      expect(result.rows).toHaveLength(3);
    });

    it('filters rows by parameter binding', async () => {
      const result = await db.query(
        '?[block_id, page_id, content] := *blocks{ block_id, page_id: $pageId, parent_id, content, type, order }',
        { pageId: 'page-1' },
      );
      expect(result.rows).toHaveLength(2);
    });

    it('returns only requested columns', async () => {
      const result = await db.query(
        '?[page_id, title] := *pages{ page_id, title, created_at, updated_at, deleted, uid }',
      );
      expect(result.headers).toEqual(['page_id', 'title']);
      expect(result.rows[0]).toHaveLength(2);
      expect(result.rows[0]).toEqual(['page-1', 'My Page']);
    });

    it('records query in history', async () => {
      const script = '?[x] := *pages{ page_id: x }';
      const params = { limit: 10 };
      await db.query(script, params);

      expect(db.queries).toHaveLength(1);
      expect(db.queries[0]).toEqual({ script, params });
    });

    it('handles multiple parameter bindings', async () => {
      db.seed('links', [
        ['page-1', 'page-2', 'reference'],
        ['page-1', 'page-3', 'reference'],
        ['page-2', 'page-3', 'embed'],
      ]);

      const result = await db.query(
        '?[source_id, target_id, type] := *links{ source_id: $src, target_id: $tgt, type }',
        { src: 'page-1', tgt: 'page-2' },
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual(['page-1', 'page-2', 'reference']);
    });
  });

  describe('mutate()', () => {
    it('records mutation in history', async () => {
      const script =
        ':put pages { page_id: $id, title: $title, created_at: $now }';
      const params = { id: 'page-1', title: 'Test', now: 1700000000 };

      await db.mutate(script, params);

      expect(db.mutations).toHaveLength(1);
      expect(db.mutations[0]).toEqual({ script, params });
    });

    it('returns empty mutation result', async () => {
      const result = await db.mutate(':put pages { page_id: "test" }');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('does not modify seeded data', async () => {
      db.seed('pages', [['page-1', 'Original']]);

      await db.mutate(':rm pages { page_id: "page-1" }');

      const exported = await db.exportRelations(['pages']);
      expect(exported['pages']).toEqual([['page-1', 'Original']]);
    });
  });

  describe('importRelations()', () => {
    it('imports multiple relations at once', async () => {
      await db.importRelations({
        pages: [['page-1', 'Title']],
        blocks: [['block-1', 'page-1', 'Content']],
      });

      const exported = await db.exportRelations(['pages', 'blocks']);
      expect(exported['pages']).toEqual([['page-1', 'Title']]);
      expect(exported['blocks']).toEqual([['block-1', 'page-1', 'Content']]);
    });

    it('overwrites existing relations', async () => {
      db.seed('pages', [['old-page', 'Old']]);

      await db.importRelations({
        pages: [['new-page', 'New']],
      });

      const exported = await db.exportRelations(['pages']);
      expect(exported['pages']).toEqual([['new-page', 'New']]);
    });
  });

  describe('exportRelations()', () => {
    it('returns empty object for unseeded relations', async () => {
      const result = await db.exportRelations(['nonexistent']);
      expect(result).toEqual({});
    });

    it('exports only requested relations', async () => {
      db.seed('pages', [['page-1']]);
      db.seed('blocks', [['block-1']]);
      db.seed('links', [['link-1']]);

      const result = await db.exportRelations(['pages', 'blocks']);
      expect(Object.keys(result)).toEqual(['pages', 'blocks']);
      expect(result['links']).toBeUndefined();
    });
  });

  describe('backup()', () => {
    it('resolves successfully (no-op)', async () => {
      await expect(db.backup('/path/to/backup.db')).resolves.toBeUndefined();
    });
  });

  describe('lastQuery', () => {
    it('returns the most recent query', async () => {
      await db.query('first query');
      await db.query('second query', { param: 1 });

      expect(db.lastQuery.script).toBe('second query');
      expect(db.lastQuery.params).toEqual({ param: 1 });
    });

    it('throws error when no queries have been made', () => {
      expect(() => db.lastQuery).toThrow('No queries have been made');
    });
  });

  describe('lastMutation', () => {
    it('returns the most recent mutation', async () => {
      await db.mutate('first mutation');
      await db.mutate('second mutation', { id: 'test' });

      expect(db.lastMutation.script).toBe('second mutation');
      expect(db.lastMutation.params).toEqual({ id: 'test' });
    });

    it('throws error when no mutations have been made', () => {
      expect(() => db.lastMutation).toThrow('No mutations have been made');
    });
  });

  describe('reset()', () => {
    it('clears all seeded data', async () => {
      db.seed('pages', [['page-1']]);
      db.seed('blocks', [['block-1']]);

      db.reset();

      const exported = await db.exportRelations(['pages', 'blocks']);
      expect(exported).toEqual({});
    });

    it('clears query history', async () => {
      await db.query('test query');
      expect(db.queries).toHaveLength(1);

      db.reset();

      expect(db.queries).toHaveLength(0);
    });

    it('clears mutation history', async () => {
      await db.mutate('test mutation');
      expect(db.mutations).toHaveLength(1);

      db.reset();

      expect(db.mutations).toHaveLength(0);
    });

    it('allows reuse after reset', async () => {
      db.seed('pages', [['old-page']]);
      await db.query('old query');
      await db.mutate('old mutation');

      db.reset();

      db.seed('pages', [['new-page']]);
      await db.query('new query');
      await db.mutate('new mutation');

      const exported = await db.exportRelations(['pages']);
      expect(exported['pages']).toEqual([['new-page']]);
      expect(db.queries).toHaveLength(1);
      expect(db.lastQuery.script).toBe('new query');
      expect(db.mutations).toHaveLength(1);
      expect(db.lastMutation.script).toBe('new mutation');
    });
  });

  describe('queries and mutations arrays', () => {
    it('returns copies to prevent external mutation', async () => {
      await db.query('test query');
      const queries = db.queries;
      queries.push({ script: 'injected', params: {} });

      expect(db.queries).toHaveLength(1);
    });

    it('accumulates all calls in order', async () => {
      await db.query('query1');
      await db.mutate('mutation1');
      await db.query('query2');
      await db.mutate('mutation2');

      expect(db.queries.map((q) => q.script)).toEqual(['query1', 'query2']);
      expect(db.mutations.map((m) => m.script)).toEqual([
        'mutation1',
        'mutation2',
      ]);
    });
  });

  describe('pattern matching edge cases', () => {
    it('handles whitespace variations in relation pattern', async () => {
      db.seed('pages', [
        ['page-1', 'Title'],
        ['page-2', 'Other'],
      ]);

      // Various whitespace patterns
      const result1 = await db.query('?[x] := *pages{x}');
      const result2 = await db.query('?[x] := *pages { x }');
      const result3 = await db.query('?[x] := *pages  {  x  }');

      expect(result1.rows).toHaveLength(2);
      expect(result2.rows).toHaveLength(2);
      expect(result3.rows).toHaveLength(2);
    });

    it('extracts first relation when multiple are present', async () => {
      db.seed('pages', [['page-1']]);
      db.seed('blocks', [['block-1'], ['block-2'], ['block-3']]);

      // Query referencing multiple relations - returns first matched
      const result = await db.query(
        '?[x, y] := *pages{ page_id: x }, *blocks{ page_id: x, block_id: y }',
      );
      expect(result.rows).toHaveLength(1); // Only pages data, as it's matched first
    });

    it('handles query with no column specification', async () => {
      db.seed('pages', [
        ['page-1', 'Title'],
        ['page-2', 'Other'],
      ]);

      // No ?[...] in query
      const result = await db.query('*pages{ page_id, title }');
      expect(result.rows).toHaveLength(2);
      expect(result.headers).toEqual([]);
    });

    it('handles default empty params', async () => {
      await db.query('test query');
      expect(db.lastQuery.params).toEqual({});
    });

    it('handles default empty params for mutate', async () => {
      await db.mutate('test mutation');
      expect(db.lastMutation.params).toEqual({});
    });
  });

  describe('realistic usage patterns', () => {
    it('simulates BlockRepository.getById pattern', async () => {
      db.seed('blocks', [
        [
          'block-1',
          'page-1',
          null,
          'Hello world',
          'text',
          1.0,
          false,
          false,
          1700000000,
          1700000000,
        ],
        [
          'block-2',
          'page-1',
          'block-1',
          'Nested',
          'text',
          2.0,
          false,
          false,
          1700000001,
          1700000001,
        ],
      ]);

      const result = await db.query(
        '?[block_id, page_id, parent_id, content, type, order, collapsed, deleted, created_at, updated_at] := *blocks{ block_id: $id, page_id, parent_id, content, type, order, collapsed, deleted, created_at, updated_at }',
        { id: 'block-1' },
      );

      expect(result.rows).toHaveLength(1);
      expect(result.headers).toContain('block_id');
      expect(result.headers).toContain('content');
    });

    it('simulates PageRepository.list pattern', async () => {
      db.seed('pages', [
        ['page-1', 'Daily Notes', 1700000000, 1700000000, false, null],
        ['page-2', 'Projects', 1700000001, 1700000001, false, null],
        ['page-3', 'Archived', 1700000002, 1700000002, true, null],
      ]);

      const result = await db.query(
        '?[page_id, title] := *pages{ page_id, title, created_at, updated_at, deleted, uid }',
      );

      expect(result.rows).toHaveLength(3);
      expect(result.headers).toEqual(['page_id', 'title']);
    });

    it('simulates mutation verification pattern', async () => {
      const blockId = 'block-new';
      const pageId = 'page-1';
      const content = 'New block content';
      const now = Date.now();

      await db.mutate(
        ':put blocks { block_id: $blockId, page_id: $pageId, content: $content, created_at: $now, updated_at: $now }',
        { blockId, pageId, content, now },
      );

      // Verify the mutation was recorded correctly
      expect(db.lastMutation.script).toContain(':put blocks');
      expect(db.lastMutation.params).toEqual({ blockId, pageId, content, now });
    });
  });
});
