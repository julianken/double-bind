// @double-bind/test-utils - MockGraphDB, fixtures, test factories
// Dependencies: @double-bind/types

export { MockGraphDB, type RecordedCall } from './mock-graph-db.js';

// Test factories
export {
  createPage,
  createBlock,
  createLink,
  createBlockRef,
  createTag,
  createProperty,
  createPageWithId,
  createBlockWithId,
  createPageWithBlocks,
  createLinkedPages,
} from './factories.js';

// Fixtures
export {
  FIXTURE_SMALL_KB,
  FIXTURE_DEEP_TREE,
  FIXTURE_PAGERANK_GRAPH,
  SMALL_KB_PAGE_IDS,
  SMALL_KB_BLOCK_IDS,
  PAGERANK_PAGE_IDS,
} from './fixtures.js';

export type {
  SmallKBFixture,
  DeepTreeFixture,
  PageRankGraphFixture,
} from './fixtures.js';
