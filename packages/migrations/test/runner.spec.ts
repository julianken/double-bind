import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import {
  runMigrations,
  getAppliedMigrations,
  getSchemaVersion,
  runSingleMigration,
  rollbackMigration,
} from '../src/runner.js';
import type { Migration } from '../src/types.js';

// Mock the registry to control migrations in tests
vi.mock('../src/registry.js', () => ({
  ALL_MIGRATIONS: [] as Migration[],
}));

// Import the mocked registry so we can modify it
import { ALL_MIGRATIONS } from '../src/registry.js';

describe('getAppliedMigrations', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  it('returns empty array when metadata relation does not exist', async () => {
    // No seeded data - simulates fresh database
    const result = await getAppliedMigrations(db);
    expect(result).toEqual([]);
  });

  it('returns empty array when no migrations have been applied', async () => {
    db.seed('metadata', [['applied_migrations', '[]']]);

    const result = await getAppliedMigrations(db);
    expect(result).toEqual([]);
  });

  it('returns list of applied migration names', async () => {
    db.seed('metadata', [['applied_migrations', '["001-initial-schema","002-add-daily-notes"]']]);

    const result = await getAppliedMigrations(db);
    expect(result).toEqual(['001-initial-schema', '002-add-daily-notes']);
  });

  it('handles malformed JSON gracefully', async () => {
    db.seed('metadata', [['applied_migrations', 'not-json']]);

    const result = await getAppliedMigrations(db);
    expect(result).toEqual([]);
  });

  it('filters non-string values from the array', async () => {
    db.seed('metadata', [
      ['applied_migrations', '["001-initial-schema", 123, null, "002-add-daily-notes"]'],
    ]);

    const result = await getAppliedMigrations(db);
    expect(result).toEqual(['001-initial-schema', '002-add-daily-notes']);
  });
});

describe('getSchemaVersion', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  it('returns 0 when metadata relation does not exist', async () => {
    // No seeded data - simulates fresh database
    const result = await getSchemaVersion(db);
    expect(result).toBe(0);
  });

  it('returns 0 when schema_version key does not exist', async () => {
    db.seed('metadata', [['other_key', 'some_value']]);

    const result = await getSchemaVersion(db);
    expect(result).toBe(0);
  });

  it('returns the current schema version', async () => {
    db.seed('metadata', [['schema_version', '5']]);

    const result = await getSchemaVersion(db);
    expect(result).toBe(5);
  });

  it('handles non-numeric values gracefully', async () => {
    db.seed('metadata', [['schema_version', 'not-a-number']]);

    const result = await getSchemaVersion(db);
    expect(result).toBe(0);
  });
});

describe('runMigrations', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
    // Clear the mocked registry
    ALL_MIGRATIONS.length = 0;
  });

  it('returns empty result when no migrations are defined', async () => {
    const result = await runMigrations(db);

    expect(result.applied).toEqual([]);
    expect(result.alreadyApplied).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('applies pending migrations in version order', async () => {
    // Add migrations in non-sequential order to test sorting
    ALL_MIGRATIONS.push(
      {
        version: 2,
        name: '002-add-daily-notes',
        up: ':put metadata { key: "schema_version", value: "2" }',
        down: '::remove daily_notes',
      },
      {
        version: 1,
        name: '001-initial-schema',
        up: ':put metadata { key: "schema_version", value: "1" }',
        down: '::remove blocks',
      }
    );

    const result = await runMigrations(db);

    expect(result.applied).toEqual(['001-initial-schema', '002-add-daily-notes']);
    expect(result.alreadyApplied).toEqual([]);
    expect(result.errors).toEqual([]);

    // Verify mutations were called in correct order
    expect(db.mutations.length).toBeGreaterThanOrEqual(2);
    expect(db.mutations[0]!.script).toContain('schema_version');
  });

  it('skips already applied migrations', async () => {
    ALL_MIGRATIONS.push(
      {
        version: 1,
        name: '001-initial-schema',
        up: ':put metadata { key: "schema_version", value: "1" }',
        down: '::remove blocks',
      },
      {
        version: 2,
        name: '002-add-daily-notes',
        up: ':put metadata { key: "schema_version", value: "2" }',
        down: '::remove daily_notes',
      }
    );

    // Seed that first migration is already applied
    db.seed('metadata', [['applied_migrations', '["001-initial-schema"]']]);

    const result = await runMigrations(db);

    expect(result.applied).toEqual(['002-add-daily-notes']);
    expect(result.alreadyApplied).toEqual(['001-initial-schema']);
    expect(result.errors).toEqual([]);
  });

  it('stops on first error and reports it', async () => {
    // Create a mock that throws when the second migration's UP script runs
    // Each migration does: 1) db.mutate(up), 2) db.mutate(updateAppliedMigrations)
    // So call 1 = migration 1 up, call 2 = update metadata, call 3 = migration 2 up
    const failingDb = new MockGraphDB();
    let callCount = 0;
    const originalMutate = failingDb.mutate.bind(failingDb);
    failingDb.mutate = async (script: string, params?: Record<string, unknown>) => {
      callCount++;
      // Fail on the third mutation (which is the second migration's up script)
      if (callCount === 3) {
        throw new Error('Database error: relation already exists');
      }
      return originalMutate(script, params);
    };

    ALL_MIGRATIONS.push(
      {
        version: 1,
        name: '001-initial-schema',
        up: ':create blocks { block_id: String }',
        down: '::remove blocks',
      },
      {
        version: 2,
        name: '002-failing-migration',
        up: ':create blocks { block_id: String }', // Duplicate - will fail
        down: '::remove blocks',
      },
      {
        version: 3,
        name: '003-never-reached',
        up: ':create something { id: String }',
        down: '::remove something',
      }
    );

    const result = await runMigrations(failingDb);

    expect(result.applied).toEqual(['001-initial-schema']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      migration: '002-failing-migration',
      error: 'Database error: relation already exists',
    });
    // Third migration should not have been attempted
    expect(result.applied).not.toContain('003-never-reached');
  });

  it('updates applied migrations after each successful migration', async () => {
    ALL_MIGRATIONS.push({
      version: 1,
      name: '001-initial-schema',
      up: ':create blocks { block_id: String }',
      down: '::remove blocks',
    });

    await runMigrations(db);

    // Find the mutation that updated applied_migrations (via params.key)
    const updateMutation = db.mutations.find(
      (m) => m.params && m.params.key === 'applied_migrations'
    );
    expect(updateMutation).toBeDefined();
    expect(updateMutation!.params).toHaveProperty('value');
    expect(JSON.parse(updateMutation!.params.value as string)).toContain('001-initial-schema');
  });
});

describe('runSingleMigration', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  it('executes the migration up script', async () => {
    const migration: Migration = {
      version: 1,
      name: '001-initial-schema',
      up: ':create blocks { block_id: String }',
      down: '::remove blocks',
    };

    await runSingleMigration(db, migration);

    expect(db.mutations).toHaveLength(1);
    expect(db.mutations[0]!.script).toBe(':create blocks { block_id: String }');
  });

  it('throws if migration fails', async () => {
    const failingDb = new MockGraphDB();
    failingDb.mutate = async () => {
      throw new Error('Syntax error');
    };

    const migration: Migration = {
      version: 1,
      name: '001-initial-schema',
      up: 'invalid syntax',
      down: '::remove blocks',
    };

    await expect(runSingleMigration(failingDb, migration)).rejects.toThrow('Syntax error');
  });
});

describe('rollbackMigration', () => {
  let db: MockGraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  it('executes the migration down script', async () => {
    const migration: Migration = {
      version: 1,
      name: '001-initial-schema',
      up: ':create blocks { block_id: String }',
      down: '::remove blocks',
    };

    await rollbackMigration(db, migration);

    expect(db.mutations).toHaveLength(1);
    expect(db.mutations[0]!.script).toBe('::remove blocks');
  });
});
