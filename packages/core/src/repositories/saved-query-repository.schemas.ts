/**
 * Zod validation schemas for SavedQueryRepository
 *
 * Validates CozoDB query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode, SavedQueryType } from '@double-bind/types';
import type { SavedQuery } from '@double-bind/types';

/**
 * Schema for validating raw CozoDB row tuple from saved_queries relation.
 * Order matches: id, name, type, definition, description, created_at, updated_at
 */
export const SavedQueryRowSchema = z.tuple([
  z.string(), // id
  z.string(), // name
  z.string(), // type
  z.string(), // definition
  z.string().nullable(), // description
  z.number(), // created_at (Unix timestamp)
  z.number(), // updated_at (Unix timestamp)
]);

export type SavedQueryRow = z.infer<typeof SavedQueryRowSchema>;

/**
 * Schema for validated SavedQuery domain object.
 * Matches the SavedQuery interface from @double-bind/types.
 */
export const SavedQuerySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(SavedQueryType),
  definition: z.string(),
  description: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/**
 * Parses a raw CozoDB row into a SavedQuery domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns SavedQuery domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseSavedQueryRow(row: unknown[]): SavedQuery {
  try {
    const [id, name, type, definition, description, createdAt, updatedAt] =
      SavedQueryRowSchema.parse(row);

    return SavedQuerySchema.parse({
      id,
      name,
      type: type as SavedQueryType,
      definition,
      description,
      createdAt,
      updatedAt,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse saved query row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
