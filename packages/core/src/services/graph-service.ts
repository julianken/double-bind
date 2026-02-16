/**
 * GraphService - Provides graph-level operations for visualization and traversal.
 *
 * This service handles operations that span the entire graph or a neighborhood
 * of pages, such as:
 * - Getting the full graph for visualization
 * - Getting N-hop neighborhoods around a page
 * - Computing PageRank scores
 * - Detecting communities with Louvain algorithm
 * - Suggesting links based on common neighbors
 *
 * Migrated from CozoDB Datalog to SQLite SQL + graphology library.
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
 */

import type { GraphDB, Page, Link, PageId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { z } from 'zod';
import { buildGraph, computePageRank as runPageRank, computeCommunities as runCommunities } from './graph-algorithms.js';

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

/**
 * Zod schema for parsing page rows from SQL queries.
 * SQLite booleans are 0/1 integers.
 */
const PageRowSchema = z.tuple([
  z.string(), // page_id
  z.string(), // title
  z.number(), // created_at
  z.number(), // updated_at
  z.number(), // is_deleted (0 or 1)
  z.string().nullable(), // daily_note_date
]);

/**
 * Zod schema for parsing link rows from SQL queries.
 */
const LinkRowSchema = z.tuple([
  z.string(), // source_id
  z.string(), // target_id
  z.string(), // link_type
  z.number(), // created_at
  z.string().nullable(), // context_block_id
]);

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
  constructor(private readonly db: GraphDB) {}

  /**
   * Get the full graph with all non-deleted pages and their links.
   *
   * This operation retrieves all pages and links in the database
   * for full graph visualization.
   *
   * @returns Object containing all pages as nodes and all links as edges
   * @throws DoubleBindError with context on query failure
   */
  async getFullGraph(): Promise<GraphResult> {
    try {
      // Query all non-deleted pages
      const pagesScript = `
        SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
        FROM pages
        WHERE is_deleted = 0
      `.trim();

      const pagesResult = await this.db.query(pagesScript);
      const pages = pagesResult.rows.map((row) => this.rowToPage(row as unknown[]));

      // Build a set of valid page IDs for filtering edges
      const validPageIds = new Set(pages.map((p) => p.pageId));

      // Query all links where both source and target exist and are non-deleted
      const linksScript = `
        SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id
        FROM links l
        JOIN pages p1 ON l.source_id = p1.page_id
        JOIN pages p2 ON l.target_id = p2.page_id
        WHERE p1.is_deleted = 0 AND p2.is_deleted = 0
      `.trim();

      const linksResult = await this.db.query(linksScript);
      const edges = linksResult.rows
        .map((row) => this.rowToLink(row as unknown[]))
        .filter((link) => validPageIds.has(link.sourceId) && validPageIds.has(link.targetId));

      return { nodes: pages, edges };
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
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
   * This operation performs a breadth-first traversal from the center page,
   * collecting all pages reachable within the specified number of hops.
   * Links are followed bidirectionally (both outgoing and incoming).
   *
   * @param pageId - The center page identifier
   * @param hops - Maximum number of hops from center (must be >= 0)
   * @returns Object containing neighborhood pages as nodes and their links as edges
   * @throws DoubleBindError with PAGE_NOT_FOUND if center page doesn't exist
   * @throws DoubleBindError with context on query failure
   */
  async getNeighborhood(pageId: PageId, hops: number): Promise<GraphResult> {
    try {
      // Validate hops parameter
      if (hops < 0) {
        throw new DoubleBindError(
          `Invalid hops parameter: ${hops}. Must be >= 0`,
          ErrorCode.INVALID_CONTENT
        );
      }

      // Verify the center page exists
      const centerPageScript = `
        SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
        FROM pages
        WHERE page_id = $center_id AND is_deleted = 0
      `.trim();

      const centerResult = await this.db.query(centerPageScript, { center_id: pageId });

      if (centerResult.rows.length === 0) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      const centerPage = this.rowToPage(centerResult.rows[0] as unknown[]);

      // If hops is 0, return just the center page with no edges
      if (hops === 0) {
        return { nodes: [centerPage], edges: [] };
      }

      // Build neighborhood using recursive CTE
      // The CTE traverses links bidirectionally up to max_depth
      const neighborhoodScript = `
        WITH RECURSIVE neighborhood AS (
          -- Base case: start with the center page
          SELECT $center_id AS node_id, 0 AS depth

          UNION ALL

          -- Recursive case: follow links in both directions
          SELECT
            CASE
              WHEN l.source_id = n.node_id THEN l.target_id
              ELSE l.source_id
            END AS node_id,
            n.depth + 1 AS depth
          FROM neighborhood n
          JOIN links l ON l.source_id = n.node_id OR l.target_id = n.node_id
          JOIN pages p ON p.page_id = CASE
            WHEN l.source_id = n.node_id THEN l.target_id
            ELSE l.source_id
          END
          WHERE n.depth < $max_depth
            AND p.is_deleted = 0
        )
        SELECT DISTINCT node_id FROM neighborhood
      `.trim();

      const neighborResult = await this.db.query(neighborhoodScript, {
        center_id: pageId,
        max_depth: hops,
      });

      // Parse the neighbor page IDs from the result
      const neighborIds = neighborResult.rows.map((row) => row[0] as string);

      // Fetch full page data for all neighbors
      const nodesScript = `
        SELECT page_id, title, created_at, updated_at, is_deleted, daily_note_date
        FROM pages
        WHERE page_id IN (${neighborIds.map((_, i) => `$id${i}`).join(', ')})
          AND is_deleted = 0
      `.trim();

      const nodesParams: Record<string, unknown> = {};
      neighborIds.forEach((id, i) => {
        nodesParams[`id${i}`] = id;
      });

      const nodesResult = await this.db.query(nodesScript, nodesParams);
      const nodes = nodesResult.rows.map((row) => this.rowToPage(row as unknown[]));

      // Fetch edges between nodes in the neighborhood
      const edgesScript = `
        SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id
        FROM links l
        JOIN pages p1 ON l.source_id = p1.page_id
        JOIN pages p2 ON l.target_id = p2.page_id
        WHERE l.source_id IN (${neighborIds.map((_, i) => `$id${i}`).join(', ')})
          AND l.target_id IN (${neighborIds.map((_, i) => `$id${i}`).join(', ')})
          AND p1.is_deleted = 0
          AND p2.is_deleted = 0
      `.trim();

      const edgesResult = await this.db.query(edgesScript, nodesParams);
      const edges = edgesResult.rows.map((row) => this.rowToLink(row as unknown[]));

      return { nodes, edges };
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
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
   * Uses graphology's PageRank algorithm to compute the importance
   * of each page based on the link structure.
   *
   * @returns Map of page IDs to their PageRank scores (higher = more important)
   * @throws DoubleBindError with context on query failure
   */
  async getPageRank(): Promise<Map<PageId, number>> {
    try {
      // Get full graph
      const { nodes, edges } = await this.getFullGraph();

      // Build graphology graph
      const graph = buildGraph(nodes, edges);

      // Compute PageRank using graphology
      const ranks = runPageRank(graph);

      return ranks;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to compute PageRank: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Detect communities in the graph using the Louvain algorithm.
   *
   * Uses graphology's Louvain community detection algorithm to partition
   * pages into communities based on link density.
   *
   * @returns Map of page IDs to their community group IDs
   * @throws DoubleBindError with context on query failure
   */
  async getCommunities(): Promise<Map<PageId, number>> {
    try {
      // Get full graph
      const { nodes, edges } = await this.getFullGraph();

      // Build graphology graph
      const graph = buildGraph(nodes, edges);

      // Compute communities using Louvain algorithm
      const communities = runCommunities(graph);

      return communities;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
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
   * Returns pages that are not yet linked from the source page but have
   * high relevance based on shared connections (common neighbors).
   * Uses common-neighbor scoring to rank potential links.
   *
   * @param pageId - The source page to get suggestions for
   * @returns Array of suggested pages with their relevance scores, sorted by score descending
   * @throws DoubleBindError with PAGE_NOT_FOUND if source page doesn't exist
   * @throws DoubleBindError with context on query failure
   */
  async getSuggestedLinks(pageId: PageId): Promise<SuggestedLink[]> {
    try {
      // First verify the page exists
      const verifyScript = `
        SELECT page_id
        FROM pages
        WHERE page_id = $page_id AND is_deleted = 0
      `.trim();

      const verifyResult = await this.db.query(verifyScript, { page_id: pageId });
      if (verifyResult.rows.length === 0) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      // Find pages that share common neighbors but aren't directly linked
      // Score is based on number of shared connections
      const script = `
        WITH page_neighbors AS (
          -- Get all neighbors of the source page (bidirectional)
          SELECT DISTINCT target_id AS neighbor_id
          FROM links
          WHERE source_id = $page_id

          UNION

          SELECT DISTINCT source_id AS neighbor_id
          FROM links
          WHERE target_id = $page_id
        ),
        candidate_links AS (
          -- Find 2-hop connections (neighbors of neighbors)
          SELECT
            CASE
              WHEN l.source_id = pn.neighbor_id THEN l.target_id
              ELSE l.source_id
            END AS candidate_id,
            pn.neighbor_id AS shared_neighbor
          FROM page_neighbors pn
          JOIN links l ON l.source_id = pn.neighbor_id OR l.target_id = pn.neighbor_id
          WHERE (l.source_id = pn.neighbor_id OR l.target_id = pn.neighbor_id)
            AND CASE
              WHEN l.source_id = pn.neighbor_id THEN l.target_id
              ELSE l.source_id
            END != $page_id
            AND CASE
              WHEN l.source_id = pn.neighbor_id THEN l.target_id
              ELSE l.source_id
            END NOT IN (SELECT neighbor_id FROM page_neighbors)
        )
        SELECT
          p.page_id,
          p.title,
          p.created_at,
          p.updated_at,
          p.is_deleted,
          p.daily_note_date,
          COUNT(DISTINCT cl.shared_neighbor) AS score
        FROM candidate_links cl
        JOIN pages p ON p.page_id = cl.candidate_id
        WHERE p.is_deleted = 0
        GROUP BY p.page_id, p.title, p.created_at, p.updated_at, p.is_deleted, p.daily_note_date
        ORDER BY score DESC
        LIMIT 20
      `.trim();

      const result = await this.db.query(script, { page_id: pageId });

      const suggestions: SuggestedLink[] = [];
      for (const row of result.rows) {
        const rowArray = row as unknown[];
        const page = this.rowToPage(rowArray.slice(0, 6));
        const score = rowArray[6] as number;

        if (typeof score !== 'number') {
          throw new DoubleBindError(
            'Invalid score type in suggested links result',
            ErrorCode.DB_QUERY_FAILED
          );
        }

        suggestions.push({ target: page, score });
      }

      return suggestions;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get suggested links for page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Convert a database row to a Page object.
   *
   * @param row - Database row array
   * @returns Page domain object
   * @throws DoubleBindError if row validation fails
   */
  private rowToPage(row: unknown[]): Page {
    const parsed = PageRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new DoubleBindError(
        `Invalid page row format: ${parsed.error.message}`,
        ErrorCode.DB_QUERY_FAILED
      );
    }

    const [pageId, title, createdAt, updatedAt, isDeletedInt, dailyNoteDate] = parsed.data;

    return {
      pageId,
      title,
      createdAt,
      updatedAt,
      isDeleted: isDeletedInt === 1,
      dailyNoteDate,
    };
  }

  /**
   * Convert a database row to a Link object.
   *
   * @param row - Database row array
   * @returns Link domain object
   * @throws DoubleBindError if row validation fails
   */
  private rowToLink(row: unknown[]): Link {
    const parsed = LinkRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new DoubleBindError(
        `Invalid link row format: ${parsed.error.message}`,
        ErrorCode.DB_QUERY_FAILED
      );
    }

    const [sourceId, targetId, linkType, createdAt, contextBlockId] = parsed.data;

    // Validate link type using Zod
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
