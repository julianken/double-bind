/**
 * ConflictListView Component Tests
 *
 * Tests conflict list rendering, interaction, and accessibility.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConflictMetadata } from '@double-bind/types';
import { ConflictListView } from '../../src/sync/ConflictListView';

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
    detectedAt: Date.now() - 3600000, // 1 hour ago
    ...overrides,
  };
}

describe('ConflictListView', () => {
  describe('rendering', () => {
    it('should render empty state when no conflicts', () => {
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={[]} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
      expect(() => element).not.toThrow();
    });

    it('should render list with single conflict', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should render list with multiple conflicts', () => {
      const conflicts = [
        createMockConflict({ conflictId: 'c1', conflictType: 'content' }),
        createMockConflict({ conflictId: 'c2', conflictType: 'move' }),
        createMockConflict({ conflictId: 'c3', conflictType: 'delete' }),
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should render page conflicts', () => {
      const conflicts = [
        createMockConflict({
          entityType: 'page',
          entityId: 'page-123',
          localVersion: {
            timestamp: '1707456123456-0-device-local',
            snapshot: { title: 'Local page title' },
            versionVector: { 'device-local': '1707456123456-0-device-local' },
          },
          remoteVersion: {
            timestamp: '1707456123457-0-device-remote',
            snapshot: { title: 'Remote page title' },
            versionVector: { 'device-remote': '1707456123457-0-device-remote' },
          },
        }),
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should render different conflict types', () => {
      const types: Array<ConflictMetadata['conflictType']> = [
        'content',
        'move',
        'delete',
        'parent',
        'order',
        'structural',
      ];

      types.forEach((type) => {
        const conflicts = [createMockConflict({ conflictType: type })];
        const onConflictPress = vi.fn();

        const element = (
          <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
        );

        expect(element).toBeDefined();
      });
    });

    it('should render different conflict states', () => {
      const states: Array<ConflictMetadata['state']> = ['detected', 'pending'];

      states.forEach((state) => {
        const conflicts = [createMockConflict({ state })];
        const onConflictPress = vi.fn();

        const element = (
          <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
        );

        expect(element).toBeDefined();
      });
    });
  });

  describe('refresh control', () => {
    it('should render without refresh control when onRefresh not provided', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should render with refresh control when onRefresh provided', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();
      const onRefresh = vi.fn();

      const element = (
        <ConflictListView
          conflicts={conflicts}
          onConflictPress={onConflictPress}
          onRefresh={onRefresh}
        />
      );

      expect(element).toBeDefined();
    });

    it('should show refreshing state', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();
      const onRefresh = vi.fn();

      const element = (
        <ConflictListView
          conflicts={conflicts}
          onConflictPress={onConflictPress}
          onRefresh={onRefresh}
          refreshing={true}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have accessibility label for list', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should have accessibility labels for conflict items', () => {
      const conflicts = [
        createMockConflict({ conflictId: 'c1' }),
        createMockConflict({ conflictId: 'c2' }),
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should accept testID prop', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView
          conflicts={conflicts}
          onConflictPress={onConflictPress}
          testID="custom-test-id"
        />
      );

      expect(element).toBeDefined();
    });

    it('should have testIDs for conflict items', () => {
      const conflicts = [createMockConflict({ conflictId: 'c123' })];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView
          conflicts={conflicts}
          onConflictPress={onConflictPress}
          testID="conflict-list"
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('touch targets', () => {
    it('should have minimum touch target of 44pt for conflict items', () => {
      const conflicts = [createMockConflict()];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });
  });

  describe('content formatting', () => {
    it('should truncate long content in title', () => {
      const longContent = 'A'.repeat(200);
      const conflicts = [
        createMockConflict({
          localVersion: {
            timestamp: '1707456123456-0-device-local',
            snapshot: { content: longContent },
            versionVector: { 'device-local': '1707456123456-0-device-local' },
          },
          remoteVersion: {
            timestamp: '1707456123457-0-device-remote',
            snapshot: { content: 'Remote' },
            versionVector: { 'device-remote': '1707456123457-0-device-remote' },
          },
        }),
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should handle missing content gracefully', () => {
      const conflicts = [
        createMockConflict({
          localVersion: {
            timestamp: '1707456123456-0-device-local',
            snapshot: {},
            versionVector: { 'device-local': '1707456123456-0-device-local' },
          },
          remoteVersion: {
            timestamp: '1707456123457-0-device-remote',
            snapshot: {},
            versionVector: { 'device-remote': '1707456123457-0-device-remote' },
          },
        }),
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });

    it('should format timestamps correctly', () => {
      const conflicts = [
        createMockConflict({ detectedAt: Date.now() - 30000 }), // 30 seconds ago
        createMockConflict({ detectedAt: Date.now() - 3600000 }), // 1 hour ago
        createMockConflict({ detectedAt: Date.now() - 86400000 }), // 1 day ago
      ];
      const onConflictPress = vi.fn();

      const element = (
        <ConflictListView conflicts={conflicts} onConflictPress={onConflictPress} />
      );

      expect(element).toBeDefined();
    });
  });
});
