// @double-bind/migrations - CozoDB schema creation/migration
// Dependencies: @double-bind/types

// Types
export type { Migration, MigrationResult } from './types.js';
export { MigrationError } from './types.js';

// Registry
export { ALL_MIGRATIONS } from './registry.js';

// Runner functions
export {
  runMigrations,
  getAppliedMigrations,
  getSchemaVersion,
  runSingleMigration,
  rollbackMigration,
} from './runner.js';
