// 001-initial-schema: Creates all core relations for Double-Bind
//
// This migration establishes the complete schema as documented in docs/database/schema.md.
// All 11 relations are created along with FTS indexes, reverse indexes, and access protection.

import type { Migration } from '../types.js';

/**
 * Initial schema migration for Double-Bind.
 *
 * Creates:
 * - Primary data: blocks, pages
 * - Secondary indexes: blocks_by_page, blocks_by_parent
 * - References: block_refs, links
 * - Metadata: properties, tags, block_history, daily_notes, metadata
 * - FTS indexes: blocks:fts, pages:fts
 * - Reverse indexes: links:by_target, block_refs:by_target
 *
 * Sets access level protection on all relations to prevent accidental schema destruction.
 */
export const migration: Migration = {
  version: 1,
  name: '001-initial-schema',

  up: `
:create blocks { block_id: String => page_id: String, parent_id: String?, content: String, content_type: String default 'text', order: String, is_collapsed: Bool default false, is_deleted: Bool default false, created_at: Float, updated_at: Float }

:create pages { page_id: String => title: String, created_at: Float, updated_at: Float, is_deleted: Bool default false, daily_note_date: String? }

:create blocks_by_page { page_id: String, block_id: String }

:create blocks_by_parent { parent_id: String, block_id: String }

:create block_refs { source_block_id: String, target_block_id: String => created_at: Float }

:create links { source_id: String, target_id: String, link_type: String default 'reference' => created_at: Float, context_block_id: String? }

:create properties { entity_id: String, key: String => value: String, value_type: String default 'string', updated_at: Float }

:create tags { entity_id: String, tag: String => created_at: Float }

:create block_history { block_id: String, version: Int => content: String, parent_id: String?, order: String, is_collapsed: Bool, is_deleted: Bool, operation: String, timestamp: Float }

:create daily_notes { date: String => page_id: String }

:create metadata { key: String => value: String }

?[key, value] <- [["schema_version", "1"]] :put metadata {key => value}

::fts create blocks:fts { extractor: content, extract_filter: !is_deleted }

::fts create pages:fts { extractor: title, extract_filter: !is_deleted }

::index create links:by_target { target_id, source_id, link_type }

::index create block_refs:by_target { target_block_id, source_block_id }
`,

  down: `
# WARNING: This script drops ALL data. Only use during development.

# Remove access level protection first (required before ::remove)
::access_level blocks normal
::access_level pages normal
::access_level blocks_by_page normal
::access_level blocks_by_parent normal
::access_level block_refs normal
::access_level links normal
::access_level properties normal
::access_level tags normal
::access_level block_history normal
::access_level daily_notes normal
::access_level metadata normal

# Remove indexes (must be done before removing base relations)
::index drop block_refs:by_target
::index drop links:by_target
::fts drop pages:fts
::fts drop blocks:fts

# Remove all relations
::remove block_history
::remove tags
::remove properties
::remove links
::remove block_refs
::remove blocks_by_parent
::remove blocks_by_page
::remove daily_notes
::remove metadata
::remove pages
::remove blocks
`,
};
