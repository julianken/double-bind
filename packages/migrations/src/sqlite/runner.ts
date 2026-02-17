// SQLite migration runner - applies migrations in version order
//
// Handles:
// - Schema versioning via schema_metadata table
// - Transaction safety (wraps each migration in BEGIN EXCLUSIVE...COMMIT)
// - PRAGMA statements (executed outside transactions)
// - Statement splitting (careful with trigger bodies containing semicolons)
// - Error handling with rollback on failure

import type { SqliteMigration, SqliteMigrationResult } from '../sqlite-types.js';
import { SqliteMigrationError } from '../sqlite-types.js';

/**
 * SQLite database interface (compatible with better-sqlite3 or similar).
 */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
}

export interface SqliteStatement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * Ensures the schema_metadata table exists.
 * Creates it if needed, initializing with schema_version=0 and empty applied_migrations list.
 */
function ensureSchemaMetadataTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Initialize if empty
  const row = db.prepare("SELECT value FROM schema_metadata WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  if (!row) {
    db.prepare("INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '0')").run();
    db.prepare(
      "INSERT INTO schema_metadata (key, value) VALUES ('applied_migrations', '[]')"
    ).run();
  }
}

/**
 * Gets the list of already-applied migration names from schema_metadata.
 */
export function getAppliedMigrations(db: SqliteDatabase): string[] {
  ensureSchemaMetadataTable(db);

  const row = db
    .prepare("SELECT value FROM schema_metadata WHERE key = 'applied_migrations'")
    .get() as { value: string } | undefined;

  if (!row) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Gets the current schema version from schema_metadata.
 */
export function getSchemaVersion(db: SqliteDatabase): number {
  ensureSchemaMetadataTable(db);

  const row = db.prepare("SELECT value FROM schema_metadata WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  if (!row) {
    return 0;
  }

  const version = parseInt(row.value, 10);
  return isNaN(version) ? 0 : version;
}

/**
 * Updates the applied_migrations list in schema_metadata.
 */
function setAppliedMigrations(db: SqliteDatabase, migrations: string[]): void {
  db.prepare("UPDATE schema_metadata SET value = ? WHERE key = 'applied_migrations'").run(
    JSON.stringify(migrations)
  );
}

/**
 * Updates the schema_version in schema_metadata.
 */
function setSchemaVersion(db: SqliteDatabase, version: number): void {
  db.prepare("UPDATE schema_metadata SET value = ? WHERE key = 'schema_version'").run(
    String(version)
  );
}

/**
 * Splits SQL into individual statements, preserving trigger bodies.
 *
 * Strategy: Split on semicolons followed by newlines at top level.
 * Trigger bodies (between BEGIN...END) may contain semicolons, but we split
 * on statement boundaries which are typically semicolon + newline.
 */
function splitSqlStatements(sql: string): string[] {
  const lines = sql.split('\n');
  const statements: string[] = [];
  let currentStatement = '';
  let inTrigger = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track trigger body boundaries
    if (trimmed.startsWith('CREATE TRIGGER')) {
      inTrigger = true;
    }

    currentStatement += line + '\n';

    // End of trigger body
    if (inTrigger && trimmed === 'END;') {
      inTrigger = false;
      statements.push(currentStatement.trim());
      currentStatement = '';
      continue;
    }

    // Regular statement ending (semicolon at end of line, not in trigger)
    if (!inTrigger && trimmed.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements.filter(
    (stmt) => stmt.length > 0 && !stmt.startsWith('--') && stmt !== ';' && !/^\s*$/.test(stmt)
  );
}

/**
 * Executes a single SQL statement.
 * PRAGMAs are executed directly (cannot be in transactions).
 * Other statements are executed within the current transaction.
 */
function executeStatement(db: SqliteDatabase, statement: string): void {
  const trimmed = statement.trim();

  // Skip comments and empty statements
  if (!trimmed || trimmed.startsWith('--')) {
    return;
  }

  // PRAGMAs must be executed outside transactions
  if (trimmed.toUpperCase().startsWith('PRAGMA')) {
    db.exec(trimmed);
    return;
  }

  // Regular statements
  db.exec(trimmed);
}

/**
 * Runs a single migration within a transaction.
 *
 * @param db - SQLite database instance
 * @param migration - Migration to apply
 * @throws {SqliteMigrationError} if migration fails
 */
export function runSingleMigration(db: SqliteDatabase, migration: SqliteMigration): void {
  const appliedMigrations = getAppliedMigrations(db);

  if (appliedMigrations.includes(migration.name)) {
    return; // Already applied
  }

  try {
    const statements = splitSqlStatements(migration.up);
    const pragmas = statements.filter((s) => s.trim().toUpperCase().startsWith('PRAGMA'));
    const regularStatements = statements.filter(
      (s) => !s.trim().toUpperCase().startsWith('PRAGMA')
    );

    // Execute PRAGMAs first (outside transaction)
    for (const pragma of pragmas) {
      executeStatement(db, pragma);
    }

    // Execute regular statements in a transaction
    db.exec('BEGIN EXCLUSIVE');

    try {
      for (const statement of regularStatements) {
        executeStatement(db, statement);
      }

      // Update metadata
      const newAppliedMigrations = [...appliedMigrations, migration.name];
      setAppliedMigrations(db, newAppliedMigrations);
      setSchemaVersion(db, migration.version);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    throw new SqliteMigrationError(migration.name, error);
  }
}

/**
 * Runs all pending migrations in version order.
 *
 * @param db - SQLite database instance
 * @param migrations - Array of migrations to apply (must be sorted by version)
 * @returns Result object with applied, skipped, and error info
 */
export function runMigrations(
  db: SqliteDatabase,
  migrations: SqliteMigration[]
): SqliteMigrationResult {
  ensureSchemaMetadataTable(db);

  const appliedMigrations = getAppliedMigrations(db);
  const result: SqliteMigrationResult = {
    applied: [],
    alreadyApplied: [],
    errors: [],
  };

  // Sort migrations by version (defensive)
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (appliedMigrations.includes(migration.name)) {
      result.alreadyApplied.push(migration.name);
      continue;
    }

    try {
      runSingleMigration(db, migration);
      result.applied.push(migration.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ migration: migration.name, error: message });
      break; // Stop on first error
    }
  }

  return result;
}

/**
 * Rolls back a single migration (best-effort, development only).
 *
 * WARNING: This runs the `down` script which typically drops tables.
 * Only use during development.
 *
 * @param db - SQLite database instance
 * @param migration - Migration to roll back
 * @param allMigrations - All migrations (needed to calculate remaining schema version)
 * @throws {SqliteMigrationError} if rollback fails
 */
export function rollbackMigration(
  db: SqliteDatabase,
  migration: SqliteMigration,
  allMigrations: SqliteMigration[]
): void {
  const appliedMigrations = getAppliedMigrations(db);

  if (!appliedMigrations.includes(migration.name)) {
    return; // Not applied, nothing to roll back
  }

  try {
    const statements = splitSqlStatements(migration.down);

    db.exec('BEGIN EXCLUSIVE');

    try {
      for (const statement of statements) {
        executeStatement(db, statement);
      }

      // Update metadata
      const newAppliedMigrations = appliedMigrations.filter((name) => name !== migration.name);
      setAppliedMigrations(db, newAppliedMigrations);

      // Set schema version to highest remaining migration version
      const remainingVersions = newAppliedMigrations
        .map((name) => {
          const m = allMigrations.find((mig) => mig.name === name);
          return m ? m.version : 0;
        })
        .filter((v) => v > 0);

      const newVersion = remainingVersions.length > 0 ? Math.max(...remainingVersions) : 0;
      setSchemaVersion(db, newVersion);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    throw new SqliteMigrationError(migration.name, error);
  }
}
