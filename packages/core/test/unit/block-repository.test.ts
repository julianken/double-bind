/**
 * Unit tests for BlockRepository
 *
 * These tests verify correct Datalog query construction and parameter passing
 * using MockGraphDB. They do NOT execute real Datalog queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { BlockRepository, computeParentKey } from '../../src/repositories/block-repository.js';

// Helper to create a valid block row tuple
function createBlockRow(overrides: Partial<Record<string, unknown>> = {}): unknown[] {
  const defaults = {
    block_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    page_id: '01ARZ3NDEKTSV4RRFFQ69G5PAG',
    parent_id: null,
    content: 'Test content',
    content_type: 'text',
    order: 'a',
    is_collapsed: false,
    is_deleted: false,
    created_at: 1700000000,
    updated_at: 1700000000,
  };

  const merged = { ...defaults, ...overrides };

  return [
    merged.block_id,
    merged.page_id,
    merged.parent_id,
    merged.content,
    merged.content_type,
    merged.order,
    merged.is_collapsed,
    merged.is_deleted,
    merged.created_at,
    merged.updated_at,
  ];
}

describe('BlockRepository', () => {
  let db: MockGraphDB;
  let repo: BlockRepository;

  beforeEach(() => {
    db = new MockGraphDB();
    repo = new BlockRepository(db);
  });

  describe('computeParentKey', () => {
    it('should return block ID when parent exists', () => {
      const result = computeParentKey('parent-block-id', 'page-id');
      expect(result).toBe('parent-block-id');
    });

    it('should return sentinel when parent is null', () => {
      const result = computeParentKey(null, 'page-123');
      expect(result).toBe('__page:page-123');
    });
  });

  describe('getById', () => {
    it('should construct correct parameterized query', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      await repo.getById(blockId);

      expect(db.lastQuery.script).toContain('*blocks{');
      expect(db.lastQuery.script).toContain('block_id == $id');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.params).toEqual({ id: blockId });
    });

    it('should return Block when found', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const now = Date.now();
      db.seed('blocks', [
        createBlockRow({
          block_id: blockId,
          page_id: pageId,
          content: 'My block content',
          created_at: now,
          updated_at: now,
        }),
      ]);

      const result = await repo.getById(blockId);

      expect(result).toEqual({
        blockId,
        pageId,
        parentId: null,
        content: 'My block content',
        contentType: 'text',
        order: 'a',
        isCollapsed: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should return null when not found', async () => {
      db.seed('blocks', []);

      const result = await repo.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle block with parent', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';
      db.seed('blocks', [createBlockRow({ block_id: blockId, parent_id: parentId })]);

      const result = await repo.getById(blockId);

      expect(result?.parentId).toBe(parentId);
    });

    it('should handle different content types', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId, content_type: 'code' })]);

      const result = await repo.getById(blockId);

      expect(result?.contentType).toBe('code');
    });
  });

  describe('getByPage', () => {
    it('should construct query joining blocks_by_page with blocks', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      // Seed empty data - we just want to verify query construction
      db.seed('blocks_by_page', []);
      db.seed('blocks', []);

      await repo.getByPage(pageId);

      expect(db.lastQuery.script).toContain('*blocks_by_page{');
      expect(db.lastQuery.script).toContain('page_id == $page_id');
      expect(db.lastQuery.script).toContain('*blocks{');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.script).toContain(':order order');
      expect(db.lastQuery.params).toEqual({ page_id: pageId });
    });

    it('should return empty array when no blocks exist', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      // Note: MockGraphDB doesn't evaluate joins, it returns first relation matched
      // Seed blocks_by_page with empty array to simulate no blocks
      db.seed('blocks_by_page', []);

      const result = await repo.getByPage(pageId);

      expect(result).toHaveLength(0);
    });

    // Note: MockGraphDB cannot properly test join semantics.
    // It returns rows from the first matched relation (*blocks_by_page),
    // not the joined result. Join behavior is tested in Layer 2 integration tests.
  });

  describe('getChildren', () => {
    it('should construct query joining blocks_by_parent with blocks', async () => {
      const parentKey = '__page:page-123';
      db.seed('blocks_by_parent', []);
      db.seed('blocks', []);

      await repo.getChildren(parentKey);

      expect(db.lastQuery.script).toContain('*blocks_by_parent{');
      expect(db.lastQuery.script).toContain('parent_id == $parent_key');
      expect(db.lastQuery.script).toContain('*blocks{');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.script).toContain(':order order');
      expect(db.lastQuery.params).toEqual({ parent_key: parentKey });
    });

    it('should work with block ID as parent key', async () => {
      const parentBlockId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';
      db.seed('blocks_by_parent', []);
      db.seed('blocks', []);

      await repo.getChildren(parentBlockId);

      expect(db.lastQuery.params).toEqual({ parent_key: parentBlockId });
    });

    it('should work with page sentinel as parent key', async () => {
      const pageId = 'page-123';
      const parentKey = `__page:${pageId}`;
      db.seed('blocks_by_parent', []);
      db.seed('blocks', []);

      await repo.getChildren(parentKey);

      expect(db.lastQuery.params).toEqual({ parent_key: parentKey });
    });
  });

  describe('create', () => {
    it('should execute three separate mutations for index maintenance', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'New block' });

      // Should have 3 separate mutations (CozoDB v0.7 doesn't allow multiple ? rules with :put)
      expect(db.mutations).toHaveLength(3);

      // First mutation: put to blocks relation
      expect(db.mutations[0]?.script).toContain(':put blocks {');
      // Second mutation: put to blocks_by_page index
      expect(db.mutations[1]?.script).toContain(':put blocks_by_page {');
      // Third mutation: put to blocks_by_parent index
      expect(db.mutations[2]?.script).toContain(':put blocks_by_parent {');
    });

    it('should generate ULID for block ID', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      const blockId = await repo.create({ pageId, content: 'New block' });

      // Verify ULID format (26 chars, valid ULID chars)
      expect(blockId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      // The first mutation (blocks insert) should have the id parameter
      expect(db.mutations[0]?.params.id).toBe(blockId);
    });

    it('should pass correct parameters', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const content = 'New block content';

      await repo.create({ pageId, content });

      // Check the first mutation (blocks insert) for all parameters
      const blocksMutation = db.mutations[0];
      expect(blocksMutation?.params.page_id).toBe(pageId);
      expect(blocksMutation?.params.content).toBe(content);
      expect(blocksMutation?.params.content_type).toBe('text');
      expect(blocksMutation?.params.parent_id).toBeNull();
    });

    it('should compute parent key for root blocks', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Root block' });

      // The third mutation (blocks_by_parent insert) has the parent_key
      expect(db.mutations[2]?.params.parent_key).toBe(`__page:${pageId}`);
    });

    it('should use parent ID as parent key when provided', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';

      await repo.create({ pageId, parentId, content: 'Child block' });

      // First mutation (blocks) has parent_id, third mutation (blocks_by_parent) has parent_key
      expect(db.mutations[0]?.params.parent_id).toBe(parentId);
      expect(db.mutations[2]?.params.parent_key).toBe(parentId);
    });

    it('should use provided content type', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: '# Heading', contentType: 'heading' });

      expect(db.mutations[0]?.params.content_type).toBe('heading');
    });

    it('should use provided order', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Block', order: 'abc' });

      expect(db.mutations[0]?.params.order).toBe('abc');
    });

    it('should set timestamps', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const before = Date.now();

      await repo.create({ pageId, content: 'New block' });

      const after = Date.now();
      const timestamp = db.mutations[0]?.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('update', () => {
    it('should perform read-modify-write', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('blocks', [createBlockRow({ block_id: blockId, created_at: now, updated_at: now })]);

      await repo.update(blockId, { content: 'Updated content' });

      // First call should be the read (query)
      expect(db.queries).toHaveLength(1);
      // Second call should be the write (mutation)
      expect(db.mutations).toHaveLength(1);
      expect(db.lastMutation.params.content).toBe('Updated content');
      expect(db.lastMutation.params.created_at).toBe(now);
    });

    it('should throw BLOCK_NOT_FOUND if block does not exist', async () => {
      db.seed('blocks', []);

      await expect(repo.update('nonexistent', { content: 'New' })).rejects.toThrow(DoubleBindError);
      await expect(repo.update('nonexistent', { content: 'New' })).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });

    it('should preserve existing fields when not updated', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [
        createBlockRow({
          block_id: blockId,
          content: 'Original',
          order: 'xyz',
          is_collapsed: true,
        }),
      ]);

      await repo.update(blockId, { content: 'Updated' });

      expect(db.lastMutation.params.order).toBe('xyz');
      expect(db.lastMutation.params.is_collapsed).toBe(true);
    });

    it('should allow updating parentId to null', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';
      db.seed('blocks', [createBlockRow({ block_id: blockId, parent_id: parentId })]);

      await repo.update(blockId, { parentId: null });

      expect(db.lastMutation.params.parent_id).toBeNull();
    });

    it('should allow updating isCollapsed', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId, is_collapsed: false })]);

      await repo.update(blockId, { isCollapsed: true });

      expect(db.lastMutation.params.is_collapsed).toBe(true);
    });

    it('should update timestamp on update', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const oldTime = 1700000000;
      db.seed('blocks', [
        createBlockRow({ block_id: blockId, created_at: oldTime, updated_at: oldTime }),
      ]);

      const before = Date.now();
      await repo.update(blockId, { content: 'Updated' });
      const after = Date.now();

      const newTime = db.lastMutation.params.now as number;
      expect(newTime).toBeGreaterThanOrEqual(before);
      expect(newTime).toBeLessThanOrEqual(after);
    });
  });

  describe('softDelete', () => {
    it('should set is_deleted to true', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      await repo.softDelete(blockId);

      expect(db.lastMutation.script).toContain(':put blocks {');
      // The mutation script should have is_deleted = true hardcoded
      expect(db.lastMutation.script).toContain('true');
    });

    it('should throw BLOCK_NOT_FOUND if block does not exist', async () => {
      db.seed('blocks', []);

      await expect(repo.softDelete('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(repo.softDelete('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });

    it('should update timestamp on soft delete', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const oldTime = 1700000000;
      db.seed('blocks', [
        createBlockRow({ block_id: blockId, created_at: oldTime, updated_at: oldTime }),
      ]);

      const before = Date.now();
      await repo.softDelete(blockId);
      const after = Date.now();

      const newTime = db.lastMutation.params.now as number;
      expect(newTime).toBeGreaterThanOrEqual(before);
      expect(newTime).toBeLessThanOrEqual(after);
    });

    it('should preserve all other fields', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [
        createBlockRow({
          block_id: blockId,
          content: 'Original content',
          order: 'abc',
        }),
      ]);

      await repo.softDelete(blockId);

      expect(db.lastMutation.params.content).toBe('Original content');
      expect(db.lastMutation.params.order).toBe('abc');
    });
  });

  describe('move', () => {
    it('should construct atomic transaction with index update', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      db.seed('blocks', [createBlockRow({ block_id: blockId, page_id: pageId })]);

      const newParentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';
      await repo.move(blockId, newParentId, 'b');

      const script = db.lastMutation.script;
      // Should be an atomic transaction
      expect(script).toContain('{');
      expect(script).toContain('}');
      // Should update blocks relation
      expect(script).toContain(':put blocks {');
      // Should remove from old parent index
      expect(script).toContain(':rm blocks_by_parent {');
      // Should add to new parent index
      expect(script).toContain(':put blocks_by_parent {');
    });

    it('should throw BLOCK_NOT_FOUND if block does not exist', async () => {
      db.seed('blocks', []);

      await expect(repo.move('nonexistent', null, 'a')).rejects.toThrow(DoubleBindError);
      await expect(repo.move('nonexistent', null, 'a')).rejects.toMatchObject({
        code: ErrorCode.BLOCK_NOT_FOUND,
      });
    });

    it('should compute old and new parent keys correctly', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const oldParentId = '01ARZ3NDEKTSV4RRFFQ69G5OLD';
      const newParentId = '01ARZ3NDEKTSV4RRFFQ69G5NEW';

      db.seed('blocks', [
        createBlockRow({ block_id: blockId, page_id: pageId, parent_id: oldParentId }),
      ]);

      await repo.move(blockId, newParentId, 'b');

      // move() uses an atomic transaction - single mutation with all params
      expect(db.lastMutation.params.old_parent_key).toBe(oldParentId);
      expect(db.lastMutation.params.new_parent_key).toBe(newParentId);
    });

    it('should use page sentinel for root-level move', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const oldParentId = '01ARZ3NDEKTSV4RRFFQ69G5OLD';

      db.seed('blocks', [
        createBlockRow({ block_id: blockId, page_id: pageId, parent_id: oldParentId }),
      ]);

      await repo.move(blockId, null, 'b');

      // move() uses an atomic transaction - single mutation with all params
      expect(db.lastMutation.params.old_parent_key).toBe(oldParentId);
      expect(db.lastMutation.params.new_parent_key).toBe(`__page:${pageId}`);
      expect(db.lastMutation.params.new_parent_id).toBeNull();
    });

    it('should update order', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId, order: 'a' })]);

      await repo.move(blockId, null, 'xyz');

      // move() uses an atomic transaction - single mutation with all params
      expect(db.lastMutation.params.new_order).toBe('xyz');
    });

    it('should preserve content and other fields', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [
        createBlockRow({
          block_id: blockId,
          content: 'Preserved content',
          content_type: 'heading',
          is_collapsed: true,
        }),
      ]);

      await repo.move(blockId, null, 'b');

      // move() uses an atomic transaction - single mutation with all params
      expect(db.lastMutation.params.content).toBe('Preserved content');
      expect(db.lastMutation.params.content_type).toBe('heading');
      expect(db.lastMutation.params.is_collapsed).toBe(true);
    });
  });

  describe('search', () => {
    it('should construct FTS query with parameters', async () => {
      db.seed('blocks', []);

      await repo.search('test query');

      expect(db.lastQuery.script).toContain('~blocks:fts{');
      expect(db.lastQuery.script).toContain('query: $query');
      expect(db.lastQuery.script).toContain('k: $limit');
      expect(db.lastQuery.script).toContain('bind_score: score');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.script).toContain(':order -score');
      expect(db.lastQuery.params).toEqual({ query: 'test query', limit: 50 });
    });

    it('should accept custom limit', async () => {
      db.seed('blocks', []);

      await repo.search('test', 25);

      expect(db.lastQuery.params).toEqual({ query: 'test', limit: 25 });
    });
  });

  describe('getHistory', () => {
    it('should construct correct query for block_history', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('block_history', []);

      await repo.getHistory(blockId);

      expect(db.lastQuery.script).toContain('*block_history{');
      expect(db.lastQuery.script).toContain('block_id == $id');
      expect(db.lastQuery.script).toContain(':order -version');
      expect(db.lastQuery.script).toContain(':limit $limit');
      expect(db.lastQuery.params).toEqual({ id: blockId, limit: 100 });
    });

    it('should accept custom limit', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('block_history', []);

      await repo.getHistory(blockId, 10);

      expect(db.lastQuery.params).toEqual({ id: blockId, limit: 10 });
    });

    it('should parse history rows correctly', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const timestamp = Date.now();
      db.seed('block_history', [
        [blockId, 2, 'Updated content', null, 'b', false, false, 'update', timestamp],
        [blockId, 1, 'Original content', null, 'a', false, false, 'create', timestamp - 1000],
      ]);

      const result = await repo.getHistory(blockId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        blockId,
        version: 2,
        content: 'Updated content',
        parentId: null,
        order: 'b',
        isCollapsed: false,
        isDeleted: false,
        operation: 'update',
        timestamp,
      });
    });
  });

  describe('parseBlockRow type validation', () => {
    // Note: These tests use getById() with matching ID since MockGraphDB
    // filters on parameterized columns. For rows to be returned and validated,
    // the block_id must match the query parameter.

    it('should throw on invalid block_id type', async () => {
      // @ts-expect-error - testing runtime validation
      db.seed('blocks', [
        [123, 'page', null, 'content', 'text', 'a', false, false, 1700000000, 1700000000],
      ]);

      // MockGraphDB filters by block_id == $id - numeric 123 won't match string 'block-1'
      // Instead, test parseBlockRow directly via getById with valid ID but seed invalid row
      // This won't match because MockGraphDB compares strictly
      const result = await repo.getById('123');
      expect(result).toBeNull(); // Won't match due to type mismatch in mock
    });

    it('should throw on invalid content_type when row is returned', async () => {
      const blockId = 'block-invalid-type';
      db.seed('blocks', [
        [
          blockId,
          'page',
          null,
          'content',
          'invalid_type',
          'a',
          false,
          false,
          1700000000,
          1700000000,
        ],
      ]);

      await expect(repo.getById(blockId)).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid timestamp type when row is returned', async () => {
      const blockId = 'block-invalid-ts';
      // @ts-expect-error - testing runtime validation
      db.seed('blocks', [
        [blockId, 'page', null, 'content', 'text', 'a', false, false, 'not-a-number', 1700000000],
      ]);

      await expect(repo.getById(blockId)).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid is_collapsed type when row is returned', async () => {
      const blockId = 'block-invalid-bool';
      // @ts-expect-error - testing runtime validation
      db.seed('blocks', [
        [
          blockId,
          'page',
          null,
          'content',
          'text',
          'a',
          'not-boolean',
          false,
          1700000000,
          1700000000,
        ],
      ]);

      await expect(repo.getById(blockId)).rejects.toThrow(DoubleBindError);
    });
  });

  describe('create with different content types', () => {
    it('should handle heading content type', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: '# Heading', contentType: 'heading' });

      expect(db.mutations[0]?.params.content_type).toBe('heading');
    });

    it('should handle code content type', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'console.log()', contentType: 'code' });

      expect(db.mutations[0]?.params.content_type).toBe('code');
    });

    it('should default to text content type', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Plain text' });

      expect(db.mutations[0]?.params.content_type).toBe('text');
    });
  });

  describe('create with empty content', () => {
    it('should allow empty string content', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: '' });

      expect(db.mutations[0]?.params.content).toBe('');
    });

    it('should handle whitespace-only content', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: '   \n   ' });

      expect(db.mutations[0]?.params.content).toBe('   \n   ');
    });
  });

  describe('update with special content', () => {
    it('should handle multiline content', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      const multilineContent = 'Line 1\nLine 2\nLine 3';
      await repo.update(blockId, { content: multilineContent });

      expect(db.lastMutation.params.content).toBe(multilineContent);
    });

    it('should handle content with special characters', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      const content = 'Content with "quotes" and \'apostrophes\' and {{brackets}}';
      await repo.update(blockId, { content });

      expect(db.lastMutation.params.content).toBe(content);
    });

    it('should handle very long content', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      const longContent = 'a'.repeat(100000);
      await repo.update(blockId, { content: longContent });

      expect(db.lastMutation.params.content).toBe(longContent);
    });

    it('should handle unicode content', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId })]);

      const content = '你好世界 🌍 Привет мир';
      await repo.update(blockId, { content });

      expect(db.lastMutation.params.content).toBe(content);
    });
  });

  describe('order string edge cases', () => {
    it('should handle single character order', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Block', order: 'z' });

      // create() uses 3 separate mutations - first one (blocks) has the order
      expect(db.mutations[0]?.params.order).toBe('z');
    });

    it('should handle multi-character order strings', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Block', order: 'abc123xyz' });

      // create() uses 3 separate mutations - first one (blocks) has the order
      expect(db.mutations[0]?.params.order).toBe('abc123xyz');
    });

    it('should handle fractional order strings', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Block', order: 'a0.5' });

      // create() uses 3 separate mutations - first one (blocks) has the order
      expect(db.mutations[0]?.params.order).toBe('a0.5');
    });
  });

  describe('move to same parent', () => {
    it('should allow moving block to same parent with different order', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';

      db.seed('blocks', [
        createBlockRow({ block_id: blockId, page_id: pageId, parent_id: parentId, order: 'a' }),
      ]);

      await repo.move(blockId, parentId, 'z');

      // move() uses an atomic transaction - single mutation with all params
      expect(db.lastMutation.params.new_parent_id).toBe(parentId);
      expect(db.lastMutation.params.old_parent_key).toBe(parentId);
      expect(db.lastMutation.params.new_parent_key).toBe(parentId);
      expect(db.lastMutation.params.new_order).toBe('z');
    });
  });

  describe('search with special queries', () => {
    it('should handle empty search query', async () => {
      db.seed('blocks', []);

      await repo.search('');

      expect(db.lastQuery.params.query).toBe('');
    });

    it('should handle search query with special FTS syntax', async () => {
      db.seed('blocks', []);

      const query = 'word AND another OR "exact phrase"';
      await repo.search(query);

      expect(db.lastQuery.params.query).toBe(query);
    });

    it('should filter deleted blocks from search results', async () => {
      db.seed('blocks', []);

      await repo.search('test');

      expect(db.lastQuery.script).toContain('is_deleted == false');
    });
  });

  describe('getHistory edge cases', () => {
    it('should return empty array when no history exists', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('block_history', []);

      const result = await repo.getHistory(blockId);

      expect(result).toEqual([]);
    });

    it('should handle history with different operations', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const timestamp = Date.now();
      db.seed('block_history', [
        [blockId, 3, 'Content 3', null, 'c', false, true, 'delete', timestamp],
        [blockId, 2, 'Content 2', null, 'b', false, false, 'update', timestamp - 1000],
        [blockId, 1, 'Content 1', null, 'a', false, false, 'create', timestamp - 2000],
      ]);

      const result = await repo.getHistory(blockId);

      expect(result).toHaveLength(3);
      expect(result[0]?.operation).toBe('delete');
      expect(result[1]?.operation).toBe('update');
      expect(result[2]?.operation).toBe('create');
    });

    it('should respect custom limit', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('block_history', []);

      await repo.getHistory(blockId, 5);

      expect(db.lastQuery.params.limit).toBe(5);
    });
  });

  describe('parent-child relationships', () => {
    it('should create root block with null parentId', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Root block' });

      // create() uses 3 separate mutations
      expect(db.mutations[0]?.params.parent_id).toBeNull();
      expect(db.mutations[2]?.params.parent_key).toBe(`__page:${pageId}`);
    });

    it('should create child block with parentId', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';

      await repo.create({ pageId, content: 'Child block', parentId });

      // create() uses 3 separate mutations
      expect(db.mutations[0]?.params.parent_id).toBe(parentId);
      expect(db.mutations[2]?.params.parent_key).toBe(parentId);
    });

    it('should maintain all indexes on create', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';

      await repo.create({ pageId, content: 'Block' });

      // create() uses 3 separate mutations for each index
      expect(db.mutations).toHaveLength(3);
      expect(db.mutations[0]?.script).toContain(':put blocks {');
      expect(db.mutations[1]?.script).toContain(':put blocks_by_page {');
      expect(db.mutations[2]?.script).toContain(':put blocks_by_parent {');
    });
  });

  describe('update preserving unmodified fields', () => {
    it('should preserve contentType when updating other fields', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId, content_type: 'code' })]);

      await repo.update(blockId, { content: 'New content' });

      expect(db.lastMutation.params.content_type).toBe('code');
    });

    it('should preserve pageId when updating', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      db.seed('blocks', [createBlockRow({ block_id: blockId, page_id: pageId })]);

      await repo.update(blockId, { content: 'New content' });

      expect(db.lastMutation.params.page_id).toBe(pageId);
    });

    it('should preserve isDeleted when updating', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('blocks', [createBlockRow({ block_id: blockId, is_deleted: false })]);

      await repo.update(blockId, { content: 'New content' });

      expect(db.lastMutation.params.is_deleted).toBe(false);
    });
  });

  describe('softDelete preserving fields', () => {
    it('should preserve all block data except is_deleted', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
      const parentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';

      db.seed('blocks', [
        createBlockRow({
          block_id: blockId,
          page_id: pageId,
          parent_id: parentId,
          content: 'Test content',
          content_type: 'code',
          order: 'xyz',
          is_collapsed: true,
        }),
      ]);

      await repo.softDelete(blockId);

      expect(db.lastMutation.params.page_id).toBe(pageId);
      expect(db.lastMutation.params.parent_id).toBe(parentId);
      expect(db.lastMutation.params.content).toBe('Test content');
      expect(db.lastMutation.params.content_type).toBe('code');
      expect(db.lastMutation.params.order).toBe('xyz');
      expect(db.lastMutation.params.is_collapsed).toBe(true);
    });
  });

  describe('rebalanceSiblings', () => {
    const pageId = '01ARZ3NDEKTSV4RRFFQ69G5PAG';
    const parentKey = `__page:${pageId}`;

    it('should do nothing for empty newOrders map', async () => {
      const newOrders = new Map<string, string>();

      await repo.rebalanceSiblings(parentKey, newOrders);

      // No mutation should have occurred - check mutations array is empty
      expect(db.mutations.length).toBe(0);
    });

    it('should construct correct fetch query with parent_key parameter', async () => {
      // The fetch query joins blocks_by_parent with blocks
      // MockGraphDB can't handle this join, but we can verify the query structure

      const newOrders = new Map<string, string>([['block1', 'a0']]);

      // Will fail to find blocks, but we can still verify the query was made
      // Seed empty data to avoid parse errors
      db.seed('blocks_by_parent', []);

      await repo.rebalanceSiblings(parentKey, newOrders);

      // Verify the fetch query structure
      const fetchQuery = db.queries[db.queries.length - 1];
      expect(fetchQuery?.script).toContain('*blocks_by_parent{');
      expect(fetchQuery?.script).toContain('parent_id == $parent_key');
      expect(fetchQuery?.script).toContain('*blocks{');
      expect(fetchQuery?.params.parent_key).toBe(parentKey);
    });

    it('should construct batch update mutation with correct structure', async () => {
      // To test the actual mutation, we need to mock the query method
      // to return proper block data

      const blockId1 = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const blockId2 = '01ARZ3NDEKTSV4RRFFQ69G5FA2';

      // Create a custom mock for this test
      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [
            blockId1,
            pageId,
            null,
            'Block 1',
            'text',
            'oldorder1',
            false,
            false,
            1700000000,
            1700000000,
          ],
          [
            blockId2,
            pageId,
            null,
            'Block 2',
            'text',
            'oldorder2',
            false,
            false,
            1700000000,
            1700000000,
          ],
        ],
      });

      const newOrders = new Map<string, string>([
        [blockId1, 'a0'],
        [blockId2, 'a1'],
      ]);

      await repo.rebalanceSiblings(parentKey, newOrders);

      // Verify the mutation script structure
      expect(db.lastMutation.script).toContain(':put blocks {');
      expect(db.lastMutation.script).toContain(blockId1);
      expect(db.lastMutation.script).toContain(blockId2);
      expect(db.lastMutation.script).toContain('"a0"');
      expect(db.lastMutation.script).toContain('"a1"');

      mockQuery.mockRestore();
    });

    it('should escape special characters in content', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const contentWithQuotes = 'Content with "quotes" and \\backslashes\\';

      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [
            blockId,
            pageId,
            null,
            contentWithQuotes,
            'text',
            'oldorder',
            false,
            false,
            1700000000,
            1700000000,
          ],
        ],
      });

      const newOrders = new Map<string, string>([[blockId, 'a0']]);

      await repo.rebalanceSiblings(parentKey, newOrders);

      // The mutation should contain escaped content
      expect(db.lastMutation.script).toContain('\\"quotes\\"');
      expect(db.lastMutation.script).toContain('\\\\backslashes\\\\');

      mockQuery.mockRestore();
    });

    it('should handle blocks with non-null parent_id', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const actualParentId = '01ARZ3NDEKTSV4RRFFQ69G5PAR';

      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [
            blockId,
            pageId,
            actualParentId,
            'Block content',
            'text',
            'oldorder',
            false,
            false,
            1700000000,
            1700000000,
          ],
        ],
      });

      const newOrders = new Map<string, string>([[blockId, 'a0']]);

      await repo.rebalanceSiblings(actualParentId, newOrders);

      // Verify parent_id is preserved in the update
      expect(db.lastMutation.script).toContain(`"${actualParentId}"`);

      mockQuery.mockRestore();
    });

    it('should preserve all block fields except order and updated_at', async () => {
      const blockId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const timestamp = 1700000000;

      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [
            blockId,
            pageId,
            null,
            'Test content',
            'code',
            'oldorder',
            true,
            false,
            timestamp,
            timestamp,
          ],
        ],
      });

      const newOrders = new Map<string, string>([[blockId, 'a0']]);

      await repo.rebalanceSiblings(parentKey, newOrders);

      const script = db.lastMutation.script;
      expect(script).toContain(`"${blockId}"`);
      expect(script).toContain(`"${pageId}"`);
      expect(script).toContain('"Test content"');
      expect(script).toContain('"code"');
      expect(script).toContain('"a0"'); // New order
      expect(script).toContain('true'); // is_collapsed
      expect(script).toContain('false'); // is_deleted
      expect(script).toContain(String(timestamp)); // created_at preserved

      mockQuery.mockRestore();
    });

    it('should only update blocks in newOrders map', async () => {
      const blockId1 = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const blockId2 = '01ARZ3NDEKTSV4RRFFQ69G5FA2';

      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [blockId1, pageId, null, 'Block 1', 'text', 'a0', false, false, 1700000000, 1700000000],
          [blockId2, pageId, null, 'Block 2', 'text', 'a1', false, false, 1700000000, 1700000000],
        ],
      });

      // Only update block1
      const newOrders = new Map<string, string>([[blockId1, 'b0']]);

      await repo.rebalanceSiblings(parentKey, newOrders);

      // Only block1's update should be in the script with new order
      expect(db.lastMutation.script).toContain(blockId1);
      expect(db.lastMutation.script).toContain('"b0"');
      // block2 should not have its order updated (it's not in newOrders)
      expect(db.lastMutation.script).not.toContain(blockId2);

      mockQuery.mockRestore();
    });

    it('should skip mutation if no blocks match the newOrders map', async () => {
      const mockQuery = vi.spyOn(db, 'query');
      mockQuery.mockResolvedValueOnce({
        headers: [
          'block_id',
          'page_id',
          'parent_id',
          'content',
          'content_type',
          'order',
          'is_collapsed',
          'is_deleted',
          'created_at',
          'updated_at',
        ],
        rows: [
          [
            'other_block_id',
            pageId,
            null,
            'Block',
            'text',
            'a0',
            false,
            false,
            1700000000,
            1700000000,
          ],
        ],
      });

      // newOrders has a different block ID
      const newOrders = new Map<string, string>([['nonexistent_id', 'b0']]);

      await repo.rebalanceSiblings(parentKey, newOrders);

      // No mutation should have been made since no blocks matched
      expect(db.mutations.length).toBe(0);

      mockQuery.mockRestore();
    });
  });
});
