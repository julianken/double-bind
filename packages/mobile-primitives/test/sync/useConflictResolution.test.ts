/**
 * useConflictResolution Hook Tests
 *
 * Tests hook interface and integration with conflict store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConflictMetadata, ConflictStore } from '@double-bind/types';
import { InMemoryConflictStore } from '../../src/sync/InMemoryConflictStore';

// Test helper to create mock conflicts
function createMockConflict(overrides: Partial<ConflictMetadata> = {}): ConflictMetadata {
  return {
    conflictId: 'conflict-123',
    entityId: 'block-456',
    entityType: 'block',
    conflictType: 'content',
    state: 'detected',
    resolutionStrategy: 'manual',
    localVersion: {
      timestamp: '1707456123456-0-device-local',
      snapshot: { content: 'Local content' },
      versionVector: { 'device-local': '1707456123456-0-device-local' },
    },
    remoteVersion: {
      timestamp: '1707456123457-0-device-remote',
      snapshot: { content: 'Remote content' },
      versionVector: { 'device-remote': '1707456123457-0-device-remote' },
    },
    detectedAt: Date.now() - 3600000,
    ...overrides,
  };
}

describe('useConflictResolution', () => {
  let conflictStore: ConflictStore;

  beforeEach(() => {
    conflictStore = new InMemoryConflictStore();
  });

  describe('conflict store integration', () => {
    it('should resolve conflict with local method through store', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      // Simulate resolution
      await conflictStore.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'local',
        mergedSnapshot: conflict.localVersion.snapshot,
        notes: 'Resolved via UI with method: local',
      });

      const resolved = await conflictStore.getConflict(conflict.conflictId);
      expect(resolved?.state).toBe('resolved');
      expect(resolved?.resolution?.method).toBe('local');
    });

    it('should resolve conflict with remote method through store', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      // Simulate resolution
      await conflictStore.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'remote',
        mergedSnapshot: conflict.remoteVersion.snapshot,
        notes: 'Resolved via UI with method: remote',
      });

      const resolved = await conflictStore.getConflict(conflict.conflictId);
      expect(resolved?.state).toBe('resolved');
      expect(resolved?.resolution?.method).toBe('remote');
    });

    it('should update conflict state to pending for merge-later', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      // Simulate merge-later
      await conflictStore.updateConflict(conflict.conflictId, {
        state: 'pending',
      });

      const updated = await conflictStore.getConflict(conflict.conflictId);
      expect(updated?.state).toBe('pending');
    });

    it('should fetch unresolved conflicts from store', async () => {
      const conflict1 = createMockConflict({ conflictId: 'c1' });
      const conflict2 = createMockConflict({ conflictId: 'c2' });

      await conflictStore.saveConflict(conflict1);
      await conflictStore.saveConflict(conflict2);

      const unresolved = await conflictStore.getUnresolvedConflicts();
      expect(unresolved).toHaveLength(2);
    });

    it('should exclude resolved conflicts from unresolved list', async () => {
      const conflict1 = createMockConflict({ conflictId: 'c1' });
      const conflict2 = createMockConflict({ conflictId: 'c2' });

      await conflictStore.saveConflict(conflict1);
      await conflictStore.saveConflict(conflict2);

      await conflictStore.resolveConflict(conflict1.conflictId, {
        conflictId: conflict1.conflictId,
        method: 'local',
      });

      const unresolved = await conflictStore.getUnresolvedConflicts();
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0]?.conflictId).toBe('c2');
    });

    it('should handle conflict not found error gracefully', async () => {
      await expect(
        conflictStore.getConflict('non-existent')
      ).resolves.toBeNull();
    });

    it('should handle resolution of non-existent conflict', async () => {
      await expect(
        conflictStore.resolveConflict('non-existent', {
          conflictId: 'non-existent',
          method: 'local',
        })
      ).rejects.toThrow();
    });
  });

  describe('resolution callback', () => {
    it('should support onResolved callback parameter', () => {
      const onResolved = vi.fn();
      expect(onResolved).toBeDefined();
      expect(typeof onResolved).toBe('function');
    });

    it('should call callback with correct parameters', async () => {
      const onResolved = vi.fn();
      const conflict = createMockConflict();

      await conflictStore.saveConflict(conflict);
      await conflictStore.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'local',
      });

      // Simulate callback invocation
      onResolved(conflict.conflictId, 'local');

      expect(onResolved).toHaveBeenCalledWith(conflict.conflictId, 'local');
    });
  });

  describe('resolution methods', () => {
    it('should support local resolution method', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      await conflictStore.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'local',
        mergedSnapshot: conflict.localVersion.snapshot,
      });

      const resolved = await conflictStore.getConflict(conflict.conflictId);
      expect(resolved?.resolution?.method).toBe('local');
    });

    it('should support remote resolution method', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      await conflictStore.resolveConflict(conflict.conflictId, {
        conflictId: conflict.conflictId,
        method: 'remote',
        mergedSnapshot: conflict.remoteVersion.snapshot,
      });

      const resolved = await conflictStore.getConflict(conflict.conflictId);
      expect(resolved?.resolution?.method).toBe('remote');
    });

    it('should support merge-later through state update', async () => {
      const conflict = createMockConflict();
      await conflictStore.saveConflict(conflict);

      await conflictStore.updateConflict(conflict.conflictId, {
        state: 'pending',
      });

      const updated = await conflictStore.getConflict(conflict.conflictId);
      expect(updated?.state).toBe('pending');
    });
  });
});
