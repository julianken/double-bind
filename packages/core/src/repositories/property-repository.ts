/**
 * PropertyRepository - Encapsulates all SQL queries for Property entities.
 *
 * Each method constructs parameterized SQL queries that are executed
 * against SQLite. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Properties are key-value pairs attached to any entity (page or block),
 * extracted from `key:: value` syntax in block content by the content parser.
 *
 * SQLite schema uses split tables (block_properties, page_properties) instead
 * of a unified CozoDB properties relation. Queries use UNION ALL to check both.
 */

import type { GraphDB, Property } from '@double-bind/types';
import { parsePropertyRow } from './property-repository.schemas.js';

/**
 * Valid value types for properties.
 */
export type PropertyValueType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Repository for Property entity operations.
 * All methods use parameterized SQL queries for security.
 */
export class PropertyRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get all properties for a specific entity (page or block).
   * Queries both block_properties and page_properties via UNION ALL.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @returns Array of properties associated with the entity
   */
  async getByEntity(entityId: string): Promise<Property[]> {
    const script = `
      SELECT block_id AS entity_id, key, value, value_type, updated_at
      FROM block_properties
      WHERE block_id = $entity_id
      UNION ALL
      SELECT page_id AS entity_id, key, value, value_type, updated_at
      FROM page_properties
      WHERE page_id = $entity_id
    `;

    const result = await this.db.query(script, { entity_id: entityId });

    return result.rows.map((row) => parsePropertyRow(row as unknown[]));
  }

  /**
   * Set a property on an entity.
   * Upserts: if the property exists, it is replaced; otherwise, it is created.
   * Determines whether the entity is a page or block by checking both tables.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param key - The property key
   * @param value - The property value (stored as string)
   * @param valueType - The value type for interpretation (defaults to 'string')
   */
  async set(
    entityId: string,
    key: string,
    value: string,
    valueType: PropertyValueType = 'string'
  ): Promise<void> {
    const now = Date.now();

    // Check if entity is a page
    const pageResult = await this.db.query(
      `SELECT page_id FROM pages WHERE page_id = $entity_id`,
      { entity_id: entityId }
    );

    if (pageResult.rows.length > 0) {
      await this.db.mutate(
        `INSERT OR REPLACE INTO page_properties (page_id, key, value, value_type, updated_at)
         VALUES ($entity_id, $key, $value, $value_type, $now)`,
        { entity_id: entityId, key, value, value_type: valueType, now }
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
        `INSERT OR REPLACE INTO block_properties (block_id, key, value, value_type, updated_at)
         VALUES ($entity_id, $key, $value, $value_type, $now)`,
        { entity_id: entityId, key, value, value_type: valueType, now }
      );
      return;
    }

    // Entity not found - insert into block_properties as fallback
    await this.db.mutate(
      `INSERT OR REPLACE INTO block_properties (block_id, key, value, value_type, updated_at)
       VALUES ($entity_id, $key, $value, $value_type, $now)`,
      { entity_id: entityId, key, value, value_type: valueType, now }
    );
  }

  /**
   * Remove a property from an entity.
   * Attempts to delete from both tables since we may not know the entity type.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param key - The property key to remove
   */
  async remove(entityId: string, key: string): Promise<void> {
    // Try both tables - one will match, the other is a no-op
    await this.db.mutate(
      `DELETE FROM block_properties WHERE block_id = $entity_id AND key = $key`,
      { entity_id: entityId, key }
    );

    await this.db.mutate(
      `DELETE FROM page_properties WHERE page_id = $entity_id AND key = $key`,
      { entity_id: entityId, key }
    );
  }
}
