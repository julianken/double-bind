/**
 * Zod validation schemas for PageRepository
 *
 * Validates database query results at the boundary between raw rows and domain types.
 * Throws DoubleBindError(DB_QUERY_FAILED) with Zod error as cause on validation failure.
 *
 * SQLite compatibility: Boolean fields use sqliteBool which accepts both
 * native booleans (true/false) and SQLite integers (0/1), converting to boolean.
 */

import { z } from 'zod';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { Page } from '@double-bind/types';

/**
 * Schema for boolean values that may come from SQLite as 0/1 integers.
 * Backwards-compatible: works with both CozoDB booleans and SQLite integers.
 */
const sqliteBool = z.union([
  z.boolean(),
  z.number().transform((n) => n !== 0),
]);

/**
 * Schema for validating raw database row tuple from pages relation.
 * Order matches: page_id, title, created_at, updated_at, is_deleted, daily_note_date
 */
export const PageRowSchema = z.tuple([
  z.string(), // page_id
  z.string(), // title
  z.number(), // created_at (Unix timestamp)
  z.number(), // updated_at (Unix timestamp)
  sqliteBool, // is_deleted (boolean or 0/1)
  z.string().nullable(), // daily_note_date (YYYY-MM-DD or null)
]);

export type PageRow = z.infer<typeof PageRowSchema>;

/**
 * Schema for validated Page domain object.
 * Matches the Page interface from @double-bind/types.
 */
export const PageSchema = z.object({
  pageId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  isDeleted: z.boolean(),
  dailyNoteDate: z.string().nullable(),
});

/**
 * Parses a raw CozoDB row into a Page domain object.
 *
 * @param row - Raw row from CozoDB query result
 * @returns Page domain object
 * @throws DoubleBindError with DB_QUERY_FAILED code if validation fails
 */
export function parsePageRow(row: unknown[]): Page {
  try {
    const [pageId, title, createdAt, updatedAt, isDeleted, dailyNoteDate] =
      PageRowSchema.parse(row);

    return PageSchema.parse({
      pageId,
      title,
      createdAt,
      updatedAt,
      isDeleted,
      dailyNoteDate,
    });
  } catch (error) {
    throw new DoubleBindError(
      `Failed to parse page row: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.DB_QUERY_FAILED,
      error instanceof Error ? error : undefined
    );
  }
}
