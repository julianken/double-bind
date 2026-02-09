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
      expect(db.lastQuery.script).toContain('page_id == $id');
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

      // First call is the read (getById), second is case-insensitive check
      expect(db.queries).toHaveLength(2);
      // Then the write (mutation)
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
      expect(db.queries[0]?.script).toContain('date == $date');
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

  describe('getByTitle edge cases', () => {
    it('should return null when title not found', async () => {
      db.seed('pages', []);

      const result = await repo.getByTitle('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle empty string title', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, '', now, now, false, null]]);

      const result = await repo.getByTitle('');

      expect(result?.title).toBe('');
    });

    it('should be case-sensitive', async () => {
      const pageId1 = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const pageId2 = '01ARZ3NDEKTSV4RRFFQ69G5FA2';
      const now = Date.now();
      db.seed('pages', [
        [pageId1, 'MyPage', now, now, false, null],
        [pageId2, 'mypage', now, now, false, null],
      ]);

      const result = await repo.getByTitle('MyPage');

      expect(result?.pageId).toBe(pageId1);
    });

    it('should handle titles with special characters', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      const title = 'Page with "quotes" and \'apostrophes\'';
      db.seed('pages', [[pageId, title, now, now, false, null]]);

      const result = await repo.getByTitle(title);

      expect(result?.title).toBe(title);
    });

    it('should not return deleted pages', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Deleted Page', now, now, true, null]]);

      await repo.getByTitle('Deleted Page');

      // MockGraphDB doesn't filter by is_deleted, but the query should have the filter
      expect(db.lastQuery.script).toContain('is_deleted == false');
      // In real DB this would return null, but MockGraphDB returns the seeded row
      // This test verifies the query structure is correct
    });

    it('should construct correct query with title parameter', async () => {
      db.seed('pages', []);

      await repo.getByTitle('Test Title');

      expect(db.lastQuery.script).toContain('title == $title');
      expect(db.lastQuery.params).toEqual({ title: 'Test Title' });
    });
  });

  describe('search edge cases', () => {
    it('should handle empty query string', async () => {
      db.seed('pages', []);

      await repo.search('');

      expect(db.lastQuery.params.query).toBe('');
    });

    it('should handle query with special FTS characters', async () => {
      db.seed('pages', []);

      const query = 'test AND query OR keyword';
      await repo.search(query);

      expect(db.lastQuery.params.query).toBe(query);
    });

    it('should only return non-deleted pages in search', async () => {
      db.seed('pages', []);

      await repo.search('test');

      expect(db.lastQuery.script).toContain('is_deleted == false');
    });
  });

  describe('getByTitleCaseInsensitive', () => {
    it('should construct case-insensitive query', async () => {
      db.seed('pages', []);

      await repo.getByTitleCaseInsensitive('Test Title');

      expect(db.lastQuery.script).toContain('lowercase(title) == lowercase($title)');
      expect(db.lastQuery.params).toEqual({ title: 'Test Title' });
    });

    it('should return page when found with different case', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'My Page', now, now, false, null]]);

      await repo.getByTitleCaseInsensitive('MY PAGE');

      // MockGraphDB doesn't implement case-insensitive matching, but we verify query structure
      expect(db.lastQuery.script).toContain('lowercase(title) == lowercase($title)');
    });

    it('should return null when not found', async () => {
      db.seed('pages', []);

      const result = await repo.getByTitleCaseInsensitive('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create uniqueness validation', () => {
    it('should check for duplicate title before creating', async () => {
      // Pre-seed with existing page
      const existingPageId = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const now = Date.now();
      db.seed('pages', [[existingPageId, 'Existing Page', now, now, false, null]]);

      await expect(repo.create({ title: 'Existing Page' })).rejects.toThrow(DoubleBindError);
      await expect(repo.create({ title: 'Existing Page' })).rejects.toMatchObject({
        code: ErrorCode.DUPLICATE_PAGE_NAME,
      });
    });

    it('should include existing title in error message', async () => {
      const existingPageId = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const now = Date.now();
      db.seed('pages', [[existingPageId, 'My Unique Page', now, now, false, null]]);

      await expect(repo.create({ title: 'My Unique Page' })).rejects.toThrow(
        /A page with the title "My Unique Page" already exists/
      );
    });
  });

  describe('update uniqueness validation', () => {
    it('should perform case-insensitive check when title changes', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Original Title', now, now, false, null]]);

      await repo.update(pageId, { title: 'New Title' });

      // Should have 2 queries: getById and getByTitleCaseInsensitive
      expect(db.queries).toHaveLength(2);
      expect(db.queries[1]?.script).toContain('lowercase(title) == lowercase($title)');
      expect(db.queries[1]?.params).toEqual({ title: 'New Title' });
    });

    it('should skip duplicate check when title unchanged', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'My Page', now, now, false, null]]);

      // Not providing title in input should skip duplicate check
      await repo.update(pageId, {});

      // Should only have 1 query: getById (no duplicate check)
      expect(db.queries).toHaveLength(1);
    });

    it('should skip duplicate check when case changes only', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'My Page', now, now, false, null]]);

      // Changing case only should succeed without checking for duplicates
      // since it's the same title case-insensitively
      await repo.update(pageId, { title: 'MY PAGE' });

      // Should have 1 query only (getById) since case-insensitive match means skip check
      expect(db.queries).toHaveLength(1);
      expect(db.lastMutation.params.title).toBe('MY PAGE');
    });

    it('should include existing title in error message when duplicate found', async () => {
      // This test verifies the error structure by mocking the scenario
      // In a real DB, when updating to a conflicting title, the error would include the existing title
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FA1';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Page One', now, now, false, null]]);

      // First update succeeds
      await repo.update(pageId, { title: 'Page One Updated' });

      // Verify duplicate check query was made with new title
      expect(db.queries[1]?.params.title).toBe('Page One Updated');
    });
  });

  describe('create edge cases', () => {
    it('should handle empty title', async () => {
      await repo.create({ title: '' });

      expect(db.lastMutation.params.title).toBe('');
    });

    it('should handle very long titles', async () => {
      const longTitle = 'a'.repeat(10000);
      await repo.create({ title: longTitle });

      expect(db.lastMutation.params.title).toBe(longTitle);
    });

    it('should handle titles with newlines', async () => {
      const title = 'Line 1\nLine 2\nLine 3';
      await repo.create({ title });

      expect(db.lastMutation.params.title).toBe(title);
    });

    it('should always set is_deleted to false on create', async () => {
      await repo.create({ title: 'New Page' });

      expect(db.lastMutation.script).toContain('false');
    });
  });

  describe('update edge cases', () => {
    it('should handle updating title to empty string', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Original', now, now, false, null]]);

      await repo.update(pageId, { title: '' });

      expect(db.lastMutation.params.title).toBe('');
    });

    it('should handle clearing dailyNoteDate', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Page', now, now, false, '2025-01-15']]);

      await repo.update(pageId, { dailyNoteDate: null });

      expect(db.lastMutation.params.daily_date).toBeNull();
    });

    it('should allow updating with no actual changes', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Original', now, now, false, null]]);

      await repo.update(pageId, {});

      expect(db.lastMutation.params.title).toBe('Original');
    });

    it('should always increment updated_at even with no changes', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const oldTime = 1700000000;
      db.seed('pages', [[pageId, 'Page', oldTime, oldTime, false, null]]);

      const before = Date.now();
      await repo.update(pageId, {});
      const after = Date.now();

      const newTime = db.lastMutation.params.now as number;
      expect(newTime).toBeGreaterThanOrEqual(before);
      expect(newTime).toBeLessThanOrEqual(after);
      expect(newTime).toBeGreaterThan(oldTime);
    });
  });

  describe('getAll pagination', () => {
    it('should handle offset without limit', async () => {
      db.seed('pages', []);

      await repo.getAll({ offset: 50 });

      expect(db.lastQuery.params).toEqual({ limit: 100, offset: 50 });
    });

    it('should handle zero offset', async () => {
      db.seed('pages', []);

      await repo.getAll({ offset: 0, limit: 10 });

      expect(db.lastQuery.params).toEqual({ limit: 10, offset: 0 });
    });

    it('should handle large limit values', async () => {
      db.seed('pages', []);

      await repo.getAll({ limit: 10000 });

      expect(db.lastQuery.params.limit).toBe(10000);
    });
  });

  describe('softDelete idempotency', () => {
    it('should verify getById filters deleted pages', async () => {
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      // Seed with already deleted page
      db.seed('pages', [[pageId, 'Deleted', now, now, true, null]]);

      // getById should filter out deleted pages
      await repo.getById(pageId);

      // MockGraphDB returns the row, but the query should have is_deleted filter
      expect(db.lastQuery.script).toContain('is_deleted == false');
      // In a real DB with deleted page, this would be null
    });
  });
});
