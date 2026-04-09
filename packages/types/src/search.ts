/** Search types for unified FTS across pages and blocks. */

import type { PageId, BlockId } from './domain.js';

export interface SearchResult {
  type: 'page' | 'block';
  id: string;
  title: string;
  content: string;
  score: number;
  pageId: PageId;
  blockId?: BlockId;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  includeTypes?: Array<'page' | 'block'>;
}
