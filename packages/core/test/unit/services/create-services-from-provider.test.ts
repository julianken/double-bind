/**
 * Unit tests for createServicesFromProvider factory
 *
 * These tests verify that the factory correctly:
 * 1. Calls provider.getDatabase() to obtain Database
 * 2. Passes the Database to createServices()
 * 3. Returns a complete Services object
 */

import { describe, it, expect, vi } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import type { DatabaseProvider } from '@double-bind/types';
import { createServicesFromProvider } from '../../../src/services/index.js';
import { PageService } from '../../../src/services/page-service.js';
import { BlockService } from '../../../src/services/block-service.js';
import { GraphService } from '../../../src/services/graph-service.js';
import { SearchService } from '../../../src/services/search-service.js';
import { SavedQueryService } from '../../../src/services/saved-query-service.js';

/**
 * Mock implementation of DatabaseProvider for testing
 */
class MockDatabaseProvider implements DatabaseProvider {
  private db: MockDatabase;
  private getDatabaseCallCount = 0;

  constructor(db?: MockDatabase) {
    this.db = db ?? new MockDatabase();
  }

  async getDatabase(): Promise<MockDatabase> {
    this.getDatabaseCallCount++;
    return this.db;
  }

  get callCount(): number {
    return this.getDatabaseCallCount;
  }
}

describe('createServicesFromProvider', () => {
  describe('factory behavior', () => {
    it('should call provider.getDatabase() exactly once', async () => {
      const provider = new MockDatabaseProvider();

      await createServicesFromProvider(provider);

      expect(provider.callCount).toBe(1);
    });

    it('should return a complete Services object', async () => {
      const provider = new MockDatabaseProvider();

      const services = await createServicesFromProvider(provider);

      expect(services).toHaveProperty('pageService');
      expect(services).toHaveProperty('blockService');
      expect(services).toHaveProperty('graphService');
      expect(services).toHaveProperty('searchService');
      expect(services).toHaveProperty('savedQueryService');
    });

    it('should return correct service instances', async () => {
      const provider = new MockDatabaseProvider();

      const services = await createServicesFromProvider(provider);

      expect(services.pageService).toBeInstanceOf(PageService);
      expect(services.blockService).toBeInstanceOf(BlockService);
      expect(services.graphService).toBeInstanceOf(GraphService);
      expect(services.searchService).toBeInstanceOf(SearchService);
      expect(services.savedQueryService).toBeInstanceOf(SavedQueryService);
    });

    it('should use the database from provider for services', async () => {
      const db = new MockDatabase();
      db.seed('pages', []);
      const provider = new MockDatabaseProvider(db);

      const services = await createServicesFromProvider(provider);

      // Verify the service is using the mock DB by calling a method
      await services.pageService.searchPages('test');
      expect(db.queries.length).toBeGreaterThan(0);
    });
  });

  describe('async provider support', () => {
    it('should work with providers that return database asynchronously', async () => {
      // Simulate a provider that has async initialization
      const provider: DatabaseProvider = {
        getDatabase: vi.fn().mockImplementation(async () => {
          // Simulate async delay (e.g., loading from disk)
          await new Promise((resolve) => setTimeout(resolve, 1));
          return new MockDatabase();
        }),
      };

      const services = await createServicesFromProvider(provider);

      expect(provider.getDatabase).toHaveBeenCalledTimes(1);
      expect(services.pageService).toBeInstanceOf(PageService);
    });

    it('should propagate errors from provider.getDatabase()', async () => {
      const provider: DatabaseProvider = {
        getDatabase: vi.fn().mockRejectedValue(new Error('Database initialization failed')),
      };

      await expect(createServicesFromProvider(provider)).rejects.toThrow(
        'Database initialization failed'
      );
    });
  });

  describe('backward compatibility', () => {
    it('should produce services equivalent to createServices()', async () => {
      const db = new MockDatabase();
      const provider = new MockDatabaseProvider(db);

      const services = await createServicesFromProvider(provider);

      // Verify all service properties exist (same as createServices)
      const serviceKeys = Object.keys(services);
      expect(serviceKeys).toContain('pageService');
      expect(serviceKeys).toContain('blockService');
      expect(serviceKeys).toContain('graphService');
      expect(serviceKeys).toContain('searchService');
      expect(serviceKeys).toContain('savedQueryService');
      expect(serviceKeys).toHaveLength(5);
    });
  });
});
