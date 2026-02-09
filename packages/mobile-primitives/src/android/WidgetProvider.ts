/**
 * WidgetProvider.ts - Data provider for Android widgets
 *
 * Provides methods to fetch data for Android home screen widgets.
 * Designed to be platform-agnostic and work with any storage backend.
 */

import type { PageId } from '@double-bind/types';
import type { PageService } from '@double-bind/core';
import type {
  AndroidRecentNotesData,
  AndroidQuickCaptureData,
  AndroidDailyNoteData,
  AndroidWidgetConfiguration,
} from './WidgetTypes';

/**
 * Android widget data provider
 * Fetches data for Android widgets from the Double-Bind core services
 */
export class AndroidWidgetProvider {
  constructor(private readonly pageService: PageService) {}

  /**
   * Get recent notes for widget display
   *
   * @param limit - Maximum number of notes to return (1-10)
   * @returns Recent notes data
   *
   * @example
   * ```ts
   * const provider = new AndroidWidgetProvider(pageService);
   * const data = await provider.getRecentNotes(5);
   * // data.notes contains [{pageId, title, preview, updatedAt}, ...]
   * ```
   */
  async getRecentNotes(limit: number = 5): Promise<AndroidRecentNotesData> {
    // Clamp limit to valid range
    const clampedLimit = Math.max(1, Math.min(10, limit));

    // Fetch recent pages from PageService
    const pages = await this.pageService.getAll({
      orderBy: 'updated',
      limit: clampedLimit,
    });

    // Transform to widget format
    const notes = pages.map((page) => ({
      pageId: page.pageId,
      title: page.title,
      preview: this.generatePreview(page.title),
      updatedAt: page.updatedAt,
    }));

    return {
      notes,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get today's daily note
   *
   * @returns Daily note data
   *
   * @example
   * ```ts
   * const provider = new AndroidWidgetProvider(pageService);
   * const data = await provider.getDailyNote();
   * // data.title is "2026-02-09"
   * ```
   */
  async getDailyNote(): Promise<AndroidDailyNoteData> {
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

    // Get page with blocks to count them
    const pageWithBlocks = await this.pageService.getById(dailyPage.pageId);

    return {
      pageId: dailyPage.pageId,
      title: dailyPage.title,
      date: today,
      blockCount: pageWithBlocks?.blocks.length ?? 0,
      preview: this.generateDailyNotePreview(pageWithBlocks?.blocks.length ?? 0),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get quick capture widget data
   *
   * @param defaultPageId - Optional default page to capture to
   * @returns Quick capture widget data
   *
   * @example
   * ```ts
   * const provider = new AndroidWidgetProvider(pageService);
   * const data = await provider.getQuickCaptureData();
   * // data.placeholder is "Quick capture..."
   * ```
   */
  async getQuickCaptureData(defaultPageId?: PageId | null): Promise<AndroidQuickCaptureData> {
    return {
      defaultPageId: defaultPageId ?? null,
      placeholder: 'Quick capture...',
      lastUpdated: Date.now(),
    };
  }

  /**
   * Update widget data based on configuration
   *
   * @param config - Widget configuration
   * @returns Widget data based on kind
   *
   * @example
   * ```ts
   * const provider = new AndroidWidgetProvider(pageService);
   * const config = {
   *   widgetId: 'widget-123',
   *   kind: AndroidWidgetKind.RecentNotes,
   *   size: AndroidWidgetSize.Medium,
   *   options: { maxNotes: 5 },
   *   lastUpdated: Date.now(),
   * };
   * const data = await provider.updateWidgetData(config);
   * ```
   */
  async updateWidgetData(
    config: AndroidWidgetConfiguration
  ): Promise<AndroidRecentNotesData | AndroidQuickCaptureData | AndroidDailyNoteData> {
    switch (config.kind) {
      case 'recentNotes':
        return this.getRecentNotes(config.options.maxNotes ?? 5);
      case 'quickCapture':
        return this.getQuickCaptureData(config.options.defaultPageId);
      case 'dailyNote':
        return this.getDailyNote();
      default:
        throw new Error(`Unknown widget kind: ${config.kind}`);
    }
  }

  /**
   * Generate preview text from page title
   * In a real implementation, this would fetch actual block content
   */
  private generatePreview(title: string): string {
    return `Recent: ${title}`;
  }

  /**
   * Generate preview text for daily note
   */
  private generateDailyNotePreview(blockCount: number): string {
    if (blockCount === 0) {
      return 'No blocks yet';
    } else if (blockCount === 1) {
      return '1 block';
    } else {
      return `${blockCount} blocks`;
    }
  }
}
