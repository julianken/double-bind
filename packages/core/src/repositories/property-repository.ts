/**
 * PropertyRepository - Encapsulates all Datalog queries for Property entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Properties are key-value pairs attached to any entity (page or block),
 * extracted from `key:: value` syntax in block content by the content parser.
 */

import type { GraphDB, Property } from '@double-bind/types';
import { parsePropertyRow } from './property-repository.schemas.js';

/**
 * Valid value types for properties.
 */
export type PropertyValueType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Repository for Property entity operations.
 * All methods use parameterized Datalog queries for security.
 */
export class PropertyRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get all properties for a specific entity (page or block).
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @returns Array of properties associated with the entity
   */
  async getByEntity(entityId: string): Promise<Property[]> {
    const script = `
?[entity_id, key, value, value_type, updated_at] :=
    *properties{ entity_id: $entity_id, key, value, value_type, updated_at }
`.trim();

    const result = await this.db.query(script, { entity_id: entityId });

    return result.rows.map((row) => parsePropertyRow(row as unknown[]));
  }

  /**
   * Set a property on an entity.
   * Upserts: if the property exists, it is replaced; otherwise, it is created.
   * CozoDB `:put` on a keyed relation (entity_id, key) replaces existing rows.
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

    const script = `
?[entity_id, key, value, value_type, updated_at] <- [[$entity_id, $key, $value, $value_type, $now]]
:put properties { entity_id, key, value, value_type, updated_at }
`.trim();

    await this.db.mutate(script, {
      entity_id: entityId,
      key,
      value,
      value_type: valueType,
      now,
    });
  }

  /**
   * Remove a property from an entity.
   *
   * @param entityId - The entity identifier (PageId or BlockId)
   * @param key - The property key to remove
   */
  async remove(entityId: string, key: string): Promise<void> {
    const script = `
?[entity_id, key] <- [[$entity_id, $key]]
:rm properties { entity_id, key }
`.trim();

    await this.db.mutate(script, {
      entity_id: entityId,
      key,
    });
  }
}
