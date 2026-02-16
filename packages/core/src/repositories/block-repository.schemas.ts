/**
 * Zod validation schemas for BlockRepository
 *
 * Validates database query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 *
 * SQLite compatibility: Boolean fields use sqliteBool which accepts both
 * native booleans (true/false) and SQLite integers (0/1), converting to boolean.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Block, BlockVersion } from '@double-bind/types';

/**
 * Schema for boolean values that may come from SQLite as 0/1 integers.
 * Backwards-compatible: works with both CozoDB booleans and SQLite integers.
 */
const sqliteBool = z.union([
  z.boolean(),
  z.number().transform((n) => n !== 0),
]);

/**
 * Valid content types for blocks.
 */
const ContentTypeSchema = z.enum(['text', 'heading', 'code', 'todo', 'query']);

/**
 * Valid operations for block history.
 */
const OperationSchema = z.enum(['create', 'update', 'delete', 'move', 'restore']);

/**
 * Schema for validating raw database row tuple from blocks relation.
 * Order matches: block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at
 */
export const BlockRowSchema = z.tuple([
  z.string(), // block_id
  z.string(), // page_id
  z.string().nullable(), // parent_id (null for root blocks)
  z.string(), // content
  ContentTypeSchema, // content_type
  z.string(), // order (fractional indexing string)
  sqliteBool, // is_collapsed (boolean or 0/1)
  sqliteBool, // is_deleted (boolean or 0/1)
  z.number(), // created_at (Unix timestamp)
  z.number(), // updated_at (Unix timestamp)
]);

export type BlockRow = z.infer<typeof BlockRowSchema>;

/**
 * Schema for validated Block domain object.
 * Matches the Block interface from @double-bind/types.
 */
export const BlockSchema = z.object({
  blockId: z.string(),
  pageId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  contentType: ContentTypeSchema,
  order: z.string(),
  isCollapsed: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/**
 * Schema for validating raw database row tuple from block_history relation.
 * Order matches: block_id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp
 */
export const BlockVersionRowSchema = z.tuple([
  z.string(), // block_id
  z.number(), // version
  z.string(), // content
  z.string().nullable(), // parent_id
  z.string(), // order
  sqliteBool, // is_collapsed (boolean or 0/1)
  sqliteBool, // is_deleted (boolean or 0/1)
  OperationSchema, // operation
  z.number(), // timestamp
]);

export type BlockVersionRow = z.infer<typeof BlockVersionRowSchema>;

/**
 * Schema for validated BlockVersion domain object.
 * Matches the BlockVersion interface from @double-bind/types.
 */
export const BlockVersionSchema = z.object({
  blockId: z.string(),
  version: z.number(),
  content: z.string(),
  parentId: z.string().nullable(),
  order: z.string(),
  isCollapsed: z.boolean(),
  isDeleted: z.boolean(),
  operation: OperationSchema,
  timestamp: z.number(),
});

/**
 * Parses a raw CozoDB row into a Block domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns Block domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseBlockRow(row: unknown[]): Block {
  try {
    const [
      blockId,
      pageId,
      parentId,
      content,
      contentType,
      order,
      isCollapsed,
      isDeleted,
      createdAt,
      updatedAt,
    ] = BlockRowSchema.parse(row);

    return BlockSchema.parse({
      blockId,
      pageId,
      parentId,
      content,
      contentType,
      order,
      isCollapsed,
      isDeleted,
      createdAt,
      updatedAt,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse block row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Parses a raw CozoDB row into a BlockVersion domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns BlockVersion domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parseBlockVersionRow(row: unknown[]): BlockVersion {
  try {
    const [
      blockId,
      version,
      content,
      parentId,
      order,
      isCollapsed,
      isDeleted,
      operation,
      timestamp,
    ] = BlockVersionRowSchema.parse(row);

    return BlockVersionSchema.parse({
      blockId,
      version,
      content,
      parentId,
      order,
      isCollapsed,
      isDeleted,
      operation,
      timestamp,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse block version row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
