/**
 * PageService - Orchestrates page operations with cross-cutting concerns.
 *
 * This service layer sits above the repositories and handles:
 * - Cascading operations (e.g., deleting page + all its blocks)
 * - Daily note management
 * - Composite queries (e.g., page with blocks)
 *
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
 */

import type { Page, Block, PageId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { PageRepository } from '../repositories/page-repository.js';
import type { BlockRepository } from '../repositories/block-repository.js';
import type { LinkRepository } from '../repositories/link-repository.js';

/**
 * Result type for getPageWithBlocks operation.
 */
export interface PageWithBlocks {
  page: Page;
  blocks: Block[];
}

/**
 * Service for high-level page operations.
 *
 * Orchestrates PageRepository, BlockRepository, and LinkRepository
 * to provide cross-cutting operations like cascading deletes.
 */
export class PageService {
  // LinkRepository is stored for future link-related operations
  // (e.g., cleaning up links when pages are deleted)
  private readonly linkRepo: LinkRepository;

  constructor(
    private readonly pageRepo: PageRepository,
    private readonly blockRepo: BlockRepository,
    linkRepo: LinkRepository
  ) {
    this.linkRepo = linkRepo;
  }

  /**
   * Get the link repository (for testing/extension purposes).
   * @internal
   */
  protected getLinkRepo(): LinkRepository {
    return this.linkRepo;
  }

  /**
   * Create a new page with the given title.
   *
   * @param title - The page title
   * @returns The newly created page
   * @throws DoubleBindError with context on repository failure
   */
  async createPage(title: string): Promise<Page> {
    try {
      const pageId = await this.pageRepo.create({ title });
      const page = await this.pageRepo.getById(pageId);

      if (!page) {
        throw new DoubleBindError(
          `Failed to retrieve created page: ${pageId}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      return page;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to create page with title "${title}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a page with all its blocks.
   *
   * @param pageId - The page identifier
   * @returns Object containing the page and its blocks
   * @throws DoubleBindError with PAGE_NOT_FOUND if page doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async getPageWithBlocks(pageId: PageId): Promise<PageWithBlocks> {
    try {
      const page = await this.pageRepo.getById(pageId);

      if (!page) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      const blocks = await this.blockRepo.getByPage(pageId);

      return { page, blocks };
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get page with blocks for pageId "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft-delete a page and all its blocks (cascading delete).
   *
   * This operation:
   * 1. Soft-deletes all blocks belonging to the page
   * 2. Soft-deletes the page itself
   *
   * @param pageId - The page identifier
   * @throws DoubleBindError with PAGE_NOT_FOUND if page doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async deletePage(pageId: PageId): Promise<void> {
    try {
      // Verify page exists first
      const page = await this.pageRepo.getById(pageId);
      if (!page) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      // Get all blocks for this page
      const blocks = await this.blockRepo.getByPage(pageId);

      // Soft-delete all blocks first (cascading)
      for (const block of blocks) {
        await this.blockRepo.softDelete(block.blockId);
      }

      // Soft-delete the page
      await this.pageRepo.softDelete(pageId);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to delete page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get or create today's daily note.
   *
   * Uses the current local date (YYYY-MM-DD format) to find or create
   * the daily note page.
   *
   * @returns Today's daily note page
   * @throws DoubleBindError with context on repository failure
   */
  async getTodaysDailyNote(): Promise<Page> {
    try {
      const today = new Date().toISOString().split('T')[0]!;
      return await this.pageRepo.getOrCreateDailyNote(today);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get today's daily note: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search pages by title.
   *
   * Delegates to the page repository's full-text search.
   *
   * @param query - The search query string
   * @returns Array of pages matching the search
   * @throws DoubleBindError with context on repository failure
   */
  async searchPages(query: string): Promise<Page[]> {
    try {
      return await this.pageRepo.search(query);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to search pages with query "${query}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all non-deleted pages sorted by updated_at descending.
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of pages sorted by updated_at descending
   * @throws DoubleBindError with context on repository failure
   */
  async getAllPages(options?: { limit?: number; offset?: number }): Promise<Page[]> {
    try {
      return await this.pageRepo.getAll({
        includeDeleted: false,
        limit: options?.limit,
        offset: options?.offset,
      });
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get all pages: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}
