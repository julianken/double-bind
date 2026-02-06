/**
 * Zod validation schemas for TagRepository
 *
 * Validates CozoDB query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Tag } from '@double-bind/types';

/**
 * Schema for validating raw CozoDB row tuple from tags relation.
 * Order matches: entity_id, tag, created_at
 */
export const TagRowSchema = z.tuple([
  z.string(), // entity_id (PageId or BlockId)
  z.string(), // tag
  z.number(), // created_at (Unix timestamp)
]);

export type TagRow = z.infer<typeof TagRowSchema>;

/**
 * Schema for validated Tag domain object.
 * Matches the Tag interface from @double-bind/types.
 */
export const TagSchema = z.object({
  entityId: z.string(),
  tag: z.string(),
  createdAt: z.number(),
});

/**
 * Parses a raw CozoDB row into a Tag domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns Tag domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseTagRow(row: unknown[]): Tag {
  try {
    const [entityId, tag, createdAt] = TagRowSchema.parse(row);

    return TagSchema.parse({
      entityId,
      tag,
      createdAt,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse tag row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
