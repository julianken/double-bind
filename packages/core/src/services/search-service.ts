/**
 * SearchService - Combines full-text search across pages and blocks.
 *
 * This service provides unified search functionality using CozoDB's built-in
 * FTS indexes on both `pages:fts` and `blocks:fts`. Results are merged into
 * a single array with relevance scores for ranking.
 *
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
 */

import type { GraphDB, SearchResult, SearchOptions, PageId, BlockId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { z } from 'zod';

// ============================================================================
// Zod Schemas for FTS Result Validation
// ============================================================================

/**
 * Schema for page FTS result row.
 * Row format: [page_id, title, score]
 */
const PageFtsResultSchema = z.tuple([
  z.string(), // page_id
  z.string(), // title
  z.number(), // score
]);

/**
 * Schema for block FTS result row.
 * Row format: [block_id, content, page_id, page_title, score]
 */
const BlockFtsResultSchema = z.tuple([
  z.string(), // block_id
  z.string(), // content
  z.string(), // page_id
  z.string(), // page_title
  z.number(), // score
]);

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_SCORE = 0;

// ============================================================================
// SearchService
// ============================================================================

/**
 * Service for unified full-text search across pages and blocks.
 *
 * Uses CozoDB's FTS indexes to search both page titles and block content,
 * merging results into a single ranked list.
 */
export class SearchService {
  constructor(private readonly db: GraphDB) {}

  /**
   * Search across both page titles and block content.
   *
   * Executes FTS queries in parallel against `pages:fts` and `blocks:fts`,
   * then merges and sorts results by relevance score.
   *
   * @param query - The search query string
   * @param options - Optional search configuration
   * @returns Array of search results sorted by score descending
   * @throws DoubleBindError with context on query failure
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const limit = options?.limit ?? DEFAULT_LIMIT;
      const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
      const includeTypes = options?.includeTypes ?? ['page', 'block'];

      // Execute searches in parallel
      const [pageResults, blockResults] = await Promise.all([
        includeTypes.includes('page') ? this.searchPages(query, limit) : [],
        includeTypes.includes('block') ? this.searchBlocks(query, limit) : [],
      ]);

      // Merge results
      const allResults: SearchResult[] = [...pageResults, ...blockResults];

      // Filter by minimum score
      const filteredResults = allResults.filter((r) => r.score >= minScore);

      // Sort by score descending
      filteredResults.sort((a, b) => b.score - a.score);

      return filteredResults;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to search with query "${query}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search page titles using FTS.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results
   * @returns Array of page search results
   */
  private async searchPages(query: string, limit: number): Promise<SearchResult[]> {
    // FTS query for page titles
    // Note: We use explicit equality for filtering: `is_deleted == $is_deleted`
    const script = `
?[page_id, title, score] :=
    ~pages:fts{ page_id, title | query: $query, k: $limit, bind_score: score },
    *pages{ page_id, is_deleted },
    is_deleted == false
:order -score
`.trim();

    const result = await this.db.query(script, {
      query,
      limit,
      is_deleted: false,
    });

    return result.rows.map((row) => {
      const parsed = PageFtsResultSchema.safeParse(row);
      if (!parsed.success) {
        throw new DoubleBindError(
          `Invalid page FTS result row format: ${JSON.stringify(row)}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      const [pageId, title, score] = parsed.data;
      return this.createPageResult(pageId, title, score);
    });
  }

  /**
   * Search block content using FTS.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results
   * @returns Array of block search results
   */
  private async searchBlocks(query: string, limit: number): Promise<SearchResult[]> {
    // FTS query for block content, joining with pages to get page title
    // Note: We use explicit equality for filtering
    const script = `
?[block_id, content, page_id, page_title, score] :=
    ~blocks:fts{ block_id, content | query: $query, k: $limit, bind_score: score },
    *blocks{ block_id, page_id, is_deleted: block_deleted },
    block_deleted == false,
    *pages{ page_id, title: page_title, is_deleted: page_deleted },
    page_deleted == false
:order -score
`.trim();

    const result = await this.db.query(script, {
      query,
      limit,
    });

    return result.rows.map((row) => {
      const parsed = BlockFtsResultSchema.safeParse(row);
      if (!parsed.success) {
        throw new DoubleBindError(
          `Invalid block FTS result row format: ${JSON.stringify(row)}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      const [blockId, content, pageId, pageTitle, score] = parsed.data;
      return this.createBlockResult(blockId, content, pageId, pageTitle, score);
    });
  }

  /**
   * Create a SearchResult for a page match.
   */
  private createPageResult(pageId: PageId, title: string, score: number): SearchResult {
    return {
      type: 'page',
      id: pageId,
      title,
      content: title, // For pages, content is the title itself
      score,
      pageId,
    };
  }

  /**
   * Create a SearchResult for a block match.
   */
  private createBlockResult(
    blockId: BlockId,
    content: string,
    pageId: PageId,
    pageTitle: string,
    score: number
  ): SearchResult {
    return {
      type: 'block',
      id: blockId,
      title: pageTitle, // Parent page title for context
      content,
      score,
      pageId,
      blockId,
    };
  }
}
