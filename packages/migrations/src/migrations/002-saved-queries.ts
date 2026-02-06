// 002-saved-queries: Creates the saved_queries relation for storing reusable queries
//
// This migration adds support for saving, loading, and managing user-defined queries.
// Saved queries can be templates (parameterized), visual (from query builder), or raw Datalog.

import type { Migration } from '../types.js';

/**
 * Migration to add saved queries support.
 *
 * Creates:
 * - saved_queries: Stores query definitions with metadata
 * - saved_queries:fts: Full-text search on query names
 *
 * Schema:
 * - id: Unique ULID identifier
 * - name: Human-readable query name
 * - type: Query type (template, visual, raw)
 * - definition: The query string or serialized query definition
 * - description: Optional description of the query
 * - created_at: Creation timestamp (Unix ms)
 * - updated_at: Last modification timestamp (Unix ms)
 */
export const migration: Migration = {
  version: 2,
  name: '002-saved-queries',

  up: `
# ===============================================
# SAVED QUERIES
# ===============================================

# Saved queries - reusable query definitions
:create saved_queries {
    id: String
    =>
    name: String,
    type: String,
    definition: String,
    description: String?,
    created_at: Float,
    updated_at: Float
}

# ===============================================
# FULL-TEXT SEARCH INDEX
# ===============================================

# FTS index on query names for search functionality
::fts create saved_queries:fts {
    extractor: name
}

# ===============================================
# ACCESS LEVEL PROTECTION
# ===============================================

# Protect saved_queries from accidental schema destruction
::access_level saved_queries protected

# ===============================================
# UPDATE SCHEMA VERSION
# ===============================================

:put metadata { key: 'schema_version', value: '2' }
`,

  down: `
# WARNING: This removes all saved queries. Only use during development.

# Remove access level protection first
::access_level saved_queries normal

# Remove FTS index
::fts drop saved_queries:fts

# Remove the relation
::remove saved_queries

# Revert schema version
:put metadata { key: 'schema_version', value: '1' }
`,
};
