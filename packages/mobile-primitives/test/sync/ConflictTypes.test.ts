/**
 * ConflictTypes Utility Tests
 *
 * Tests utility functions for formatting conflict data for display.
 */

import { describe, it, expect } from 'vitest';
import type { ConflictMetadata } from '@double-bind/types';
import { formatConflictForList } from '../../src/sync/ConflictTypes';

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

describe('ConflictTypes utilities', () => {
  describe('formatConflictForList', () => {
    it('should format block conflict', () => {
      const conflict = createMockConflict({
        entityType: 'block',
        localVersion: {
          timestamp: '1707456123456-0-device-local',
          snapshot: { content: 'Test block content' },
          versionVector: { 'device-local': '1707456123456-0-device-local' },
        },
        remoteVersion: {
          timestamp: '1707456123457-0-device-remote',
          snapshot: { content: 'Remote content' },
          versionVector: { 'device-remote': '1707456123457-0-device-remote' },
        },
      });

      const result = formatConflictForList(conflict);

      expect(result.title).toContain('Block:');
      expect(result.title).toContain('Test block content');
      expect(result.conflict).toEqual(conflict);
    });

    it('should format page conflict', () => {
      const conflict = createMockConflict({
        entityType: 'page',
        entityId: 'page-123',
        localVersion: {
          timestamp: '1707456123456-0-device-local',
          snapshot: { title: 'Test Page' },
          versionVector: { 'device-local': '1707456123456-0-device-local' },
        },
        remoteVersion: {
          timestamp: '1707456123457-0-device-remote',
          snapshot: { title: 'Remote Page' },
          versionVector: { 'device-remote': '1707456123457-0-device-remote' },
        },
      });

      const result = formatConflictForList(conflict);

      expect(result.title).toContain('Page:');
      expect(result.title).toContain('Test Page');
    });

    it('should truncate long content in title', () => {
      const longContent = 'A'.repeat(100);
      const conflict = createMockConflict({
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
      });

      const result = formatConflictForList(conflict);

      expect(result.title.length).toBeLessThan(longContent.length);
      expect(result.title).toContain('...');
    });

    it('should handle missing content', () => {
      const conflict = createMockConflict({
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
      });

      const result = formatConflictForList(conflict);

      expect(result.title).toBeDefined();
      expect(result.title).toContain('Unknown');
    });

    it('should handle null snapshot', () => {
      const conflict = createMockConflict({
        localVersion: {
          timestamp: '1707456123456-0-device-local',
          snapshot: null,
          versionVector: { 'device-local': '1707456123456-0-device-local' },
        },
        remoteVersion: {
          timestamp: '1707456123457-0-device-remote',
          snapshot: null,
          versionVector: { 'device-remote': '1707456123457-0-device-remote' },
        },
      });

      const result = formatConflictForList(conflict);

      expect(result.title).toBeDefined();
      expect(result.title).toContain('Unknown');
    });

    it('should format subtitle with conflict type', () => {
      const conflict = createMockConflict({ conflictType: 'content' });

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toContain('Content Change');
    });

    it('should format subtitle with relative time', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 3600000 });

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toMatch(/\d+[hmd] ago/);
    });

    it('should select appropriate icon for content conflict', () => {
      const conflict = createMockConflict({ conflictType: 'content' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('edit');
    });

    it('should select appropriate icon for move conflict', () => {
      const conflict = createMockConflict({ conflictType: 'move' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('move');
    });

    it('should select appropriate icon for delete conflict', () => {
      const conflict = createMockConflict({ conflictType: 'delete' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('trash');
    });

    it('should select appropriate icon for parent conflict', () => {
      const conflict = createMockConflict({ conflictType: 'parent' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('folder');
    });

    it('should select appropriate icon for order conflict', () => {
      const conflict = createMockConflict({ conflictType: 'order' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('reorder');
    });

    it('should select appropriate icon for structural conflict', () => {
      const conflict = createMockConflict({ conflictType: 'structural' });

      const result = formatConflictForList(conflict);

      expect(result.icon).toBe('warning');
    });

    it('should handle recent timestamps', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 30000 }); // 30 seconds ago

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toContain('Just now');
    });

    it('should handle minute-old timestamps', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 120000 }); // 2 minutes ago

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toMatch(/\d+m ago/);
    });

    it('should handle hour-old timestamps', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 7200000 }); // 2 hours ago

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toMatch(/\d+h ago/);
    });

    it('should handle day-old timestamps', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 172800000 }); // 2 days ago

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toMatch(/\d+d ago/);
    });

    it('should handle week-old timestamps with date', () => {
      const conflict = createMockConflict({ detectedAt: Date.now() - 604800000 }); // 7 days ago

      const result = formatConflictForList(conflict);

      expect(result.subtitle).toBeDefined();
    });
  });
});
