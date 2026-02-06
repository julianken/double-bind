/**
 * Search types for Double-Bind
 *
 * Types for unified search across pages and blocks using CozoDB FTS.
 */

import type { PageId, BlockId } from './domain.js';

// ============================================================================
// Search Result Types
// ============================================================================

/**
 * Unified search result that can represent either a page title match
 * or a block content match.
 */
export interface SearchResult {
  /** The type of match: page title or block content */
  type: 'page' | 'block';

  /** The ID of the matched entity (page_id or block_id) */
  id: string;

  /** Page title (for pages) or parent page title (for blocks) */
  title: string;

  /** Title (for pages) or block content snippet (for blocks) */
  content: string;

  /** FTS relevance score from CozoDB */
  score: number;

  /** Page ID for navigation - same as id for pages, parent page for blocks */
  pageId: PageId;

  /** Block ID if this is a block result (for direct navigation within page) */
  blockId?: BlockId;
}

/**
 * Options for configuring search behavior.
 */
export interface SearchOptions {
  /** Maximum number of results to return per type (default: 20) */
  limit?: number;

  /** Minimum score threshold for results (default: 0) */
  minScore?: number;

  /** Types of results to include (default: both) */
  includeTypes?: Array<'page' | 'block'>;
}
