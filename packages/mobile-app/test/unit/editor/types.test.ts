/**
 * Tests for editor type definitions.
 *
 * These tests verify that the type definitions are correct and
 * can be used as expected. Uses compile-time checks.
 */

import { describe, it, expect } from 'vitest';
import type {
  FormatMark,
  SelectionState,
  AutocompleteTrigger,
  AutocompleteSuggestion,
  MobileEditorProps,
  MobileToolbarProps,
  WikiLinkSuggestionsProps,
  RNToWebViewMessage,
  WebViewToRNMessage,
} from '../../../src/editor/types';

describe('editor/types', () => {
  describe('FormatMark', () => {
    it('should accept valid format marks', () => {
      const marks: FormatMark[] = ['bold', 'italic', 'code', 'highlight', 'strikethrough'];
      expect(marks).toHaveLength(5);
    });
  });

  describe('SelectionState', () => {
    it('should have the correct structure', () => {
      const selection: SelectionState = {
        hasSelection: true,
        from: 0,
        to: 10,
        activeMarks: ['bold', 'italic'],
      };
      expect(selection.hasSelection).toBe(true);
      expect(selection.from).toBe(0);
      expect(selection.to).toBe(10);
      expect(selection.activeMarks).toContain('bold');
    });

    it('should work with no selection', () => {
      const selection: SelectionState = {
        hasSelection: false,
        from: 5,
        to: 5,
        activeMarks: [],
      };
      expect(selection.hasSelection).toBe(false);
      expect(selection.from).toBe(selection.to);
    });
  });

  describe('AutocompleteTrigger', () => {
    it('should accept valid trigger types', () => {
      const triggers: AutocompleteTrigger[] = ['page', 'block', 'tag'];
      expect(triggers).toHaveLength(3);
    });
  });

  describe('AutocompleteSuggestion', () => {
    it('should create page suggestions', () => {
      const suggestion: AutocompleteSuggestion = {
        type: 'page',
        data: {
          pageId: 'page-123' as any,
          title: 'Test Page',
          isCreateNew: false,
        },
      };
      expect(suggestion.type).toBe('page');
      expect(suggestion.data.title).toBe('Test Page');
    });

    it('should create block suggestions', () => {
      const suggestion: AutocompleteSuggestion = {
        type: 'block',
        data: {
          blockId: 'block-456' as any,
          content: 'Some block content',
          pageTitle: 'Parent Page',
        },
      };
      expect(suggestion.type).toBe('block');
      expect(suggestion.data.content).toBe('Some block content');
    });

    it('should create tag suggestions', () => {
      const suggestion: AutocompleteSuggestion = {
        type: 'tag',
        data: {
          tag: 'important',
          count: 42,
        },
      };
      expect(suggestion.type).toBe('tag');
      expect(suggestion.data.tag).toBe('important');
      expect(suggestion.data.count).toBe(42);
    });
  });

  describe('RNToWebViewMessage', () => {
    it('should create valid messages', () => {
      const initMsg: RNToWebViewMessage = {
        type: 'INIT',
        blockId: 'block-1' as any,
        content: 'Hello',
      };
      expect(initMsg.type).toBe('INIT');

      const focusMsg: RNToWebViewMessage = { type: 'FOCUS' };
      expect(focusMsg.type).toBe('FOCUS');

      const toggleMsg: RNToWebViewMessage = {
        type: 'TOGGLE_MARK',
        mark: 'bold',
      };
      expect(toggleMsg.type).toBe('TOGGLE_MARK');
    });
  });

  describe('WebViewToRNMessage', () => {
    it('should create valid messages', () => {
      const readyMsg: WebViewToRNMessage = { type: 'READY' };
      expect(readyMsg.type).toBe('READY');

      const contentMsg: WebViewToRNMessage = {
        type: 'CONTENT_CHANGED',
        content: 'Updated content',
      };
      expect(contentMsg.type).toBe('CONTENT_CHANGED');

      const selectionMsg: WebViewToRNMessage = {
        type: 'SELECTION_CHANGED',
        selection: {
          hasSelection: false,
          from: 0,
          to: 0,
          activeMarks: [],
        },
      };
      expect(selectionMsg.type).toBe('SELECTION_CHANGED');

      const autocompleteMsg: WebViewToRNMessage = {
        type: 'AUTOCOMPLETE_TRIGGERED',
        trigger: 'page',
        query: 'test',
      };
      expect(autocompleteMsg.type).toBe('AUTOCOMPLETE_TRIGGERED');
    });
  });

  describe('MobileEditorProps', () => {
    it('should have required props', () => {
      const props: MobileEditorProps = {
        blockId: 'block-1' as any,
        initialContent: 'Hello, world!',
      };
      expect(props.blockId).toBe('block-1');
      expect(props.initialContent).toBe('Hello, world!');
    });

    it('should accept optional props', () => {
      const props: MobileEditorProps = {
        blockId: 'block-1' as any,
        initialContent: '',
        pageId: 'page-1' as any,
        readOnly: true,
        placeholder: 'Type here...',
        autoFocus: true,
        onContentChange: () => {},
        onFocus: () => {},
        onBlur: () => {},
        onSplitBlock: () => {},
        onMergeWithPrevious: () => {},
        onIndent: () => {},
        onOutdent: () => {},
      };
      expect(props.readOnly).toBe(true);
      expect(props.autoFocus).toBe(true);
    });
  });

  describe('MobileToolbarProps', () => {
    it('should have required props', () => {
      const props: MobileToolbarProps = {
        selection: {
          hasSelection: false,
          from: 0,
          to: 0,
          activeMarks: [],
        },
        isVisible: true,
        keyboardHeight: 300,
        onToggleBold: () => {},
        onToggleItalic: () => {},
        onToggleCode: () => {},
        onToggleHighlight: () => {},
        onToggleStrikethrough: () => {},
        onInsertPageLink: () => {},
        onInsertBlockRef: () => {},
        onInsertTag: () => {},
        onDismissKeyboard: () => {},
      };
      expect(props.isVisible).toBe(true);
      expect(props.keyboardHeight).toBe(300);
    });
  });

  describe('WikiLinkSuggestionsProps', () => {
    it('should have required props', () => {
      const props: WikiLinkSuggestionsProps = {
        isVisible: true,
        type: 'page',
        query: 'test',
        suggestions: [],
        selectedIndex: 0,
        bottomOffset: 300,
        onSelect: () => {},
        onClose: () => {},
      };
      expect(props.isVisible).toBe(true);
      expect(props.type).toBe('page');
      expect(props.query).toBe('test');
    });
  });
});
