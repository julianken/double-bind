/**
 * DirectShare Tests
 *
 * Tests for Android Direct Share targets functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DirectShareService,
  setDirectShareBridge,
  createTargetsFromNotes,
  createTargetsFromPages,
  MockDirectShareBridge,
} from '../../src/android/DirectShare';

describe('DirectShare', () => {
  let mockBridge: MockDirectShareBridge;
  let service: DirectShareService;

  beforeEach(() => {
    mockBridge = new MockDirectShareBridge();
    setDirectShareBridge(mockBridge);
    service = new DirectShareService();
  });

  describe('DirectShareService', () => {
    it('should initialize with default config', () => {
      const service = new DirectShareService();
      expect(service).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const service = new DirectShareService({
        maxTargets: 3,
        includeRecentNotes: false,
      });
      expect(service).toBeDefined();
    });

    it('should update recent notes', async () => {
      const notes = [
        { id: '1', title: 'Note 1', type: 'note' as const },
        { id: '2', title: 'Note 2', type: 'note' as const },
      ];

      await service.updateRecentNotes(notes);

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe('1');
      expect(targets[0].title).toBe('Note 1');
      expect(targets[0].type).toBe('note');
    });

    it('should limit targets to maxTargets', async () => {
      const service = new DirectShareService({ maxTargets: 3 });

      const notes = [
        { id: '1', title: 'Note 1', type: 'note' as const },
        { id: '2', title: 'Note 2', type: 'note' as const },
        { id: '3', title: 'Note 3', type: 'note' as const },
        { id: '4', title: 'Note 4', type: 'note' as const },
        { id: '5', title: 'Note 5', type: 'note' as const },
      ];

      await service.updateRecentNotes(notes);

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(3);
    });

    it('should update favorite pages', async () => {
      const pages = [
        { id: 'p1', title: 'Page 1' },
        { id: 'p2', title: 'Page 2' },
      ];

      await service.updateFavoritePages(pages);

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(2);
      expect(targets[0].type).toBe('page');
      expect(targets[0].subtitle).toBe('Favorite');
    });

    it('should update targets', async () => {
      const targets = [
        {
          id: '1',
          title: 'Target 1',
          type: 'note' as const,
        },
      ];

      await service.updateTargets(targets);

      const storedTargets = await mockBridge.getTargets();
      expect(storedTargets).toHaveLength(1);
      expect(storedTargets[0].id).toBe('1');
    });

    it('should clear targets', async () => {
      const notes = [{ id: '1', title: 'Note', type: 'note' as const }];
      await service.updateRecentNotes(notes);

      let targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(1);

      await service.clearTargets();

      targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(0);
    });

    it('should get targets', async () => {
      const notes = [
        { id: '1', title: 'Note 1', type: 'note' as const },
        { id: '2', title: 'Note 2', type: 'note' as const },
      ];

      await service.updateRecentNotes(notes);

      const targets = await service.getTargets();
      expect(targets).toHaveLength(2);
    });

    it('should add a single target', async () => {
      await service.addTarget({
        id: '1',
        title: 'New Target',
        type: 'note',
      });

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(1);
      expect(targets[0].title).toBe('New Target');
    });

    it('should update existing target', async () => {
      await service.addTarget({
        id: '1',
        title: 'Original',
        type: 'note',
      });

      await service.addTarget({
        id: '1',
        title: 'Updated',
        type: 'note',
      });

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(1);
      expect(targets[0].title).toBe('Updated');
    });

    it('should remove target by ID', async () => {
      await service.addTarget({
        id: '1',
        title: 'Target 1',
        type: 'note',
      });

      await service.addTarget({
        id: '2',
        title: 'Target 2',
        type: 'note',
      });

      await service.removeTarget('1');

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('2');
    });

    it('should not update recent notes if disabled', async () => {
      const service = new DirectShareService({ includeRecentNotes: false });

      const notes = [{ id: '1', title: 'Note', type: 'note' as const }];
      await service.updateRecentNotes(notes);

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(0);
    });

    it('should not update favorite pages if disabled', async () => {
      const service = new DirectShareService({ includeFavoritePages: false });

      const pages = [{ id: '1', title: 'Page' }];
      await service.updateFavoritePages(pages);

      const targets = await mockBridge.getTargets();
      expect(targets).toHaveLength(0);
    });

    it('should set rank for targets', async () => {
      const notes = [
        { id: '1', title: 'Note 1', type: 'note' as const },
        { id: '2', title: 'Note 2', type: 'note' as const },
      ];

      await service.updateRecentNotes(notes);

      const targets = await mockBridge.getTargets();
      expect(targets[0].rank).toBe(0);
      expect(targets[1].rank).toBe(1);
    });

    it('should throw error if bridge not available', async () => {
      setDirectShareBridge(null as unknown as MockDirectShareBridge);
      const service = new DirectShareService();

      await expect(service.updateTargets([])).rejects.toThrow('Direct share bridge not available');
    });
  });

  describe('createTargetsFromNotes', () => {
    it('should create targets from notes', () => {
      const notes = [
        { id: '1', title: 'Note 1' },
        { id: '2', title: 'Note 2' },
      ];

      const targets = createTargetsFromNotes(notes);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe('1');
      expect(targets[0].title).toBe('Note 1');
      expect(targets[0].type).toBe('note');
      expect(targets[0].subtitle).toBe('Note');
    });

    it('should set rank for notes', () => {
      const notes = [
        { id: '1', title: 'Note 1' },
        { id: '2', title: 'Note 2' },
      ];

      const targets = createTargetsFromNotes(notes);

      expect(targets[0].rank).toBe(0);
      expect(targets[1].rank).toBe(1);
    });

    it('should handle empty array', () => {
      const targets = createTargetsFromNotes([]);
      expect(targets).toEqual([]);
    });
  });

  describe('createTargetsFromPages', () => {
    it('should create targets from pages', () => {
      const pages = [
        { id: 'p1', title: 'Page 1' },
        { id: 'p2', title: 'Page 2' },
      ];

      const targets = createTargetsFromPages(pages);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe('p1');
      expect(targets[0].title).toBe('Page 1');
      expect(targets[0].type).toBe('page');
      expect(targets[0].subtitle).toBe('Page');
    });

    it('should set rank for pages', () => {
      const pages = [
        { id: 'p1', title: 'Page 1' },
        { id: 'p2', title: 'Page 2' },
      ];

      const targets = createTargetsFromPages(pages);

      expect(targets[0].rank).toBe(0);
      expect(targets[1].rank).toBe(1);
    });

    it('should handle empty array', () => {
      const targets = createTargetsFromPages([]);
      expect(targets).toEqual([]);
    });
  });

  describe('MockDirectShareBridge', () => {
    it('should store and retrieve targets', async () => {
      const bridge = new MockDirectShareBridge();

      const targets = [{ id: '1', title: 'Target', type: 'note' as const }];

      await bridge.updateTargets(targets);

      const retrieved = await bridge.getTargets();
      expect(retrieved).toEqual(targets);
    });

    it('should clear targets', async () => {
      const bridge = new MockDirectShareBridge();

      await bridge.updateTargets([{ id: '1', title: 'Target', type: 'note' as const }]);

      await bridge.clearTargets();

      const targets = await bridge.getTargets();
      expect(targets).toEqual([]);
    });

    it('should return a copy of targets', async () => {
      const bridge = new MockDirectShareBridge();

      const targets = [{ id: '1', title: 'Target', type: 'note' as const }];

      await bridge.updateTargets(targets);

      const retrieved1 = await bridge.getTargets();
      const retrieved2 = await bridge.getTargets();

      expect(retrieved1).not.toBe(retrieved2);
      expect(retrieved1).toEqual(retrieved2);
    });
  });
});
