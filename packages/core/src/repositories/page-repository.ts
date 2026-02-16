/**
 * PageRepository - Encapsulates all SQL queries for Page entities.
 *
 * Each method constructs parameterized SQL queries that are executed
 * against SQLite. User data never enters the query string directly;
 * all values are passed as named parameters.
 *
 * Key patterns:
 * - Booleans stored as 0/1 integers; validation handles conversion
 * - Case-insensitive matching uses LOWER() function
 * - Soft-delete pattern (is_deleted = 0/1) instead of physical deletion
 * - Daily notes use a separate lookup table (daily_notes)
 */

import { ulid } from 'ulid';
import type { GraphDB, Page, PageId, CreatePageInput } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

/** Database row type for pages relation (SQLite returns 0/1 for booleans) */
type PageRow = [string, string, number, number, number | boolean, string | null];

/**
 * Options for listing pages.
 */
export interface GetAllOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Repository for Page entity operations.
 * All methods use parameterized SQL queries for security.
 */
export class PageRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get a page by its ID.
   *
   * @param pageId - The page identifier (ULID)
   * @returns The page if found, null otherwise
   */
  async getById(pageId: PageId): Promise<Page | null> {
    const script = `
SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
FROM pages
WHERE page_id = $id AND is_deleted = 0
`.trim();

    const result = await this.db.query(script, { id: pageId });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as PageRow;
    return this.rowToPage(row);
  }

  /**
   * List all pages (non-deleted by default).
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of pages sorted by updated_at descending
   */
  async getAll(options: GetAllOptions = {}): Promise<Page[]> {
    const { includeDeleted = false, limit = 100, offset = 0 } = options;

    let script: string;

    if (includeDeleted) {
      script = `
SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
FROM pages
ORDER BY updated_at DESC
LIMIT $limit OFFSET $offset
`.trim();
    } else {
      script = `
SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
FROM pages
WHERE is_deleted = 0
ORDER BY updated_at DESC
LIMIT $limit OFFSET $offset
`.trim();
    }

    const result = await this.db.query(script, { limit, offset });

    return result.rows.map((row) => this.rowToPage(row as PageRow));
  }

  /**
   * Full-text search on page titles.
   *
   * Uses FTS5 for full-text search. The pages_fts table is kept in sync
   * via triggers defined in the schema migration.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of pages matching the search, sorted by relevance score
   */
  async search(query: string, limit = 50): Promise<Page[]> {
    const script = `
SELECT p.page_id, p.title, p.created_at, p.updated_at, p.is_deleted, p.daily_note_date
FROM pages_fts fts
JOIN pages p ON p.page_id = fts.page_id
WHERE pages_fts MATCH $query
  AND p.is_deleted = 0
ORDER BY rank
LIMIT $limit
`.trim();

    const result = await this.db.query(script, { query, limit });

    return result.rows.map((row) => {
      const pageRow = row as PageRow;
      return this.rowToPage(pageRow);
    });
  }

  /**
   * Create a new page.
   *
   * @param input - Page creation input (title, optional dailyNoteDate)
   * @returns The ID of the newly created page
   * @throws DoubleBindError with DUPLICATE_PAGE_NAME if a page with the same title exists (case-insensitive)
   */
  async create(input: CreatePageInput): Promise<PageId> {
    // Check for duplicate title (case-insensitive)
    const existing = await this.getByTitleCaseInsensitive(input.title);
    if (existing) {
      throw new DoubleBindError(
        `A page with the title "${existing.title}" already exists`,
        ErrorCode.DUPLICATE_PAGE_NAME
      );
    }

    const pageId = ulid();
    const now = Date.now();
    const dailyNoteDate = input.dailyNoteDate ?? null;

    const script = `
INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
VALUES ($id, $title, $now, $now, 0, $daily_date)
`.trim();

    await this.db.mutate(script, {
      id: pageId,
      title: input.title,
      now,
      daily_date: dailyNoteDate,
    });

    return pageId;
  }

  /**
   * Update an existing page.
   *
   * This is a read-modify-write operation: it reads the current state,
   * applies the updates, and writes back the changed fields.
   *
   * @param pageId - The page to update
   * @param input - Partial page data to update
   * @throws DoubleBindError if page not found
   * @throws DoubleBindError with DUPLICATE_PAGE_NAME if title conflicts with another page (case-insensitive)
   */
  async update(
    pageId: PageId,
    input: Partial<Pick<Page, 'title' | 'dailyNoteDate'>>
  ): Promise<void> {
    // First, read the existing page
    const existing = await this.getById(pageId);
    if (!existing) {
      throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
    }

    const now = Date.now();
    const newTitle = input.title ?? existing.title;
    const newDailyNoteDate =
      input.dailyNoteDate !== undefined ? input.dailyNoteDate : existing.dailyNoteDate;

    // Check for duplicate title if title is being changed
    if (input.title !== undefined && input.title.toLowerCase() !== existing.title.toLowerCase()) {
      const duplicate = await this.getByTitleCaseInsensitive(input.title);
      if (duplicate && duplicate.pageId !== pageId) {
        throw new DoubleBindError(
          `A page with the title "${duplicate.title}" already exists`,
          ErrorCode.DUPLICATE_PAGE_NAME
        );
      }
    }

    const script = `
UPDATE pages
SET title = $title,
    daily_note_date = $daily_date,
    updated_at = $now
WHERE page_id = $id
`.trim();

    await this.db.mutate(script, {
      id: pageId,
      title: newTitle,
      daily_date: newDailyNoteDate,
      now,
    });
  }

  /**
   * Soft-delete a page by setting is_deleted = 1.
   *
   * @param pageId - The page to delete
   * @throws DoubleBindError if page not found
   */
  async softDelete(pageId: PageId): Promise<void> {
    // First, read the existing page to verify it exists
    const existing = await this.getById(pageId);
    if (!existing) {
      throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
    }

    const now = Date.now();

    const script = `
UPDATE pages
SET is_deleted = 1, updated_at = $now
WHERE page_id = $id
`.trim();

    await this.db.mutate(script, {
      id: pageId,
      now,
    });
  }

  /**
   * Get a page by its exact title.
   *
   * @param title - The page title to look up
   * @returns The page if found, null otherwise
   */
  async getByTitle(title: string): Promise<Page | null> {
    const script = `
SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
FROM pages
WHERE title = $title AND is_deleted = 0
`.trim();

    const result = await this.db.query(script, { title });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as PageRow;
    return this.rowToPage(row);
  }

  /**
   * Get a page by title (case-insensitive match).
   *
   * @param title - The page title to look up (case-insensitive)
   * @returns The page if found, null otherwise
   */
  async getByTitleCaseInsensitive(title: string): Promise<Page | null> {
    const script = `
SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
FROM pages
WHERE LOWER(title) = LOWER($title) AND is_deleted = 0
`.trim();

    const result = await this.db.query(script, { title });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as PageRow;
    return this.rowToPage(row);
  }

  /**
   * Get a page by title, or create it if it doesn't exist.
   *
   * @param title - The page title to look up or create
   * @returns The existing or newly created page
   */
  async getOrCreateByTitle(title: string): Promise<Page> {
    // Check if page already exists
    const existing = await this.getByTitle(title);
    if (existing) {
      return existing;
    }

    // Create new page with title
    const pageId = await this.create({ title });

    // Return the newly created page
    const page = await this.getById(pageId);
    if (!page) {
      throw new DoubleBindError(
        `Failed to retrieve created page: ${pageId}`,
        ErrorCode.DB_QUERY_FAILED
      );
    }

    return page;
  }

  /**
   * Get a page by its daily note date.
   *
   * @param date - The date in YYYY-MM-DD format
   * @returns The daily note page if found, null otherwise
   */
  async getByDailyNoteDate(date: string): Promise<Page | null> {
    // Query the daily_notes lookup table
    const lookupScript = `
SELECT page_id FROM daily_notes WHERE date = $date
`.trim();

    const lookupResult = await this.db.query(lookupScript, { date });

    if (lookupResult.rows.length === 0) {
      return null;
    }

    const row = lookupResult.rows[0] as [string];
    const pageId = row[0];

    // Then get the full page data
    return this.getById(pageId);
  }

  /**
   * Get or create a daily note for the specified date.
   *
   * If a daily note already exists for the date, returns it.
   * Otherwise, creates a new page with the date as the title
   * and registers it in the daily_notes lookup table.
   *
   * @param date - The date in YYYY-MM-DD format
   * @returns The daily note page (existing or newly created)
   */
  async getOrCreateDailyNote(date: string): Promise<Page> {
    // Check if daily note already exists
    const existing = await this.getByDailyNoteDate(date);
    if (existing) {
      return existing;
    }

    // Create new page with date as title
    const pageId = await this.create({
      title: date,
      dailyNoteDate: date,
    });

    // Register in daily_notes lookup table
    const registerScript = `
INSERT INTO daily_notes (date, page_id) VALUES ($date, $page_id)
`.trim();

    await this.db.mutate(registerScript, {
      date,
      page_id: pageId,
    });

    // Return the newly created page
    const page = await this.getById(pageId);
    if (!page) {
      throw new DoubleBindError(
        `Failed to retrieve created daily note: ${pageId}`,
        ErrorCode.DB_QUERY_FAILED
      );
    }

    return page;
  }

  /**
   * Convert a database row to a Page object.
   * Handles both boolean and integer (0/1) values for is_deleted.
   *
   * @param row - Database row tuple
   * @returns Page domain object
   */
  private rowToPage(row: PageRow): Page {
    const [pageId, title, createdAt, updatedAt, isDeletedRaw, dailyNoteDate] = row;

    // Simple type validation
    if (typeof pageId !== 'string') {
      throw new DoubleBindError('Invalid page_id type in database row', ErrorCode.DB_QUERY_FAILED);
    }
    if (typeof title !== 'string') {
      throw new DoubleBindError('Invalid title type in database row', ErrorCode.DB_QUERY_FAILED);
    }
    if (typeof createdAt !== 'number') {
      throw new DoubleBindError(
        'Invalid created_at type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (typeof updatedAt !== 'number') {
      throw new DoubleBindError(
        'Invalid updated_at type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (dailyNoteDate !== null && typeof dailyNoteDate !== 'string') {
      throw new DoubleBindError(
        'Invalid daily_note_date type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }

    // Handle both boolean and integer (0/1) for is_deleted
    let isDeleted: boolean;
    if (typeof isDeletedRaw === 'boolean') {
      isDeleted = isDeletedRaw;
    } else if (typeof isDeletedRaw === 'number') {
      isDeleted = isDeletedRaw !== 0;
    } else {
      throw new DoubleBindError(
        'Invalid is_deleted type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }

    return {
      pageId,
      title,
      createdAt,
      updatedAt,
      isDeleted,
      dailyNoteDate,
    };
  }
}
