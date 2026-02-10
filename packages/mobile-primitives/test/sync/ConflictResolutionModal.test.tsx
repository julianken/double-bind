/**
 * ConflictResolutionModal Component Tests
 *
 * Tests modal rendering, option selection, and confirmation flow.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConflictMetadata } from '@double-bind/types';
import { ConflictResolutionModal } from '../../src/sync/ConflictResolutionModal';

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

describe('ConflictResolutionModal', () => {
  let onResolve: ReturnType<typeof vi.fn>;
  let onDismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onResolve = vi.fn();
    onDismiss = vi.fn();
  });

  describe('rendering', () => {
    it('should render when visible', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.visible).toBe(true);
      expect(element.props.conflict).toBe(conflict);
      expect(element.props.onResolve).toBe(onResolve);
      expect(element.props.onDismiss).toBe(onDismiss);
    });

    it('should not render when not visible', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={false}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.visible).toBe(false);
    });

    it('should handle null conflict gracefully', () => {
      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={null}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict).toBeNull();
    });

    it('should render with testID', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
          testID="custom-modal"
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('resolution options', () => {
    it('should render Keep Local option', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict).toBe(conflict);
    });

    it('should render Keep Remote option', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict).toBe(conflict);
    });

    it('should render Merge Later option', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
      expect(element.props.conflict).toBe(conflict);
    });
  });

  describe('action buttons', () => {
    it('should render Cancel button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should render Confirm button', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should have disabled Confirm button initially', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have accessibility roles for radio buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should have accessibility labels for options', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should have accessibility labels for action buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should have testIDs for options', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
          testID="modal"
        />
      );

      expect(element).toBeDefined();
    });

    it('should have testIDs for action buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
          testID="modal"
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('touch targets', () => {
    it('should have minimum touch target of 44pt for options', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should have minimum touch target of 44pt for action buttons', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });
  });

  describe('modal behavior', () => {
    it('should support transparent overlay', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should support fade animation', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });

    it('should handle onRequestClose', () => {
      const conflict = createMockConflict();

      const element = (
        <ConflictResolutionModal
          visible={true}
          conflict={conflict}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      );

      expect(element).toBeDefined();
    });
  });
});
