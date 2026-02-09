/**
 * Siri suggestions integration via NSUserActivity.
 *
 * Provides services for donating user activities to Siri, registering
 * shortcuts, and handling Siri intents. Activities donated to Siri appear
 * in Spotlight, Siri suggestions, and the Shortcuts app.
 */

import type { Page } from '@double-bind/types';
import type {
  SpotlightActivity,
  SpotlightActivityType,
  SpotlightIntent,
} from './SpotlightTypes.js';

/**
 * Native bridge interface for Siri activity operations.
 * Implemented by platform-specific code (e.g., React Native module).
 */
export interface SiriActivityBridge {
  /**
   * Donate a user activity to Siri.
   * Activity will appear in Siri suggestions and Spotlight.
   */
  donateActivity(activity: SpotlightActivity): Promise<void>;

  /**
   * Register available Siri intents/shortcuts.
   * Should be called on app launch.
   */
  registerIntents(intents: SpotlightIntent[]): Promise<void>;

  /**
   * Handle an intent triggered by Siri or Shortcuts.
   * Returns continuation data for app to process.
   */
  handleIntent(intent: SpotlightIntent): Promise<unknown>;

  /**
   * Delete all donated activities.
   * Useful for cleanup or privacy reasons.
   */
  deleteAllActivities(): Promise<void>;

  /**
   * Delete activities with a specific activity type.
   */
  deleteActivitiesWithType(activityType: SpotlightActivityType): Promise<void>;

  /**
   * Check if Siri suggestions are available.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Mock implementation of SiriActivityBridge for testing.
 */
export class MockSiriActivityBridge implements SiriActivityBridge {
  private activities: SpotlightActivity[] = [];
  private intents: SpotlightIntent[] = [];
  private available = true;

  async donateActivity(activity: SpotlightActivity): Promise<void> {
    this.activities.push(activity);
  }

  async registerIntents(intents: SpotlightIntent[]): Promise<void> {
    this.intents = intents;
  }

  async handleIntent(intent: SpotlightIntent): Promise<unknown> {
    return intent.parameters;
  }

  async deleteAllActivities(): Promise<void> {
    this.activities = [];
  }

  async deleteActivitiesWithType(activityType: SpotlightActivityType): Promise<void> {
    this.activities = this.activities.filter((a) => a.activityType !== activityType);
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  // Test helpers
  getActivities(): SpotlightActivity[] {
    return this.activities;
  }

  getIntents(): SpotlightIntent[] {
    return this.intents;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  getActivityCount(): number {
    return this.activities.length;
  }
}

/**
 * Service for managing Siri suggestions via NSUserActivity.
 *
 * @example
 * ```ts
 * const siri = new SiriActivityService(bridge);
 * await siri.donateViewPageActivity(page);
 * ```
 */
export class SiriActivityService {
  private bridge: SiriActivityBridge;

  constructor(bridge: SiriActivityBridge) {
    this.bridge = bridge;
  }

  /**
   * Check if Siri suggestions are available.
   */
  async isAvailable(): Promise<boolean> {
    return this.bridge.isAvailable();
  }

  /**
   * Donate a "view page" activity to Siri.
   * This helps Siri suggest recently viewed pages.
   *
   * @param page - Page that was viewed
   * @returns Promise that resolves when activity is donated
   *
   * @example
   * ```ts
   * // When user opens a page
   * await siri.donateViewPageActivity(currentPage);
   * ```
   */
  async donateViewPageActivity(page: Page): Promise<void> {
    const activity: SpotlightActivity = {
      activityType: 'com.doublebind.viewPage',
      title: `View ${page.title}`,
      userInfo: {
        pageId: page.pageId,
        pageTitle: page.title,
      },
      keywords: [page.title, 'note', 'page', 'view'],
      isEligibleForSearch: true,
      isEligibleForHandoff: true,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    };

    await this.bridge.donateActivity(activity);
  }

  /**
   * Donate a "create page" activity to Siri.
   * This helps Siri suggest creating new pages.
   *
   * @returns Promise that resolves when activity is donated
   *
   * @example
   * ```ts
   * // When user creates a new page
   * await siri.donateCreatePageActivity();
   * ```
   */
  async donateCreatePageActivity(): Promise<void> {
    const activity: SpotlightActivity = {
      activityType: 'com.doublebind.createPage',
      title: 'Create New Page',
      userInfo: {},
      keywords: ['create', 'new', 'note', 'page'],
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    };

    await this.bridge.donateActivity(activity);
  }

  /**
   * Donate a "search pages" activity to Siri.
   * This helps Siri suggest the search feature.
   *
   * @param query - Optional search query that was performed
   * @returns Promise that resolves when activity is donated
   *
   * @example
   * ```ts
   * // When user performs a search
   * await siri.donateSearchActivity('project notes');
   * ```
   */
  async donateSearchActivity(query?: string): Promise<void> {
    const activity: SpotlightActivity = {
      activityType: 'com.doublebind.searchPages',
      title: query ? `Search for "${query}"` : 'Search Pages',
      userInfo: {
        ...(query && { query }),
      },
      keywords: ['search', 'find', 'notes', 'pages'],
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    };

    await this.bridge.donateActivity(activity);
  }

  /**
   * Donate a custom activity to Siri.
   *
   * @param activity - Custom activity to donate
   * @returns Promise that resolves when activity is donated
   *
   * @example
   * ```ts
   * await siri.donateActivity({
   *   activityType: 'com.doublebind.customAction',
   *   title: 'Custom Action',
   *   userInfo: { customData: 'value' },
   *   isEligibleForSearch: true,
   *   isEligibleForHandoff: false,
   *   isEligibleForPrediction: true,
   *   timestamp: Date.now(),
   * });
   * ```
   */
  async donateActivity(activity: SpotlightActivity): Promise<void> {
    await this.bridge.donateActivity(activity);
  }

  /**
   * Register available Siri intents.
   * Should be called once during app initialization.
   *
   * @returns Promise that resolves when intents are registered
   *
   * @example
   * ```ts
   * // On app launch
   * await siri.registerIntents();
   * ```
   */
  async registerIntents(): Promise<void> {
    const intents: SpotlightIntent[] = [
      {
        identifier: 'ViewPageIntent',
        parameters: {
          pageId: '',
          pageTitle: '',
        },
      },
      {
        identifier: 'CreatePageIntent',
        parameters: {},
      },
      {
        identifier: 'SearchPagesIntent',
        parameters: {
          query: '',
        },
      },
    ];

    await this.bridge.registerIntents(intents);
  }

  /**
   * Handle a Siri intent.
   * Called when user activates a Siri shortcut.
   *
   * @param intent - Intent to handle
   * @returns Promise that resolves with intent result
   *
   * @example
   * ```ts
   * const result = await siri.handleIntent({
   *   identifier: 'ViewPageIntent',
   *   parameters: { pageId: '01HQVZ8Y9P3X2K1N0M4F6JWQR' },
   * });
   * ```
   */
  async handleIntent(intent: SpotlightIntent): Promise<unknown> {
    return this.bridge.handleIntent(intent);
  }

  /**
   * Delete all donated activities.
   * Useful for privacy or cleanup purposes.
   *
   * @returns Promise that resolves when activities are deleted
   *
   * @example
   * ```ts
   * // Clear all Siri suggestions
   * await siri.deleteAllActivities();
   * ```
   */
  async deleteAllActivities(): Promise<void> {
    await this.bridge.deleteAllActivities();
  }

  /**
   * Delete activities of a specific type.
   *
   * @param activityType - Type of activities to delete
   * @returns Promise that resolves when activities are deleted
   *
   * @example
   * ```ts
   * // Clear only "view page" activities
   * await siri.deleteActivitiesWithType('com.doublebind.viewPage');
   * ```
   */
  async deleteActivitiesWithType(activityType: SpotlightActivityType): Promise<void> {
    await this.bridge.deleteActivitiesWithType(activityType);
  }
}

/**
 * Handler function for processing Siri intents.
 */
export type IntentHandler = (intent: SpotlightIntent) => Promise<void> | void;

/**
 * Intent handler registry for managing Siri shortcuts.
 *
 * @example
 * ```ts
 * const registry = new IntentHandlerRegistry();
 * registry.register('ViewPageIntent', async (intent) => {
 *   const { pageId } = intent.parameters;
 *   navigation.navigate('Page', { pageId });
 * });
 * await registry.handle({ identifier: 'ViewPageIntent', parameters: { pageId: '...' } });
 * ```
 */
export class IntentHandlerRegistry {
  private handlers = new Map<string, IntentHandler>();

  /**
   * Register a handler for a specific intent type.
   *
   * @param identifier - Intent identifier
   * @param handler - Handler function
   */
  register(identifier: string, handler: IntentHandler): void {
    this.handlers.set(identifier, handler);
  }

  /**
   * Unregister a handler for a specific intent type.
   *
   * @param identifier - Intent identifier
   */
  unregister(identifier: string): void {
    this.handlers.delete(identifier);
  }

  /**
   * Handle an intent by invoking the registered handler.
   *
   * @param intent - Intent to handle
   * @throws Error if no handler is registered for the intent
   */
  async handle(intent: SpotlightIntent): Promise<void> {
    const handler = this.handlers.get(intent.identifier);
    if (!handler) {
      throw new Error(`No handler registered for intent: ${intent.identifier}`);
    }

    await handler(intent);
  }

  /**
   * Check if a handler is registered for an intent type.
   *
   * @param identifier - Intent identifier
   * @returns Whether a handler is registered
   */
  hasHandler(identifier: string): boolean {
    return this.handlers.has(identifier);
  }

  /**
   * Get all registered intent identifiers.
   *
   * @returns Array of registered intent identifiers
   */
  getRegisteredIntents(): string[] {
    return Array.from(this.handlers.keys());
  }
}
