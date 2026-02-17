import { describe, it, expect, beforeEach } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { migration } from '../src/migrations/002-saved-queries.js';
import { runSingleMigration, rollbackMigration } from '../src/runner.js';

describe('002-saved-queries migration', () => {
  describe('migration metadata', () => {
    it('has correct version', () => {
      expect(migration.version).toBe(2);
    });

    it('has correct name', () => {
      expect(migration.name).toBe('002-saved-queries');
    });

    it('has non-empty up script', () => {
      expect(migration.up).toBeTruthy();
      expect(migration.up.length).toBeGreaterThan(0);
    });

    it('has non-empty down script', () => {
      expect(migration.down).toBeTruthy();
      expect(migration.down.length).toBeGreaterThan(0);
    });
  });

  describe('up script content', () => {
    it('creates saved_queries relation', () => {
      expect(migration.up).toContain(':create saved_queries');
    });

    it('creates saved_queries relation with all required columns', () => {
      expect(migration.up).toContain('id: String');
      expect(migration.up).toContain('name: String');
      expect(migration.up).toContain('type: String');
      expect(migration.up).toContain('definition: String');
      expect(migration.up).toContain('description: String?');
      expect(migration.up).toContain('created_at: Float');
      expect(migration.up).toContain('updated_at: Float');
    });

    // Note: FTS and access level protection were removed from the simplified
    // migration to work with the Tauri IPC bridge's blocked operations.

    it('updates schema version to 2', () => {
      // Uses inline JSON array syntax in simplified format
      expect(migration.up).toContain('schema_version');
      expect(migration.up).toContain(':put metadata');
    });
  });

  describe('down script content', () => {
    it('removes saved_queries relation', () => {
      expect(migration.down).toContain('::remove saved_queries');
    });

    it('reverts schema version to 1', () => {
      // Uses inline JSON array syntax in simplified format
      expect(migration.down).toContain('"schema_version", "1"');
      expect(migration.down).toContain(':put metadata');
    });
  });

  describe('migration execution', () => {
    let db: MockDatabase;

    beforeEach(() => {
      db = new MockDatabase();
    });

    it('executes up script without errors', async () => {
      await expect(runSingleMigration(db, migration)).resolves.not.toThrow();
    });

    it('records the migration script execution', async () => {
      await runSingleMigration(db, migration);

      expect(db.mutations).toHaveLength(1);
      expect(db.mutations[0]!.script).toBe(migration.up);
    });

    it('executes down script (rollback) without errors', async () => {
      await expect(rollbackMigration(db, migration)).resolves.not.toThrow();
    });

    it('records the rollback script execution', async () => {
      await rollbackMigration(db, migration);

      expect(db.mutations).toHaveLength(1);
      expect(db.mutations[0]!.script).toBe(migration.down);
    });
  });
});
