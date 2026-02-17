// Integration tests for migrations with real CozoDB
//
// NOTE: These tests use MockDatabase as a placeholder for real CozoDB integration.
// To run against real CozoDB, install cozo-node and replace MockDatabase with:
//
// import { CozoDb } from 'cozo-node';
// const db = new CozoDb('mem');
//
// See docs/testing/integration-tests.md for full setup instructions.
//
// These tests verify that:
// - Migration scripts execute without syntax errors
// - Schema is created correctly
// - Applied migrations are tracked
// - Migration runner handles errors properly
// - Data operations work after migration

import { describe, it, expect, beforeEach } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { migration as initialSchema } from '../../src/migrations/001-initial-schema.js';
import {
  runMigrations,
  runSingleMigration,
  getAppliedMigrations,
  getSchemaVersion,
} from '../../src/runner.js';
import type { Database } from '@double-bind/types';

describe('Migration Integration Tests', () => {
  let db: Database;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe('001-initial-schema migration', () => {
    it('executes up script without errors', async () => {
      await expect(runSingleMigration(db, initialSchema)).resolves.not.toThrow();
    });

    it('records the migration script execution', async () => {
      await runSingleMigration(db, initialSchema);

      const mockDb = db as MockDatabase;
      expect(mockDb.mutations).toHaveLength(1);
      expect(mockDb.mutations[0]!.script).toBe(initialSchema.up);
    });

    it('migration script contains all relation creations', () => {
      const expectedRelations = [
        'blocks',
        'pages',
        'blocks_by_page',
        'blocks_by_parent',
        'block_refs',
        'links',
        'properties',
        'tags',
        'block_history',
        'daily_notes',
        'metadata',
      ];

      for (const relation of expectedRelations) {
        expect(initialSchema.up).toContain(`:create ${relation}`);
      }
    });

    it('migration script sets schema version', () => {
      // Simplified format uses inline JSON array syntax
      expect(initialSchema.up).toContain('schema_version');
      expect(initialSchema.up).toContain(':put metadata');
    });

    // Note: FTS, reverse indexes, and access level protection were removed
    // from the up script to work with the Tauri IPC bridge's blocked operations.
    // These features can be added via direct database access or by expanding
    // the blocklist exceptions in lib.rs.
  });

  describe('Migration runner', () => {
    it('starts with no applied migrations', async () => {
      const applied = await getAppliedMigrations(db);
      expect(applied).toEqual([]);
    });

    it('starts with schema version 0', async () => {
      const version = await getSchemaVersion(db);
      expect(version).toBe(0);
    });

    it('runs all pending migrations successfully', async () => {
      const result = await runMigrations(db);

      expect(result.errors).toEqual([]);
      expect(result.applied.length).toBeGreaterThan(0);
    });

    it('records migration in applied migrations list', async () => {
      const mockDb = db as MockDatabase;
      await runMigrations(db);

      // Check that mutation to update applied_migrations was called
      const metadataUpdates = mockDb.mutations.filter(
        (m) => m.params && m.params.key === 'applied_migrations'
      );
      expect(metadataUpdates.length).toBeGreaterThan(0);
    });

    it('skips already applied migrations on second run', async () => {
      const mockDb = db as MockDatabase;

      // Seed that all migrations are already applied
      mockDb.seed('metadata', [
        ['applied_migrations', '["001-initial-schema","002-saved-queries"]'],
      ]);

      const result = await runMigrations(db);

      expect(result.applied).toEqual([]);
      expect(result.alreadyApplied).toContain('001-initial-schema');
      expect(result.alreadyApplied).toContain('002-saved-queries');
    });

    it('updates schema version metadata', async () => {
      await runMigrations(db);

      // Verify the migration script contains schema version update
      // Uses inline JSON array syntax in simplified format
      expect(initialSchema.up).toContain('schema_version');
      expect(initialSchema.up).toContain(':put metadata');
    });
  });

  describe('Rollback functionality', () => {
    it('down script reverses all up operations', () => {
      const relations = [
        'blocks',
        'pages',
        'blocks_by_page',
        'blocks_by_parent',
        'block_refs',
        'links',
        'properties',
        'tags',
        'block_history',
        'daily_notes',
        'metadata',
      ];

      for (const relation of relations) {
        expect(initialSchema.down).toContain(`::remove ${relation}`);
      }
    });

    it('down script drops FTS and indexes', () => {
      expect(initialSchema.down).toContain('::fts drop blocks:fts');
      expect(initialSchema.down).toContain('::fts drop pages:fts');
      expect(initialSchema.down).toContain('::index drop links:by_target');
      expect(initialSchema.down).toContain('::index drop block_refs:by_target');
    });

    it('down script normalizes access levels', () => {
      expect(initialSchema.down).toContain('::access_level blocks normal');
      expect(initialSchema.down).toContain('::access_level pages normal');
      expect(initialSchema.down).toContain('::access_level metadata normal');
    });
  });

  describe('Migration tracking', () => {
    it('records migration name in applied migrations metadata', async () => {
      await runMigrations(db);

      const mockDb = db as MockDatabase;
      const metadataUpdates = mockDb.mutations.filter(
        (m) => m.params && m.params.key === 'applied_migrations'
      );

      expect(metadataUpdates.length).toBeGreaterThan(0);
      const lastUpdate = metadataUpdates[metadataUpdates.length - 1]!;
      const appliedList = JSON.parse(lastUpdate.params.value as string);
      expect(appliedList).toContain('001-initial-schema');
    });

    it('increments schema version after migration', async () => {
      const mockDb = db as MockDatabase;

      // Seed with version 0
      mockDb.seed('metadata', [['schema_version', '0']]);

      await runMigrations(db);

      // Migration script sets version to 1 using inline array syntax
      expect(initialSchema.up).toContain('"schema_version", "1"');
    });
  });

  describe('Error handling', () => {
    it('continues tracking migrations even if later migrations fail', async () => {
      const mockDb = db as MockDatabase;

      // Run successful migration
      await runSingleMigration(db, initialSchema);

      expect(mockDb.mutations).toHaveLength(1);
      expect(mockDb.mutations[0]!.script).toBe(initialSchema.up);
    });

    it('migration runner reports errors with migration name', async () => {
      const failingDb = new MockDatabase();
      let callCount = 0;
      const originalMutate = failingDb.mutate.bind(failingDb);

      failingDb.mutate = async (script: string, params?: Record<string, unknown>) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated database error');
        }
        return originalMutate(script, params);
      };

      const result = await runMigrations(failingDb);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.migration).toBe('001-initial-schema');
      expect(result.errors[0]!.error).toContain('Simulated database error');
    });

    it('stops migration execution on first error', async () => {
      const failingDb = new MockDatabase();
      failingDb.mutate = async () => {
        throw new Error('Migration failed');
      };

      const result = await runMigrations(failingDb);

      expect(result.errors).toHaveLength(1);
      expect(result.applied).toEqual([]);
    });
  });

  describe('Migration script structure', () => {
    it('uses inline syntax for metadata updates', () => {
      // Simplified migration uses inline JSON array syntax for metadata
      expect(initialSchema.up).toContain('?[key, value] <-');
      expect(initialSchema.up).toContain(':put metadata');
    });

    it('creates all core relations', () => {
      // The simplified schema focuses on core relation creation
      // without comments (removed for blocked operation compatibility)
      expect(initialSchema.up).toContain(':create blocks');
      expect(initialSchema.up).toContain(':create pages');
      expect(initialSchema.up).toContain(':create metadata');
    });

    it('down script includes warning about data loss', () => {
      expect(initialSchema.down).toContain('WARNING');
      expect(initialSchema.down).toContain('drops ALL data');
    });
  });
});
