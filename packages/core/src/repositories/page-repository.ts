/**
 * PageRepository - Encapsulates all Datalog queries for Page entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 */

import { ulid } from 'ulid';
import type { GraphDB, Page, PageId, CreatePageInput } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

/** Database row type for pages relation */
type PageRow = [string, string, number, number, boolean, string | null];

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
 * All methods use parameterized Datalog queries for security.
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    page_id == $id,
    is_deleted == false
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date }
:order -updated_at
:limit $limit
:offset $offset
`.trim();
    } else {
      script = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    is_deleted == false
:order -updated_at
:limit $limit
:offset $offset
`.trim();
    }

    const result = await this.db.query(script, { limit, offset });

    return result.rows.map((row) => this.rowToPage(row as PageRow));
  }

  /**
   * Full-text search on page titles.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of pages matching the search, sorted by relevance score
   */
  async search(query: string, limit = 50): Promise<Page[]> {
    const script = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date, score] :=
    ~pages:fts{ page_id, title | query: $query, k: $limit, bind_score: score },
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    is_deleted == false
:order -score
`.trim();

    const result = await this.db.query(script, { query, limit });

    // Map rows to Pages (excluding the score column at index 6)
    return result.rows.map((row) => {
      const pageRow = row.slice(0, 6) as PageRow;
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
    [$id, $title, $now, $now, false, $daily_date]
]
:put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }
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
   * applies the updates, and writes back the full record.
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
    [$id, $title, $created_at, $now, $is_deleted, $daily_date]
]
:put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }
`.trim();

    await this.db.mutate(script, {
      id: pageId,
      title: newTitle,
      created_at: existing.createdAt,
      now,
      is_deleted: existing.isDeleted,
      daily_date: newDailyNoteDate,
    });
  }

  /**
   * Soft-delete a page by setting is_deleted = true.
   *
   * @param pageId - The page to delete
   * @throws DoubleBindError if page not found
   */
  async softDelete(pageId: PageId): Promise<void> {
    // First, read the existing page to get all fields
    const existing = await this.getById(pageId);
    if (!existing) {
      throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
    }

    const now = Date.now();

    const script = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
    [$id, $title, $created_at, $now, true, $daily_date]
]
:put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }
`.trim();

    await this.db.mutate(script, {
      id: pageId,
      title: existing.title,
      created_at: existing.createdAt,
      now,
      daily_date: existing.dailyNoteDate,
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    title == $title,
    is_deleted == false
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted, daily_note_date },
    lowercase(title) == lowercase($title),
    is_deleted == false
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
    // First query the daily_notes lookup relation
    const lookupScript = `
?[page_id] :=
    *daily_notes{ date, page_id },
    date == $date
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
   * and registers it in the daily_notes lookup relation.
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

    // Register in daily_notes lookup relation
    const registerScript = `
?[date, page_id] <- [[$date, $page_id]]
:put daily_notes { date, page_id }
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
   *
   * @param row - Database row tuple
   * @returns Page domain object
   */
  private rowToPage(row: PageRow): Page {
    const [pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] = row;

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
    if (typeof isDeleted !== 'boolean') {
      throw new DoubleBindError(
        'Invalid is_deleted type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (dailyNoteDate !== null && typeof dailyNoteDate !== 'string') {
      throw new DoubleBindError(
        'Invalid daily_note_date type in database row',
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
