/**
 * Repository schemas barrel export
 *
 * Re-exports all Zod validation schemas and parser functions for repositories.
 */

// Page repository
export {
  PageRowSchema,
  PageSchema,
  parsePageRow,
  type PageRow,
} from './page-repository.schemas.js';

// Block repository
export {
  BlockRowSchema,
  BlockSchema,
  BlockVersionRowSchema,
  BlockVersionSchema,
  parseBlockRow,
  parseBlockVersionRow,
  type BlockRow,
  type BlockVersionRow,
} from './block-repository.schemas.js';

// Link repository
export {
  LinkRowSchema,
  LinkSchema,
  BlockRefRowSchema,
  BlockRefSchema,
  parseLinkRow,
  parseBlockRefRow,
  type LinkRow,
  type BlockRefRow,
} from './link-repository.schemas.js';

// Tag repository
export { TagRowSchema, TagSchema, parseTagRow, type TagRow } from './tag-repository.schemas.js';

// Property repository
export {
  PropertyRowSchema,
  PropertySchema,
  parsePropertyRow,
  type PropertyRow,
} from './property-repository.schemas.js';

// Saved query repository
export {
  SavedQueryRowSchema,
  SavedQuerySchema,
  parseSavedQueryRow,
  type SavedQueryRow,
} from './saved-query-repository.schemas.js';

// Repositories - SQL query construction for domain entities
export { PageRepository, type GetAllOptions } from './page-repository.js';
export { TagRepository, type TagWithCount } from './tag-repository.js';
export {
  LinkRepository,
  type CreateLinkInput,
  type CreateBlockRefInput,
  type LinkWithTargetTitle,
  type InLink,
  type BlockBacklink,
} from './link-repository.js';
export { BlockRepository, computeParentKey, type BlockSearchResult } from './block-repository.js';
export { PropertyRepository, type PropertyValueType } from './property-repository.js';
export {
  SavedQueryRepository,
  type GetAllSavedQueriesOptions,
} from './saved-query-repository.js';
