// Integration tests for PageRepository against real CozoDB
// Validates baseline behavior before SQLite migration

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphDB } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { PageRepository } from '../../src/repositories/page-repository.js';

describe('PageRepository Integration Tests', () => {
  let db: GraphDB;
  let pageRepo: PageRepository;

  beforeEach(async () => {
    // Create fresh database with migrations applied
    db = await createTestDatabase();
    pageRepo = new PageRepository(db);
  });

  describe('create', () => {
    it('should create a new page with title', async () => {
      const pageId = await pageRepo.create({ title: 'Test Page' });

      expect(pageId).toBeDefined();
      expect(typeof pageId).toBe('string');

      const page = await pageRepo.getById(pageId);
      expect(page).toBeDefined();
      expect(page?.title).toBe('Test Page');
      expect(page?.isDeleted).toBe(false);
      expect(page?.dailyNoteDate).toBeNull();
    });

    it('should create a page with daily note date', async () => {
      const date = '2024-01-15';
      const pageId = await pageRepo.create({ title: date, dailyNoteDate: date });

      const page = await pageRepo.getById(pageId);
      expect(page).toBeDefined();
      expect(page?.title).toBe(date);
      expect(page?.dailyNoteDate).toBe(date);
    });

    it('should throw error for duplicate title (case-insensitive)', async () => {
      await pageRepo.create({ title: 'Duplicate Test' });

      await expect(pageRepo.create({ title: 'Duplicate Test' })).rejects.toThrow(
        DoubleBindError
      );
      await expect(pageRepo.create({ title: 'duplicate test' })).rejects.toThrow(
        DoubleBindError
      );
      await expect(pageRepo.create({ title: 'DUPLICATE TEST' })).rejects.toThrow(
        DoubleBindError
      );
    });

    it('should handle titles with special characters', async () => {
      const specialTitles = [
        'Title with [[wiki links]]',
        'Title with #tags',
        'Title with "quotes"',
        "Title with 'apostrophes'",
        'Title with $symbols & more!',
        'Title with 中文字符',
        'Title with émojis 🚀',
      ];

      for (const title of specialTitles) {
        const pageId = await pageRepo.create({ title });
        const page = await pageRepo.getById(pageId);
        expect(page?.title).toBe(title);
      }
    });

    it('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(1000);
      const pageId = await pageRepo.create({ title: longTitle });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe(longTitle);
      expect(page?.title.length).toBe(1000);
    });

    it('should set timestamps correctly on creation', async () => {
      const beforeCreate = Date.now();
      const pageId = await pageRepo.create({ title: 'Timestamp Test' });
      const afterCreate = Date.now();

      const page = await pageRepo.getById(pageId);
      expect(page).toBeDefined();
      expect(page!.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(page!.createdAt).toBeLessThanOrEqual(afterCreate);
      expect(page!.updatedAt).toBe(page!.createdAt);
    });
  });

  describe('getById', () => {
    it('should retrieve existing page by ID', async () => {
      const pageId = await pageRepo.create({ title: 'Find Me' });

      const page = await pageRepo.getById(pageId);
      expect(page).toBeDefined();
      expect(page?.pageId).toBe(pageId);
      expect(page?.title).toBe('Find Me');
    });

    it('should return null for non-existent page', async () => {
      const page = await pageRepo.getById('non-existent-id');
      expect(page).toBeNull();
    });

    it('should not return soft-deleted pages', async () => {
      const pageId = await pageRepo.create({ title: 'Deleted Page' });
      await pageRepo.softDelete(pageId);

      const page = await pageRepo.getById(pageId);
      expect(page).toBeNull();
    });
  });

  describe('getByTitle', () => {
    it('should retrieve page by exact title', async () => {
      await pageRepo.create({ title: 'Exact Title' });

      const page = await pageRepo.getByTitle('Exact Title');
      expect(page).toBeDefined();
      expect(page?.title).toBe('Exact Title');
    });

    it('should return null for non-existent title', async () => {
      const page = await pageRepo.getByTitle('Does Not Exist');
      expect(page).toBeNull();
    });

    it('should be case-sensitive for exact match', async () => {
      await pageRepo.create({ title: 'CaseSensitive' });

      const exactMatch = await pageRepo.getByTitle('CaseSensitive');
      expect(exactMatch).toBeDefined();

      const wrongCase = await pageRepo.getByTitle('casesensitive');
      expect(wrongCase).toBeNull();
    });
  });

  describe('getByTitleCaseInsensitive', () => {
    it('should retrieve page ignoring case', async () => {
      await pageRepo.create({ title: 'Mixed Case Title' });

      const lower = await pageRepo.getByTitleCaseInsensitive('mixed case title');
      expect(lower).toBeDefined();
      expect(lower?.title).toBe('Mixed Case Title');

      const upper = await pageRepo.getByTitleCaseInsensitive('MIXED CASE TITLE');
      expect(upper).toBeDefined();
      expect(upper?.title).toBe('Mixed Case Title');

      const mixed = await pageRepo.getByTitleCaseInsensitive('MiXeD cAsE tItLe');
      expect(mixed).toBeDefined();
      expect(mixed?.title).toBe('Mixed Case Title');
    });

    it('should return null for non-existent title', async () => {
      const page = await pageRepo.getByTitleCaseInsensitive('Does Not Exist');
      expect(page).toBeNull();
    });

    it('should handle unicode case folding', async () => {
      await pageRepo.create({ title: 'Café' });

      const lower = await pageRepo.getByTitleCaseInsensitive('café');
      expect(lower).toBeDefined();
      expect(lower?.title).toBe('Café');

      const upper = await pageRepo.getByTitleCaseInsensitive('CAFÉ');
      expect(upper).toBeDefined();
      expect(upper?.title).toBe('Café');
    });
  });

  describe('getOrCreateByTitle', () => {
    it('should return existing page if found', async () => {
      const firstId = await pageRepo.create({ title: 'Existing Page' });

      const page = await pageRepo.getOrCreateByTitle('Existing Page');
      expect(page.pageId).toBe(firstId);
      expect(page.title).toBe('Existing Page');

      // Verify only one page exists
      const allPages = await pageRepo.getAll();
      expect(allPages.length).toBe(1);
    });

    it('should create new page if not found', async () => {
      const page = await pageRepo.getOrCreateByTitle('New Page');
      expect(page).toBeDefined();
      expect(page.title).toBe('New Page');

      // Verify it was actually created
      const retrieved = await pageRepo.getById(page.pageId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.pageId).toBe(page.pageId);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no pages exist', async () => {
      const pages = await pageRepo.getAll();
      expect(pages).toEqual([]);
    });

    it('should return all non-deleted pages', async () => {
      await pageRepo.create({ title: 'Page 1' });
      await pageRepo.create({ title: 'Page 2' });
      await pageRepo.create({ title: 'Page 3' });

      const pages = await pageRepo.getAll();
      expect(pages.length).toBe(3);
    });

    it('should exclude soft-deleted pages by default', async () => {
      const id1 = await pageRepo.create({ title: 'Page 1' });
      await pageRepo.create({ title: 'Page 2' });
      await pageRepo.softDelete(id1);

      const pages = await pageRepo.getAll();
      expect(pages.length).toBe(1);
      expect(pages[0]?.title).toBe('Page 2');
    });

    it('should include deleted pages when requested', async () => {
      const id1 = await pageRepo.create({ title: 'Page 1' });
      await pageRepo.create({ title: 'Page 2' });
      await pageRepo.softDelete(id1);

      const pages = await pageRepo.getAll({ includeDeleted: true });
      expect(pages.length).toBe(2);
    });

    it('should respect limit parameter', async () => {
      await pageRepo.create({ title: 'Page 1' });
      await pageRepo.create({ title: 'Page 2' });
      await pageRepo.create({ title: 'Page 3' });
      await pageRepo.create({ title: 'Page 4' });
      await pageRepo.create({ title: 'Page 5' });

      const pages = await pageRepo.getAll({ limit: 3 });
      expect(pages.length).toBe(3);
    });

    it('should respect offset parameter', async () => {
      await pageRepo.create({ title: 'Page 1' });
      await pageRepo.create({ title: 'Page 2' });
      await pageRepo.create({ title: 'Page 3' });

      const pages = await pageRepo.getAll({ offset: 1, limit: 10 });
      expect(pages.length).toBe(2);
    });

    it('should paginate correctly', async () => {
      // Create 10 pages
      for (let i = 1; i <= 10; i++) {
        await pageRepo.create({ title: `Page ${i}` });
      }

      // Get first page (3 items)
      const page1 = await pageRepo.getAll({ limit: 3, offset: 0 });
      expect(page1.length).toBe(3);

      // Get second page (3 items)
      const page2 = await pageRepo.getAll({ limit: 3, offset: 3 });
      expect(page2.length).toBe(3);

      // Get third page (3 items)
      const page3 = await pageRepo.getAll({ limit: 3, offset: 6 });
      expect(page3.length).toBe(3);

      // Get fourth page (1 item remaining)
      const page4 = await pageRepo.getAll({ limit: 3, offset: 9 });
      expect(page4.length).toBe(1);

      // Verify no overlap
      const allIds = [...page1, ...page2, ...page3, ...page4].map((p) => p.pageId);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(10);
    });

    it('should sort by updated_at descending', async () => {
      // Create pages with delays to ensure different timestamps
      const id1 = await pageRepo.create({ title: 'First' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id2 = await pageRepo.create({ title: 'Second' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id3 = await pageRepo.create({ title: 'Third' });

      const pages = await pageRepo.getAll();
      expect(pages.length).toBe(3);

      // Most recent first
      expect(pages[0]?.pageId).toBe(id3);
      expect(pages[1]?.pageId).toBe(id2);
      expect(pages[2]?.pageId).toBe(id1);
    });
  });

  describe('update', () => {
    it('should update page title', async () => {
      const pageId = await pageRepo.create({ title: 'Original Title' });

      await pageRepo.update(pageId, { title: 'Updated Title' });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('Updated Title');
    });

    it('should update daily note date', async () => {
      const pageId = await pageRepo.create({ title: 'Test Page' });

      await pageRepo.update(pageId, { dailyNoteDate: '2024-01-15' });

      const page = await pageRepo.getById(pageId);
      expect(page?.dailyNoteDate).toBe('2024-01-15');
    });

    it('should update updated_at timestamp', async () => {
      const pageId = await pageRepo.create({ title: 'Test' });
      const originalPage = await pageRepo.getById(pageId);

      await new Promise((resolve) => setTimeout(resolve, 10));
      await pageRepo.update(pageId, { title: 'Updated' });

      const updatedPage = await pageRepo.getById(pageId);
      expect(updatedPage!.updatedAt).toBeGreaterThan(originalPage!.updatedAt);
    });

    it('should preserve created_at timestamp', async () => {
      const pageId = await pageRepo.create({ title: 'Test' });
      const originalPage = await pageRepo.getById(pageId);

      await pageRepo.update(pageId, { title: 'Updated' });

      const updatedPage = await pageRepo.getById(pageId);
      expect(updatedPage!.createdAt).toBe(originalPage!.createdAt);
    });

    it('should throw error for non-existent page', async () => {
      await expect(
        pageRepo.update('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow(DoubleBindError);
    });

    it('should throw error for duplicate title (case-insensitive)', async () => {
      const id1 = await pageRepo.create({ title: 'Page One' });
      await pageRepo.create({ title: 'Page Two' });

      await expect(pageRepo.update(id1, { title: 'Page Two' })).rejects.toThrow(
        DoubleBindError
      );
      await expect(pageRepo.update(id1, { title: 'page two' })).rejects.toThrow(
        DoubleBindError
      );
    });

    it('should allow updating to same title with different case', async () => {
      const pageId = await pageRepo.create({ title: 'Original' });

      await expect(pageRepo.update(pageId, { title: 'original' })).resolves.not.toThrow();

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('original');
    });

    it('should handle partial updates', async () => {
      const pageId = await pageRepo.create({ title: 'Test', dailyNoteDate: '2024-01-15' });

      // Update only title
      await pageRepo.update(pageId, { title: 'New Title' });
      let page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('New Title');
      expect(page?.dailyNoteDate).toBe('2024-01-15');

      // Update only daily note date
      await pageRepo.update(pageId, { dailyNoteDate: '2024-01-16' });
      page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('New Title');
      expect(page?.dailyNoteDate).toBe('2024-01-16');
    });
  });

  describe('softDelete', () => {
    it('should mark page as deleted', async () => {
      const pageId = await pageRepo.create({ title: 'To Delete' });

      await pageRepo.softDelete(pageId);

      // Should not be returned by getById
      const page = await pageRepo.getById(pageId);
      expect(page).toBeNull();

      // But should be included when requested
      const allPages = await pageRepo.getAll({ includeDeleted: true });
      const deletedPage = allPages.find((p) => p.pageId === pageId);
      expect(deletedPage).toBeDefined();
      expect(deletedPage?.isDeleted).toBe(true);
    });

    it('should update updated_at on soft delete', async () => {
      const pageId = await pageRepo.create({ title: 'Test' });
      const originalPage = await pageRepo.getById(pageId);

      await new Promise((resolve) => setTimeout(resolve, 10));
      await pageRepo.softDelete(pageId);

      const allPages = await pageRepo.getAll({ includeDeleted: true });
      const deletedPage = allPages.find((p) => p.pageId === pageId);
      expect(deletedPage!.updatedAt).toBeGreaterThan(originalPage!.updatedAt);
    });

    it('should throw error for non-existent page', async () => {
      await expect(pageRepo.softDelete('non-existent-id')).rejects.toThrow(DoubleBindError);
    });

    it('should throw error when trying to delete already deleted page', async () => {
      const pageId = await pageRepo.create({ title: 'Test' });
      await pageRepo.softDelete(pageId);

      await expect(pageRepo.softDelete(pageId)).rejects.toThrow(DoubleBindError);
    });
  });

  describe('getByDailyNoteDate', () => {
    it('should retrieve daily note by date', async () => {
      const date = '2024-01-15';
      const pageId = await pageRepo.create({ title: date, dailyNoteDate: date });

      // Register in daily_notes lookup
      await db.mutate(
        `?[date, page_id] <- [[$date, $page_id]]
         :put daily_notes { date, page_id }`,
        { date, page_id: pageId }
      );

      const page = await pageRepo.getByDailyNoteDate(date);
      expect(page).toBeDefined();
      expect(page?.pageId).toBe(pageId);
      expect(page?.dailyNoteDate).toBe(date);
    });

    it('should return null for non-existent date', async () => {
      const page = await pageRepo.getByDailyNoteDate('2024-01-15');
      expect(page).toBeNull();
    });
  });

  describe('getOrCreateDailyNote', () => {
    it('should return existing daily note if found', async () => {
      const date = '2024-01-15';
      const firstId = await pageRepo.create({ title: date, dailyNoteDate: date });

      // Register in daily_notes lookup
      await db.mutate(
        `?[date, page_id] <- [[$date, $page_id]]
         :put daily_notes { date, page_id }`,
        { date, page_id: firstId }
      );

      const page = await pageRepo.getOrCreateDailyNote(date);
      expect(page.pageId).toBe(firstId);

      // Verify only one page exists for this date
      const allPages = await pageRepo.getAll();
      const dailyNotes = allPages.filter((p) => p.dailyNoteDate === date);
      expect(dailyNotes.length).toBe(1);
    });

    it('should create new daily note if not found', async () => {
      const date = '2024-01-15';

      const page = await pageRepo.getOrCreateDailyNote(date);
      expect(page).toBeDefined();
      expect(page.title).toBe(date);
      expect(page.dailyNoteDate).toBe(date);

      // Verify it was registered in daily_notes lookup
      const retrieved = await pageRepo.getByDailyNoteDate(date);
      expect(retrieved).toBeDefined();
      expect(retrieved?.pageId).toBe(page.pageId);
    });

    it('should handle multiple daily notes for different dates', async () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';
      const date3 = '2024-01-17';

      const page1 = await pageRepo.getOrCreateDailyNote(date1);
      const page2 = await pageRepo.getOrCreateDailyNote(date2);
      const page3 = await pageRepo.getOrCreateDailyNote(date3);

      expect(page1.pageId).not.toBe(page2.pageId);
      expect(page2.pageId).not.toBe(page3.pageId);
      expect(page1.pageId).not.toBe(page3.pageId);

      // Verify each can be retrieved
      const retrieved1 = await pageRepo.getByDailyNoteDate(date1);
      const retrieved2 = await pageRepo.getByDailyNoteDate(date2);
      const retrieved3 = await pageRepo.getByDailyNoteDate(date3);

      expect(retrieved1?.pageId).toBe(page1.pageId);
      expect(retrieved2?.pageId).toBe(page2.pageId);
      expect(retrieved3?.pageId).toBe(page3.pageId);
    });

    it('should create daily note with correct format', async () => {
      const date = '2024-12-31';

      const page = await pageRepo.getOrCreateDailyNote(date);

      expect(page.title).toBe(date);
      expect(page.dailyNoteDate).toBe(date);
      expect(page.isDeleted).toBe(false);
      expect(page.createdAt).toBeDefined();
      expect(page.updatedAt).toBeDefined();
    });
  });

  describe('search', () => {
    it('should find pages by title search', async () => {
      await pageRepo.create({ title: 'Getting Started Guide' });
      await pageRepo.create({ title: 'Advanced Topics' });
      await pageRepo.create({ title: 'Getting Things Done' });

      const results = await pageRepo.search('Getting');
      expect(results.length).toBe(2);

      const titles = results.map((p) => p.title);
      expect(titles).toContain('Getting Started Guide');
      expect(titles).toContain('Getting Things Done');
    });

    it('should return empty array for no matches', async () => {
      await pageRepo.create({ title: 'Test Page' });

      const results = await pageRepo.search('NonExistent');
      expect(results).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      for (let i = 1; i <= 10; i++) {
        await pageRepo.create({ title: `Test Page ${i}` });
      }

      const results = await pageRepo.search('Test', 5);
      expect(results.length).toBe(5);
    });

    it('should exclude deleted pages from search', async () => {
      const id1 = await pageRepo.create({ title: 'Searchable Page' });
      await pageRepo.create({ title: 'Another Searchable' });
      await pageRepo.softDelete(id1);

      const results = await pageRepo.search('Searchable');
      expect(results.length).toBe(1);
      expect(results[0]?.title).toBe('Another Searchable');
    });
  });

  describe('edge cases', () => {
    it('should handle empty title', async () => {
      const pageId = await pageRepo.create({ title: '' });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('');
    });

    it('should handle whitespace-only title', async () => {
      const pageId = await pageRepo.create({ title: '   ' });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe('   ');
    });

    it('should handle title with newlines', async () => {
      const titleWithNewlines = 'Line 1\nLine 2\nLine 3';
      const pageId = await pageRepo.create({ title: titleWithNewlines });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe(titleWithNewlines);
    });

    it('should handle title with tabs', async () => {
      const titleWithTabs = 'Column1\tColumn2\tColumn3';
      const pageId = await pageRepo.create({ title: titleWithTabs });

      const page = await pageRepo.getById(pageId);
      expect(page?.title).toBe(titleWithTabs);
    });

    it('should detect duplicate title on sequential creates', async () => {
      // Create first page
      await pageRepo.create({ title: 'Sequential Page' });

      // Attempting to create second page with same title should fail
      await expect(pageRepo.create({ title: 'Sequential Page' })).rejects.toThrow(
        DoubleBindError
      );

      // Verify only one page was created
      const allPages = await pageRepo.getAll();
      const sequentialPages = allPages.filter((p) => p.title === 'Sequential Page');
      expect(sequentialPages.length).toBe(1);
    });

    it('should handle concurrent creates (race condition exists)', async () => {
      // Note: This test documents that concurrent creates can result in duplicates
      // due to race conditions in the check-then-create pattern.
      // This is expected behavior with CozoDB and will be addressed in SQLite migration.

      const results = await Promise.allSettled([
        pageRepo.create({ title: 'Concurrent Page' }),
        pageRepo.create({ title: 'Concurrent Page' }),
        pageRepo.create({ title: 'Concurrent Page' }),
      ]);

      // Some creates may succeed due to race condition
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // At least one should succeed, but race conditions may allow multiple
      expect(succeeded.length).toBeGreaterThanOrEqual(1);

      // Total should be 3
      expect(succeeded.length + failed.length).toBe(3);
    });
  });
});
