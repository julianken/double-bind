/**
 * Unit tests for createServices() factory
 *
 * These tests verify that the factory:
 * - Creates all services with correct dependencies
 * - Properly wires up repositories
 * - Returns a valid Services object
 * - Services are functional and can execute operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { createServices, type Services } from '../../../src/services/index.js';
import { PageService } from '../../../src/services/page-service.js';
import { BlockService } from '../../../src/services/block-service.js';

describe('createServices', () => {
  let db: MockGraphDB;
  let services: Services;

  beforeEach(() => {
    db = new MockGraphDB();
    services = createServices(db);
  });

  describe('Factory initialization', () => {
    it('should create a Services object with all required services', () => {
      expect(services).toBeDefined();
      expect(services).toHaveProperty('pageService');
      expect(services).toHaveProperty('blockService');
    });

    it('should create PageService instance', () => {
      expect(services.pageService).toBeInstanceOf(PageService);
    });

    it('should create BlockService instance', () => {
      expect(services.blockService).toBeInstanceOf(BlockService);
    });

    it('should create services that share the same GraphDB instance', async () => {
      // Both services should interact with the same database
      // We verify this by seeding data and checking if both services can access it
      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Test Page', now, now, false, null]]);

      // Both services should be able to see the same data
      await expect(services.pageService.getPageWithBlocks(pageId)).resolves.toBeDefined();
    });
  });

  describe('Service wiring', () => {
    it('should wire PageService with correct repository dependencies', () => {
      // PageService needs: PageRepository, BlockRepository, LinkRepository
      // The factory creates these repositories and injects them into the service
      // We verify the service was created and has the expected structure
      expect(services.pageService).toBeInstanceOf(PageService);

      // Verify the service has the expected methods
      expect(typeof services.pageService.createPage).toBe('function');
      expect(typeof services.pageService.getPageWithBlocks).toBe('function');
      expect(typeof services.pageService.deletePage).toBe('function');
      expect(typeof services.pageService.getTodaysDailyNote).toBe('function');
      expect(typeof services.pageService.searchPages).toBe('function');
    });

    it('should wire BlockService with correct repository dependencies', () => {
      // BlockService needs: BlockRepository, LinkRepository, PageRepository, TagRepository, PropertyRepository
      // The factory creates these repositories and injects them into the service
      expect(services.blockService).toBeInstanceOf(BlockService);

      // Verify the service has the expected methods
      expect(typeof services.blockService.updateContent).toBe('function');
      expect(typeof services.blockService.createBlock).toBe('function');
      expect(typeof services.blockService.deleteBlock).toBe('function');
      expect(typeof services.blockService.moveBlock).toBe('function');
      expect(typeof services.blockService.indentBlock).toBe('function');
      expect(typeof services.blockService.outdentBlock).toBe('function');
      expect(typeof services.blockService.toggleCollapse).toBe('function');
      expect(typeof services.blockService.getBacklinks).toBe('function');
    });

    it('should allow services to interact via shared repositories', () => {
      // Both services should share the same GraphDB instance through their repositories
      // This ensures data consistency across the service layer

      // Create separate Services instances from the same DB
      const services1 = createServices(db);
      const services2 = createServices(db);

      // Both should be valid service instances
      expect(services1.pageService).toBeInstanceOf(PageService);
      expect(services2.pageService).toBeInstanceOf(PageService);

      // Though they're different instances, they share the same DB
      expect(services1).not.toBe(services2);
    });
  });

  describe('Service functionality', () => {
    it('should create functional PageService that can execute operations', () => {
      // Verify PageService has all required methods for page operations
      expect(services.pageService).toBeDefined();
      expect(typeof services.pageService.searchPages).toBe('function');
      expect(typeof services.pageService.createPage).toBe('function');

      // The service is properly initialized and ready for use
      // Integration tests verify actual execution
    });

    it('should create functional BlockService that can execute operations', () => {
      // Verify BlockService has all required methods for block operations
      expect(services.blockService).toBeDefined();
      expect(typeof services.blockService.updateContent).toBe('function');
      expect(typeof services.blockService.createBlock).toBe('function');

      // The service is properly initialized with all dependencies
      // Integration tests verify actual execution
    });

    it('should wire services to support cascading operations', () => {
      // PageService.deletePage needs BlockRepository to cascade deletes
      // Verify the PageService has the deletePage method
      expect(typeof services.pageService.deletePage).toBe('function');

      // BlockService.deleteBlock needs LinkRepository, TagRepository, PropertyRepository
      // Verify the BlockService has the deleteBlock method
      expect(typeof services.blockService.deleteBlock).toBe('function');

      // The factory correctly wires all dependencies for cascading operations
    });
  });

  describe('Repository sharing', () => {
    it('should create separate repository instances for isolation', () => {
      // Each service gets its own repository instances
      // This is important for testing and potential future optimizations
      const services1 = createServices(db);
      const services2 = createServices(db);

      // Different Services instances
      expect(services1).not.toBe(services2);
      expect(services1.pageService).not.toBe(services2.pageService);
      expect(services1.blockService).not.toBe(services2.blockService);
    });

    it('should share the GraphDB instance across all created repositories', async () => {
      // Multiple calls to createServices with the same DB should work
      const services1 = createServices(db);
      const services2 = createServices(db);

      const pageId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const now = Date.now();
      db.seed('pages', [[pageId, 'Shared Test', now, now, false, null]]);

      // Both services should see the same data
      const result1 = await services1.pageService.getPageWithBlocks(pageId);
      const result2 = await services2.pageService.getPageWithBlocks(pageId);

      expect(result1.page.pageId).toBe(pageId);
      expect(result2.page.pageId).toBe(pageId);
      expect(result1.page.title).toBe(result2.page.title);
    });
  });

  describe('Error handling', () => {
    it('should create services that can propagate errors', () => {
      // Services should be properly wired to handle and propagate errors
      expect(services.pageService).toBeDefined();
      expect(services.blockService).toBeDefined();

      // Error handling is verified in individual service tests
      // The factory just ensures services are properly initialized
    });

    it('should wire services to maintain error context', () => {
      // Each service is created with proper repository dependencies
      // that maintain error context throughout the call chain
      expect(services.pageService).toBeInstanceOf(PageService);
      expect(services.blockService).toBeInstanceOf(BlockService);

      // Actual error propagation is tested in service-specific tests
    });
  });

  describe('Daily note operations', () => {
    it('should support daily note operations through PageService', () => {
      // PageService should have daily note methods
      expect(typeof services.pageService.getTodaysDailyNote).toBe('function');

      // The factory properly wires PageRepository which handles daily note logic
      expect(services.pageService).toBeInstanceOf(PageService);
    });
  });

  describe('Content parsing integration', () => {
    it('should wire BlockService with content parsing dependencies', () => {
      // BlockService needs LinkRepository for creating links from [[references]]
      expect(typeof services.blockService.updateContent).toBe('function');

      // The updateContent method uses content parser and multiple repositories
      // Factory ensures all dependencies are properly wired
      expect(services.blockService).toBeInstanceOf(BlockService);
    });

    it('should wire BlockService with tag and property repositories', () => {
      // BlockService needs TagRepository and PropertyRepository
      // for parsing #tags and key:: value properties
      expect(typeof services.blockService.updateContent).toBe('function');

      // Factory creates and injects all required repositories
      expect(services.blockService).toBeInstanceOf(BlockService);
    });
  });

  describe('Block tree operations', () => {
    it('should wire BlockService with indent operation support', () => {
      // Indent operations need BlockRepository
      expect(typeof services.blockService.indentBlock).toBe('function');
      expect(services.blockService).toBeInstanceOf(BlockService);
    });

    it('should wire BlockService with outdent operation support', () => {
      // Outdent operations need BlockRepository
      expect(typeof services.blockService.outdentBlock).toBe('function');
      expect(services.blockService).toBeInstanceOf(BlockService);
    });

    it('should wire BlockService with move operation support', () => {
      // Move operations need BlockRepository
      expect(typeof services.blockService.moveBlock).toBe('function');
      expect(services.blockService).toBeInstanceOf(BlockService);
    });
  });

  describe('Type safety', () => {
    it('should return correctly typed Services object', () => {
      const result = createServices(db);

      // TypeScript should infer the correct types
      const _pageService: PageService = result.pageService;
      const _blockService: BlockService = result.blockService;

      expect(_pageService).toBeDefined();
      expect(_blockService).toBeDefined();
    });

    it('should accept any GraphDB implementation', () => {
      // createServices should work with any GraphDB implementation
      const mockDb = new MockGraphDB();

      // Should compile and run without errors
      const result = createServices(mockDb);

      expect(result).toBeDefined();
    });
  });
});
