/**
 * Tests for SiriActivityService and IntentHandlerRegistry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page } from '@double-bind/types';
import {
  SiriActivityService,
  MockSiriActivityBridge,
  IntentHandlerRegistry,
} from '../../src/ios/SiriActivity.js';

describe('MockSiriActivityBridge', () => {
  let bridge: MockSiriActivityBridge;

  beforeEach(() => {
    bridge = new MockSiriActivityBridge();
  });

  it('should start with no activities', () => {
    expect(bridge.getActivities()).toHaveLength(0);
  });

  it('should donate activity', async () => {
    await bridge.donateActivity({
      activityType: 'com.doublebind.viewPage',
      title: 'View Page',
      userInfo: { pageId: 'test-id' },
      isEligibleForSearch: true,
      isEligibleForHandoff: true,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    expect(bridge.getActivities()).toHaveLength(1);
  });

  it('should accumulate multiple activities', async () => {
    await bridge.donateActivity({
      activityType: 'com.doublebind.viewPage',
      title: 'Activity 1',
      userInfo: {},
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    await bridge.donateActivity({
      activityType: 'com.doublebind.createPage',
      title: 'Activity 2',
      userInfo: {},
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    expect(bridge.getActivities()).toHaveLength(2);
  });

  it('should register intents', async () => {
    const intents = [
      { identifier: 'ViewPageIntent', parameters: {} },
      { identifier: 'CreatePageIntent', parameters: {} },
    ];

    await bridge.registerIntents(intents);

    expect(bridge.getIntents()).toEqual(intents);
  });

  it('should replace intents on re-registration', async () => {
    await bridge.registerIntents([{ identifier: 'Intent1', parameters: {} }]);
    await bridge.registerIntents([{ identifier: 'Intent2', parameters: {} }]);

    expect(bridge.getIntents()).toHaveLength(1);
    expect(bridge.getIntents()[0].identifier).toBe('Intent2');
  });

  it('should handle intents', async () => {
    const result = await bridge.handleIntent({
      identifier: 'ViewPageIntent',
      parameters: { pageId: 'test-id' },
    });

    expect(result).toEqual({ pageId: 'test-id' });
  });

  it('should delete all activities', async () => {
    await bridge.donateActivity({
      activityType: 'com.doublebind.viewPage',
      title: 'Activity',
      userInfo: {},
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    await bridge.deleteAllActivities();
    expect(bridge.getActivities()).toHaveLength(0);
  });

  it('should delete activities by type', async () => {
    await bridge.donateActivity({
      activityType: 'com.doublebind.viewPage',
      title: 'View',
      userInfo: {},
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    await bridge.donateActivity({
      activityType: 'com.doublebind.createPage',
      title: 'Create',
      userInfo: {},
      isEligibleForSearch: true,
      isEligibleForHandoff: false,
      isEligibleForPrediction: true,
      timestamp: Date.now(),
    });

    await bridge.deleteActivitiesWithType('com.doublebind.viewPage');

    expect(bridge.getActivities()).toHaveLength(1);
    expect(bridge.getActivities()[0].activityType).toBe('com.doublebind.createPage');
  });

  it('should report as available by default', async () => {
    expect(await bridge.isAvailable()).toBe(true);
  });

  it('should allow setting availability', async () => {
    bridge.setAvailable(false);
    expect(await bridge.isAvailable()).toBe(false);

    bridge.setAvailable(true);
    expect(await bridge.isAvailable()).toBe(true);
  });

  it('should track activity count', () => {
    expect(bridge.getActivityCount()).toBe(0);
  });
});

describe('SiriActivityService', () => {
  let service: SiriActivityService;
  let bridge: MockSiriActivityBridge;

  beforeEach(() => {
    bridge = new MockSiriActivityBridge();
    service = new SiriActivityService(bridge);
  });

  const createTestPage = (overrides: Partial<Page> = {}): Page => ({
    pageId: 'test-page-id',
    title: 'Test Page',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
    dailyNoteDate: null,
    ...overrides,
  });

  describe('isAvailable', () => {
    it('should report availability from bridge', async () => {
      expect(await service.isAvailable()).toBe(true);
    });
  });

  describe('donateViewPageActivity', () => {
    it('should donate view page activity', async () => {
      const page = createTestPage({ title: 'My Note' });
      await service.donateViewPageActivity(page);

      const activities = bridge.getActivities();
      expect(activities).toHaveLength(1);

      const activity = activities[0];
      expect(activity.activityType).toBe('com.doublebind.viewPage');
      expect(activity.title).toBe('View My Note');
      expect(activity.userInfo.pageId).toBe(page.pageId);
      expect(activity.userInfo.pageTitle).toBe(page.title);
      expect(activity.keywords).toContain(page.title);
      expect(activity.isEligibleForSearch).toBe(true);
      expect(activity.isEligibleForHandoff).toBe(true);
      expect(activity.isEligibleForPrediction).toBe(true);
    });

    it('should include timestamp', async () => {
      const before = Date.now();
      await service.donateViewPageActivity(createTestPage());
      const after = Date.now();

      const activity = bridge.getActivities()[0];
      expect(activity.timestamp).toBeGreaterThanOrEqual(before);
      expect(activity.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('donateCreatePageActivity', () => {
    it('should donate create page activity', async () => {
      await service.donateCreatePageActivity();

      const activities = bridge.getActivities();
      expect(activities).toHaveLength(1);

      const activity = activities[0];
      expect(activity.activityType).toBe('com.doublebind.createPage');
      expect(activity.title).toBe('Create New Page');
      expect(activity.keywords).toContain('create');
      expect(activity.keywords).toContain('new');
      expect(activity.isEligibleForSearch).toBe(true);
      expect(activity.isEligibleForHandoff).toBe(false);
      expect(activity.isEligibleForPrediction).toBe(true);
    });
  });

  describe('donateSearchActivity', () => {
    it('should donate search activity without query', async () => {
      await service.donateSearchActivity();

      const activities = bridge.getActivities();
      expect(activities).toHaveLength(1);

      const activity = activities[0];
      expect(activity.activityType).toBe('com.doublebind.searchPages');
      expect(activity.title).toBe('Search Pages');
      expect(activity.keywords).toContain('search');
      expect(activity.isEligibleForSearch).toBe(true);
    });

    it('should donate search activity with query', async () => {
      await service.donateSearchActivity('project notes');

      const activity = bridge.getActivities()[0];
      expect(activity.title).toBe('Search for "project notes"');
      expect(activity.userInfo.query).toBe('project notes');
    });
  });

  describe('donateActivity', () => {
    it('should donate custom activity', async () => {
      const customActivity = {
        activityType: 'com.doublebind.viewPage' as const,
        title: 'Custom Activity',
        userInfo: { custom: 'data' },
        keywords: ['custom'],
        isEligibleForSearch: true,
        isEligibleForHandoff: false,
        isEligibleForPrediction: false,
        timestamp: Date.now(),
      };

      await service.donateActivity(customActivity);

      const activities = bridge.getActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0]).toEqual(customActivity);
    });
  });

  describe('registerIntents', () => {
    it('should register all standard intents', async () => {
      await service.registerIntents();

      const intents = bridge.getIntents();
      expect(intents).toHaveLength(3);

      const identifiers = intents.map((i) => i.identifier);
      expect(identifiers).toContain('ViewPageIntent');
      expect(identifiers).toContain('CreatePageIntent');
      expect(identifiers).toContain('SearchPagesIntent');
    });

    it('should include correct parameters for ViewPageIntent', async () => {
      await service.registerIntents();

      const viewIntent = bridge.getIntents().find((i) => i.identifier === 'ViewPageIntent');

      expect(viewIntent?.parameters).toHaveProperty('pageId');
      expect(viewIntent?.parameters).toHaveProperty('pageTitle');
    });

    it('should include correct parameters for SearchPagesIntent', async () => {
      await service.registerIntents();

      const searchIntent = bridge.getIntents().find((i) => i.identifier === 'SearchPagesIntent');

      expect(searchIntent?.parameters).toHaveProperty('query');
    });
  });

  describe('handleIntent', () => {
    it('should handle intent through bridge', async () => {
      const intent = {
        identifier: 'ViewPageIntent',
        parameters: { pageId: 'test-id' },
      };

      const result = await service.handleIntent(intent);

      expect(result).toEqual(intent.parameters);
    });
  });

  describe('deleteAllActivities', () => {
    it('should delete all activities', async () => {
      await service.donateViewPageActivity(createTestPage());
      await service.donateCreatePageActivity();

      expect(bridge.getActivities()).toHaveLength(2);

      await service.deleteAllActivities();

      expect(bridge.getActivities()).toHaveLength(0);
    });
  });

  describe('deleteActivitiesWithType', () => {
    it('should delete activities of specific type', async () => {
      await service.donateViewPageActivity(createTestPage());
      await service.donateCreatePageActivity();

      expect(bridge.getActivities()).toHaveLength(2);

      await service.deleteActivitiesWithType('com.doublebind.viewPage');

      expect(bridge.getActivities()).toHaveLength(1);
      expect(bridge.getActivities()[0].activityType).toBe('com.doublebind.createPage');
    });
  });
});

describe('IntentHandlerRegistry', () => {
  let registry: IntentHandlerRegistry;

  beforeEach(() => {
    registry = new IntentHandlerRegistry();
  });

  describe('register', () => {
    it('should register a handler', () => {
      const handler = vi.fn();
      registry.register('ViewPageIntent', handler);

      expect(registry.hasHandler('ViewPageIntent')).toBe(true);
    });

    it('should replace existing handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register('ViewPageIntent', handler1);
      registry.register('ViewPageIntent', handler2);

      expect(registry.hasHandler('ViewPageIntent')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should unregister a handler', () => {
      const handler = vi.fn();
      registry.register('ViewPageIntent', handler);

      registry.unregister('ViewPageIntent');

      expect(registry.hasHandler('ViewPageIntent')).toBe(false);
    });

    it('should handle unregistering non-existent handler', () => {
      expect(() => registry.unregister('NonExistent')).not.toThrow();
    });
  });

  describe('handle', () => {
    it('should invoke registered handler', async () => {
      const handler = vi.fn();
      registry.register('ViewPageIntent', handler);

      const intent = {
        identifier: 'ViewPageIntent',
        parameters: { pageId: 'test-id' },
      };

      await registry.handle(intent);

      expect(handler).toHaveBeenCalledWith(intent);
    });

    it('should throw error for unregistered intent', async () => {
      const intent = {
        identifier: 'UnregisteredIntent',
        parameters: {},
      };

      await expect(registry.handle(intent)).rejects.toThrow(
        'No handler registered for intent: UnregisteredIntent'
      );
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      registry.register('AsyncIntent', handler);

      const intent = {
        identifier: 'AsyncIntent',
        parameters: {},
      };

      await registry.handle(intent);

      expect(handler).toHaveBeenCalled();
    });

    it('should handle sync handlers', async () => {
      const handler = vi.fn();
      registry.register('SyncIntent', handler);

      const intent = {
        identifier: 'SyncIntent',
        parameters: {},
      };

      await registry.handle(intent);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      registry.register('ViewPageIntent', vi.fn());

      expect(registry.hasHandler('ViewPageIntent')).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(registry.hasHandler('UnregisteredIntent')).toBe(false);
    });
  });

  describe('getRegisteredIntents', () => {
    it('should return empty array when no intents registered', () => {
      expect(registry.getRegisteredIntents()).toEqual([]);
    });

    it('should return all registered intent identifiers', () => {
      registry.register('ViewPageIntent', vi.fn());
      registry.register('CreatePageIntent', vi.fn());
      registry.register('SearchPagesIntent', vi.fn());

      const intents = registry.getRegisteredIntents();

      expect(intents).toHaveLength(3);
      expect(intents).toContain('ViewPageIntent');
      expect(intents).toContain('CreatePageIntent');
      expect(intents).toContain('SearchPagesIntent');
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple intent types', async () => {
      const viewHandler = vi.fn();
      const createHandler = vi.fn();

      registry.register('ViewPageIntent', viewHandler);
      registry.register('CreatePageIntent', createHandler);

      await registry.handle({
        identifier: 'ViewPageIntent',
        parameters: { pageId: 'test-1' },
      });

      await registry.handle({
        identifier: 'CreatePageIntent',
        parameters: {},
      });

      expect(viewHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle intent with complex parameters', async () => {
      const handler = vi.fn();
      registry.register('ComplexIntent', handler);

      const intent = {
        identifier: 'ComplexIntent',
        parameters: {
          pageId: 'test-id',
          title: 'Test Page',
          nested: {
            value: 42,
            flag: true,
          },
        },
      };

      await registry.handle(intent);

      expect(handler).toHaveBeenCalledWith(intent);
    });
  });
});
