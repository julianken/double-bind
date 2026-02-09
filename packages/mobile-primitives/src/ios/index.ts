/**
 * iOS Spotlight integration module.
 *
 * Provides TypeScript interfaces and services for integrating with iOS
 * Spotlight search and Siri suggestions. Enables system-wide search of
 * notes and intelligent Siri predictions based on user behavior.
 *
 * @example
 * ```ts
 * import {
 *   SpotlightIndexer,
 *   MockSpotlightBridge,
 *   useSpotlightSearch,
 *   SiriActivityService,
 * } from '@double-bind/mobile-primitives/ios';
 *
 * // Create indexer
 * const bridge = new MockSpotlightBridge();
 * const indexer = new SpotlightIndexer(bridge);
 *
 * // Index a page
 * await indexer.indexPage(page, 'Content preview...');
 *
 * // Handle search results
 * useSpotlightSearch((continuation) => {
 *   navigation.navigate('Page', { pageId: continuation.pageId });
 * });
 *
 * // Donate Siri activity
 * const siri = new SiriActivityService(siriBridge);
 * await siri.donateViewPageActivity(page);
 * ```
 */

// Types
export type {
  SpotlightDomainIdentifier,
  SpotlightItemIdentifier,
  SpotlightItem,
  SpotlightActivityType,
  SpotlightActivity,
  SpotlightIntent,
  SpotlightIndexResult,
  SpotlightBatchOptions,
  SpotlightSearchContinuation,
} from './SpotlightTypes.js';

// Indexer
export {
  SpotlightIndexer,
  MockSpotlightBridge,
  DEFAULT_DOMAIN_IDENTIFIER,
  DEFAULT_CONTENT_TYPE,
} from './SpotlightIndexer.js';
export type { SpotlightBridge } from './SpotlightIndexer.js';

// Search hook
export {
  useSpotlightSearch,
  useHasSpotlight,
  MockSpotlightSearchBridge,
} from './useSpotlightSearch.js';
export type {
  SpotlightSearchHandler,
  SpotlightSearchBridge,
  UseSpotlightSearchOptions,
  UseSpotlightSearchResult,
} from './useSpotlightSearch.js';

// Siri activity
export {
  SiriActivityService,
  MockSiriActivityBridge,
  IntentHandlerRegistry,
} from './SiriActivity.js';
export type { SiriActivityBridge, IntentHandler } from './SiriActivity.js';
