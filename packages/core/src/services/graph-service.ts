/**
 * GraphService - Provides graph-level operations for visualization and traversal.
 *
 * This service handles operations that span the entire graph or a neighborhood
 * of pages, such as:
 * - Getting the full graph for visualization
 * - Getting N-hop neighborhoods around a page
 *
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
 */

import type { GraphDB, Page, Link, PageId } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { z } from 'zod';

/**
 * Result type for graph operations containing nodes and edges.
 */
export interface GraphResult {
  nodes: Page[];
  edges: Link[];
}

/** Database row type for pages relation */
type PageRow = [string, string, number, number, boolean, string | null];

/** Database row type for links relation */
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted: false, daily_note_date }
`.trim();

      const pagesResult = await this.db.query(pagesScript);
      const pages = pagesResult.rows.map((row) => this.rowToPage(row as PageRow));

      // Build a set of valid page IDs for filtering edges
      const validPageIds = new Set(pages.map((p) => p.pageId));

      // Query all links where both source and target exist and are non-deleted
      const linksScript = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id },
    *pages{ page_id: source_id, is_deleted: false },
    *pages{ page_id: target_id, is_deleted: false }
`.trim();

      const linksResult = await this.db.query(linksScript);
      const edges = linksResult.rows
        .map((row) => this.rowToLink(row as LinkRow))
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
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id: $center_id, title, created_at, updated_at, is_deleted: false, daily_note_date }
`.trim();

      const centerResult = await this.db.query(centerPageScript, { center_id: pageId });

      if (centerResult.rows.length === 0) {
        throw new DoubleBindError(`Page not found: ${pageId}`, ErrorCode.PAGE_NOT_FOUND);
      }

      const centerPage = this.rowToPage(centerResult.rows[0] as PageRow);

      // If hops is 0, return just the center page with no edges
      if (hops === 0) {
        return { nodes: [centerPage], edges: [] };
      }

      // Build neighborhood using recursive Datalog query
      // CozoDB supports recursive rules for graph traversal
      const neighborhoodScript = this.buildNeighborhoodQuery(hops);

      const neighborResult = await this.db.query(neighborhoodScript, { center_id: pageId });

      // Parse the neighbor page IDs from the result
      const neighborIds = new Set<string>([pageId]);
      for (const row of neighborResult.rows) {
        const neighborId = row[0] as string;
        neighborIds.add(neighborId);
      }

      // Fetch full page data for all neighbors
      const nodesScript = `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] :=
    *pages{ page_id, title, created_at, updated_at, is_deleted: false, daily_note_date },
    page_id in $page_ids
`.trim();

      const nodesResult = await this.db.query(nodesScript, {
        page_ids: Array.from(neighborIds),
      });

      const nodes = nodesResult.rows.map((row) => this.rowToPage(row as PageRow));

      // Fetch edges between nodes in the neighborhood
      const edgesScript = `
?[source_id, target_id, link_type, created_at, context_block_id] :=
    *links{ source_id, target_id, link_type, created_at, context_block_id },
    source_id in $page_ids,
    target_id in $page_ids,
    *pages{ page_id: source_id, is_deleted: false },
    *pages{ page_id: target_id, is_deleted: false }
`.trim();

      const edgesResult = await this.db.query(edgesScript, {
        page_ids: Array.from(neighborIds),
      });

      const edges = edgesResult.rows.map((row) => this.rowToLink(row as LinkRow));

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
   * Build a recursive Datalog query for N-hop neighborhood traversal.
   *
   * Uses CozoDB's recursive rule support to traverse links in both directions.
   *
   * @param hops - Number of hops to traverse
   * @returns Datalog query string
   */
  private buildNeighborhoodQuery(hops: number): string {
    // Use recursive Datalog query with path length constraint
    // The query finds all pages reachable within N hops via links (bidirectional)
    return `
neighbors[neighbor] :=
    *links{ source_id: $center_id, target_id: neighbor },
    *pages{ page_id: neighbor, is_deleted: false }
neighbors[neighbor] :=
    *links{ target_id: $center_id, source_id: neighbor },
    *pages{ page_id: neighbor, is_deleted: false }
${hops > 1 ? this.buildRecursiveRules(hops) : ''}
?[neighbor] := neighbors[neighbor]
`.trim();
  }

  /**
   * Build recursive rules for multi-hop traversal.
   *
   * @param hops - Total number of hops
   * @returns Recursive rule definitions
   */
  private buildRecursiveRules(hops: number): string {
    const rules: string[] = [];

    // Add rules for each additional hop level
    for (let hop = 2; hop <= hops; hop++) {
      rules.push(`
neighbors[next] :=
    neighbors[current],
    *links{ source_id: current, target_id: next },
    *pages{ page_id: next, is_deleted: false }
neighbors[next] :=
    neighbors[current],
    *links{ target_id: current, source_id: next },
    *pages{ page_id: next, is_deleted: false }`);
    }

    return rules.join('\n');
  }

  /**
   * Convert a database row to a Page object.
   *
   * @param row - Database row tuple
   * @returns Page domain object
   * @throws DoubleBindError if row validation fails
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

  /**
   * Convert a database row to a Link object.
   *
   * @param row - Database row tuple
   * @returns Link domain object
   * @throws DoubleBindError if row validation fails
   */
  private rowToLink(row: LinkRow): Link {
    const [sourceId, targetId, linkType, createdAt, contextBlockId] = row;

    // Validate types
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
