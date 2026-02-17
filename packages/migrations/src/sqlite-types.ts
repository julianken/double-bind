// Migration types for SQLite schema management

/**
 * A SQLite database migration definition.
 *
 * Migrations are applied in version order. Each migration contains
 * SQL statements to apply (up) and reverse (down) the schema change.
 */
export interface SqliteMigration {
  /** Numeric version for ordering. Must be unique and sequential. */
  version: number;

  /** Human-readable name (e.g., '001-initial-schema'). Must be unique. */
  name: string;

  /** SQL statements to apply this migration. May contain multiple statements. */
  up: string;

  /**
   * SQL statements to reverse this migration.
   * WARNING: DROP TABLE operations are destructive.
   * Rollback should only be used during development.
   */
  down: string;
}

/**
 * Result of running SQLite migrations.
 */
export interface SqliteMigrationResult {
  /** Migration names that were successfully applied in this run. */
  applied: string[];

  /** Migration names that were already applied (skipped). */
  alreadyApplied: string[];

  /** Errors encountered during migration. Stops on first error. */
  errors: Array<{ migration: string; error: string }>;
}

/**
 * Error thrown when SQLite migration execution fails.
 */
export class SqliteMigrationError extends Error {
  constructor(
    public readonly migrationName: string,
    public readonly cause: unknown
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`SQLite migration '${migrationName}' failed: ${message}`);
    this.name = 'SqliteMigrationError';
  }
}
