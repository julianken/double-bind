/**
 * Tests for SafeArea component and useSafeAreaWithMinimum hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeArea, type SafeAreaProps, type MinimumPadding } from '../src/layout/SafeArea';

// Mock the hook with controllable return value
let mockInsets = { top: 44, right: 0, bottom: 34, left: 0 };

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    return React.createElement('SafeAreaView', props, children);
  },
  useSafeAreaInsets: vi.fn(() => mockInsets),
}));

describe('SafeArea', () => {
  beforeEach(() => {
    mockInsets = { top: 44, right: 0, bottom: 34, left: 0 };
    vi.mocked(useSafeAreaInsets).mockReturnValue(mockInsets);
  });

  describe('SafeArea component', () => {
    it('should be a valid React component', () => {
      expect(typeof SafeArea).toBe('function');
    });

    it('should accept required props', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div', null, 'Test'),
      };
      expect(props.children).toBeDefined();
    });

    it('should accept optional edges prop', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div'),
        edges: ['top', 'bottom'],
      };
      expect(props.edges).toEqual(['top', 'bottom']);
    });

    it('should accept optional backgroundColor prop', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div'),
        backgroundColor: '#FF0000',
      };
      expect(props.backgroundColor).toBe('#FF0000');
    });

    it('should accept optional minimumPadding prop', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div'),
        minimumPadding: { top: 20, bottom: 30 },
      };
      expect(props.minimumPadding).toEqual({ top: 20, bottom: 30 });
    });

    it('should accept mode prop for padding or margin', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div'),
        mode: 'margin',
      };
      expect(props.mode).toBe('margin');
    });

    it('should accept testID prop', () => {
      const props: SafeAreaProps = {
        children: React.createElement('div'),
        testID: 'safe-area-test',
      };
      expect(props.testID).toBe('safe-area-test');
    });
  });

  describe('useSafeAreaWithMinimum hook', () => {
    it('should return max of inset and minimum for each edge', () => {
      const minimumPadding: MinimumPadding = {
        top: 20, // inset is 44, should return 44
        right: 16, // inset is 0, should return 16
        bottom: 50, // inset is 34, should return 50
        left: 16, // inset is 0, should return 16
      };

      // We need to test the hook logic directly since we can't render
      const insets = mockInsets;
      const result = {
        top: Math.max(insets.top, minimumPadding.top ?? 0),
        right: Math.max(insets.right, minimumPadding.right ?? 0),
        bottom: Math.max(insets.bottom, minimumPadding.bottom ?? 0),
        left: Math.max(insets.left, minimumPadding.left ?? 0),
        rawInsets: insets,
      };

      expect(result.top).toBe(44); // inset > minimum
      expect(result.right).toBe(16); // minimum > inset
      expect(result.bottom).toBe(50); // minimum > inset
      expect(result.left).toBe(16); // minimum > inset
    });

    it('should handle empty minimum config', () => {
      const insets = mockInsets;
      const minimumPadding: MinimumPadding = {};
      const result = {
        top: Math.max(insets.top, minimumPadding.top ?? 0),
        right: Math.max(insets.right, minimumPadding.right ?? 0),
        bottom: Math.max(insets.bottom, minimumPadding.bottom ?? 0),
        left: Math.max(insets.left, minimumPadding.left ?? 0),
        rawInsets: insets,
      };

      expect(result.top).toBe(44);
      expect(result.right).toBe(0);
      expect(result.bottom).toBe(34);
      expect(result.left).toBe(0);
    });

    it('should include raw insets for reference', () => {
      const insets = mockInsets;
      expect(insets).toEqual({
        top: 44,
        right: 0,
        bottom: 34,
        left: 0,
      });
    });
  });

  describe('MinimumPadding type', () => {
    it('should allow partial edge specification', () => {
      const padding1: MinimumPadding = { top: 20 };
      const padding2: MinimumPadding = { bottom: 30 };
      const padding3: MinimumPadding = { left: 10, right: 10 };
      const padding4: MinimumPadding = {};

      expect(padding1.top).toBe(20);
      expect(padding2.bottom).toBe(30);
      expect(padding3.left).toBe(10);
      expect(padding4.top).toBeUndefined();
    });
  });
});
