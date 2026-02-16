/**
 * GraphService - Provides graph-level operations for visualization and traversal.
 *
 * This service handles operations that span the entire graph or a neighborhood
 * of pages, such as:
 * - Getting the full graph for visualization
 * - Getting N-hop neighborhoods around a page (via recursive CTE)
 * - PageRank scoring (simple heuristic until graphology is wired in)
 * - Community detection (placeholder until graphology is wired in)
 * - Suggested links based on shared connections
 *
 * All queries use SQL (SQLite). Recursive CTEs handle N-hop traversal.
 */

import type { Database, Page, Link, PageId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { z } from 'zod';

// Backwards compatibility alias (used by existing consumers)
import type { GraphDB } from '@double-bind/types';

/**
 * Result type for graph operations containing nodes and edges.
 */
export interface GraphResult {
  nodes: Page[];
  edges: Link[];
}

/**
 * Result type for suggested link operations.
 */
export interface SuggestedLink {
  target: Page;
  score: number;
}

/** Database row type for pages query (array format from adapter).
 *  is_deleted can be boolean (CozoDB legacy) or number 0/1 (SQLite). */
type PageRow = [string, string, number, number, boolean | number, string | null];

/** Database row type for links query (array format from adapter) */
type LinkRow = [string, string, string, number, string | null];

/**
 * Valid link types.
 */
const LinkTypeSchema = z.enum(['reference', 'embed', 'tag']);

/**
 * Service for graph-level operations.
 *
 * Provides operations for querying the entire knowledge graph or
 * specific neighborhoods for visualization and traversal.
 */
export class GraphService {
  constructor(private readonly db: Database | GraphDB) {}

  /**
   * Get the full graph with all non-deleted pages and their links.
   */
  async getFullGraph(): Promise<GraphResult> {
    try {
      const pagesResult = await this.db.query(
        `SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
         FROM pages WHERE is_deleted = 0`
      );
      const pages = pagesResult.rows.map((row) => this.rowToPage(row as PageRow));

      const validPageIds = new Set(pages.map((p) => p.pageId));

      const linksResult = await this.db.query(
        `SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id
         FROM links l
         JOIN pages sp ON l.source_id = sp.page_id AND sp.is_deleted = 0
         JOIN pages tp ON l.target_id = tp.page_id AND tp.is_deleted = 0`
      );
      const edges = linksResult.rows
        .map((row) => this.rowToLink(row as LinkRow))
        .filter((link) => validPageIds.has(link.sourceId) && validPageIds.has(link.targetId));

      return { nodes: pages, edges };
    } catch (error) {
      if (error instanceof DoubleBindError) throw error;
      throw new DoubleBindError(
        `Failed to get full graph: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a neighborhood of pages within N hops of a center page.
   *
   * Uses a recursive CTE for bidirectional N-hop traversal via links.
   * UNION (not UNION ALL) prevents cycles by deduplicating rows.
   */
  async getNeighborhood(pageId: PageId, hops: number): Promise<GraphResult> {
    try {
      if (hops < 0) {
        throw new DoubleBindError(
          `Invalid hops parameter: ${hops}. Must be >= 0`,
          ErrorCode.INVALID_CONTENT
        );
      }

      // Verify the center page exists
      const centerResult = await this.db.query(
        `SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
         FROM pages WHERE page_id = $center_id AND is_deleted = 0`,
        { center_id: pageId }
      );

      if (centerResult.rows.length === 0) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      const centerPage = this.rowToPage(centerResult.rows[0] as PageRow);

      if (hops === 0) {
        return { nodes: [centerPage], edges: [] };
      }

      // Recursive CTE: bidirectional N-hop traversal
      const nodesResult = await this.db.query(
        `WITH RECURSIVE neighborhood(page_id, depth) AS (
           VALUES ($center_id, 0)
           UNION
           SELECT CASE WHEN l.source_id = n.page_id THEN l.target_id ELSE l.source_id END,
                  n.depth + 1
           FROM neighborhood n
           JOIN links l ON (l.source_id = n.page_id OR l.target_id = n.page_id)
           WHERE n.depth < $max_hops
         )
         SELECT p.page_id, p.title, p.created_at, p.updated_at, p.is_deleted, p.daily_note_date
         FROM pages p
         JOIN (SELECT DISTINCT page_id FROM neighborhood) nh ON p.page_id = nh.page_id
         WHERE p.is_deleted = 0`,
        { center_id: pageId, max_hops: hops }
      );

      const nodes = nodesResult.rows.map((row) => this.rowToPage(row as PageRow));
      const neighborIds = new Set(nodes.map((n) => n.pageId));

      // Build parameterized IN clause for edge query
      // (SQLite doesn't support array binding like CozoDB's `page_id in $page_ids`)
      const idArray = Array.from(neighborIds);
      const placeholders = idArray.map((_, i) => `$id${i}`).join(', ');
      const edgeParams: Record<string, unknown> = {};
      idArray.forEach((id, i) => {
        edgeParams[`id${i}`] = id;
      });

      const edgesResult = await this.db.query(
        `SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id
         FROM links l
         JOIN pages sp ON l.source_id = sp.page_id AND sp.is_deleted = 0
         JOIN pages tp ON l.target_id = tp.page_id AND tp.is_deleted = 0
         WHERE l.source_id IN (${placeholders})
           AND l.target_id IN (${placeholders})`,
        edgeParams
      );

      const edges = edgesResult.rows.map((row) => this.rowToLink(row as LinkRow));

      return { nodes, edges };
    } catch (error) {
      if (error instanceof DoubleBindError) throw error;
      throw new DoubleBindError(
        `Failed to get neighborhood for page "${pageId}" with ${hops} hops: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculate PageRank scores for all pages in the graph.
   *
   * Uses a simple heuristic: uniform base score boosted by incoming links.
   * TODO(Phase 3): Replace with graphology's pagerank algorithm.
   */
  async getPageRank(): Promise<Map<PageId, number>> {
    try {
      const { nodes, edges } = await this.getFullGraph();

      const ranks = new Map<PageId, number>();
      const uniformScore = nodes.length > 0 ? 1.0 / nodes.length : 0;
      for (const node of nodes) {
        ranks.set(node.pageId, uniformScore);
      }

      // Boost pages with incoming links as a simple heuristic
      for (const edge of edges) {
        const current = ranks.get(edge.targetId) ?? uniformScore;
        ranks.set(edge.targetId, current + uniformScore * 0.1);
      }

      return ranks;
    } catch (error) {
      if (error instanceof DoubleBindError) throw error;
      throw new DoubleBindError(
        `Failed to compute PageRank: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Detect communities in the graph.
   *
   * Assigns all pages to community 0 as a placeholder.
   * TODO(Phase 3): Replace with graphology-communities-louvain.
   */
  async getCommunities(): Promise<Map<PageId, number>> {
    try {
      const pagesResult = await this.db.query(
        `SELECT page_id FROM pages WHERE is_deleted = 0`
      );

      const communities = new Map<PageId, number>();
      for (const row of pagesResult.rows) {
        communities.set(row[0] as string, 0);
      }

      return communities;
    } catch (error) {
      if (error instanceof DoubleBindError) throw error;
      throw new DoubleBindError(
        `Failed to detect communities: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get suggested pages to link to from a given page.
   *
   * Finds pages reachable in 2 hops that aren't directly connected,
   * scored by the number of shared connections.
   */
  async getSuggestedLinks(pageId: PageId): Promise<SuggestedLink[]> {
    try {
      // Verify the page exists
      const verifyResult = await this.db.query(
        `SELECT page_id FROM pages WHERE page_id = $page_id AND is_deleted = 0`,
        { page_id: pageId }
      );
      if (verifyResult.rows.length === 0) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      // Find 2-hop candidates not directly connected, scored by shared connections
      const result = await this.db.query(
        `WITH
           connected(page_id) AS (
             SELECT target_id FROM links WHERE source_id = $page_id
             UNION
             SELECT source_id FROM links WHERE target_id = $page_id
           ),
           candidates(page_id, score) AS (
             SELECT candidate_id, COUNT(DISTINCT shared_id)
             FROM (
               SELECT c.page_id AS shared_id, l.target_id AS candidate_id
               FROM connected c
               JOIN links l ON l.source_id = c.page_id
               WHERE l.target_id != $page_id
                 AND l.target_id NOT IN (SELECT page_id FROM connected)
               UNION ALL
               SELECT c.page_id AS shared_id, l.source_id AS candidate_id
               FROM connected c
               JOIN links l ON l.target_id = c.page_id
               WHERE l.source_id != $page_id
                 AND l.source_id NOT IN (SELECT page_id FROM connected)
             )
             GROUP BY candidate_id
           )
         SELECT p.page_id, p.title, p.created_at, p.updated_at, p.is_deleted,
                p.daily_note_date, c.score
         FROM candidates c
         JOIN pages p ON c.page_id = p.page_id
         WHERE p.is_deleted = 0
         ORDER BY c.score DESC
         LIMIT 20`,
        { page_id: pageId }
      );

      const suggestions: SuggestedLink[] = [];
      for (const row of result.rows) {
        const page = this.rowToPage(row.slice(0, 6) as PageRow);
        const score = row[6] as number;
        suggestions.push({ target: page, score });
      }

      return suggestions;
    } catch (error) {
      if (error instanceof DoubleBindError) throw error;
      throw new DoubleBindError(
        `Failed to get suggested links for page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Convert a database row to a Page object.
   * Handles both boolean (CozoDB legacy) and integer 0/1 (SQLite) for is_deleted.
   */
  private rowToPage(row: PageRow): Page {
    const [pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] = row;

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
    // Accept both boolean (CozoDB) and integer 0/1 (SQLite) for is_deleted
    if (typeof isDeleted !== 'boolean' && typeof isDeleted !== 'number') {
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
      isDeleted: typeof isDeleted === 'boolean' ? isDeleted : Boolean(isDeleted),
      dailyNoteDate,
    };
  }

  /**
   * Convert a database row to a Link object.
   */
  private rowToLink(row: LinkRow): Link {
    const [sourceId, targetId, linkType, createdAt, contextBlockId] = row;

    if (typeof sourceId !== 'string') {
      throw new DoubleBindError(
        'Invalid source_id type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (typeof targetId !== 'string') {
      throw new DoubleBindError(
        'Invalid target_id type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (typeof createdAt !== 'number') {
      throw new DoubleBindError(
        'Invalid created_at type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }
    if (contextBlockId !== null && typeof contextBlockId !== 'string') {
      throw new DoubleBindError(
        'Invalid context_block_id type in database row',
        ErrorCode.DB_QUERY_FAILED
      );
    }

    const parsedLinkType = LinkTypeSchema.safeParse(linkType);
    if (!parsedLinkType.success) {
      throw new DoubleBindError(
        `Invalid link_type in database row: ${linkType}`,
        ErrorCode.DB_QUERY_FAILED
      );
    }

    return {
      sourceId,
      targetId,
      linkType: parsedLinkType.data,
      createdAt,
      contextBlockId,
    };
  }
}
