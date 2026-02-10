/**
 * TypeScript types for iOS Spotlight integration.
 *
 * Provides type-safe interfaces for indexing content with iOS Spotlight
 * and handling Siri suggestions via NSUserActivity.
 */

import type { PageId } from '@double-bind/types';

/**
 * Domain identifier for Spotlight items.
 * Used to group related searchable items and enable batch operations.
 */
export type SpotlightDomainIdentifier = string;

/**
 * Unique identifier for a Spotlight item.
 * Typically maps to a PageId in our domain.
 */
export type SpotlightItemIdentifier = string;

/**
 * Searchable item for iOS Spotlight indexing.
 * Maps to CSSearchableItem in iOS SDK.
 */
export interface SpotlightItem {
  /**
   * Unique identifier for this item.
   * Used for updates and deletions.
   */
  identifier: SpotlightItemIdentifier;

  /**
   * Domain identifier for grouping items.
   * Example: 'com.doublebind.page'
   */
  domainIdentifier: SpotlightDomainIdentifier;

  /**
   * Display title shown in Spotlight results.
   */
  title: string;

  /**
   * Content description shown in Spotlight results.
   * Typically the first few lines of the page content.
   */
  contentDescription: string;

  /**
   * Keywords for improving search relevance.
   * Example: ['note', 'research', 'project']
   */
  keywords: string[];

  /**
   * Thumbnail image data (base64 encoded).
   * Optional. Shows in Spotlight results if provided.
   */
  thumbnailData?: string;

  /**
   * Creation date as Unix timestamp (milliseconds).
   */
  createdAt: number;

  /**
   * Last modification date as Unix timestamp (milliseconds).
   */
  updatedAt: number;

  /**
   * Additional metadata for search ranking.
   */
  metadata?: {
    /**
     * Content type identifier.
     * Example: 'com.doublebind.note'
     */
    contentType?: string;

    /**
     * Page identifier for deep linking.
     */
    pageId: PageId;

    /**
     * Whether this is a daily note.
     */
    isDailyNote?: boolean;

    /**
     * Daily note date (YYYY-MM-DD) if applicable.
     */
    dailyNoteDate?: string;
  };
}

/**
 * Activity type for Siri suggestions.
 * Maps to NSUserActivity.activityType in iOS SDK.
 */
export type SpotlightActivityType =
  | 'com.doublebind.viewPage'
  | 'com.doublebind.createPage'
  | 'com.doublebind.searchPages';

/**
 * User activity for Siri suggestions integration.
 * Maps to NSUserActivity in iOS SDK.
 */
export interface SpotlightActivity {
  /**
   * Activity type identifier.
   * Must match registered intent in Info.plist.
   */
  activityType: SpotlightActivityType;

  /**
   * Title shown in Siri suggestions.
   */
  title: string;

  /**
   * User info dictionary for restoring activity state.
   */
  userInfo: {
    pageId?: PageId;
    pageTitle?: string;
    [key: string]: unknown;
  };

  /**
   * Keywords for Siri relevance.
   */
  keywords?: string[];

  /**
   * Whether this activity is eligible for search.
   */
  isEligibleForSearch: boolean;

  /**
   * Whether this activity is eligible for handoff.
   */
  isEligibleForHandoff: boolean;

  /**
   * Whether this activity is eligible for Siri prediction.
   */
  isEligibleForPrediction: boolean;

  /**
   * When the activity occurred (Unix timestamp in milliseconds).
   */
  timestamp: number;
}

/**
 * Intent for Siri shortcuts.
 * Simplified representation of INIntent from iOS SDK.
 */
export interface SpotlightIntent {
  /**
   * Intent identifier.
   * Example: 'ViewPageIntent'
   */
  identifier: string;

  /**
   * Parameters for the intent.
   */
  parameters: {
    pageId?: PageId;
    pageTitle?: string;
    [key: string]: unknown;
  };
}

/**
 * Result of a Spotlight indexing operation.
 */
export interface SpotlightIndexResult {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * Number of items indexed.
   */
  itemCount: number;

  /**
   * Error message if operation failed.
   */
  error?: string;
}

/**
 * Options for batch indexing operations.
 */
export interface SpotlightBatchOptions {
  /**
   * Maximum number of items to index per batch.
   * iOS recommends batching to avoid memory pressure.
   * Default: 100
   */
  batchSize?: number;

  /**
   * Delay between batches in milliseconds.
   * Helps prevent system overload.
   * Default: 100
   */
  batchDelay?: number;

  /**
   * Whether to clear existing index before adding new items.
   * Default: false
   */
  clearExisting?: boolean;
}

/**
 * Search continuation data for handling Spotlight search results.
 */
export interface SpotlightSearchContinuation {
  /**
   * Unique identifier for the item that was selected.
   */
  itemIdentifier: SpotlightItemIdentifier;

  /**
   * Page ID to navigate to.
   */
  pageId: PageId;

  /**
   * Search query that led to this result.
   */
  searchQuery?: string;
}
