/**
 * TagRepository - Encapsulates all Datalog queries for Tag entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Tags are case-sensitive (no normalization at repository level).
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
 * All methods use parameterized Datalog queries for security.
 */
export class TagRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get all tags for a specific entity (page or block).
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @returns Array of tags associated with the entity
   */
  async getByEntity(entityId: string): Promise<Tag[]> {
    const script = `
?[entity_id, tag, created_at] :=
    *tags{ entity_id: $entity_id, tag, created_at }
`.trim();

    const result = await this.db.query(script, { entity_id: entityId });

    return result.rows.map((row) => parseTagRow(row as unknown[]));
  }

  /**
   * Get all entities that have a specific tag.
   *
   * @param tag - The tag to search for (case-sensitive)
   * @returns Array of tags (each containing an entity reference)
   */
  async getByTag(tag: string): Promise<Tag[]> {
    const script = `
?[entity_id, tag, created_at] :=
    *tags{ entity_id, tag: $tag, created_at }
`.trim();

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
?[tag, count(entity_id)] :=
    *tags{ entity_id, tag }
:order -count(entity_id)
`.trim();

    const result = await this.db.query(script, {});

    return result.rows.map((row) => {
      const [tag, count] = row as [string, number];
      return { tag, count };
    });
  }

  /**
   * Add a tag to an entity.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param tag - The tag to add (case-sensitive)
   */
  async addTag(entityId: string, tag: string): Promise<void> {
    const now = Date.now();

    const script = `
?[entity_id, tag, created_at] <- [[$entity_id, $tag, $now]]
:put tags { entity_id, tag, created_at }
`.trim();

    await this.db.mutate(script, {
      entity_id: entityId,
      tag,
      now,
    });
  }

  /**
   * Remove a tag from an entity.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param tag - The tag to remove (case-sensitive)
   */
  async removeTag(entityId: string, tag: string): Promise<void> {
    const script = `
?[entity_id, tag] <- [[$entity_id, $tag]]
:rm tags { entity_id, tag }
`.trim();

    await this.db.mutate(script, {
      entity_id: entityId,
      tag,
    });
  }
}
