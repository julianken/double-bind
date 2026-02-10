/**
 * Tests for Android WidgetConfiguration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryAndroidWidgetConfigStore,
  AndroidWidgetConfigManager,
} from '../../src/android/WidgetConfiguration';
import { AndroidWidgetKind, AndroidWidgetSize } from '../../src/android/WidgetTypes';

describe('InMemoryAndroidWidgetConfigStore', () => {
  let store: InMemoryAndroidWidgetConfigStore;

  beforeEach(() => {
    store = new InMemoryAndroidWidgetConfigStore();
  });

  it('should store and retrieve configuration', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: { maxNotes: 5 },
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    const retrieved = await store.getConfiguration('widget-1');

    expect(retrieved).toEqual(config);
  });

  it('should return null for non-existent configuration', async () => {
    const result = await store.getConfiguration('non-existent');
    expect(result).toBeNull();
  });

  it('should list all configurations', async () => {
    const config1 = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };
    const config2 = {
      widgetId: 'widget-2',
      kind: AndroidWidgetKind.DailyNote,
      size: AndroidWidgetSize.Small,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config1);
    await store.setConfiguration('widget-2', config2);

    const all = await store.getAllConfigurations();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(config1);
    expect(all).toContainEqual(config2);
  });

  it('should delete configuration', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    await store.deleteConfiguration('widget-1');

    const result = await store.getConfiguration('widget-1');
    expect(result).toBeNull();
  });

  it('should check if configuration exists', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);

    expect(await store.hasConfiguration('widget-1')).toBe(true);
    expect(await store.hasConfiguration('non-existent')).toBe(false);
  });

  it('should update options', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: {
        maxNotes: 5,
        showPreviews: true,
      },
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    await store.updateOptions('widget-1', {
      maxNotes: 10,
      theme: 'dark',
    });

    const updated = await store.getConfiguration('widget-1');
    expect(updated?.options.maxNotes).toBe(10);
    expect(updated?.options.showPreviews).toBe(true);
    expect(updated?.options.theme).toBe('dark');
  });

  it('should throw error when updating options for non-existent widget', async () => {
    await expect(store.updateOptions('non-existent', { maxNotes: 10 })).rejects.toThrow(
      'Widget configuration not found: non-existent'
    );
  });

  it('should clear all configurations', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: AndroidWidgetKind.RecentNotes,
      size: AndroidWidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    store.clear();

    expect(store.size()).toBe(0);
    expect(await store.getConfiguration('widget-1')).toBeNull();
  });
});

describe('AndroidWidgetConfigManager', () => {
  let manager: AndroidWidgetConfigManager;
  let store: InMemoryAndroidWidgetConfigStore;

  beforeEach(() => {
    store = new InMemoryAndroidWidgetConfigStore();
    manager = new AndroidWidgetConfigManager(store);
  });

  describe('createConfiguration', () => {
    it('should create RecentNotes configuration with defaults', async () => {
      const config = await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      expect(config.widgetId).toBe('widget-1');
      expect(config.kind).toBe(AndroidWidgetKind.RecentNotes);
      expect(config.size).toBe(AndroidWidgetSize.Medium);
      expect(config.options.maxNotes).toBe(5);
      expect(config.options.showPreviews).toBe(true);
      expect(config.options.theme).toBe('auto');
      expect(config.options.backgroundOpacity).toBe(90);
    });

    it('should create QuickCapture configuration with defaults', async () => {
      const config = await manager.createConfiguration(
        'widget-2',
        AndroidWidgetKind.QuickCapture,
        AndroidWidgetSize.Small
      );

      expect(config.options.defaultPageId).toBeNull();
      expect(config.options.placeholder).toBe('Quick capture...');
    });

    it('should create DailyNote configuration with defaults', async () => {
      const config = await manager.createConfiguration(
        'widget-3',
        AndroidWidgetKind.DailyNote,
        AndroidWidgetSize.Large
      );

      expect(config.options.showTasks).toBe(true);
      expect(config.options.showLinkedPages).toBe(true);
    });

    it('should set maxNotes based on size for small widgets', async () => {
      const config = await manager.createConfiguration(
        'widget-4',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Small
      );

      expect(config.options.maxNotes).toBe(3);
      expect(config.options.showPreviews).toBe(false);
    });

    it('should set maxNotes based on size for large widgets', async () => {
      const config = await manager.createConfiguration(
        'widget-5',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Large
      );

      expect(config.options.maxNotes).toBe(10);
      expect(config.options.showPreviews).toBe(true);
    });

    it('should throw error if configuration already exists', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      await expect(
        manager.createConfiguration(
          'widget-1',
          AndroidWidgetKind.DailyNote,
          AndroidWidgetSize.Small
        )
      ).rejects.toThrow('Widget configuration already exists: widget-1');
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      const updated = await manager.updateConfiguration('widget-1', {
        size: AndroidWidgetSize.Large,
        options: { maxNotes: 10 },
      });

      expect(updated.size).toBe(AndroidWidgetSize.Large);
      expect(updated.options.maxNotes).toBe(10);
      expect(updated.widgetId).toBe('widget-1');
    });

    it('should merge options when updating', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      const updated = await manager.updateConfiguration('widget-1', {
        options: { accentColor: '#FF5722' },
      });

      expect(updated.options.maxNotes).toBe(5); // Original value preserved
      expect(updated.options.accentColor).toBe('#FF5722');
    });

    it('should update lastUpdated timestamp', async () => {
      const original = await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await manager.updateConfiguration('widget-1', {
        options: { maxNotes: 8 },
      });

      expect(updated.lastUpdated).toBeGreaterThan(original.lastUpdated);
    });

    it('should throw error for non-existent widget', async () => {
      await expect(
        manager.updateConfiguration('non-existent', {
          size: AndroidWidgetSize.Large,
        })
      ).rejects.toThrow('Widget configuration not found: non-existent');
    });
  });

  describe('deleteConfiguration', () => {
    it('should delete configuration', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      await manager.deleteConfiguration('widget-1');

      const configs = await manager.getAllConfigurations();
      expect(configs).toHaveLength(0);
    });
  });

  describe('getAllConfigurations', () => {
    it('should return empty array when no configurations exist', async () => {
      const configs = await manager.getAllConfigurations();
      expect(configs).toEqual([]);
    });

    it('should return all configurations', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );
      await manager.createConfiguration(
        'widget-2',
        AndroidWidgetKind.DailyNote,
        AndroidWidgetSize.Small
      );

      const configs = await manager.getAllConfigurations();
      expect(configs).toHaveLength(2);
    });
  });

  describe('getConfigurationsByKind', () => {
    it('should filter configurations by kind', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );
      await manager.createConfiguration(
        'widget-2',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Large
      );
      await manager.createConfiguration(
        'widget-3',
        AndroidWidgetKind.DailyNote,
        AndroidWidgetSize.Small
      );

      const recentNotesConfigs = await manager.getConfigurationsByKind(
        AndroidWidgetKind.RecentNotes
      );
      expect(recentNotesConfigs).toHaveLength(2);

      const dailyNoteConfigs = await manager.getConfigurationsByKind(AndroidWidgetKind.DailyNote);
      expect(dailyNoteConfigs).toHaveLength(1);
    });

    it('should return empty array when no configurations match', async () => {
      await manager.createConfiguration(
        'widget-1',
        AndroidWidgetKind.RecentNotes,
        AndroidWidgetSize.Medium
      );

      const quickCaptureConfigs = await manager.getConfigurationsByKind(
        AndroidWidgetKind.QuickCapture
      );
      expect(quickCaptureConfigs).toEqual([]);
    });
  });
});
