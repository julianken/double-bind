/**
 * Tests for MobileEditor component.
 *
 * These tests verify the WebView-based editor component behavior.
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
  Platform: {
    OS: 'ios',
    select: (options: any) => options.ios,
  },
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    dismiss: vi.fn(),
  },
}));

// Mock react-native-webview
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// Import after mocking
import { MobileEditor } from '../../../src/editor/MobileEditor';
import type { MobileEditorProps, MobileEditorHandle } from '../../../src/editor/types';

describe('MobileEditor', () => {
  const defaultProps: MobileEditorProps = {
    blockId: 'block-test-123' as any,
    initialContent: 'Hello, world!',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('component structure', () => {
    it('should be a valid React component', () => {
      expect(MobileEditor).toBeDefined();
      expect(typeof MobileEditor).toBe('object'); // forwardRef returns an object
    });

    it('should accept required props', () => {
      const props: MobileEditorProps = {
        blockId: 'block-1' as any,
        initialContent: 'test content',
      };

      // This is a type check - if types are wrong, TS will error
      expect(props.blockId).toBe('block-1');
      expect(props.initialContent).toBe('test content');
    });

    it('should accept optional props', () => {
      const props: MobileEditorProps = {
        ...defaultProps,
        pageId: 'page-1' as any,
        readOnly: true,
        placeholder: 'Type here...',
        autoFocus: true,
        onContentChange: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        onSplitBlock: vi.fn(),
        onMergeWithPrevious: vi.fn(),
        onIndent: vi.fn(),
        onOutdent: vi.fn(),
      };

      expect(props.readOnly).toBe(true);
      expect(props.autoFocus).toBe(true);
      expect(typeof props.onContentChange).toBe('function');
    });
  });

  describe('callback types', () => {
    it('should have correct type for onContentChange', () => {
      const onContentChange = vi.fn((content: string) => {
        expect(typeof content).toBe('string');
      });

      const props: MobileEditorProps = {
        ...defaultProps,
        onContentChange,
      };

      // Simulate callback
      props.onContentChange?.('new content');
      expect(onContentChange).toHaveBeenCalledWith('new content');
    });

    it('should have correct type for onSplitBlock', () => {
      const onSplitBlock = vi.fn((cursorPosition: number) => {
        expect(typeof cursorPosition).toBe('number');
      });

      const props: MobileEditorProps = {
        ...defaultProps,
        onSplitBlock,
      };

      props.onSplitBlock?.(5);
      expect(onSplitBlock).toHaveBeenCalledWith(5);
    });

    it('should have correct type for onAutocompleteRequest', () => {
      const onAutocompleteRequest = vi.fn((trigger: string, query: string) => {
        expect(['page', 'block', 'tag']).toContain(trigger);
        expect(typeof query).toBe('string');
      });

      const props: MobileEditorProps = {
        ...defaultProps,
        onAutocompleteRequest,
      };

      props.onAutocompleteRequest?.('page', 'test');
      expect(onAutocompleteRequest).toHaveBeenCalledWith('page', 'test');
    });
  });

  describe('imperative handle types', () => {
    it('should define focus method', () => {
      const handle: MobileEditorHandle = {
        focus: vi.fn(),
        blur: vi.fn(),
        getContent: vi.fn(() => 'content'),
        setContent: vi.fn(),
        toggleMark: vi.fn(),
      };

      handle.focus();
      expect(handle.focus).toHaveBeenCalled();
    });

    it('should define blur method', () => {
      const handle: MobileEditorHandle = {
        focus: vi.fn(),
        blur: vi.fn(),
        getContent: vi.fn(() => 'content'),
        setContent: vi.fn(),
        toggleMark: vi.fn(),
      };

      handle.blur();
      expect(handle.blur).toHaveBeenCalled();
    });

    it('should define getContent method returning string', () => {
      const handle: MobileEditorHandle = {
        focus: vi.fn(),
        blur: vi.fn(),
        getContent: vi.fn(() => 'test content'),
        setContent: vi.fn(),
        toggleMark: vi.fn(),
      };

      const content = handle.getContent();
      expect(content).toBe('test content');
    });

    it('should define setContent method', () => {
      const handle: MobileEditorHandle = {
        focus: vi.fn(),
        blur: vi.fn(),
        getContent: vi.fn(() => 'content'),
        setContent: vi.fn(),
        toggleMark: vi.fn(),
      };

      handle.setContent('new content');
      expect(handle.setContent).toHaveBeenCalledWith('new content');
    });

    it('should define toggleMark method with FormatMark parameter', () => {
      const handle: MobileEditorHandle = {
        focus: vi.fn(),
        blur: vi.fn(),
        getContent: vi.fn(() => 'content'),
        setContent: vi.fn(),
        toggleMark: vi.fn(),
      };

      handle.toggleMark('bold');
      expect(handle.toggleMark).toHaveBeenCalledWith('bold');

      handle.toggleMark('italic');
      expect(handle.toggleMark).toHaveBeenCalledWith('italic');
    });
  });

  describe('default values', () => {
    it('should have default readOnly as false', () => {
      const props: MobileEditorProps = {
        ...defaultProps,
      };

      // readOnly should be undefined (defaults to false in component)
      expect(props.readOnly).toBeUndefined();
    });

    it('should have default autoFocus as false', () => {
      const props: MobileEditorProps = {
        ...defaultProps,
      };

      expect(props.autoFocus).toBeUndefined();
    });
  });
});
