/**
 * WidgetDataProvider.ts - Data provider for iOS widgets
 *
 * Provides methods to fetch data for iOS home screen widgets.
 * Designed to be platform-agnostic and work with any storage backend.
 */

import type { PageId } from '@double-bind/types';
import type { PageService } from '@double-bind/core';
import type {
  RecentNotesData,
  QuickCaptureData,
  DailyNoteData,
  WidgetConfiguration,
} from './WidgetTypes';

/**
 * Storage interface for widget configurations
 */
export interface WidgetConfigStore {
  getConfiguration(widgetId: string): Promise<WidgetConfiguration | null>;
  setConfiguration(widgetId: string, config: WidgetConfiguration): Promise<void>;
  getAllConfigurations(): Promise<WidgetConfiguration[]>;
  deleteConfiguration(widgetId: string): Promise<void>;
}

/**
 * In-memory implementation of WidgetConfigStore (for testing)
 */
export class InMemoryWidgetConfigStore implements WidgetConfigStore {
  private configs = new Map<string, WidgetConfiguration>();

  async getConfiguration(widgetId: string): Promise<WidgetConfiguration | null> {
    return this.configs.get(widgetId) ?? null;
  }

  async setConfiguration(widgetId: string, config: WidgetConfiguration): Promise<void> {
    this.configs.set(widgetId, config);
  }

  async getAllConfigurations(): Promise<WidgetConfiguration[]> {
    return Array.from(this.configs.values());
  }

  async deleteConfiguration(widgetId: string): Promise<void> {
    this.configs.delete(widgetId);
  }
}

/**
 * Widget data provider
 * Fetches data for iOS widgets from the Double-Bind core services
 */
export class WidgetDataProvider {
  constructor(
    private readonly pageService: PageService,
    private readonly configStore: WidgetConfigStore
  ) {}

  /**
   * Get recent notes for widget display
   *
   * @param limit - Maximum number of notes to return (1-10)
   * @returns Recent notes data
   *
   * @example
   * ```ts
   * const provider = new WidgetDataProvider(pageService, configStore);
   * const data = await provider.getRecentNotes(5);
   * // data.notes contains [{pageId, title, preview, updatedAt}, ...]
   * ```
   */
  async getRecentNotes(limit: number = 5): Promise<RecentNotesData> {
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
   * const provider = new WidgetDataProvider(pageService, configStore);
   * const data = await provider.getDailyNote();
   * // data.title is "2026-02-09"
   * ```
   */
  async getDailyNote(): Promise<DailyNoteData> {
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
   * Get widget configuration
   *
   * @param widgetId - Widget identifier
   * @returns Widget configuration or null if not found
   *
   * @example
   * ```ts
   * const provider = new WidgetDataProvider(pageService, configStore);
   * const config = await provider.getWidgetConfiguration('widget-123');
   * // config?.kind is WidgetKind.RecentNotes
   * ```
   */
  async getWidgetConfiguration(widgetId: string): Promise<WidgetConfiguration | null> {
    return this.configStore.getConfiguration(widgetId);
  }

  /**
   * Get quick capture widget data
   *
   * @param defaultPageId - Optional default page to capture to
   * @returns Quick capture widget data
   *
   * @example
   * ```ts
   * const provider = new WidgetDataProvider(pageService, configStore);
   * const data = await provider.getQuickCaptureData();
   * // data.placeholder is "Quick capture..."
   * ```
   */
  async getQuickCaptureData(defaultPageId?: PageId | null): Promise<QuickCaptureData> {
    return {
      defaultPageId: defaultPageId ?? null,
      placeholder: 'Quick capture...',
      lastUpdated: Date.now(),
    };
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
