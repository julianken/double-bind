/**
 * TagRepository - Encapsulates all SQL queries for Tag entities.
 *
 * Each method constructs parameterized SQL queries that are executed
 * against SQLite. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Tags are case-sensitive (no normalization at repository level).
 *
 * SQLite schema uses split tables (block_tags, page_tags) instead of
 * a unified CozoDB tags relation. Queries use UNION ALL to check both.
 */

import type { GraphDB, Tag } from '@double-bind/types';
import { parseTagRow } from './tag-repository.schemas.js';

/**
 * Represents a tag with its usage count.
 */
export interface TagWithCount {
  tag: string;
  count: number;
}

/**
 * Repository for Tag entity operations.
 * All methods use parameterized SQL queries for security.
 */
export class TagRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get all tags for a specific entity (page or block).
   * Queries both block_tags and page_tags via UNION ALL.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @returns Array of tags associated with the entity
   */
  async getByEntity(entityId: string): Promise<Tag[]> {
    const script = `
      SELECT block_id AS entity_id, tag, created_at FROM block_tags WHERE block_id = $entity_id
      UNION ALL
      SELECT page_id AS entity_id, tag, created_at FROM page_tags WHERE page_id = $entity_id
    `;

    const result = await this.db.query(script, { entity_id: entityId });

    return result.rows.map((row) => parseTagRow(row as unknown[]));
  }

  /**
   * Get all entities that have a specific tag.
   * Queries both block_tags and page_tags via UNION ALL.
   *
   * @param tag - The tag to search for (case-sensitive)
   * @returns Array of tags (each containing an entity reference)
   */
  async getByTag(tag: string): Promise<Tag[]> {
    const script = `
      SELECT block_id AS entity_id, tag, created_at FROM block_tags WHERE tag = $tag
      UNION ALL
      SELECT page_id AS entity_id, tag, created_at FROM page_tags WHERE tag = $tag
    `;

    const result = await this.db.query(script, { tag });

    return result.rows.map((row) => parseTagRow(row as unknown[]));
  }

  /**
   * Get all distinct tags in the database with their usage counts.
   * Returns tags ordered by usage count descending.
   *
   * @returns Array of tag names with counts, ordered by count descending
   */
  async getAllTags(): Promise<TagWithCount[]> {
    const script = `
      SELECT tag, COUNT(*) AS count FROM (
        SELECT tag FROM block_tags
        UNION ALL
        SELECT tag FROM page_tags
      )
      GROUP BY tag
      ORDER BY count DESC
    `;

    const result = await this.db.query(script, {});

    return result.rows.map((row) => {
      const [tag, count] = row as [string, number];
      return { tag, count };
    });
  }

  /**
   * Add a tag to an entity.
   * Determines whether the entity is a block or page by checking both tables.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param tag - The tag to add (case-sensitive)
   */
  async addTag(entityId: string, tag: string): Promise<void> {
    const now = Date.now();

    // Check if entity is a page
    const pageResult = await this.db.query(
      `SELECT page_id FROM pages WHERE page_id = $entity_id`,
      { entity_id: entityId }
    );

    if (pageResult.rows.length > 0) {
      await this.db.mutate(
        `INSERT OR REPLACE INTO page_tags (page_id, tag, created_at)
         VALUES ($entity_id, $tag, $now)`,
        { entity_id: entityId, tag, now }
      );
      return;
    }

    // Check if entity is a block
    const blockResult = await this.db.query(
      `SELECT block_id FROM blocks WHERE block_id = $entity_id`,
      { entity_id: entityId }
    );

    if (blockResult.rows.length > 0) {
      await this.db.mutate(
        `INSERT OR REPLACE INTO block_tags (block_id, tag, created_at)
         VALUES ($entity_id, $tag, $now)`,
        { entity_id: entityId, tag, now }
      );
      return;
    }

    // Entity not found in either table - still insert into block_tags as fallback
    // (this preserves the original behavior where any entity_id was accepted)
    await this.db.mutate(
      `INSERT OR REPLACE INTO block_tags (block_id, tag, created_at)
       VALUES ($entity_id, $tag, $now)`,
      { entity_id: entityId, tag, now }
    );
  }

  /**
   * Remove a tag from an entity.
   * Attempts to delete from both tables since we may not know the entity type.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param tag - The tag to remove (case-sensitive)
   */
  async removeTag(entityId: string, tag: string): Promise<void> {
    // Try both tables - one will match, the other is a no-op
    await this.db.mutate(
      `DELETE FROM block_tags WHERE block_id = $entity_id AND tag = $tag`,
      { entity_id: entityId, tag }
    );

    await this.db.mutate(
      `DELETE FROM page_tags WHERE page_id = $entity_id AND tag = $tag`,
      { entity_id: entityId, tag }
    );
  }
}
