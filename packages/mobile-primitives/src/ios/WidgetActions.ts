/**
 * WidgetActions.ts - Actions triggered from iOS widgets
 *
 * Defines actions that can be triggered when users interact with widgets.
 * These actions are executed in the main app context when a widget is tapped.
 */

import type { PageId, BlockId } from '@double-bind/types';
import type { PageService, BlockService } from '@double-bind/core';

/**
 * Navigation interface for widget actions
 * Implemented by the app's navigation system
 */
export interface WidgetNavigator {
  /**
   * Navigate to a specific page
   */
  navigateToPage(pageId: PageId): void;

  /**
   * Navigate to a specific block within a page
   */
  navigateToBlock(pageId: PageId, blockId: BlockId): void;

  /**
   * Navigate to today's daily note
   */
  navigateToDailyNote(): void;

  /**
   * Open the quick capture interface
   */
  openQuickCapture(): void;
}

/**
 * Mock implementation of WidgetNavigator for testing
 */
export class MockWidgetNavigator implements WidgetNavigator {
  private navigationHistory: Array<{ action: string; params: unknown }> = [];

  navigateToPage(pageId: PageId): void {
    this.navigationHistory.push({ action: 'navigateToPage', params: { pageId } });
  }

  navigateToBlock(pageId: PageId, blockId: BlockId): void {
    this.navigationHistory.push({ action: 'navigateToBlock', params: { pageId, blockId } });
  }

  navigateToDailyNote(): void {
    this.navigationHistory.push({ action: 'navigateToDailyNote', params: {} });
  }

  openQuickCapture(): void {
    this.navigationHistory.push({ action: 'openQuickCapture', params: {} });
  }

  // Test utilities
  getHistory(): Array<{ action: string; params: unknown }> {
    return [...this.navigationHistory];
  }

  clearHistory(): void {
    this.navigationHistory = [];
  }
}

/**
 * Widget actions handler
 * Orchestrates actions triggered from iOS widgets
 */
export class WidgetActions {
  constructor(
    private readonly pageService: PageService,
    private readonly blockService: BlockService,
    private readonly navigator: WidgetNavigator
  ) {}

  /**
   * Open a specific note
   *
   * @param pageId - Page identifier
   *
   * @example
   * ```ts
   * const actions = new WidgetActions(pageService, blockService, navigator);
   * await actions.openNote('page-123');
   * // Navigates to the specified page
   * ```
   */
  async openNote(pageId: PageId): Promise<void> {
    // Verify page exists
    const page = await this.pageService.getById(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    // Navigate to page
    this.navigator.navigateToPage(pageId);
  }

  /**
   * Open today's daily note
   * Creates the daily note if it doesn't exist
   *
   * @example
   * ```ts
   * const actions = new WidgetActions(pageService, blockService, navigator);
   * await actions.openDailyNote();
   * // Navigates to today's daily note
   * ```
   */
  async openDailyNote(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Try to find existing daily note
    let dailyPage = await this.pageService.getByTitle(today);

    // If it doesn't exist, create it
    if (!dailyPage) {
      dailyPage = await this.pageService.create({
        title: today,
        createdAt: Date.now(),
      });
    }

    // Navigate to daily note
    this.navigator.navigateToPage(dailyPage.pageId);
  }

  /**
   * Create a quick note with content
   *
   * @param content - Note content
   * @param targetPageId - Optional target page (defaults to today's daily note)
   * @returns Created block ID
   *
   * @example
   * ```ts
   * const actions = new WidgetActions(pageService, blockService, navigator);
   * const blockId = await actions.createQuickNote('Meeting notes', 'page-123');
   * // Creates a new block in the specified page
   * ```
   */
  async createQuickNote(content: string, targetPageId?: PageId): Promise<BlockId> {
    let pageId = targetPageId;

    // If no target page specified, use today's daily note
    if (!pageId) {
      const today = new Date().toISOString().split('T')[0];
      let dailyPage = await this.pageService.getByTitle(today);

      if (!dailyPage) {
        dailyPage = await this.pageService.create({
          title: today,
          createdAt: Date.now(),
        });
      }

      pageId = dailyPage.pageId;
    }

    // Verify target page exists
    const page = await this.pageService.getById(pageId);
    if (!page) {
      throw new Error(`Target page not found: ${pageId}`);
    }

    // Create block with content
    const block = await this.blockService.create({
      pageId,
      content,
      parentId: null,
      createdAt: Date.now(),
    });

    // Navigate to the created block
    this.navigator.navigateToBlock(pageId, block.blockId);

    return block.blockId;
  }

  /**
   * Open the quick capture interface
   *
   * @example
   * ```ts
   * const actions = new WidgetActions(pageService, blockService, navigator);
   * actions.openQuickCaptureInterface();
   * // Opens the quick capture modal/screen
   * ```
   */
  openQuickCaptureInterface(): void {
    this.navigator.openQuickCapture();
  }
}
