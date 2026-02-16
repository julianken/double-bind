/**
 * Zod validation schemas for PropertyRepository
 *
 * Validates SQLite query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Property } from '@double-bind/types';

/**
 * Valid value types for properties.
 */
const ValueTypeSchema = z.enum(['string', 'number', 'boolean', 'date']);

/**
 * Schema for validating raw SQLite row tuple from block_properties/page_properties tables.
 * Order matches: entity_id, key, value, value_type, updated_at
 */
export const PropertyRowSchema = z.tuple([
  z.string(), // entity_id (PageId or BlockId)
  z.string(), // key
  z.string(), // value (stored as string, interpreted based on value_type)
  ValueTypeSchema, // value_type
  z.number(), // updated_at (Unix timestamp)
]);

export type PropertyRow = z.infer<typeof PropertyRowSchema>;

/**
 * Schema for validated Property domain object.
 * Matches the Property interface from @double-bind/types.
 */
export const PropertySchema = z.object({
  entityId: z.string(),
  key: z.string(),
  value: z.string(),
  valueType: ValueTypeSchema,
  updatedAt: z.number(),
});

/**
 * Parses a raw SQLite row into a Property domain object.
 *
 * @param row - Raw row from SQLite query result
 * @returns Property domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parsePropertyRow(row: unknown[]): Property {
  try {
    const [entityId, key, value, valueType, updatedAt] = PropertyRowSchema.parse(row);

    return PropertySchema.parse({
      entityId,
      key,
      value,
      valueType,
      updatedAt,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse property row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
