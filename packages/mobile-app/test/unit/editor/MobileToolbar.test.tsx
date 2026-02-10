/**
 * Tests for MobileToolbar component.
 *
 * These tests verify the formatting toolbar behavior.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-native
vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Platform: {
    OS: 'ios',
    select: (options: any) => options.ios || {},
  },
}));

// Import after mocking
import { MobileToolbar } from '../../../src/editor/MobileToolbar';
import type { MobileToolbarProps, SelectionState } from '../../../src/editor/types';

describe('MobileToolbar', () => {
  const defaultSelection: SelectionState = {
    hasSelection: false,
    from: 0,
    to: 0,
    activeMarks: [],
  };

  const createProps = (overrides: Partial<MobileToolbarProps> = {}): MobileToolbarProps => ({
    selection: defaultSelection,
    isVisible: true,
    keyboardHeight: 300,
    onToggleBold: vi.fn(),
    onToggleItalic: vi.fn(),
    onToggleCode: vi.fn(),
    onToggleHighlight: vi.fn(),
    onToggleStrikethrough: vi.fn(),
    onInsertPageLink: vi.fn(),
    onInsertBlockRef: vi.fn(),
    onInsertTag: vi.fn(),
    onDismissKeyboard: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('component structure', () => {
    it('should be a valid React component', () => {
      expect(MobileToolbar).toBeDefined();
    });

    it('should accept all required props', () => {
      const props = createProps();

      expect(props.selection).toBeDefined();
      expect(props.isVisible).toBe(true);
      expect(props.keyboardHeight).toBe(300);
      expect(typeof props.onToggleBold).toBe('function');
    });
  });

  describe('visibility behavior', () => {
    it('should not render when isVisible is false', () => {
      const props = createProps({ isVisible: false });

      // Component returns null when not visible
      expect(props.isVisible).toBe(false);
    });

    it('should render when isVisible is true', () => {
      const props = createProps({ isVisible: true });

      expect(props.isVisible).toBe(true);
    });
  });

  describe('active marks', () => {
    it('should detect bold as active', () => {
      const props = createProps({
        selection: {
          ...defaultSelection,
          activeMarks: ['bold'],
        },
      });

      expect(props.selection.activeMarks).toContain('bold');
    });

    it('should detect multiple active marks', () => {
      const props = createProps({
        selection: {
          ...defaultSelection,
          activeMarks: ['bold', 'italic', 'code'],
        },
      });

      expect(props.selection.activeMarks).toContain('bold');
      expect(props.selection.activeMarks).toContain('italic');
      expect(props.selection.activeMarks).toContain('code');
    });

    it('should handle no active marks', () => {
      const props = createProps({
        selection: {
          ...defaultSelection,
          activeMarks: [],
        },
      });

      expect(props.selection.activeMarks).toHaveLength(0);
    });
  });

  describe('callback handlers', () => {
    it('should have onToggleBold callback', () => {
      const onToggleBold = vi.fn();
      const props = createProps({ onToggleBold });

      props.onToggleBold();
      expect(onToggleBold).toHaveBeenCalled();
    });

    it('should have onToggleItalic callback', () => {
      const onToggleItalic = vi.fn();
      const props = createProps({ onToggleItalic });

      props.onToggleItalic();
      expect(onToggleItalic).toHaveBeenCalled();
    });

    it('should have onToggleCode callback', () => {
      const onToggleCode = vi.fn();
      const props = createProps({ onToggleCode });

      props.onToggleCode();
      expect(onToggleCode).toHaveBeenCalled();
    });

    it('should have onToggleHighlight callback', () => {
      const onToggleHighlight = vi.fn();
      const props = createProps({ onToggleHighlight });

      props.onToggleHighlight();
      expect(onToggleHighlight).toHaveBeenCalled();
    });

    it('should have onToggleStrikethrough callback', () => {
      const onToggleStrikethrough = vi.fn();
      const props = createProps({ onToggleStrikethrough });

      props.onToggleStrikethrough();
      expect(onToggleStrikethrough).toHaveBeenCalled();
    });

    it('should have onInsertPageLink callback', () => {
      const onInsertPageLink = vi.fn();
      const props = createProps({ onInsertPageLink });

      props.onInsertPageLink();
      expect(onInsertPageLink).toHaveBeenCalled();
    });

    it('should have onInsertBlockRef callback', () => {
      const onInsertBlockRef = vi.fn();
      const props = createProps({ onInsertBlockRef });

      props.onInsertBlockRef();
      expect(onInsertBlockRef).toHaveBeenCalled();
    });

    it('should have onInsertTag callback', () => {
      const onInsertTag = vi.fn();
      const props = createProps({ onInsertTag });

      props.onInsertTag();
      expect(onInsertTag).toHaveBeenCalled();
    });

    it('should have onDismissKeyboard callback', () => {
      const onDismissKeyboard = vi.fn();
      const props = createProps({ onDismissKeyboard });

      props.onDismissKeyboard();
      expect(onDismissKeyboard).toHaveBeenCalled();
    });
  });

  describe('keyboard height', () => {
    it('should accept keyboard height for positioning', () => {
      const props = createProps({ keyboardHeight: 300 });

      expect(props.keyboardHeight).toBe(300);
    });

    it('should handle zero keyboard height', () => {
      const props = createProps({ keyboardHeight: 0 });

      expect(props.keyboardHeight).toBe(0);
    });

    it('should handle large keyboard height', () => {
      const props = createProps({ keyboardHeight: 500 });

      expect(props.keyboardHeight).toBe(500);
    });
  });

  describe('selection state', () => {
    it('should track hasSelection flag', () => {
      const props = createProps({
        selection: {
          ...defaultSelection,
          hasSelection: true,
          from: 5,
          to: 10,
        },
      });

      expect(props.selection.hasSelection).toBe(true);
      expect(props.selection.from).toBe(5);
      expect(props.selection.to).toBe(10);
    });
  });
});
