/**
 * PageService - Orchestrates page operations with cross-cutting concerns.
 *
 * Handles cascading deletes, daily note management, and composite queries.
 */

import type { Page, Block, PageId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { PageRepository } from '../repositories/page-repository.js';
import type { BlockRepository } from '../repositories/block-repository.js';
import type { LinkRepository } from '../repositories/link-repository.js';

export interface PageWithBlocks {
  page: Page;
  blocks: Block[];
}

export interface PageBacklink {
  block: Block;
  page: Page;
}

export class PageService {
  private readonly linkRepo: LinkRepository;

  constructor(
    private readonly pageRepo: PageRepository,
    private readonly blockRepo: BlockRepository,
    linkRepo: LinkRepository
  ) {
    this.linkRepo = linkRepo;
  }

  /** @internal */
  protected getLinkRepo(): LinkRepository {
    return this.linkRepo;
  }

  /** Create a new page with an initial empty block. */
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

      await this.blockRepo.create({
        pageId,
        content: '',
      });

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

  /** Soft-delete a page and all its blocks. */
  async deletePage(pageId: PageId): Promise<void> {
    try {
      const page = await this.pageRepo.getById(pageId);
      if (!page) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      const blocks = await this.blockRepo.getByPage(pageId);

      for (const block of blocks) {
        await this.blockRepo.softDelete(block.blockId);
      }

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

  /** @param date - YYYY-MM-DD format */
  async getOrCreateDailyNote(date: string): Promise<Page> {
    try {
      const page = await this.pageRepo.getOrCreateDailyNote(date);

      const blocks = await this.blockRepo.getByPage(page.pageId);
      if (blocks.length === 0) {
        await this.blockRepo.create({
          pageId: page.pageId,
          content: '',
        });
      }

      return page;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get or create daily note for "${date}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getTodaysDailyNote(): Promise<Page> {
    const today = new Date().toISOString().split('T')[0]!;
    return this.getOrCreateDailyNote(today);
  }

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

  async updateTitle(pageId: PageId, title: string): Promise<void> {
    try {
      await this.pageRepo.update(pageId, { title });
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to update title for page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getPageBacklinks(pageId: PageId): Promise<PageBacklink[]> {
    try {
      const inLinks = await this.linkRepo.getInLinks(pageId);

      const results: PageBacklink[] = [];
      for (const link of inLinks) {
        const sourcePage = await this.pageRepo.getById(link.sourceId);
        if (!sourcePage) continue;

        if (!link.contextBlockId) continue;

        const block = await this.blockRepo.getById(link.contextBlockId);
        if (!block) continue;

        results.push({
          block,
          page: sourcePage,
        });
      }

      return results;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get backlinks for page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getByTitle(title: string): Promise<Page | null> {
    try {
      return await this.pageRepo.getByTitle(title);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get page by title "${title}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getOrCreateByTitle(title: string): Promise<Page> {
    try {
      return await this.pageRepo.getOrCreateByTitle(title);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get or create page by title "${title}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}
