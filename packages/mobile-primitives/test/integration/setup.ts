/**
 * Integration test setup for mobile-primitives
 *
 * Sets up mock mobile platform bridges, core services, and real CozoDB database
 * for integration testing. These tests verify that mobile components correctly
 * interact with shared core services.
 */

import { vi, afterEach } from 'vitest';

// Unmock @double-bind/core for integration tests (it's mocked in main setup.ts)
vi.unmock('@double-bind/core');
import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';
import { CozoDb } from 'cozo-node';
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
import { ALL_MIGRATIONS } from '@double-bind/migrations';

// Get the initial schema migration (first in the list)
const initialSchema = ALL_MIGRATIONS[0];

/**
 * Adapter to wrap CozoDb and match the GraphDB interface
 */
class CozoDbAdapter implements GraphDB {
  constructor(private db: CozoDb) {}

  async query<T = unknown>(script: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    const result = await this.db.run(script, params);
    // CozoDB returns errors as objects with {ok: false, display: string}
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error((result as any).display || JSON.stringify(result));
    }
    return result as QueryResult<T>;
  }

  async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
    const result = await this.db.run(script, params);
    // CozoDB returns errors as objects with {ok: false, display: string}
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error((result as any).display || JSON.stringify(result));
    }
    return result as MutationResult;
  }

  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    return this.db.importRelations(data);
  }

  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    return this.db.exportRelations(relations);
  }

  async backup(path: string): Promise<void> {
    // No-op for in-memory database
  }

  async restore(path: string): Promise<void> {
    // No-op for in-memory database
  }

  async importRelationsFromBackup(path: string, relations: string[]): Promise<void> {
    // No-op for in-memory database
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Test context containing all services and repositories with real CozoDB
 */
export interface TestContext {
  db: GraphDB;
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

// Track databases to clean up
const activeDatabases: GraphDB[] = [];

/**
 * Create a fresh test context with all services initialized using real CozoDB
 * Each call creates a completely isolated in-memory database instance
 */
export async function createTestContext(): Promise<TestContext> {
  // Create in-memory CozoDB instance and wrap with adapter
  const cozoDb = new CozoDb('mem');
  const db: GraphDB = new CozoDbAdapter(cozoDb);
  activeDatabases.push(db);

  // Run migrations to set up schema
  // Use a simplified schema without FTS/access_level for testing
  try {
    console.log('[Setup] Creating database schema...');

    // Create core relations
    await db.mutate(`:create blocks { block_id: String => page_id: String, parent_id: String?, content: String, content_type: String default 'text', order: String, is_collapsed: Bool default false, is_deleted: Bool default false, created_at: Float, updated_at: Float }`, {});
    await db.mutate(`:create pages { page_id: String => title: String, created_at: Float, updated_at: Float, is_deleted: Bool default false, daily_note_date: String? }`, {});
    await db.mutate(`:create blocks_by_page { page_id: String, block_id: String }`, {});
    await db.mutate(`:create blocks_by_parent { parent_id: String, block_id: String }`, {});
    await db.mutate(`:create block_refs { source_block_id: String, target_block_id: String => created_at: Float }`, {});
    await db.mutate(`:create links { source_id: String, target_id: String, link_type: String default 'reference' => created_at: Float, context_block_id: String? }`, {});
    await db.mutate(`:create properties { entity_id: String, key: String => value: String, value_type: String default 'string', updated_at: Float }`, {});
    await db.mutate(`:create tags { entity_id: String, tag: String => created_at: Float }`, {});
    await db.mutate(`:create block_history { block_id: String, version: Int => content: String, parent_id: String?, order: String, is_collapsed: Bool, is_deleted: Bool, operation: String, timestamp: Float }`, {});
    await db.mutate(`:create daily_notes { date: String => page_id: String }`, {});
    await db.mutate(`:create metadata { key: String => value: String }`, {});
    await db.mutate(`:create saved_queries { id: String => name: String, type: String, definition: String, description: String?, created_at: Float, updated_at: Float }`, {});

    // Create indexes (FTS skipped for compatibility)
    await db.mutate(`::index create links:by_target { target_id, source_id, link_type }`, {});
    await db.mutate(`::index create block_refs:by_target { target_block_id, source_block_id }`, {});

    // Set metadata
    await db.mutate(`?[key, value] <- [["schema_version", "2"]] :put metadata { key, value }`, {});
    await db.mutate(`?[key, value] <- [["applied_migrations", '["001-initial-schema","002-saved-queries"]']] :put metadata { key, value }`, {});

    console.log('[Setup] Schema created successfully');
  } catch (error) {
    console.error('[Setup] Schema creation failed:', error);
    throw error;
  }

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

// Clean up all databases after each test
afterEach(async () => {
  for (const db of activeDatabases) {
    try {
      await db.close();
    } catch {
      // Ignore close errors
    }
  }
  activeDatabases.length = 0;
});

/**
 * Seed test database with sample data for integration tests
 * Uses direct database operations to insert test data
 */
export async function seedTestData(db: GraphDB): Promise<void> {
  // Seed pages
  await db.mutate(
    `
?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
  ['page-1', 'Seeded Page One', 1700000000, 1700000000, false, null],
  ['page-2', 'Seeded Page Two', 1700000100, 1700000100, false, null],
  ['page-3', 'Seeded Page Three', 1700000200, 1700000200, false, null]
]
:put pages { page_id, title, created_at, updated_at, is_deleted, daily_note_date }
`,
    {}
  );

  // Seed blocks
  await db.mutate(
    `
{
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
  ['block-1', 'page-1', null, 'Content linking to [[Seeded Page Two]]', 'text', 'a0', false, false, 1700000000, 1700000000],
  ['block-2', 'page-1', null, 'Content linking to [[Seeded Page Three]]', 'text', 'a1', false, false, 1700000010, 1700000010],
  ['block-3', 'page-2', null, 'Seeded block content', 'text', 'a0', false, false, 1700000100, 1700000100],
  ['block-4', 'page-3', null, 'Seeded block content', 'text', 'a0', false, false, 1700000200, 1700000200]
]
:put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
}
{
?[page_id, block_id] <- [
  ['page-1', 'block-1'],
  ['page-1', 'block-2'],
  ['page-2', 'block-3'],
  ['page-3', 'block-4']
]
:put blocks_by_page { page_id, block_id }
}
{
?[parent_id, block_id] <- [
  ['page-1#', 'block-1'],
  ['page-1#', 'block-2'],
  ['page-2#', 'block-3'],
  ['page-3#', 'block-4']
]
:put blocks_by_parent { parent_id, block_id }
}
`,
    {}
  );

  // Seed links
  await db.mutate(
    `
?[source_id, target_id, link_type, created_at, context_block_id] <- [
  ['page-1', 'page-2', 'reference', 1700000000, 'block-1'],
  ['page-1', 'page-3', 'reference', 1700000010, 'block-2']
]
:put links { source_id, target_id, link_type, created_at, context_block_id }
`,
    {}
  );
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
