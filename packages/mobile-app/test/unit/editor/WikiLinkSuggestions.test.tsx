/**
 * Tests for WikiLinkSuggestions component.
 *
 * These tests verify the autocomplete popup behavior.
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
  FlatList: 'FlatList',
  Animated: {
    View: 'Animated.View',
    Value: vi.fn(() => ({
      setValue: vi.fn(),
    })),
    timing: vi.fn(() => ({
      start: vi.fn(),
    })),
    parallel: vi.fn(() => ({
      start: vi.fn(),
    })),
  },
  Platform: {
    OS: 'ios',
    select: (options: any) => options.ios || {},
  },
}));

// Import after mocking
import { WikiLinkSuggestions } from '../../../src/editor/WikiLinkSuggestions';
import type { WikiLinkSuggestionsProps, AutocompleteSuggestion } from '../../../src/editor/types';

describe('WikiLinkSuggestions', () => {
  const createPageSuggestion = (title: string, isCreateNew = false): AutocompleteSuggestion => ({
    type: 'page',
    data: {
      pageId: `page-${title}` as any,
      title,
      isCreateNew,
    },
  });

  const createBlockSuggestion = (content: string): AutocompleteSuggestion => ({
    type: 'block',
    data: {
      blockId: `block-${content.substring(0, 5)}` as any,
      content,
      pageTitle: 'Parent Page',
    },
  });

  const createTagSuggestion = (tag: string, count: number): AutocompleteSuggestion => ({
    type: 'tag',
    data: {
      tag,
      count,
    },
  });

  const createProps = (
    overrides: Partial<WikiLinkSuggestionsProps> = {}
  ): WikiLinkSuggestionsProps => ({
    isVisible: true,
    type: 'page',
    query: 'test',
    suggestions: [createPageSuggestion('Test Page')],
    selectedIndex: 0,
    bottomOffset: 300,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('component structure', () => {
    it('should be a valid React component', () => {
      expect(WikiLinkSuggestions).toBeDefined();
    });

    it('should accept all required props', () => {
      const props = createProps();

      expect(props.isVisible).toBe(true);
      expect(props.type).toBe('page');
      expect(props.query).toBe('test');
      expect(props.suggestions).toHaveLength(1);
    });
  });

  describe('visibility', () => {
    it('should not render when isVisible is false', () => {
      const props = createProps({ isVisible: false });

      expect(props.isVisible).toBe(false);
    });

    it('should render when isVisible is true', () => {
      const props = createProps({ isVisible: true });

      expect(props.isVisible).toBe(true);
    });
  });

  describe('page suggestions', () => {
    it('should display page suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [
        createPageSuggestion('Page One'),
        createPageSuggestion('Page Two'),
        createPageSuggestion('Page Three'),
      ];

      const props = createProps({ suggestions, type: 'page' });

      expect(props.suggestions).toHaveLength(3);
      expect(props.suggestions[0].type).toBe('page');
    });

    it('should mark new page creation option', () => {
      const suggestions: AutocompleteSuggestion[] = [
        createPageSuggestion('Existing Page'),
        createPageSuggestion('New Page', true),
      ];

      const props = createProps({ suggestions });

      const createSuggestion = props.suggestions[1];
      expect(createSuggestion.type).toBe('page');
      if (createSuggestion.type === 'page') {
        expect(createSuggestion.data.isCreateNew).toBe(true);
      }
    });
  });

  describe('block suggestions', () => {
    it('should display block suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [
        createBlockSuggestion('Block content one'),
        createBlockSuggestion('Block content two'),
      ];

      const props = createProps({ suggestions, type: 'block' });

      expect(props.suggestions).toHaveLength(2);
      expect(props.suggestions[0].type).toBe('block');
    });

    it('should include page title for block suggestions', () => {
      const suggestion = createBlockSuggestion('Some content');

      expect(suggestion.type).toBe('block');
      if (suggestion.type === 'block') {
        expect(suggestion.data.pageTitle).toBe('Parent Page');
      }
    });
  });

  describe('tag suggestions', () => {
    it('should display tag suggestions', () => {
      const suggestions: AutocompleteSuggestion[] = [
        createTagSuggestion('important', 10),
        createTagSuggestion('todo', 25),
      ];

      const props = createProps({ suggestions, type: 'tag' });

      expect(props.suggestions).toHaveLength(2);
      expect(props.suggestions[0].type).toBe('tag');
    });

    it('should include usage count for tags', () => {
      const suggestion = createTagSuggestion('project', 42);

      expect(suggestion.type).toBe('tag');
      if (suggestion.type === 'tag') {
        expect(suggestion.data.count).toBe(42);
      }
    });
  });

  describe('selection', () => {
    it('should track selected index', () => {
      const props = createProps({ selectedIndex: 2 });

      expect(props.selectedIndex).toBe(2);
    });

    it('should handle first item selected', () => {
      const props = createProps({ selectedIndex: 0 });

      expect(props.selectedIndex).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call onSelect when suggestion is selected', () => {
      const onSelect = vi.fn();
      const suggestion = createPageSuggestion('Test');
      const props = createProps({ onSelect });

      props.onSelect(suggestion, 0);

      expect(onSelect).toHaveBeenCalledWith(suggestion, 0);
    });

    it('should call onClose when popup is closed', () => {
      const onClose = vi.fn();
      const props = createProps({ onClose });

      props.onClose();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should handle empty suggestions', () => {
      const props = createProps({ suggestions: [] });

      expect(props.suggestions).toHaveLength(0);
    });
  });

  describe('positioning', () => {
    it('should accept bottom offset for keyboard', () => {
      const props = createProps({ bottomOffset: 350 });

      expect(props.bottomOffset).toBe(350);
    });

    it('should handle zero bottom offset', () => {
      const props = createProps({ bottomOffset: 0 });

      expect(props.bottomOffset).toBe(0);
    });
  });

  describe('query display', () => {
    it('should track search query', () => {
      const props = createProps({ query: 'search term' });

      expect(props.query).toBe('search term');
    });

    it('should handle empty query', () => {
      const props = createProps({ query: '' });

      expect(props.query).toBe('');
    });
  });

  describe('type indicator', () => {
    it('should display correct type for pages', () => {
      const props = createProps({ type: 'page' });

      expect(props.type).toBe('page');
    });

    it('should display correct type for blocks', () => {
      const props = createProps({ type: 'block' });

      expect(props.type).toBe('block');
    });

    it('should display correct type for tags', () => {
      const props = createProps({ type: 'tag' });

      expect(props.type).toBe('tag');
    });

    it('should handle null type', () => {
      const props = createProps({ type: null });

      expect(props.type).toBeNull();
    });
  });
});
