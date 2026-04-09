/**
 * Domain types for Double-Bind
 *
 * Core entity interfaces representing the graph-native data model.
 * All identifiers use ULID format for sortable, unique IDs.
 */

export type PageId = string;
export type BlockId = string;

/** Top-level container for blocks. Can be a regular note or daily note. */
export interface Page {
  pageId: PageId;
  title: string;
  createdAt: number; // Unix timestamp (float, milliseconds)
  updatedAt: number;
  isDeleted: boolean;
  dailyNoteDate: string | null; // YYYY-MM-DD format or null for regular pages
}

/** Fundamental unit of content. Forms a tree within a page via parentId. */
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

/** Block-to-block reference for embeds and transclusions. */
export interface BlockRef {
  sourceBlockId: BlockId;
  targetBlockId: BlockId;
  createdAt: number;
}

/** Page-to-page link extracted from block content for graph traversal. */
export interface Link {
  sourceId: PageId;
  targetId: PageId;
  linkType: 'reference' | 'embed' | 'tag';
  createdAt: number;
  contextBlockId: BlockId | null; // The block containing this link
}

/** Key-value metadata on a page or block (e.g., status::done, priority::high). */
export interface Property {
  entityId: string; // PageId or BlockId
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'date';
  updatedAt: number;
}

/** Tag on a page or block. */
export interface Tag {
  entityId: string; // PageId or BlockId
  tag: string;
  createdAt: number;
}

/** Versioned snapshot of a block for undo/redo and audit trails. */
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
