/**
 * Zod validation schemas for LinkRepository
 *
 * Validates CozoDB query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Link, BlockRef } from '@double-bind/types';

/**
 * Valid link types.
 */
const LinkTypeSchema = z.enum(['reference', 'embed', 'tag']);

/**
 * Schema for validating raw CozoDB row tuple from links relation.
 * Order matches: source_id, target_id, link_type, created_at, context_block_id
 */
export const LinkRowSchema = z.tuple([
  z.string(), // source_id (page_id of source page)
  z.string(), // target_id (page_id of target page)
  LinkTypeSchema, // link_type
  z.number(), // created_at (Unix timestamp)
  z.string().nullable(), // context_block_id (block containing the link)
]);

export type LinkRow = z.infer<typeof LinkRowSchema>;

/**
 * Schema for validated Link domain object.
 * Matches the Link interface from @double-bind/types.
 */
export const LinkSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  linkType: LinkTypeSchema,
  createdAt: z.number(),
  contextBlockId: z.string().nullable(),
});

/**
 * Schema for validating raw CozoDB row tuple from block_refs relation.
 * Order matches: source_block_id, target_block_id, created_at
 */
export const BlockRefRowSchema = z.tuple([
  z.string(), // source_block_id
  z.string(), // target_block_id
  z.number(), // created_at (Unix timestamp)
]);

export type BlockRefRow = z.infer<typeof BlockRefRowSchema>;

/**
 * Schema for validated BlockRef domain object.
 * Matches the BlockRef interface from @double-bind/types.
 */
export const BlockRefSchema = z.object({
  sourceBlockId: z.string(),
  targetBlockId: z.string(),
  createdAt: z.number(),
});

/**
 * Parses a raw CozoDB row into a Link domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns Link domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseLinkRow(row: unknown[]): Link {
  try {
    const [sourceId, targetId, linkType, createdAt, contextBlockId] = LinkRowSchema.parse(row);

    return LinkSchema.parse({
      sourceId,
      targetId,
      linkType,
      createdAt,
      contextBlockId,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse link row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Parses a raw CozoDB row into a BlockRef domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns BlockRef domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseBlockRefRow(row: unknown[]): BlockRef {
  try {
    const [sourceBlockId, targetBlockId, createdAt] = BlockRefRowSchema.parse(row);

    return BlockRefSchema.parse({
      sourceBlockId,
      targetBlockId,
      createdAt,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse block ref row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
