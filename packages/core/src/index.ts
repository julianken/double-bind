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
} from './repositories/index.js';

// Parsers
export {
  parseContent,
  type ParsedContent,
  type PageLink,
  type BlockReference,
  type ParsedProperty,
} from './parsers/index.js';

// Client implementations
export { tauriGraphDB } from './client/index.js';
