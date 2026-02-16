/**
 * SearchService - Combines full-text search across pages and blocks.
 *
 * This service provides unified search functionality using SQLite FTS5
 * indexes on both `pages_fts` and `blocks_fts`. Results are merged into
 * a single array with relevance scores for ranking.
 *
 * FTS5 rank values are negative (closer to 0 = better match).
 * We negate the rank to produce positive scores for the domain layer:
 * score = -rank (higher is better).
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
  z.number(), // score (negated rank, positive)
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
  z.number(), // score (negated rank, positive)
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
 * Uses SQLite FTS5 indexes to search both page titles and block content,
 * merging results into a single ranked list.
 */
export class SearchService {
  constructor(private readonly db: GraphDB) {}

  /**
   * Search across both page titles and block content.
   *
   * Executes FTS5 queries in parallel against `pages_fts` and `blocks_fts`,
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

      // Sanitize query for FTS5 MATCH syntax
      const sanitizedQuery = this.sanitizeFtsQuery(query);
      if (!sanitizedQuery) {
        return [];
      }

      // Execute searches in parallel
      const [pageResults, blockResults] = await Promise.all([
        includeTypes.includes('page') ? this.searchPages(sanitizedQuery, limit) : [],
        includeTypes.includes('block') ? this.searchBlocks(sanitizedQuery, limit) : [],
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
   * Search page titles using FTS5.
   *
   * @param query - The sanitized FTS5 query string
   * @param limit - Maximum number of results
   * @returns Array of page search results
   */
  private async searchPages(query: string, limit: number): Promise<SearchResult[]> {
    const script = `
      SELECT pf.page_id, p.title, -pf.rank AS score
      FROM pages_fts pf
      JOIN pages p ON pf.page_id = p.page_id
      WHERE pages_fts MATCH $query
        AND p.is_deleted = 0
      ORDER BY pf.rank
      LIMIT $limit
    `;

    const result = await this.db.query(script, { query, limit });

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
   * Search block content using FTS5.
   *
   * @param query - The sanitized FTS5 query string
   * @param limit - Maximum number of results
   * @returns Array of block search results
   */
  private async searchBlocks(query: string, limit: number): Promise<SearchResult[]> {
    const script = `
      SELECT bf.block_id, b.content, b.page_id, p.title AS page_title, -bf.rank AS score
      FROM blocks_fts bf
      JOIN blocks b ON bf.block_id = b.block_id
      JOIN pages p ON b.page_id = p.page_id
      WHERE blocks_fts MATCH $query
        AND b.is_deleted = 0
        AND p.is_deleted = 0
      ORDER BY bf.rank
      LIMIT $limit
    `;

    const result = await this.db.query(script, { query, limit });

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
   * Sanitize a user query for FTS5 MATCH syntax.
   *
   * FTS5 has special syntax characters that can cause parse errors.
   * This method escapes or removes problematic characters while
   * preserving meaningful search terms.
   *
   * @param query - Raw user query string
   * @returns Sanitized query suitable for FTS5 MATCH, or empty string if invalid
   */
  private sanitizeFtsQuery(query: string): string {
    // Trim whitespace
    const sanitized = query.trim();

    if (!sanitized) {
      return '';
    }

    // Remove FTS5 special operators that could cause parse errors
    // Keep alphanumeric, spaces, and basic punctuation
    // Quote each term to prevent FTS5 syntax interpretation
    const terms = sanitized.split(/\s+/).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return '';
    }

    // Escape double quotes within terms and wrap each in double quotes
    const escapedTerms = terms.map((term) => {
      // Remove characters that are problematic in FTS5
      const cleaned = term.replace(/['"(){}[\]*:^~]/g, '');
      return cleaned || '';
    }).filter((t) => t.length > 0);

    if (escapedTerms.length === 0) {
      return '';
    }

    // Join terms with spaces (FTS5 implicit AND)
    return escapedTerms.join(' ');
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
