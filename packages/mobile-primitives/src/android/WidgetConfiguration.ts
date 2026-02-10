/**
 * WidgetConfiguration.ts - Android widget configuration management
 *
 * Provides storage and management for Android widget configurations.
 * Stores user preferences, appearance settings, and widget state.
 */

import type { AndroidWidgetConfiguration } from './WidgetTypes';

/**
 * Storage interface for Android widget configurations
 */
export interface AndroidWidgetConfigStore {
  /**
   * Get configuration for a specific widget
   */
  getConfiguration(widgetId: string): Promise<AndroidWidgetConfiguration | null>;

  /**
   * Set configuration for a specific widget
   */
  setConfiguration(widgetId: string, config: AndroidWidgetConfiguration): Promise<void>;

  /**
   * Get all widget configurations
   */
  getAllConfigurations(): Promise<AndroidWidgetConfiguration[]>;

  /**
   * Delete configuration for a specific widget
   */
  deleteConfiguration(widgetId: string): Promise<void>;

  /**
   * Check if a widget configuration exists
   */
  hasConfiguration(widgetId: string): Promise<boolean>;

  /**
   * Update specific options for a widget without replacing entire config
   */
  updateOptions(
    widgetId: string,
    options: Partial<AndroidWidgetConfiguration['options']>
  ): Promise<void>;
}

/**
 * In-memory implementation of AndroidWidgetConfigStore
 * Useful for testing and development
 */
export class InMemoryAndroidWidgetConfigStore implements AndroidWidgetConfigStore {
  private configs = new Map<string, AndroidWidgetConfiguration>();

  async getConfiguration(widgetId: string): Promise<AndroidWidgetConfiguration | null> {
    return this.configs.get(widgetId) ?? null;
  }

  async setConfiguration(widgetId: string, config: AndroidWidgetConfiguration): Promise<void> {
    this.configs.set(widgetId, config);
  }

  async getAllConfigurations(): Promise<AndroidWidgetConfiguration[]> {
    return Array.from(this.configs.values());
  }

  async deleteConfiguration(widgetId: string): Promise<void> {
    this.configs.delete(widgetId);
  }

  async hasConfiguration(widgetId: string): Promise<boolean> {
    return this.configs.has(widgetId);
  }

  async updateOptions(
    widgetId: string,
    options: Partial<AndroidWidgetConfiguration['options']>
  ): Promise<void> {
    const config = this.configs.get(widgetId);
    if (!config) {
      throw new Error(`Widget configuration not found: ${widgetId}`);
    }

    const updatedConfig: AndroidWidgetConfiguration = {
      ...config,
      options: {
        ...config.options,
        ...options,
      },
      lastUpdated: Date.now(),
    };

    this.configs.set(widgetId, updatedConfig);
  }

  // Test utilities
  clear(): void {
    this.configs.clear();
  }

  size(): number {
    return this.configs.size;
  }
}

/**
 * Widget configuration manager
 * Provides high-level operations for managing widget configurations
 */
export class AndroidWidgetConfigManager {
  constructor(private readonly store: AndroidWidgetConfigStore) {}

  /**
   * Create a new widget configuration with default options
   *
   * @param widgetId - Widget identifier
   * @param kind - Widget kind
   * @param size - Widget size
   * @returns Created configuration
   *
   * @example
   * ```ts
   * const manager = new AndroidWidgetConfigManager(store);
   * const config = await manager.createConfiguration(
   *   'widget-123',
   *   AndroidWidgetKind.RecentNotes,
   *   AndroidWidgetSize.Medium
   * );
   * ```
   */
  async createConfiguration(
    widgetId: string,
    kind: AndroidWidgetConfiguration['kind'],
    size: AndroidWidgetConfiguration['size']
  ): Promise<AndroidWidgetConfiguration> {
    // Check if configuration already exists
    const existing = await this.store.getConfiguration(widgetId);
    if (existing) {
      throw new Error(`Widget configuration already exists: ${widgetId}`);
    }

    // Create default configuration based on widget kind
    const config: AndroidWidgetConfiguration = {
      widgetId,
      kind,
      size,
      options: this.getDefaultOptions(kind, size),
      lastUpdated: Date.now(),
    };

    await this.store.setConfiguration(widgetId, config);
    return config;
  }

  /**
   * Update widget configuration
   *
   * @param widgetId - Widget identifier
   * @param updates - Partial configuration updates
   * @returns Updated configuration
   *
   * @example
   * ```ts
   * const manager = new AndroidWidgetConfigManager(store);
   * const config = await manager.updateConfiguration('widget-123', {
   *   size: AndroidWidgetSize.Large,
   *   options: { maxNotes: 10 },
   * });
   * ```
   */
  async updateConfiguration(
    widgetId: string,
    updates: Partial<Omit<AndroidWidgetConfiguration, 'widgetId' | 'lastUpdated'>>
  ): Promise<AndroidWidgetConfiguration> {
    const existing = await this.store.getConfiguration(widgetId);
    if (!existing) {
      throw new Error(`Widget configuration not found: ${widgetId}`);
    }

    const updated: AndroidWidgetConfiguration = {
      ...existing,
      ...updates,
      widgetId, // Ensure widgetId is not changed
      options: {
        ...existing.options,
        ...updates.options,
      },
      lastUpdated: Date.now(),
    };

    await this.store.setConfiguration(widgetId, updated);
    return updated;
  }

  /**
   * Delete widget configuration
   *
   * @param widgetId - Widget identifier
   *
   * @example
   * ```ts
   * const manager = new AndroidWidgetConfigManager(store);
   * await manager.deleteConfiguration('widget-123');
   * ```
   */
  async deleteConfiguration(widgetId: string): Promise<void> {
    await this.store.deleteConfiguration(widgetId);
  }

  /**
   * Get all widget configurations
   *
   * @returns All configurations
   *
   * @example
   * ```ts
   * const manager = new AndroidWidgetConfigManager(store);
   * const configs = await manager.getAllConfigurations();
   * ```
   */
  async getAllConfigurations(): Promise<AndroidWidgetConfiguration[]> {
    return this.store.getAllConfigurations();
  }

  /**
   * Get widget configurations by kind
   *
   * @param kind - Widget kind
   * @returns Configurations of specified kind
   *
   * @example
   * ```ts
   * const manager = new AndroidWidgetConfigManager(store);
   * const recentNotesWidgets = await manager.getConfigurationsByKind(
   *   AndroidWidgetKind.RecentNotes
   * );
   * ```
   */
  async getConfigurationsByKind(
    kind: AndroidWidgetConfiguration['kind']
  ): Promise<AndroidWidgetConfiguration[]> {
    const all = await this.store.getAllConfigurations();
    return all.filter((config) => config.kind === kind);
  }

  /**
   * Get default options for a widget kind and size
   */
  private getDefaultOptions(
    kind: AndroidWidgetConfiguration['kind'],
    size: AndroidWidgetConfiguration['size']
  ): AndroidWidgetConfiguration['options'] {
    const baseOptions: AndroidWidgetConfiguration['options'] = {
      theme: 'auto' as const,
      backgroundOpacity: 90,
    };

    switch (kind) {
      case 'recentNotes':
        return {
          ...baseOptions,
          maxNotes: this.getMaxNotesForSize(size),
          showPreviews: size !== 'small',
        };
      case 'quickCapture':
        return {
          ...baseOptions,
          defaultPageId: null,
          placeholder: 'Quick capture...',
        };
      case 'dailyNote':
        return {
          ...baseOptions,
          showTasks: true,
          showLinkedPages: true,
        };
    }
  }

  /**
   * Get recommended note count for widget size
   */
  private getMaxNotesForSize(size: AndroidWidgetConfiguration['size']): number {
    switch (size) {
      case 'small':
        return 3;
      case 'medium':
        return 5;
      case 'large':
        return 10;
    }
  }
}
