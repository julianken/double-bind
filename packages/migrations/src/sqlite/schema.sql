-- ═══════════════════════════════════════════════════════════════
-- DOUBLE-BIND SQLITE SCHEMA v1
-- ═══════════════════════════════════════════════════════════════
--
-- Production-ready SQLite schema with Phase 2 architecture review corrections:
--
-- 1. Contentless FTS5 (not external content) - safer with TEXT primary keys
-- 2. ON DELETE RESTRICT for parent blocks - safe with soft-deletes
-- 3. Split properties/tags into typed tables - enables FK enforcement
-- 4. Auto-update triggers for updated_at fields
-- 5. Schema metadata table for dual versioning
--
-- This file is for reference only. The actual schema is applied via
-- TypeScript migrations in 001-initial-schema.ts.
--
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- PRAGMA SETTINGS
-- ═══════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ═══════════════════════════════════════════════════════════════
-- PRIMARY TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE pages (
    page_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    daily_note_date TEXT,
    CHECK (is_deleted IN (0, 1))
);

CREATE TABLE blocks (
    block_id TEXT PRIMARY KEY NOT NULL,
    page_id TEXT NOT NULL,
    parent_id TEXT,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text',
    "order" TEXT NOT NULL,
    is_collapsed INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES blocks(block_id) ON DELETE RESTRICT,
    CHECK (is_collapsed IN (0, 1)),
    CHECK (is_deleted IN (0, 1)),
    CHECK (content_type IN ('text', 'heading', 'code', 'todo', 'query'))
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES (replace CozoDB manual index relations)
-- ═══════════════════════════════════════════════════════════════

-- Active blocks for page load (replaces blocks_by_page)
CREATE INDEX idx_blocks_page_active ON blocks(page_id, "order") WHERE is_deleted = 0;

-- All blocks for page (including deleted, for admin)
CREATE INDEX idx_blocks_page_id ON blocks(page_id, "order");

-- Active children for tree traversal (replaces blocks_by_parent)
CREATE INDEX idx_blocks_parent_active ON blocks(parent_id, "order") WHERE is_deleted = 0;

-- Pages sorted by recency
CREATE INDEX idx_pages_updated_at ON pages(updated_at DESC) WHERE is_deleted = 0;

-- Daily note lookup
CREATE INDEX idx_pages_daily_note_date ON pages(daily_note_date) WHERE daily_note_date IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- REFERENCES AND LINKS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE block_refs (
    source_block_id TEXT NOT NULL,
    target_block_id TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (source_block_id, target_block_id),
    FOREIGN KEY (source_block_id) REFERENCES blocks(block_id) ON DELETE CASCADE,
    FOREIGN KEY (target_block_id) REFERENCES blocks(block_id) ON DELETE CASCADE
);

CREATE TABLE links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    link_type TEXT NOT NULL DEFAULT 'reference',
    created_at REAL NOT NULL,
    context_block_id TEXT,
    PRIMARY KEY (source_id, target_id, link_type),
    FOREIGN KEY (source_id) REFERENCES pages(page_id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES pages(page_id) ON DELETE CASCADE,
    FOREIGN KEY (context_block_id) REFERENCES blocks(block_id) ON DELETE SET NULL,
    CHECK (link_type IN ('reference', 'embed', 'tag'))
);

CREATE INDEX idx_block_refs_target ON block_refs(target_block_id, source_block_id);

CREATE INDEX idx_links_target ON links(target_id, source_id, link_type);

CREATE INDEX idx_links_context_block ON links(context_block_id);

-- ═══════════════════════════════════════════════════════════════
-- PROPERTIES AND TAGS (split into typed tables for FK enforcement)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE block_properties (
    block_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string',
    updated_at REAL NOT NULL,
    PRIMARY KEY (block_id, key),
    FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE,
    CHECK (value_type IN ('string', 'number', 'boolean', 'date'))
);

CREATE TABLE page_properties (
    page_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string',
    updated_at REAL NOT NULL,
    PRIMARY KEY (page_id, key),
    FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE,
    CHECK (value_type IN ('string', 'number', 'boolean', 'date'))
);

CREATE TABLE block_tags (
    block_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (block_id, tag),
    FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE
);

CREATE TABLE page_tags (
    page_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (page_id, tag),
    FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
);

CREATE INDEX idx_block_tags_tag ON block_tags(tag, block_id);

CREATE INDEX idx_page_tags_tag ON page_tags(tag, page_id);

CREATE INDEX idx_block_properties_block ON block_properties(block_id);

CREATE INDEX idx_page_properties_page ON page_properties(page_id);

-- ═══════════════════════════════════════════════════════════════
-- HISTORY AND VERSIONING
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE block_history (
    block_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_id TEXT,
    "order" TEXT NOT NULL,
    is_collapsed INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL,
    operation TEXT NOT NULL,
    timestamp REAL NOT NULL,
    PRIMARY KEY (block_id, version),
    FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE,
    CHECK (is_collapsed IN (0, 1)),
    CHECK (is_deleted IN (0, 1)),
    CHECK (operation IN ('create', 'update', 'move', 'delete', 'restore'))
);

CREATE INDEX idx_block_history_timestamp ON block_history(block_id, version DESC);

-- ═══════════════════════════════════════════════════════════════
-- LOOKUPS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE daily_notes (
    date TEXT PRIMARY KEY NOT NULL,
    page_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
);

CREATE TABLE schema_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- SAVED QUERIES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE saved_queries (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    definition TEXT NOT NULL,
    description TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    CHECK (type IN ('template', 'visual', 'raw'))
);

CREATE INDEX idx_saved_queries_updated_at ON saved_queries(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- CONTENTLESS FTS5 (with entity ID for lookups)
-- ═══════════════════════════════════════════════════════════════

CREATE VIRTUAL TABLE blocks_fts USING fts5(
    block_id UNINDEXED,
    content,
    tokenize='porter unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE pages_fts USING fts5(
    page_id UNINDEXED,
    title,
    tokenize='porter unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE saved_queries_fts USING fts5(
    query_id UNINDEXED,
    name,
    tokenize='porter unicode61 remove_diacritics 2'
);

-- ═══════════════════════════════════════════════════════════════
-- FTS TRIGGERS (contentless FTS requires manual sync)
-- ═══════════════════════════════════════════════════════════════

-- Blocks FTS
CREATE TRIGGER blocks_fts_insert AFTER INSERT ON blocks
    WHEN NEW.is_deleted = 0
BEGIN
    INSERT INTO blocks_fts(block_id, content) VALUES (NEW.block_id, NEW.content);
END;

CREATE TRIGGER blocks_fts_update AFTER UPDATE OF content, is_deleted ON blocks
BEGIN
    DELETE FROM blocks_fts WHERE block_id = OLD.block_id;
    INSERT INTO blocks_fts(block_id, content)
        SELECT NEW.block_id, NEW.content WHERE NEW.is_deleted = 0;
END;

CREATE TRIGGER blocks_fts_delete AFTER DELETE ON blocks
BEGIN
    DELETE FROM blocks_fts WHERE block_id = OLD.block_id;
END;

-- Pages FTS
CREATE TRIGGER pages_fts_insert AFTER INSERT ON pages
    WHEN NEW.is_deleted = 0
BEGIN
    INSERT INTO pages_fts(page_id, title) VALUES (NEW.page_id, NEW.title);
END;

CREATE TRIGGER pages_fts_update AFTER UPDATE OF title, is_deleted ON pages
BEGIN
    DELETE FROM pages_fts WHERE page_id = OLD.page_id;
    INSERT INTO pages_fts(page_id, title)
        SELECT NEW.page_id, NEW.title WHERE NEW.is_deleted = 0;
END;

CREATE TRIGGER pages_fts_delete AFTER DELETE ON pages
BEGIN
    DELETE FROM pages_fts WHERE page_id = OLD.page_id;
END;

-- Saved Queries FTS
CREATE TRIGGER saved_queries_fts_insert AFTER INSERT ON saved_queries
BEGIN
    INSERT INTO saved_queries_fts(query_id, name) VALUES (NEW.id, NEW.name);
END;

CREATE TRIGGER saved_queries_fts_update AFTER UPDATE OF name ON saved_queries
BEGIN
    DELETE FROM saved_queries_fts WHERE query_id = OLD.id;
    INSERT INTO saved_queries_fts(query_id, name) VALUES (NEW.id, NEW.name);
END;

CREATE TRIGGER saved_queries_fts_delete AFTER DELETE ON saved_queries
BEGIN
    DELETE FROM saved_queries_fts WHERE query_id = OLD.id;
END;

-- ═══════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGERS for updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER pages_updated_at AFTER UPDATE ON pages
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE pages SET updated_at = unixepoch('now', 'subsec') WHERE page_id = NEW.page_id;
END;

CREATE TRIGGER blocks_updated_at AFTER UPDATE ON blocks
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE blocks SET updated_at = unixepoch('now', 'subsec') WHERE block_id = NEW.block_id;
END;

CREATE TRIGGER saved_queries_updated_at AFTER UPDATE ON saved_queries
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE saved_queries SET updated_at = unixepoch('now', 'subsec') WHERE id = NEW.id;
END;

-- ═══════════════════════════════════════════════════════════════
-- SCHEMA VERSIONING
-- ═══════════════════════════════════════════════════════════════

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '1');
INSERT INTO schema_metadata (key, value) VALUES ('applied_migrations', '["001-initial-schema"]');
