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

// Repositories - Datalog query construction for domain entities
export { PageRepository, type GetAllOptions } from './page-repository.js';
export { TagRepository, type TagWithCount } from './tag-repository.js';
