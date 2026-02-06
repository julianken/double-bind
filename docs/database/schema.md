# Database Schema

## Relations Overview

| Relation | Key Columns | Purpose |
|----------|------------|---------|
| `blocks` | `block_id` | Primary block storage |
| `blocks_by_page` | `page_id, block_id` | Page load index |
| `blocks_by_parent` | `parent_id, block_id` | Tree traversal index |
| `pages` | `page_id` | Page metadata |
| `block_refs` | `source_block_id, target_block_id` | Block-to-block references |
| `links` | `source_id, target_id, link_type` | Page-to-page links |
| `properties` | `entity_id, key` | Key-value properties |
| `tags` | `entity_id, tag` | Tags on any entity |
| `block_history` | `block_id, version` | Edit history for undo/versioning |
| `daily_notes` | `date` | Date → page_id lookup |
| `metadata` | `key` | App-level configuration |

## Full Schema

```datalog
# ═══════════════════════════════════════════════
# PRIMARY DATA
# ═══════════════════════════════════════════════

# Blocks — the atomic unit of content.
# Key: block_id only (simple key for O(1) reference resolution).
# See ADR-005 for the full analysis of this decision.
:create blocks {
    block_id: String
    =>
    page_id: String,
    parent_id: String?,       # null for root-level blocks (direct children of a page)
    content: String,
    content_type: String default 'text',   # 'text' | 'heading' | 'code' | 'todo' | 'query'
    order: String,            # string-based fractional indexing (see ADR-013)
    is_collapsed: Bool default false,
    is_deleted: Bool default false,         # soft delete
    created_at: Float,        # Unix timestamp (seconds)
    updated_at: Float
}

# Pages — top-level containers for blocks.
:create pages {
    page_id: String
    =>
    title: String,
    created_at: Float,
    updated_at: Float,
    is_deleted: Bool default false,
    daily_note_date: String?  # ISO date string if this is a daily note, null otherwise
}

# ═══════════════════════════════════════════════
# SECONDARY INDEXES (maintained by application)
# ═══════════════════════════════════════════════

# Index for fast page load: prefix scan on page_id returns all block_ids for a page.
:create blocks_by_page {
    page_id: String,
    block_id: String
}

# Index for tree traversal: prefix scan on parent_id returns all children.
# Root-level blocks (parent_id = null) use the page_id as a sentinel key
# with a "__page:" prefix, e.g., "__page:01HXQ..." — this avoids null keys
# while keeping root blocks queryable via the same index.
:create blocks_by_parent {
    parent_id: String,         # block_id of parent, or "__page:<page_id>" for root blocks
    block_id: String
}

# ═══════════════════════════════════════════════
# REFERENCES AND LINKS
# ═══════════════════════════════════════════════

# Block references — from ((block_id)) syntax in content.
# Source block contains the reference text; target block is being referenced.
:create block_refs {
    source_block_id: String,
    target_block_id: String
    =>
    created_at: Float
}

# Page-to-page links — denormalized from [[Page Name]] in block content.
:create links {
    source_id: String,        # page_id of the page containing the link
    target_id: String,        # page_id of the linked page
    link_type: String default 'reference'  # 'reference' | 'embed' | 'tag'
    =>
    created_at: Float,
    context_block_id: String? # which block contains this link
}

# ═══════════════════════════════════════════════
# METADATA AND PROPERTIES
# ═══════════════════════════════════════════════

# Key-value properties on any entity (page or block).
# Enables user-defined attributes without schema changes.
:create properties {
    entity_id: String,
    key: String
    =>
    value: String,
    value_type: String default 'string',  # 'string' | 'number' | 'boolean' | 'date'
    updated_at: Float
}

# Tags on any entity.
:create tags {
    entity_id: String,
    tag: String
    =>
    created_at: Float
}

# ═══════════════════════════════════════════════
# HISTORY AND VERSIONING
# ═══════════════════════════════════════════════

# Block edit history — for undo/redo and version control.
# Stores all mutable fields from blocks to enable full state restoration.
:create block_history {
    block_id: String,
    version: Int              # monotonically increasing per block
    =>
    content: String,
    parent_id: String?,
    order: String,
    is_collapsed: Bool,
    is_deleted: Bool,
    operation: String,        # 'create' | 'update' | 'move' | 'delete' | 'restore'
    timestamp: Float
}

# ═══════════════════════════════════════════════
# LOOKUPS
# ═══════════════════════════════════════════════

# Daily notes — date string → page_id.
:create daily_notes {
    date: String              # ISO date: '2024-01-15'
    =>
    page_id: String
}

# App metadata — key-value store for app configuration.
:create metadata {
    key: String
    =>
    value: String
}

# ═══════════════════════════════════════════════
# FULL-TEXT SEARCH INDEXES
# ═══════════════════════════════════════════════

# Full-text search indexes with soft-delete filtering.
# extract_filter ensures soft-deleted rows are removed from the FTS index
# when updated via :put. Query-time filter provides additional safety.
::fts create blocks:fts {
    extractor: content,
    extract_filter: !is_deleted
}
::fts create pages:fts {
    extractor: title,
    extract_filter: !is_deleted
}

# ═══════════════════════════════════════════════
# REVERSE INDEXES (for backlink queries)
# ═══════════════════════════════════════════════

# CozoDB only supports prefix scans on leading key columns.
# Without these, backlink queries on links and block_refs do full table scans.
::index create links:by_target { target_id, source_id, link_type }
::index create block_refs:by_target { target_block_id, source_block_id }
```

## Consistency Rules

1. **Every block in `blocks` must have a corresponding entry in `blocks_by_page`.**
2. **Every block in `blocks` must have an entry in `blocks_by_parent`.** Root-level blocks use `"__page:<page_id>"` as the parent_id key.
3. **Block mutations must update both the primary relation and index relations atomically** (within a single CozoDB transaction).
4. **`block_refs` and `links` are derived from block content** — updated whenever content changes.

## Soft-Delete and Garbage Collection

**Soft-delete strategy**: Entities are marked `is_deleted = true` rather than removed. This preserves referential integrity and supports undo.

**Garbage collection**: Application runs periodic purge of soft-deleted entities older than 30 days:
```datalog
# Purge soft-deleted blocks older than 30 days
?[block_id] := *blocks{ block_id, is_deleted, updated_at },
    is_deleted == true,
    updated_at < $cutoff_timestamp
:rm blocks { block_id }
```

The purge also cleans up index relations (`blocks_by_page`, `blocks_by_parent`) and derived relations (`block_refs`, `links`, `tags`, `properties`) for purged entities.

**block_history compaction**: Keep the last 100 versions per block. On app startup (background task), prune older versions:
```datalog
# Find versions to prune (keep latest 100 per block)
?[block_id, version] := *block_history{ block_id, version },
    max_ver = max(v): *block_history{ block_id, version: v },
    version < max_ver - 100
:rm block_history { block_id, version }
```
