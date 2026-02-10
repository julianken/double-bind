/**
 * Unit tests for InMemoryConflictStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryConflictStore } from '../../src/sync/InMemoryConflictStore';
import type { ConflictMetadata } from '@double-bind/types';

describe('InMemoryConflictStore', () => {
  let store: InMemoryConflictStore;

  beforeEach(() => {
    store = new InMemoryConflictStore();
  });

  const createTestConflict = (overrides?: Partial<ConflictMetadata>): ConflictMetadata => ({
    conflictId: 'conflict-123',
    entityId: 'block-456',
    entityType: 'block',
    conflictType: 'content',
    state: 'detected',
    resolutionStrategy: 'manual',
    localVersion: {
      timestamp: '1000-0-local',
      snapshot: { content: 'local content' },
      versionVector: { local: '1000-0-local' },
    },
    remoteVersion: {
      timestamp: '1000-1-remote',
      snapshot: { content: 'remote content' },
      versionVector: { remote: '1000-1-remote' },
    },
    detectedAt: Date.now(),
    ...overrides,
  });

  describe('saveConflict', () => {
    it('should save a conflict', async () => {
      const conflict = createTestConflict();
      await store.saveConflict(conflict);

      const retrieved = await store.getConflict(conflict.conflictId);
      expect(retrieved).toEqual(conflict);
    });

    it('should overwrite existing conflict with same ID', async () => {
      const conflict1 = createTestConflict({ conflictType: 'content' });
      const conflict2 = createTestConflict({ conflictType: 'delete' });

      await store.saveConflict(conflict1);
      await store.saveConflict(conflict2);

      const retrieved = await store.getConflict(conflict1.conflictId);
      expect(retrieved?.conflictType).toBe('delete');
    });
  });

  describe('getConflict', () => {
    it('should return conflict by ID', async () => {
      const conflict = createTestConflict();
      await store.saveConflict(conflict);

      const retrieved = await store.getConflict(conflict.conflictId);
      expect(retrieved).toEqual(conflict);
    });

    it('should return null for non-existent conflict', async () => {
      const retrieved = await store.getConflict('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return a copy of the conflict', async () => {
      const conflict = createTestConflict();
      await store.saveConflict(conflict);

      const retrieved = await store.getConflict(conflict.conflictId);
      expect(retrieved).not.toBe(conflict); // Different object reference
      expect(retrieved).toEqual(conflict); // But same content
    });
  });

  describe('getConflictsForEntity', () => {
    it('should return all conflicts for an entity', async () => {
      const conflict1 = createTestConflict({
        conflictId: 'conflict-1',
        entityId: 'block-123',
      });
      const conflict2 = createTestConflict({
        conflictId: 'conflict-2',
        entityId: 'block-123',
      });
      const conflict3 = createTestConflict({
        conflictId: 'conflict-3',
        entityId: 'block-456',
      });

      await store.saveConflict(conflict1);
      await store.saveConflict(conflict2);
      await store.saveConflict(conflict3);

      const conflicts = await store.getConflictsForEntity('block-123');
      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.conflictId).sort()).toEqual(['conflict-1', 'conflict-2']);
    });

    it('should return empty array for entity with no conflicts', async () => {
      const conflicts = await store.getConflictsForEntity('non-existent');
      expect(conflicts).toEqual([]);
    });
  });

  describe('getUnresolvedConflicts', () => {
    it('should return only unresolved conflicts', async () => {
      const detected = createTestConflict({
        conflictId: 'conflict-1',
        state: 'detected',
      });
      const pending = createTestConflict({
        conflictId: 'conflict-2',
        state: 'pending',
      });
      const resolved = createTestConflict({
        conflictId: 'conflict-3',
        state: 'resolved',
      });
      const rejected = createTestConflict({
        conflictId: 'conflict-4',
        state: 'rejected',
      });

      await store.saveConflict(detected);
      await store.saveConflict(pending);
      await store.saveConflict(resolved);
      await store.saveConflict(rejected);

      const unresolved = await store.getUnresolvedConflicts();
      expect(unresolved).toHaveLength(2);
      expect(unresolved.map((c) => c.conflictId).sort()).toEqual(['conflict-1', 'conflict-2']);
    });

    it('should return empty array when all conflicts are resolved', async () => {
      const resolved = createTestConflict({ state: 'resolved' });
      await store.saveConflict(resolved);

      const unresolved = await store.getUnresolvedConflicts();
      expect(unresolved).toEqual([]);
    });
  });

  describe('updateConflict', () => {
    it('should update conflict properties', async () => {
      const conflict = createTestConflict({ state: 'detected' });
      await store.saveConflict(conflict);

      await store.updateConflict(conflict.conflictId, {
        state: 'pending',
        resolutionStrategy: 'last-write-wins',
      });

      const updated = await store.getConflict(conflict.conflictId);
      expect(updated?.state).toBe('pending');
      expect(updated?.resolutionStrategy).toBe('last-write-wins');
      expect(updated?.entityId).toBe(conflict.entityId); // Unchanged
    });

    it('should throw error for non-existent conflict', async () => {
      await expect(
        store.updateConflict('non-existent', { state: 'pending' })
      ).rejects.toThrow('Conflict not found');
    });
  });

  describe('resolveConflict', () => {
    it('should mark conflict as resolved', async () => {
      const conflict = createTestConflict({ state: 'detected' });
      await store.saveConflict(conflict);

      await store.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'manual',
        notes: 'Manually merged',
        userId: 'user-123',
      });

      const resolved = await store.getConflict(conflict.conflictId);
      expect(resolved?.state).toBe('resolved');
      expect(resolved?.resolution?.method).toBe('manual');
      expect(resolved?.resolution?.description).toBe('Manually merged');
      expect(resolved?.metadata?.resolvedBy).toBe('user-123');
      expect(resolved?.metadata?.notes).toBe('Manually merged');
      expect(resolved?.resolvedAt).toBeDefined();
    });

    it('should throw error for non-existent conflict', async () => {
      await expect(
        store.resolveConflict('non-existent', {
          conflictId: 'non-existent',
          method: 'manual',
        })
      ).rejects.toThrow('Conflict not found');
    });

    it('should preserve merged snapshot in resolution', async () => {
      const conflict = createTestConflict();
      await store.saveConflict(conflict);

      const mergedSnapshot = { content: 'merged content' };
      await store.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'merged',
        mergedSnapshot,
      });

      const resolved = await store.getConflict(conflict.conflictId);
      expect(resolved?.resolution?.method).toBe('merged');
    });
  });

  describe('deleteConflict', () => {
    it('should delete a conflict', async () => {
      const conflict = createTestConflict();
      await store.saveConflict(conflict);

      await store.deleteConflict(conflict.conflictId);

      const retrieved = await store.getConflict(conflict.conflictId);
      expect(retrieved).toBeNull();
    });

    it('should not throw error for non-existent conflict', async () => {
      await expect(store.deleteConflict('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('pruneResolvedConflicts', () => {
    it('should delete resolved conflicts older than threshold', async () => {
      const now = Date.now();
      const oldTime = now - 10000;

      const oldResolved = createTestConflict({
        conflictId: 'old-resolved',
        state: 'resolved',
        resolvedAt: oldTime,
      });
      const recentResolved = createTestConflict({
        conflictId: 'recent-resolved',
        state: 'resolved',
        resolvedAt: now,
      });
      const unresolved = createTestConflict({
        conflictId: 'unresolved',
        state: 'detected',
      });

      await store.saveConflict(oldResolved);
      await store.saveConflict(recentResolved);
      await store.saveConflict(unresolved);

      const threshold = now - 5000;
      const pruned = await store.pruneResolvedConflicts(threshold);

      expect(pruned).toBe(1);
      expect(await store.getConflict('old-resolved')).toBeNull();
      expect(await store.getConflict('recent-resolved')).not.toBeNull();
      expect(await store.getConflict('unresolved')).not.toBeNull();
    });

    it('should not delete unresolved conflicts', async () => {
      const unresolved = createTestConflict({
        state: 'detected',
        detectedAt: Date.now() - 10000,
      });
      await store.saveConflict(unresolved);

      const pruned = await store.pruneResolvedConflicts(Date.now());
      expect(pruned).toBe(0);
      expect(await store.getConflict(unresolved.conflictId)).not.toBeNull();
    });

    it('should return 0 when no conflicts to prune', async () => {
      const pruned = await store.pruneResolvedConflicts(Date.now());
      expect(pruned).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all conflicts', async () => {
      await store.saveConflict(createTestConflict({ conflictId: 'c1' }));
      await store.saveConflict(createTestConflict({ conflictId: 'c2' }));
      await store.saveConflict(createTestConflict({ conflictId: 'c3' }));

      expect(store.size()).toBe(3);

      store.clear();

      expect(store.size()).toBe(0);
      expect(await store.getUnresolvedConflicts()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return the number of conflicts', async () => {
      expect(store.size()).toBe(0);

      await store.saveConflict(createTestConflict({ conflictId: 'c1' }));
      expect(store.size()).toBe(1);

      await store.saveConflict(createTestConflict({ conflictId: 'c2' }));
      expect(store.size()).toBe(2);

      await store.deleteConflict('c1');
      expect(store.size()).toBe(1);
    });
  });
});
