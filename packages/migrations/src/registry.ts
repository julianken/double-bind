// Migration registry - ordered list of all migrations
// New migrations are added here in version order

import type { Migration } from './types.js';

/**
 * All migrations in version order.
 *
 * Each migration is imported from its own file in the migrations/ directory.
 * DBB-136 will add the first migration (001-initial-schema).
 *
 * @example
 * ```typescript
 * // After DBB-136:
 * import { migration as v001 } from './migrations/001-initial-schema.js';
 *
 * export const ALL_MIGRATIONS: Migration[] = [
 *   v001,
 * ];
 * ```
 */
export const ALL_MIGRATIONS: Migration[] = [];
