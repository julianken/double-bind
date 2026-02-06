/**
 * Types for Saved Queries
 *
 * Saved queries allow users to persist and reuse query definitions.
 * Three query types are supported:
 * - template: Parameterized queries with placeholder variables
 * - visual: Queries built through a visual query builder
 * - raw: Raw Datalog queries entered directly
 */

// ============================================================================
// Identifiers
// ============================================================================

/** Saved query identifier - ULID format */
export type SavedQueryId = string;

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of saved queries.
 * - template: Parameterized queries with placeholders (e.g., $variable)
 * - visual: Queries created via visual query builder
 * - raw: Raw Datalog queries
 */
export enum SavedQueryType {
  TEMPLATE = 'template',
  VISUAL = 'visual',
  RAW = 'raw',
}

// ============================================================================
// Domain Entities
// ============================================================================

/**
 * A saved query stores a reusable query definition.
 */
export interface SavedQuery {
  /** Unique identifier (ULID) */
  id: SavedQueryId;

  /** Human-readable name for the query */
  name: string;

  /** Type of query (template, visual, raw) */
  type: SavedQueryType;

  /** The query definition (Datalog string or serialized visual query) */
  definition: string;

  /** Optional description of what the query does */
  description: string | null;

  /** Unix timestamp (milliseconds) when created */
  createdAt: number;

  /** Unix timestamp (milliseconds) when last updated */
  updatedAt: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new saved query.
 */
export interface CreateSavedQueryInput {
  /** Human-readable name for the query */
  name: string;

  /** Type of query (template, visual, raw) */
  type: SavedQueryType;

  /** The query definition */
  definition: string;

  /** Optional description */
  description?: string | null;
}

/**
 * Input for updating an existing saved query.
 */
export interface UpdateSavedQueryInput {
  /** New name (optional) */
  name?: string;

  /** New type (optional) */
  type?: SavedQueryType;

  /** New definition (optional) */
  definition?: string;

  /** New description (optional) */
  description?: string | null;
}
