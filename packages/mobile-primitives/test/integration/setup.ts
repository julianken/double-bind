/**
 * Integration test setup for mobile-primitives
 *
 * Sets up mock mobile platform bridges, core services, and database adapters
 * for integration testing. These tests verify that mobile components correctly
 * interact with shared core services.
 */

import { vi } from 'vitest';

// Unmock @double-bind/core for integration tests (it's mocked in main setup.ts)
vi.unmock('@double-bind/core');
import type { GraphDB } from '@double-bind/types';
import { MockGraphDB } from '@double-bind/test-utils';
import {
  PageRepository,
  BlockRepository,
  LinkRepository,
  TagRepository,
  PropertyRepository,
  PageService,
  BlockService,
  GraphService,
  SearchService,
} from '@double-bind/core';

/**
 * Test context containing all mocked services and repositories
 */
export interface TestContext {
  db: MockGraphDB;
  pageRepo: PageRepository;
  blockRepo: BlockRepository;
  linkRepo: LinkRepository;
  tagRepo: TagRepository;
  propertyRepo: PropertyRepository;
  pageService: PageService;
  blockService: BlockService;
  graphService: GraphService;
  searchService: SearchService;
}

/**
 * Create a fresh test context with all services initialized
 * Each call creates a completely isolated database instance
 */
export function createTestContext(): TestContext {
  const db = new MockGraphDB() as unknown as GraphDB;

  // Create repositories
  const pageRepo = new PageRepository(db);
  const blockRepo = new BlockRepository(db);
  const linkRepo = new LinkRepository(db);
  const tagRepo = new TagRepository(db);
  const propertyRepo = new PropertyRepository(db);

  // Create services
  const pageService = new PageService(pageRepo, blockRepo, linkRepo);
  const blockService = new BlockService(blockRepo, linkRepo, pageRepo, tagRepo, propertyRepo);
  const graphService = new GraphService(db);
  const searchService = new SearchService(db, pageRepo, blockRepo);

  return {
    db,
    pageRepo,
    blockRepo,
    linkRepo,
    tagRepo,
    propertyRepo,
    pageService,
    blockService,
    graphService,
    searchService,
  };
}

/**
 * Seed test database with sample data for integration tests
 * Uses unique names to avoid conflicts with test-created pages
 */
export function seedTestData(db: MockGraphDB): void {
  // Seed pages - use unique prefixes to avoid conflicts
  db.seed('pages', [
    ['page-1', 'Seeded Page One', 1700000000, 1700000000, false, null],
    ['page-2', 'Seeded Page Two', 1700000100, 1700000100, false, null],
    ['page-3', 'Seeded Page Three', 1700000200, 1700000200, false, null],
  ]);

  // Seed blocks - reference the seeded pages only
  db.seed('blocks', [
    [
      'block-1',
      'page-1',
      null,
      'Content linking to [[Seeded Page Two]]',
      'text',
      'a0',
      false,
      false,
      1700000000,
      1700000000,
    ],
    [
      'block-2',
      'page-1',
      null,
      'Content linking to [[Seeded Page Three]]',
      'text',
      'a1',
      false,
      false,
      1700000010,
      1700000010,
    ],
    [
      'block-3',
      'page-2',
      null,
      'Seeded block content',
      'text',
      'a0',
      false,
      false,
      1700000100,
      1700000100,
    ],
    [
      'block-4',
      'page-3',
      null,
      'Seeded block content',
      'text',
      'a0',
      false,
      false,
      1700000200,
      1700000200,
    ],
  ]);

  // Seed links
  db.seed('links', [
    ['page-1', 'page-2', 'reference', 1700000000, 'block-1'],
    ['page-1', 'page-3', 'reference', 1700000010, 'block-2'],
  ]);
}

/**
 * Mock mobile platform bridge for iOS/Android
 */
export class MockMobileBridge {
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  /**
   * Simulate a native event from the platform
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(...args));
  }

  /**
   * Register a listener for native events
   */
  on(event: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  /**
   * Remove a listener
   */
  off(event: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.listeners.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Mock touch gesture system for mobile
 */
export class MockGestureSystem {
  private gestures: Map<string, unknown> = new Map();

  /**
   * Register a gesture handler
   */
  register(gestureId: string, config: unknown): void {
    this.gestures.set(gestureId, config);
  }

  /**
   * Simulate a gesture event
   */
  simulate(gestureId: string, event: unknown): void {
    const config = this.gestures.get(gestureId);
    if (config && typeof config === 'object' && config !== null) {
      // Trigger the gesture handler
      const handler = (config as Record<string, unknown>).onEnd;
      if (typeof handler === 'function') {
        handler(event);
      }
    }
  }

  /**
   * Clear all registered gestures
   */
  clear(): void {
    this.gestures.clear();
  }
}

/**
 * Create a mock mobile environment with platform bridges and gesture system
 */
export function createMockMobileEnvironment() {
  const bridge = new MockMobileBridge();
  const gestures = new MockGestureSystem();

  return {
    bridge,
    gestures,
    cleanup: () => {
      bridge.clear();
      gestures.clear();
    },
  };
}
