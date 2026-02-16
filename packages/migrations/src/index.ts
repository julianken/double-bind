// @double-bind/migrations - CozoDB schema creation/migration
// Dependencies: @double-bind/types

// CozoDB Types
export type { Migration, MigrationResult } from './types.js';
export { MigrationError } from './types.js';

// CozoDB Registry
export { ALL_MIGRATIONS } from './registry.js';

// CozoDB Runner functions
export {
  runMigrations,
  getAppliedMigrations,
  getSchemaVersion,
  runSingleMigration,
  rollbackMigration,
} from './runner.js';

// SQLite Types
export type { SqliteMigration, SqliteMigrationResult } from './sqlite-types.js';
export { SqliteMigrationError } from './sqlite-types.js';

// SQLite Registry
export { ALL_SQLITE_MIGRATIONS } from './sqlite/registry.js';

// SQLite Runner functions
export {
  runMigrations as runSqliteMigrations,
  getAppliedMigrations as getSqliteAppliedMigrations,
  getSchemaVersion as getSqliteSchemaVersion,
  runSingleMigration as runSingleSqliteMigration,
  rollbackMigration as rollbackSqliteMigration,
} from './sqlite/runner.js';
export type { SqliteDatabase, SqliteStatement } from './sqlite/runner.js';
