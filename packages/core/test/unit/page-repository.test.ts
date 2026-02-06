/**
 * Unit tests for PageRepository
 *
 * These tests verify correct Datalog query construction and parameter passing
 * using MockGraphDB. They do NOT execute real Datalog queries - that's for
 * Layer 2 integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { PageRepository } from '../../src/repositories/page-repository.js';

describe('PageRepository', () => {
  let db: MockGraphDB;
  let repo: PageRepository;

  beforeEach(() => {
    db = new MockGraphDB();
    repo = new PageRepository(db);
  });

  describe('getById', () => {
    it('should construct correct parameterized query', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      db.seed('pages', [[pageId, 'Test Page', 1700000000, 1700000000, false, null]]);

      await repo.getById(pageId);

      expect(db.lastQuery.script).toContain('*pages{');
      expect(db.lastQuery.script).toContain('page_id: $id');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.params).toEqual({ id: pageId });
    });

    it('should return Page when found', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'My Page', now, now, false, null]]);

      const result = await repo.getById(pageId);

      expect(result).toEqual({
        pageId,
        title: 'My Page',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        dailyNoteDate: null,
      });
    });

    it('should return null when not found', async () => {
      db.seed('pages', []);

      const result = await repo.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle daily note date', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, '2025-01-15', now, now, false, '2025-01-15']]);

      const result = await repo.getById(pageId);

      expect(result?.dailyNoteDate).toBe('2025-01-15');
    });
  });

  describe('getAll', () => {
    it('should construct query with default options', async () => {
      db.seed('pages', []);

      await repo.getAll();

      expect(db.lastQuery.script).toContain('*pages{');
      expect(db.lastQuery.script).toContain('is_deleted == false');
      expect(db.lastQuery.script).toContain(':order -updated_at');
      expect(db.lastQuery.script).toContain(':limit $limit');
      expect(db.lastQuery.script).toContain(':offset $offset');
      expect(db.lastQuery.params).toEqual({ limit: 100, offset: 0 });
    });

    it('should accept custom limit and offset', async () => {
      db.seed('pages', []);

      await repo.getAll({ limit: 50, offset: 10 });

      expect(db.lastQuery.params).toEqual({ limit: 50, offset: 10 });
    });

    it('should include deleted pages when requested', async () => {
      db.seed('pages', []);

      await repo.getAll({ includeDeleted: true });

      // When includeDeleted is true, the query should NOT have is_deleted filter
      expect(db.lastQuery.script).not.toContain('is_deleted == false');
    });

    it('should return array of Pages', async () => {
      const now = Date.now();
      db.seed('pages', [
        ['page-1', 'Page One', now, now, false, null],
        ['page-2', 'Page Two', now, now, false, null],
      ]);

      const result = await repo.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe('Page One');
      expect(result[1]?.title).toBe('Page Two');
    });
  });

  describe('search', () => {
    it('should construct FTS query with parameters', async () => {
      db.seed('pages', []);

      await repo.search('test query');

      expect(db.lastQuery.script).toContain('~pages:fts{');
      expect(db.lastQuery.script).toContain('query: $query');
      expect(db.lastQuery.script).toContain('k: $limit');
      expect(db.lastQuery.script).toContain('bind_score: score');
      expect(db.lastQuery.script).toContain(':order -score');
      expect(db.lastQuery.params).toEqual({ query: 'test query', limit: 50 });
    });

    it('should accept custom limit', async () => {
      db.seed('pages', []);

      await repo.search('test', 25);

      expect(db.lastQuery.params).toEqual({ query: 'test', limit: 25 });
    });
  });

  describe('create', () => {
    it('should construct put mutation with ULID', async () => {
      await repo.create({ title: 'New Page' });

      expect(db.lastMutation.script).toContain(':put pages {');
      expect(db.lastMutation.script).toContain(
        'page_id, title, created_at, updated_at, is_deleted, daily_note_date'
      );
      expect(db.lastMutation.params.title).toBe('New Page');
      expect(db.lastMutation.params.daily_date).toBeNull();
      // Verify ULID format (26 chars, valid ULID chars)
      expect(db.lastMutation.params.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('should return generated page ID', async () => {
      const pageId = await repo.create({ title: 'New Page' });

      expect(pageId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(db.lastMutation.params.id).toBe(pageId);
    });

    it('should include daily note date when provided', async () => {
      await repo.create({ title: '2025-01-15', dailyNoteDate: '2025-01-15' });

      expect(db.lastMutation.params.daily_date).toBe('2025-01-15');
    });

    it('should set timestamps', async () => {
      const before = Date.now();
      await repo.create({ title: 'New Page' });
      const after = Date.now();

      const timestamp = db.lastMutation.params.now as number;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('update', () => {
    it('should perform read-modify-write', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Original Title', now, now, false, null]]);

      await repo.update(pageId, { title: 'Updated Title' });

      // First call should be the read (query)
      expect(db.queries).toHaveLength(1);
      // Second call should be the write (mutation)
      expect(db.mutations).toHaveLength(1);
      expect(db.lastMutation.params.title).toBe('Updated Title');
      expect(db.lastMutation.params.created_at).toBe(now);
    });

    it('should throw PAGE_NOT_FOUND if page does not exist', async () => {
      db.seed('pages', []);

      await expect(repo.update('nonexistent', { title: 'New' })).rejects.toThrow(DoubleBindError);
      await expect(repo.update('nonexistent', { title: 'New' })).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should preserve existing fields when not updated', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const createdAt = 1700000000;
      db.seed('pages', [[pageId, 'Original', createdAt, createdAt, false, '2025-01-15']]);

      await repo.update(pageId, { title: 'Updated' });

      expect(db.lastMutation.params.daily_date).toBe('2025-01-15');
      expect(db.lastMutation.params.is_deleted).toBe(false);
    });

    it('should allow updating dailyNoteDate', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Page', now, now, false, null]]);

      await repo.update(pageId, { dailyNoteDate: '2025-01-20' });

      expect(db.lastMutation.params.daily_date).toBe('2025-01-20');
    });
  });

  describe('softDelete', () => {
    it('should set is_deleted to true', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'To Delete', now, now, false, null]]);

      await repo.softDelete(pageId);

      expect(db.lastMutation.script).toContain(':put pages {');
      // The mutation script should have is_deleted = true hardcoded
      expect(db.lastMutation.script).toContain('true');
    });

    it('should throw PAGE_NOT_FOUND if page does not exist', async () => {
      db.seed('pages', []);

      await expect(repo.softDelete('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(repo.softDelete('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should update timestamp on soft delete', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const oldTime = 1700000000;
      db.seed('pages', [[pageId, 'To Delete', oldTime, oldTime, false, null]]);

      const before = Date.now();
      await repo.softDelete(pageId);
      const after = Date.now();

      const newTime = db.lastMutation.params.now as number;
      expect(newTime).toBeGreaterThanOrEqual(before);
      expect(newTime).toBeLessThanOrEqual(after);
    });
  });

  describe('getByDailyNoteDate', () => {
    it('should query daily_notes relation first', async () => {
      db.seed('daily_notes', []);

      await repo.getByDailyNoteDate('2025-01-15');

      expect(db.queries[0]?.script).toContain('*daily_notes{');
      expect(db.queries[0]?.script).toContain('date: $date');
      expect(db.queries[0]?.params).toEqual({ date: '2025-01-15' });
    });

    it('should return null if no daily note exists', async () => {
      db.seed('daily_notes', []);

      const result = await repo.getByDailyNoteDate('2025-01-15');

      expect(result).toBeNull();
    });

    it('should return page when daily note exists', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('daily_notes', [['2025-01-15', pageId]]);
      db.seed('pages', [[pageId, '2025-01-15', now, now, false, '2025-01-15']]);

      const result = await repo.getByDailyNoteDate('2025-01-15');

      expect(result?.pageId).toBe(pageId);
      expect(result?.dailyNoteDate).toBe('2025-01-15');
    });
  });

  describe('getOrCreateDailyNote', () => {
    it('should return existing daily note without creating', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('daily_notes', [['2025-01-15', pageId]]);
      db.seed('pages', [[pageId, '2025-01-15', now, now, false, '2025-01-15']]);

      const result = await repo.getOrCreateDailyNote('2025-01-15');

      // Should have queries but no mutations
      expect(db.queries.length).toBeGreaterThan(0);
      expect(db.mutations).toHaveLength(0);
      expect(result.pageId).toBe(pageId);
    });

    it('should create page and register in daily_notes when not exists', async () => {
      db.seed('daily_notes', []);
      // After creation, the getById call needs data
      // MockGraphDB doesn't actually persist mutations, so we need to pre-seed
      // In real tests, we'd use integration tests for this behavior

      // For unit test, we verify the mutations are called correctly
      await expect(repo.getOrCreateDailyNote('2025-01-15')).rejects.toThrow();

      // Even though it fails (because mock doesn't persist), we can verify mutations
      expect(db.mutations.length).toBeGreaterThanOrEqual(1);
      // First mutation creates the page
      expect(db.mutations[0]?.script).toContain(':put pages {');
      expect(db.mutations[0]?.params.title).toBe('2025-01-15');
      expect(db.mutations[0]?.params.daily_date).toBe('2025-01-15');
    });

    it('should register new daily note in daily_notes relation', async () => {
      db.seed('daily_notes', []);

      // Will fail at getById after create, but we can still verify the mutation
      await expect(repo.getOrCreateDailyNote('2025-01-15')).rejects.toThrow();

      // Should have at least 2 mutations: create page and register daily note
      expect(db.mutations.length).toBeGreaterThanOrEqual(2);
      expect(db.mutations[1]?.script).toContain(':put daily_notes {');
      expect(db.mutations[1]?.params.date).toBe('2025-01-15');
    });
  });

  describe('rowToPage type validation', () => {
    // Note: These tests use getAll() since MockGraphDB's filtering mechanism
    // may skip rows that don't match the query parameter type exactly.
    // Using getAll() ensures the invalid row is returned and validated.

    it('should throw on invalid page_id type', async () => {
      // @ts-expect-error - testing runtime validation
      db.seed('pages', [[123, 'Title', 1700000000, 1700000000, false, null]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid title type', async () => {
      // @ts-expect-error - testing runtime validation
      db.seed('pages', [['page-1', null, 1700000000, 1700000000, false, null]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });

    it('should throw on invalid timestamp type', async () => {
      // @ts-expect-error - testing runtime validation
      db.seed('pages', [['page-1', 'Title', 'not-a-number', 1700000000, false, null]]);

      await expect(repo.getAll()).rejects.toThrow(DoubleBindError);
    });
  });
});
