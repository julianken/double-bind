// SQLite migration registry - ordered list of all migrations
// New migrations are added here in version order

import type { SqliteMigration } from '../sqlite-types.js';
import { migration as v001 } from './001-initial-schema.js';

/**
 * All SQLite migrations in version order.
 *
 * Each migration is imported from its own file in the sqlite/ directory.
 * Migrations are applied in version order (lowest to highest).
 */
export const ALL_SQLITE_MIGRATIONS: SqliteMigration[] = [v001];
