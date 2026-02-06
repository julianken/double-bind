import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
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

    it('creates FTS index on saved_queries', () => {
      expect(migration.up).toContain('::fts create saved_queries:fts');
      expect(migration.up).toContain('extractor: name');
    });

    it('sets access level protection on saved_queries', () => {
      expect(migration.up).toContain('::access_level saved_queries protected');
    });

    it('updates schema version to 2', () => {
      expect(migration.up).toContain("key: 'schema_version'");
      expect(migration.up).toContain("value: '2'");
    });
  });

  describe('down script content', () => {
    it('removes access level protection before removal', () => {
      expect(migration.down).toContain('::access_level saved_queries normal');
    });

    it('drops FTS index', () => {
      expect(migration.down).toContain('::fts drop saved_queries:fts');
    });

    it('removes saved_queries relation', () => {
      expect(migration.down).toContain('::remove saved_queries');
    });

    it('reverts schema version to 1', () => {
      expect(migration.down).toContain("key: 'schema_version'");
      expect(migration.down).toContain("value: '1'");
    });

    it('contains operations in correct order (protection, fts, remove)', () => {
      const accessLevelPos = migration.down.indexOf('::access_level saved_queries normal');
      const ftsDropPos = migration.down.indexOf('::fts drop saved_queries:fts');
      const removePos = migration.down.indexOf('::remove saved_queries');

      // Protection must be removed before FTS index
      expect(accessLevelPos).toBeLessThan(ftsDropPos);
      // FTS must be dropped before relation removal
      expect(ftsDropPos).toBeLessThan(removePos);
    });
  });

  describe('migration execution', () => {
    let db: MockGraphDB;

    beforeEach(() => {
      db = new MockGraphDB();
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
