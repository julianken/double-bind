/**
 * Services barrel export
 *
 * Services orchestrate repositories and handle cross-cutting concerns.
 * They provide higher-level operations than repositories.
 */

import type { GraphDB } from '@double-bind/types';
import { PageService } from './page-service.js';
import { BlockService } from './block-service.js';
import { GraphService } from './graph-service.js';
import {
  PageRepository,
  BlockRepository,
  LinkRepository,
  TagRepository,
  PropertyRepository,
} from '../repositories/index.js';

export { PageService, type PageWithBlocks } from './page-service.js';
export { BlockService, type BlockBacklinkResult, type RebalanceCallback } from './block-service.js';
export { GraphService, type GraphResult, type SuggestedLink } from './graph-service.js';

/**
 * All services bundled for dependency injection.
 *
 * This interface represents the complete service layer of the application.
 * It is created by the createServices() factory and injected into the
 * UI layer (desktop, TUI, CLI).
 */
export interface Services {
  pageService: PageService;
  blockService: BlockService;
  graphService: GraphService;
}

/**
 * Factory function — creates all services from a single GraphDB instance.
 *
 * This is called once at app startup (desktop, TUI, CLI) after migrations
 * have completed successfully.
 *
 * The factory:
 * 1. Creates all repository instances with the GraphDB
 * 2. Wires up services with their repository dependencies
 * 3. Returns the Services object for injection into the UI
 *
 * @param db - The GraphDB instance (CozoDB or Tauri client)
 * @returns Services object containing all application services
 *
 * @example
 * ```typescript
 * // Desktop app initialization (after migrations complete)
 * const db = tauriGraphDB();
 * const services = createServices(db);
 *
 * // TUI/CLI initialization
 * const db = createCozoNodeGraphDB(dbPath);
 * const migrationResult = await runMigrations(db);
 * if (migrationResult.errors.length > 0) {
 *   console.error('Migration failed:', migrationResult.errors);
 *   process.exit(3);
 * }
 * const services = createServices(db);
 * ```
 */
export function createServices(db: GraphDB): Services {
  // Create all repository instances
  const pageRepo = new PageRepository(db);
  const blockRepo = new BlockRepository(db);
  const linkRepo = new LinkRepository(db);
  const tagRepo = new TagRepository(db);
  const propertyRepo = new PropertyRepository(db);

  // Wire up services with their dependencies
  const pageService = new PageService(pageRepo, blockRepo, linkRepo);
  const blockService = new BlockService(blockRepo, linkRepo, pageRepo, tagRepo, propertyRepo);
  const graphService = new GraphService(db);

  return {
    pageService,
    blockService,
    graphService,
  };
}
