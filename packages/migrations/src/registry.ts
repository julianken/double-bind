// Migration registry - ordered list of all migrations
// New migrations are added here in version order

import type { Migration } from './types.js';
import { migration as v001 } from './migrations/001-initial-schema.js';

/**
 * All migrations in version order.
 *
 * Each migration is imported from its own file in the migrations/ directory.
 * Migrations are applied in version order (lowest to highest).
 */
export const ALL_MIGRATIONS: Migration[] = [v001];
