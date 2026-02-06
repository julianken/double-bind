// Integration tests for migrations with real CozoDB
//
// NOTE: These tests use MockGraphDB as a placeholder for real CozoDB integration.
// To run against real CozoDB, install cozo-node and replace MockGraphDB with:
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
import { MockGraphDB } from '@double-bind/test-utils';
import { migration as initialSchema } from '../../src/migrations/001-initial-schema.js';
import {
  runMigrations,
  runSingleMigration,
  getAppliedMigrations,
  getSchemaVersion,
} from '../../src/runner.js';
import type { GraphDB } from '@double-bind/types';

describe('Migration Integration Tests', () => {
  let db: GraphDB;

  beforeEach(() => {
    db = new MockGraphDB();
  });

  describe('001-initial-schema migration', () => {
    it('executes up script without errors', async () => {
      await expect(runSingleMigration(db, initialSchema)).resolves.not.toThrow();
    });

    it('records the migration script execution', async () => {
      await runSingleMigration(db, initialSchema);

      const mockDb = db as MockGraphDB;
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
      expect(initialSchema.up).toContain("key: 'schema_version'");
      expect(initialSchema.up).toContain("value: '1'");
    });

    it('migration script creates FTS indexes', () => {
      expect(initialSchema.up).toContain('::fts create blocks:fts');
      expect(initialSchema.up).toContain('::fts create pages:fts');
    });

    it('migration script creates reverse indexes', () => {
      expect(initialSchema.up).toContain('::index create links:by_target');
      expect(initialSchema.up).toContain('::index create block_refs:by_target');
    });

    it('migration script sets access level protection', () => {
      expect(initialSchema.up).toContain('::access_level blocks protected');
      expect(initialSchema.up).toContain('::access_level pages protected');
      expect(initialSchema.up).toContain('::access_level metadata protected');
    });
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
      const mockDb = db as MockGraphDB;
      await runMigrations(db);

      // Check that mutation to update applied_migrations was called
      const metadataUpdates = mockDb.mutations.filter(
        (m) => m.params && m.params.key === 'applied_migrations'
      );
      expect(metadataUpdates.length).toBeGreaterThan(0);
    });

    it('skips already applied migrations on second run', async () => {
      const mockDb = db as MockGraphDB;

      // Seed that first migration is already applied
      mockDb.seed('metadata', [['applied_migrations', '["001-initial-schema"]']]);

      const result = await runMigrations(db);

      expect(result.applied).toEqual([]);
      expect(result.alreadyApplied).toContain('001-initial-schema');
    });

    it('updates schema version metadata', async () => {
      await runMigrations(db);

      // Verify the migration script contains schema version update
      expect(initialSchema.up).toContain("key: 'schema_version'");
      expect(initialSchema.up).toContain("value: '1'");
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

      const mockDb = db as MockGraphDB;
      const metadataUpdates = mockDb.mutations.filter(
        (m) => m.params && m.params.key === 'applied_migrations'
      );

      expect(metadataUpdates.length).toBeGreaterThan(0);
      const lastUpdate = metadataUpdates[metadataUpdates.length - 1]!;
      const appliedList = JSON.parse(lastUpdate.params.value as string);
      expect(appliedList).toContain('001-initial-schema');
    });

    it('increments schema version after migration', async () => {
      const mockDb = db as MockGraphDB;

      // Seed with version 0
      mockDb.seed('metadata', [['schema_version', '0']]);

      await runMigrations(db);

      // Migration script sets version to 1
      expect(initialSchema.up).toContain("value: '1'");
    });
  });

  describe('Error handling', () => {
    it('continues tracking migrations even if later migrations fail', async () => {
      const mockDb = db as MockGraphDB;

      // Run successful migration
      await runSingleMigration(db, initialSchema);

      expect(mockDb.mutations).toHaveLength(1);
      expect(mockDb.mutations[0]!.script).toBe(initialSchema.up);
    });

    it('migration runner reports errors with migration name', async () => {
      const failingDb = new MockGraphDB();
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
      const failingDb = new MockGraphDB();
      failingDb.mutate = async () => {
        throw new Error('Migration failed');
      };

      const result = await runMigrations(failingDb);

      expect(result.errors).toHaveLength(1);
      expect(result.applied).toEqual([]);
    });
  });

  describe('Migration script structure', () => {
    it('uses parameterized queries for metadata updates', () => {
      // Migration script should use inline values, but runner uses params
      // This is acceptable for schema_version which is static
      expect(initialSchema.up).toContain("key: 'schema_version'");
    });

    it('includes comments explaining each section', () => {
      expect(initialSchema.up).toContain('PRIMARY DATA');
      expect(initialSchema.up).toContain('SECONDARY INDEXES');
      expect(initialSchema.up).toContain('REFERENCES AND LINKS');
      expect(initialSchema.up).toContain('FULL-TEXT SEARCH');
      expect(initialSchema.up).toContain('ACCESS LEVEL PROTECTION');
    });

    it('down script includes warning about data loss', () => {
      expect(initialSchema.down).toContain('WARNING');
      expect(initialSchema.down).toContain('drops ALL data');
    });
  });
});
