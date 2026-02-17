/**
 * Unit tests for DatabaseProvider interface contract
 *
 * These tests verify that implementations of DatabaseProvider follow the
 * expected lifecycle and behavior. We use a mock implementation to test
 * the interface contract without depending on any specific platform.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Database, QueryResult, MutationResult } from '@double-bind/types';
import type {
  DatabaseProvider,
  DatabaseProviderConfig,
  DatabaseProviderInitResult,
} from '../../../src/providers/database-provider.js';

/**
 * Mock Database implementation for testing provider behavior.
 */
class MockDatabase implements Database {
  async query<T = unknown>(
    _script: string,
    _params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    return { headers: [], rows: [] };
  }

  async mutate(_script: string, _params?: Record<string, unknown>): Promise<MutationResult> {
    return { headers: [], rows: [] };
  }

  async importRelations(_data: Record<string, unknown[][]>): Promise<void> {
    // No-op
  }

  async exportRelations(_relations: string[]): Promise<Record<string, unknown[][]>> {
    return {};
  }

  async backup(_path: string): Promise<void> {
    // No-op
  }
}

/**
 * Mock implementation of DatabaseProvider for testing interface contract.
 *
 * This demonstrates how a platform-specific implementation would work.
 */
class MockDatabaseProvider implements DatabaseProvider {
  private _db: Database | null = null;
  private _initialized = false;
  private _closed = false;
  private _schemaVersion: number | undefined;
  private _shouldFailInit = false;
  private _initError: string | undefined;

  /**
   * Configure the mock to fail on initialize.
   */
  setFailInit(error: string): void {
    this._shouldFailInit = true;
    this._initError = error;
  }

  async initialize(config?: DatabaseProviderConfig): Promise<DatabaseProviderInitResult> {
    // Check if closed first - cannot reinitialize after close
    if (this._closed) {
      return {
        success: false,
        error: 'Provider has been closed and cannot be reinitialized',
      };
    }

    // Idempotent: if already initialized, return success
    if (this._initialized) {
      return {
        success: true,
        schemaVersion: this._schemaVersion,
        migrationsApplied: 0,
      };
    }

    // Simulate failure if configured
    if (this._shouldFailInit) {
      return {
        success: false,
        error: this._initError,
      };
    }

    // Create the mock database
    this._db = new MockDatabase();
    this._initialized = true;
    this._schemaVersion = config?.runMigrations !== false ? 1 : 0;

    return {
      success: true,
      schemaVersion: this._schemaVersion,
      migrationsApplied: config?.runMigrations !== false ? 1 : 0,
    };
  }

  getDatabase(): Database {
    if (!this._initialized) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }
    if (this._closed) {
      throw new Error('Provider has been closed.');
    }
    return this._db!;
  }

  isInitialized(): boolean {
    return this._initialized && !this._closed;
  }

  async close(): Promise<void> {
    // Idempotent: if already closed, do nothing
    if (this._closed) {
      return;
    }

    this._closed = true;
    this._db = null;
  }

  getSchemaVersion(): number | undefined {
    return this._schemaVersion;
  }
}

describe('DatabaseProvider', () => {
  let provider: MockDatabaseProvider;

  beforeEach(() => {
    provider = new MockDatabaseProvider();
  });

  describe('lifecycle', () => {
    it('should not be initialized before calling initialize()', () => {
      expect(provider.isInitialized()).toBe(false);
    });

    it('should be initialized after calling initialize()', async () => {
      const result = await provider.initialize();

      expect(result.success).toBe(true);
      expect(provider.isInitialized()).toBe(true);
    });

    it('should not be initialized after calling close()', async () => {
      await provider.initialize();
      await provider.close();

      expect(provider.isInitialized()).toBe(false);
    });

    it('should handle initialize() being called multiple times', async () => {
      const result1 = await provider.initialize();
      const result2 = await provider.initialize();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(provider.isInitialized()).toBe(true);
    });

    it('should handle close() being called multiple times', async () => {
      await provider.initialize();
      await provider.close();
      await provider.close(); // Should not throw

      expect(provider.isInitialized()).toBe(false);
    });

    it('should fail to initialize after being closed', async () => {
      await provider.initialize();
      await provider.close();
      const result = await provider.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toContain('closed');
    });
  });

  describe('getDatabase', () => {
    it('should throw if called before initialize()', () => {
      expect(() => provider.getDatabase()).toThrow('not initialized');
    });

    it('should return Database after initialize()', async () => {
      await provider.initialize();
      const db = provider.getDatabase();

      expect(db).toBeDefined();
      expect(typeof db.query).toBe('function');
      expect(typeof db.mutate).toBe('function');
    });

    it('should throw if called after close()', async () => {
      await provider.initialize();
      await provider.close();

      expect(() => provider.getDatabase()).toThrow('closed');
    });

    it('should return the same Database instance on multiple calls', async () => {
      await provider.initialize();
      const db1 = provider.getDatabase();
      const db2 = provider.getDatabase();

      expect(db1).toBe(db2);
    });
  });

  describe('initialize result', () => {
    it('should return success with schema version', async () => {
      const result = await provider.initialize();

      expect(result.success).toBe(true);
      expect(result.schemaVersion).toBeDefined();
      expect(typeof result.schemaVersion).toBe('number');
    });

    it('should return migrations applied count', async () => {
      const result = await provider.initialize({ runMigrations: true });

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toBeDefined();
      expect(typeof result.migrationsApplied).toBe('number');
    });

    it('should return error message on failure', async () => {
      provider.setFailInit('Database file not found');
      const result = await provider.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database file not found');
    });

    it('should not throw on failure', async () => {
      provider.setFailInit('Connection refused');

      // Should not throw, but return error in result
      const result = await provider.initialize();

      expect(result.success).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should accept optional dbPath', async () => {
      const result = await provider.initialize({ dbPath: '/path/to/db' });

      expect(result.success).toBe(true);
    });

    it('should accept optional runMigrations flag', async () => {
      const result = await provider.initialize({ runMigrations: false });

      expect(result.success).toBe(true);
      // With runMigrations: false, should have schema version 0
      expect(result.schemaVersion).toBe(0);
    });

    it('should accept additional platform-specific options', async () => {
      const result = await provider.initialize({
        options: {
          customSetting: true,
          anotherOption: 'value',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should work with no configuration', async () => {
      const result = await provider.initialize();

      expect(result.success).toBe(true);
    });
  });

  describe('getSchemaVersion', () => {
    it('should return undefined before initialization', () => {
      expect(provider.getSchemaVersion()).toBeUndefined();
    });

    it('should return schema version after initialization', async () => {
      await provider.initialize();
      const version = provider.getSchemaVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('number');
    });

    it('should return schema version even after close', async () => {
      await provider.initialize();
      const versionBefore = provider.getSchemaVersion();
      await provider.close();
      const versionAfter = provider.getSchemaVersion();

      // Schema version should still be available for logging/debugging
      expect(versionBefore).toBe(versionAfter);
    });
  });

  describe('Database interface compliance', () => {
    it('should provide Database with query method', async () => {
      await provider.initialize();
      const db = provider.getDatabase();
      const result = await db.query('?[x] := x = 1');

      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.headers)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should provide Database with mutate method', async () => {
      await provider.initialize();
      const db = provider.getDatabase();
      const result = await db.mutate(':create test {}');

      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('rows');
    });

    it('should provide Database with importRelations method', async () => {
      await provider.initialize();
      const db = provider.getDatabase();

      await expect(db.importRelations({ test: [[1, 2]] })).resolves.toBeUndefined();
    });

    it('should provide Database with exportRelations method', async () => {
      await provider.initialize();
      const db = provider.getDatabase();
      const result = await db.exportRelations(['test']);

      expect(typeof result).toBe('object');
    });

    it('should provide Database with backup method', async () => {
      await provider.initialize();
      const db = provider.getDatabase();

      await expect(db.backup('/path/to/backup')).resolves.toBeUndefined();
    });
  });
});
