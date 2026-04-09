/**
 * SearchService - Unified full-text search across pages and blocks.
 *
 * Uses SQLite FTS5 indexes (pages_fts, blocks_fts). FTS5 rank values are
 * negative (closer to 0 = better), so we negate: score = -rank (higher is better).
 */

import type { Database, SearchResult, SearchOptions, PageId, BlockId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { z } from 'zod';

const PageFtsResultSchema = z.tuple([
  z.string(), // page_id
  z.string(), // title
  z.number(), // score
]);

const BlockFtsResultSchema = z.tuple([
  z.string(), // block_id
  z.string(), // content
  z.string(), // page_id
  z.string(), // page_title
  z.number(), // score
]);

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_SCORE = 0;

export class SearchService {
  constructor(private readonly db: Database) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const limit = options?.limit ?? DEFAULT_LIMIT;
      const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
      const includeTypes = options?.includeTypes ?? ['page', 'block'];

      const sanitizedQuery = this.sanitizeFtsQuery(query);
      if (!sanitizedQuery) {
        return [];
      }

      const [pageResults, blockResults] = await Promise.all([
        includeTypes.includes('page') ? this.searchPages(sanitizedQuery, limit) : [],
        includeTypes.includes('block') ? this.searchBlocks(sanitizedQuery, limit) : [],
      ]);

      const allResults: SearchResult[] = [...pageResults, ...blockResults];
      const filteredResults = allResults.filter((r) => r.score >= minScore);
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

  /** Strip FTS5 special syntax characters to prevent MATCH parse errors. */
  private sanitizeFtsQuery(query: string): string {
    const sanitized = query.trim();

    if (!sanitized) {
      return '';
    }

    const terms = sanitized.split(/\s+/).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return '';
    }

    const escapedTerms = terms.map((term) => {
      const cleaned = term.replace(/['"(){}[\]*:^~]/g, '');
      return cleaned || '';
    }).filter((t) => t.length > 0);

    if (escapedTerms.length === 0) {
      return '';
    }

    return escapedTerms.join(' ');
  }

  private createPageResult(pageId: PageId, title: string, score: number): SearchResult {
    return {
      type: 'page',
      id: pageId,
      title,
      content: title,
      score,
      pageId,
    };
  }

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
      title: pageTitle,
      content,
      score,
      pageId,
      blockId,
    };
  }
}
