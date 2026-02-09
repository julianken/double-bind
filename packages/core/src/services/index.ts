/**
 * Services barrel export
 *
 * Services orchestrate repositories and handle cross-cutting concerns.
 * They provide higher-level operations than repositories.
 */

import type { GraphDB } from '@double-bind/types';
import type { GraphDBProvider } from '../providers/graph-db-provider.js';
import { PageService } from './page-service.js';
import { BlockService } from './block-service.js';
import { GraphService } from './graph-service.js';
import { SearchService } from './search-service.js';
import { SavedQueryService } from './saved-query-service.js';
import {
  PageRepository,
  BlockRepository,
  LinkRepository,
  TagRepository,
  PropertyRepository,
  SavedQueryRepository,
} from '../repositories/index.js';

export { PageService, type PageWithBlocks, type PageBacklink } from './page-service.js';
export { BlockService, type BlockBacklinkResult, type RebalanceCallback } from './block-service.js';
export { GraphService, type GraphResult, type SuggestedLink } from './graph-service.js';
export { SearchService } from './search-service.js';
export { SavedQueryService, type ListSavedQueriesOptions } from './saved-query-service.js';

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
  searchService: SearchService;
  savedQueryService: SavedQueryService;
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
 * @param db - The GraphDB instance (platform-specific implementation)
 * @returns Services object containing all application services
 *
 * @example
 * ```typescript
 * // Desktop/mobile app initialization with GraphDBProvider
 * const provider = new TauriGraphDBProvider(); // or SqliteGraphDBProvider for mobile
 * await provider.initialize();
 * const db = provider.getGraphDB();
 * await runMigrations(db);
 * const services = createServices(db);
 *
 * // Node.js CLI initialization
 * const db = createCozoNodeGraphDB(dbPath);
 * await runMigrations(db);
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
  const savedQueryRepo = new SavedQueryRepository(db);

  // Wire up services with their dependencies
  const pageService = new PageService(pageRepo, blockRepo, linkRepo);
  const blockService = new BlockService(blockRepo, linkRepo, pageRepo, tagRepo, propertyRepo);
  const graphService = new GraphService(db);
  const searchService = new SearchService(db);
  const savedQueryService = new SavedQueryService(savedQueryRepo);

  return {
    pageService,
    blockService,
    graphService,
    searchService,
    savedQueryService,
  };
}

/**
 * Factory function — creates all services from a GraphDBProvider.
 *
 * This is the platform-agnostic way to initialize the service layer.
 * Each platform (desktop, mobile, CLI) provides its own GraphDBProvider
 * implementation, and this factory uses it to create all services.
 *
 * The factory:
 * 1. Gets the GraphDB instance from the provider
 * 2. Delegates to createServices() to create all services
 * 3. Returns the Services object for injection into the UI
 *
 * @param provider - The platform-specific GraphDBProvider
 * @returns Promise resolving to Services object
 *
 * @example
 * ```typescript
 * // Desktop app with Tauri
 * const provider = new TauriGraphDBProvider();
 * const services = await createServicesFromProvider(provider);
 *
 * // Mobile app with Expo SQLite
 * const provider = new ExpoSQLiteProvider(dbPath);
 * const services = await createServicesFromProvider(provider);
 *
 * // CLI with cozo-node
 * const provider = new NodeGraphDBProvider(dbPath);
 * const services = await createServicesFromProvider(provider);
 * ```
 */
export async function createServicesFromProvider(
  provider: GraphDBProvider
): Promise<Services> {
  const db = await provider.getDatabase();
  return createServices(db);
}
