// Migration runner - executes pending migrations in order

import type { GraphDB } from '@double-bind/types';
import type { Migration, MigrationResult } from './types.js';
import { ALL_MIGRATIONS } from './registry.js';

/**
 * Split a migration script into individual statements.
 *
 * CozoDB doesn't support multiple system commands (like :create, :put) in a single query.
 * This function splits the script so each statement can be executed separately.
 *
 * @param script - The full migration script
 * @returns Array of individual statements to execute
 */
function splitIntoStatements(script: string): string[] {
  const lines = script.split('\n');
  const statements: string[] = [];
  let currentStatement = '';
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Track brace depth to handle multi-line statements
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    currentStatement += line + '\n';

    // Statement is complete when braces are balanced and we have content
    if (braceDepth === 0 && currentStatement.trim()) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add any remaining content
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

/**
 * Metadata relation key for tracking applied migrations.
 */
const MIGRATIONS_KEY = 'applied_migrations';

/**
 * Metadata relation key for schema version.
 */
const SCHEMA_VERSION_KEY = 'schema_version';

/**
 * Query to read a value from the metadata relation.
 */
const METADATA_QUERY = `?[value] := *metadata{ key: $key, value }`;

/**
 * Get the list of migration names that have already been applied.
 *
 * Reads from the metadata relation. If the relation doesn't exist yet
 * (fresh database), returns an empty array.
 *
 * @param db - Database connection
 * @returns Array of applied migration names
 */
export async function getAppliedMigrations(db: GraphDB): Promise<string[]> {
  try {
    const result = await db.query<string>(METADATA_QUERY, { key: MIGRATIONS_KEY });

    if (result.rows.length === 0) {
      return [];
    }

    // Value is stored as JSON array string
    const value = result.rows[0]?.[0];
    if (typeof value !== 'string') {
      return [];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    // Metadata relation doesn't exist yet (fresh database)
    return [];
  }
}

/**
 * Get the current schema version.
 *
 * Reads from the metadata relation. If the relation doesn't exist yet
 * (fresh database), returns 0.
 *
 * @param db - Database connection
 * @returns Current schema version number
 */
export async function getSchemaVersion(db: GraphDB): Promise<number> {
  try {
    const result = await db.query<string>(METADATA_QUERY, { key: SCHEMA_VERSION_KEY });

    if (result.rows.length === 0) {
      return 0;
    }

    const value = result.rows[0]?.[0];
    if (typeof value !== 'string') {
      return 0;
    }

    const version = parseInt(value, 10);
    return isNaN(version) ? 0 : version;
  } catch {
    // Metadata relation doesn't exist yet (fresh database)
    return 0;
  }
}

/**
 * Run all pending migrations in version order.
 *
 * Migrations are applied sequentially. If any migration fails, execution
 * stops immediately and the error is recorded in the result.
 *
 * Each migration's `up` script is executed via `db.mutate()`. The script
 * should update the schema_version and applied_migrations metadata.
 *
 * @param db - Database connection
 * @returns Migration result with applied, skipped, and error information
 *
 * @example
 * ```typescript
 * const result = await runMigrations(db);
 *
 * if (result.errors.length > 0) {
 *   // Handle migration failure
 *   throw new Error(`Migration failed: ${result.errors[0].error}`);
 * }
 * // result.applied contains newly applied migrations
 * // result.alreadyApplied contains previously applied migrations
 * ```
 */
export async function runMigrations(db: GraphDB): Promise<MigrationResult> {
  const applied = await getAppliedMigrations(db);
  const appliedSet = new Set(applied);

  // Filter to pending migrations and sort by version
  const pending = ALL_MIGRATIONS.filter((m) => !appliedSet.has(m.name)).sort(
    (a, b) => a.version - b.version
  );

  const result: MigrationResult = {
    applied: [],
    alreadyApplied: [...applied],
    errors: [],
  };

  for (const migration of pending) {
    try {
      // Execute the migration's up script
      // Split by lines starting with : (system commands like :create, :put)
      // and execute each separately since CozoDB doesn't support multiple system commands in one query
      const statements = splitIntoStatements(migration.up);
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]!;
        await db.mutate(stmt);
      }

      // Record that this migration was applied
      result.applied.push(migration.name);

      // Update the applied migrations list in metadata
      await updateAppliedMigrations(db, [...applied, ...result.applied]);
    } catch (error) {
      result.errors.push({
        migration: migration.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Stop on first error
      break;
    }
  }

  return result;
}

/**
 * Update the list of applied migrations in the metadata relation.
 *
 * @param db - Database connection
 * @param migrations - Complete list of applied migration names
 */
async function updateAppliedMigrations(db: GraphDB, migrations: string[]): Promise<void> {
  const value = JSON.stringify(migrations);
  await db.mutate(`?[key, value] <- [[$key, $value]] :put metadata {key => value}`, {
    key: MIGRATIONS_KEY,
    value,
  });
}

/**
 * Run a single migration (for testing or manual execution).
 *
 * Does NOT update the applied migrations list. Use this for testing
 * individual migrations in isolation.
 *
 * @param db - Database connection
 * @param migration - The migration to run
 * @throws If the migration fails
 */
export async function runSingleMigration(db: GraphDB, migration: Migration): Promise<void> {
  await db.mutate(migration.up);
}

/**
 * Rollback a single migration (development only).
 *
 * WARNING: This uses the migration's `down` script, which typically
 * drops relations and loses data. Only use during development.
 *
 * @param db - Database connection
 * @param migration - The migration to roll back
 * @throws If the rollback fails
 */
export async function rollbackMigration(db: GraphDB, migration: Migration): Promise<void> {
  await db.mutate(migration.down);
}
