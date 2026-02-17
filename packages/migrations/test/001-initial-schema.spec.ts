import { describe, it, expect, beforeEach } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { migration } from '../src/migrations/001-initial-schema.js';
import { runSingleMigration, rollbackMigration } from '../src/runner.js';

describe('001-initial-schema migration', () => {
  describe('migration metadata', () => {
    it('has correct version', () => {
      expect(migration.version).toBe(1);
    });

    it('has correct name', () => {
      expect(migration.name).toBe('001-initial-schema');
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
    it('creates all 11 required relations', () => {
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
        expect(migration.up).toContain(`:create ${relation}`);
      }
    });

    it('creates blocks relation with all required columns', () => {
      expect(migration.up).toContain('block_id: String');
      expect(migration.up).toContain('page_id: String');
      expect(migration.up).toContain('parent_id: String?');
      expect(migration.up).toContain('content: String');
      expect(migration.up).toContain("content_type: String default 'text'");
      expect(migration.up).toContain('order: String');
      expect(migration.up).toContain('is_collapsed: Bool default false');
      expect(migration.up).toContain('is_deleted: Bool default false');
      expect(migration.up).toContain('created_at: Float');
      expect(migration.up).toContain('updated_at: Float');
    });

    it('creates pages relation with all required columns', () => {
      expect(migration.up).toContain('page_id: String');
      expect(migration.up).toContain('title: String');
      expect(migration.up).toContain('daily_note_date: String?');
    });

    // Note: FTS indexes, reverse indexes, and access level protection were
    // removed from the up script to work with the Tauri IPC bridge's blocked
    // operations. These features are retained in the down script for completeness
    // and can be added via direct database access.

    it('sets schema version to 1', () => {
      // Simplified format uses inline JSON array syntax
      expect(migration.up).toContain('schema_version');
      expect(migration.up).toContain(':put metadata');
    });
  });

  describe('down script content', () => {
    it('removes access level protection before dropping relations', () => {
      const normalizedRelations = [
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

      for (const relation of normalizedRelations) {
        expect(migration.down).toContain(`::access_level ${relation} normal`);
      }
    });

    it('drops FTS indexes', () => {
      expect(migration.down).toContain('::fts drop blocks:fts');
      expect(migration.down).toContain('::fts drop pages:fts');
    });

    it('drops reverse indexes', () => {
      expect(migration.down).toContain('::index drop links:by_target');
      expect(migration.down).toContain('::index drop block_refs:by_target');
    });

    it('removes all relations', () => {
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
        expect(migration.down).toContain(`::remove ${relation}`);
      }
    });
  });

  describe('execution with MockDatabase', () => {
    let db: MockDatabase;

    beforeEach(() => {
      db = new MockDatabase();
    });

    it('executes up script without error', async () => {
      await expect(runSingleMigration(db, migration)).resolves.not.toThrow();
    });

    it('records the up script as a mutation', async () => {
      await runSingleMigration(db, migration);

      expect(db.mutations).toHaveLength(1);
      expect(db.mutations[0]!.script).toBe(migration.up);
    });

    it('executes down script without error', async () => {
      await expect(rollbackMigration(db, migration)).resolves.not.toThrow();
    });

    it('records the down script as a mutation', async () => {
      await rollbackMigration(db, migration);

      expect(db.mutations).toHaveLength(1);
      expect(db.mutations[0]!.script).toBe(migration.down);
    });
  });
});

describe('001-initial-schema relation specifications', () => {
  describe('blocks relation', () => {
    it('has block_id as key column', () => {
      // Key columns are before '=>'
      const blocksMatch = migration.up.match(/:create blocks \{([^}]+)\}/s);
      expect(blocksMatch).toBeTruthy();

      const schema = blocksMatch![1]!;
      const [keyPart] = schema.split('=>');
      expect(keyPart).toContain('block_id: String');
    });

    it('has page_id as value column (not key)', () => {
      const blocksMatch = migration.up.match(/:create blocks \{([^}]+)\}/s);
      const schema = blocksMatch![1]!;
      const [, valuePart] = schema.split('=>');
      expect(valuePart).toContain('page_id: String');
    });
  });

  describe('blocks_by_page relation', () => {
    it('has composite key (page_id, block_id)', () => {
      const match = migration.up.match(/:create blocks_by_page \{([^}]+)\}/s);
      expect(match).toBeTruthy();

      const schema = match![1]!;
      expect(schema).toContain('page_id: String');
      expect(schema).toContain('block_id: String');
      // No '=>' means all columns are keys
      expect(schema).not.toContain('=>');
    });
  });

  describe('block_history relation', () => {
    it('has composite key (block_id, version)', () => {
      const match = migration.up.match(/:create block_history \{([^}]+)\}/s);
      expect(match).toBeTruthy();

      const schema = match![1]!;
      const [keyPart] = schema.split('=>');
      expect(keyPart).toContain('block_id: String');
      expect(keyPart).toContain('version: Int');
    });

    it('includes operation field for tracking change type', () => {
      const match = migration.up.match(/:create block_history \{([^}]+)\}/s);
      const schema = match![1]!;
      expect(schema).toContain('operation: String');
    });
  });

  describe('links relation', () => {
    it('has composite key (source_id, target_id, link_type)', () => {
      const match = migration.up.match(/:create links \{([^}]+)\}/s);
      expect(match).toBeTruthy();

      const schema = match![1]!;
      const [keyPart] = schema.split('=>');
      expect(keyPart).toContain('source_id: String');
      expect(keyPart).toContain('target_id: String');
      expect(keyPart).toContain('link_type: String');
    });

    it('has context_block_id as optional value column', () => {
      const match = migration.up.match(/:create links \{([^}]+)\}/s);
      const schema = match![1]!;
      const [, valuePart] = schema.split('=>');
      expect(valuePart).toContain('context_block_id: String?');
    });
  });

  describe('metadata relation', () => {
    it('is a simple key-value store', () => {
      const match = migration.up.match(/:create metadata \{([^}]+)\}/s);
      expect(match).toBeTruthy();

      const schema = match![1]!;
      expect(schema).toContain('key: String');
      expect(schema).toContain('value: String');
    });
  });
});
