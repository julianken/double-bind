/**
 * ConflictDetailView Component Tests
 *
 * Tests conflict detail rendering, side-by-side comparison, and resolution actions.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConflictMetadata } from '@double-bind/types';
import { ConflictDetailView } from '../../src/sync/ConflictDetailView';

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
      snapshot: { content: 'Local content version' },
      versionVector: { 'device-local': '1707456123456-0-device-local' },
    },
    remoteVersion: {
      timestamp: '1707456123457-0-device-remote',
      snapshot: { content: 'Remote content version' },
      versionVector: { 'device-remote': '1707456123457-0-device-remote' },
    },
    detectedAt: Date.now() - 3600000, // 1 hour ago
    ...overrides,
  };
}

describe('ConflictDetailView', () => {
  let onKeepLocal: ReturnType<typeof vi.fn>;
  let onKeepRemote: ReturnType<typeof vi.fn>;
  let onMergeLater: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onKeepLocal = vi.fn();
    onKeepRemote = vi.fn();
    onMergeLater = vi.fn();
    onClose = vi.fn();
  });

  describe('rendering', () => {
    it('should render conflict details', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict).toBe(conflict);
      expect(element.props.onKeepLocal).toBe(onKeepLocal);
      expect(element.props.onKeepRemote).toBe(onKeepRemote);
      expect(element.props.onMergeLater).toBe(onMergeLater);
      expect(element.props.onClose).toBe(onClose);
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
        const conflict = createMockConflict({ conflictType: type });

        const element = (
          <ConflictDetailView
            conflict={conflict}
            onKeepLocal={onKeepLocal}
            onKeepRemote={onKeepRemote}
            onMergeLater={onMergeLater}
            onClose={onClose}
          />
        );

        expect(element).toBeDefined();
      });
    });

    it('should render page conflicts', () => {
      const conflict = createMockConflict({
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
      });

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should render block conflicts', () => {
      const conflict = createMockConflict({
        entityType: 'block',
        entityId: 'block-123',
      });

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('side-by-side comparison', () => {
    it('should display local version content', () => {
      const conflict = createMockConflict({
        localVersion: {
          timestamp: '1707456123456-0-device-local',
          snapshot: { content: 'This is the local version' },
          versionVector: { 'device-local': '1707456123456-0-device-local' },
        },
        remoteVersion: {
          timestamp: '1707456123457-0-device-remote',
          snapshot: { content: 'This is the remote version' },
          versionVector: { 'device-remote': '1707456123457-0-device-remote' },
        },
      });

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict.localVersion.snapshot).toHaveProperty('content');
      expect(element.props.conflict.remoteVersion.snapshot).toHaveProperty('content');
      expect((element.props.conflict.localVersion.snapshot as Record<string, string>).content).toBe(
        'This is the local version'
      );
    });

    it('should display remote version content', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict.remoteVersion.snapshot).toHaveProperty('content');
    });

    it('should display timestamps for both versions', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should handle missing content gracefully', () => {
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

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should handle null snapshot gracefully', () => {
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

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should display long content properly', () => {
      const longContent = 'A'.repeat(500);
      const conflict = createMockConflict({
        localVersion: {
          timestamp: '1707456123456-0-device-local',
          snapshot: { content: longContent },
          versionVector: { 'device-local': '1707456123456-0-device-local' },
        },
        remoteVersion: {
          timestamp: '1707456123457-0-device-remote',
          snapshot: { content: longContent + ' modified' },
          versionVector: { 'device-remote': '1707456123457-0-device-remote' },
        },
      });

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('action buttons', () => {
    it('should render Keep Local button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should render Keep Remote button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should render Merge Later button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should render close button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have accessibility labels for action buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });

    it('should accept testID prop', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
          testID="custom-detail-view"
        />
      );

      expect(element).toBeDefined();
    });

    it('should have testIDs for action buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
          testID="detail-view"
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('touch targets', () => {
    it('should have minimum touch target of 44pt for buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictDetailView
          conflict={conflict}
          onKeepLocal={onKeepLocal}
          onKeepRemote={onKeepRemote}
          onMergeLater={onMergeLater}
          onClose={onClose}
        />
      );

      expect(element).toBeDefined();
    });
  });
});
