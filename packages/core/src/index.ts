// @double-bind/core - Business logic (repos, services, client)
// Dependencies: @double-bind/types, @double-bind/migrations

// Repository schemas and parsers
export {
  // Page
  PageRowSchema,
  PageSchema,
  parsePageRow,
  type PageRow,
  // Block
  BlockRowSchema,
  BlockSchema,
  BlockVersionRowSchema,
  BlockVersionSchema,
  parseBlockRow,
  parseBlockVersionRow,
  type BlockRow,
  type BlockVersionRow,
  // Link
  LinkRowSchema,
  LinkSchema,
  BlockRefRowSchema,
  BlockRefSchema,
  parseLinkRow,
  parseBlockRefRow,
  type LinkRow,
  type BlockRefRow,
  // Tag
  TagRowSchema,
  TagSchema,
  parseTagRow,
  type TagRow,
  // Property
  PropertyRowSchema,
  PropertySchema,
  parsePropertyRow,
  type PropertyRow,
  // Saved Query
  SavedQueryRowSchema,
  SavedQuerySchema,
  parseSavedQueryRow,
  type SavedQueryRow,
  // Repositories
  PageRepository,
  BlockRepository,
  computeParentKey,
  type GetAllOptions,
  type BlockSearchResult,
  TagRepository,
  type TagWithCount,
  LinkRepository,
  type CreateLinkInput,
  type CreateBlockRefInput,
  type LinkWithTargetTitle,
  type InLink,
  type BlockBacklink,
  PropertyRepository,
  type PropertyValueType,
  SavedQueryRepository,
  type GetAllSavedQueriesOptions,
} from './repositories/index.js';

// Parsers
export {
  parseContent,
  PATTERN_SOURCES,
  type ParsedContent,
  type PageLink,
  type BlockReference,
  type TagReference,
  type ParsedProperty,
} from './parsers/index.js';

// Utils - ordering and other utilities
export {
  keyBetween,
  keysBetween,
  needsRebalance,
  rebalanceKeys,
  keyForInsertAfter,
  MAX_KEY_LENGTH,
  DEFAULT_ORDER,
} from './utils/index.js';

// Services - orchestrate repositories with cross-cutting concerns
export {
  PageService,
  type PageWithBlocks,
  type PageBacklink,
  BlockService,
  type BlockBacklinkResult,
  type RebalanceCallback,
  GraphService,
  type GraphResult,
  SearchService,
  SavedQueryService,
  type ListSavedQueriesOptions,
  createServices,
  createServicesFromProvider,
  type Services,
} from './services/index.js';

// Adapters - database adapter implementations
export { SqliteNodeAdapter } from './adapters/sqlite-node-adapter.js';

// Providers - platform-agnostic database lifecycle management
export {
  type GraphDBProvider,
  type GraphDBProviderConfig,
  type GraphDBProviderInitResult,
} from './providers/index.js';
