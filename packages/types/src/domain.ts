/**
 * Domain types for Double-Bind
 *
 * Core entity interfaces representing the graph-native data model.
 * All identifiers use ULID format for sortable, unique IDs.
 */

// ============================================================================
// Identifiers
// ============================================================================

/** Page identifier - ULID format */
export type PageId = string;

/** Block identifier - ULID format */
export type BlockId = string;

// ============================================================================
// Core Entities
// ============================================================================

/**
 * A page is the top-level container for blocks.
 * Pages can be regular notes or daily notes (journal entries).
 */
export interface Page {
  pageId: PageId;
  title: string;
  createdAt: number; // Unix timestamp (float, milliseconds)
  updatedAt: number;
  isDeleted: boolean;
  dailyNoteDate: string | null; // YYYY-MM-DD format or null for regular pages
}

/**
 * A block is the fundamental unit of content.
 * Blocks form a tree structure within a page via parentId references.
 */
export interface Block {
  blockId: BlockId;
  pageId: PageId;
  parentId: BlockId | null; // null = root block of page
  content: string;
  contentType: 'text' | 'heading' | 'code' | 'todo' | 'query';
  order: string; // String-based fractional indexing (rocicorp/fractional-indexing)
  isCollapsed: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * A block reference links one block to another.
 * Used for block embeds and transclusions.
 */
export interface BlockRef {
  sourceBlockId: BlockId;
  targetBlockId: BlockId;
  createdAt: number;
}

/**
 * A link connects two pages.
 * Links are extracted from block content and stored for graph traversal.
 */
export interface Link {
  sourceId: PageId;
  targetId: PageId;
  linkType: 'reference' | 'embed' | 'tag';
  createdAt: number;
  contextBlockId: BlockId | null; // The block containing this link
}

/**
 * A property is a key-value pair attached to a page or block.
 * Used for structured metadata (e.g., status::done, priority::high).
 */
export interface Property {
  entityId: string; // PageId or BlockId
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'date';
  updatedAt: number;
}

/**
 * A tag attached to a page or block.
 * Tags are a simplified form of categorization.
 */
export interface Tag {
  entityId: string; // PageId or BlockId
  tag: string;
  createdAt: number;
}

/**
 * A versioned snapshot of a block for history tracking.
 * Enables undo/redo and audit trails.
 */
export interface BlockVersion {
  blockId: BlockId;
  version: number;
  content: string;
  parentId: BlockId | null;
  order: string;
  isCollapsed: boolean;
  isDeleted: boolean;
  operation: 'create' | 'update' | 'delete' | 'move' | 'restore';
  timestamp: number;
}
