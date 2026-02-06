// Migration types for CozoDB schema management

/**
 * A database migration definition.
 *
 * Migrations are applied in version order. Each migration contains
 * CozoScript to apply (up) and reverse (down) the schema change.
 *
 * Note: CozoDB has no ALTER TABLE, so schema changes require creating
 * new relations and migrating data. The `down` script is best-effort
 * and should only be used during development.
 */
export interface Migration {
  /** Numeric version for ordering. Must be unique and sequential. */
  version: number;

  /** Human-readable name (e.g., '001-initial-schema'). Must be unique. */
  name: string;

  /** CozoScript to apply this migration. May contain multiple statements. */
  up: string;

  /**
   * CozoScript to reverse this migration (best-effort).
   * WARNING: In CozoDB, ::remove drops the entire relation including data.
   * Rollback is only useful during development.
   */
  down: string;
}

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  /** Migration names that were successfully applied in this run. */
  applied: string[];

  /** Migration names that were already applied (skipped). */
  alreadyApplied: string[];

  /** Errors encountered during migration. Stops on first error. */
  errors: Array<{ migration: string; error: string }>;
}

/**
 * Error thrown when migration execution fails.
 */
export class MigrationError extends Error {
  constructor(
    public readonly migrationName: string,
    public readonly cause: unknown
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Migration '${migrationName}' failed: ${message}`);
    this.name = 'MigrationError';
  }
}
