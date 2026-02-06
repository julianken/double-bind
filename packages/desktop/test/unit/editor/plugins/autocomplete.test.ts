/**
 * Unit tests for block reference autocomplete plugin
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema } from '../../../../src/editor/schema.js';
import {
  createBlockRefAutocompletePlugin,
  autocompletePluginKey,
  getAutocompleteState,
  truncatePreview,
  type BlockRefResult,
} from '../../../../src/editor/plugins/autocomplete.js';

// Mock search function
const mockSearchBlocks = vi.fn<(query: string) => Promise<BlockRefResult[]>>();

// Helper to create editor state with autocomplete plugin
function createEditorState(content: string): EditorState {
  const doc = schema.nodes.doc!.create(null, [
    schema.nodes.paragraph!.create(null, content ? schema.text(content) : []),
  ]);

  return EditorState.create({
    doc,
    schema,
    plugins: [
      createBlockRefAutocompletePlugin({
        searchBlocks: mockSearchBlocks,
        debounceMs: 0, // No debounce for tests
      }),
    ],
    selection: TextSelection.atEnd(doc),
  });
}

describe('BlockRefAutocompletePlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchBlocks.mockReset();
    mockSearchBlocks.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Trigger Detection
  // ============================================================================

  describe('Trigger Detection', () => {
    it('activates when `((` is typed', () => {
      const state = createEditorState('Hello ((');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.query).toBe('');
    });

    it('captures query typed after trigger', () => {
      const state = createEditorState('Hello ((test');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.query).toBe('test');
    });

    it('does not activate without trigger', () => {
      const state = createEditorState('Hello world');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(false);
    });

    it('does not activate with single parenthesis', () => {
      const state = createEditorState('Hello (world');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(false);
    });

    it('deactivates when trigger is completed with ))', () => {
      const state = createEditorState('Hello ((blockId))');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(false);
    });

    it('deactivates when query contains )', () => {
      const state = createEditorState('Hello ((test)');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(false);
    });

    it('handles multiple (( in text, uses the last one', () => {
      const state = createEditorState('((first)) and ((second');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.query).toBe('second');
    });

    it('handles (( at the start of document', () => {
      const state = createEditorState('((query');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.query).toBe('query');
    });
  });

  // ============================================================================
  // Trigger Position
  // ============================================================================

  describe('Trigger Position', () => {
    it('calculates correct trigger position at start', () => {
      const state = createEditorState('((');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      // Position 0 is doc start, position 1 is paragraph start
      expect(pluginState?.triggerPos).toBe(1);
    });

    it('calculates correct trigger position after text', () => {
      const state = createEditorState('Hello ((');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      // "Hello " is 6 chars, trigger is at position 7 (paragraph start + 6)
      expect(pluginState?.triggerPos).toBe(7);
    });
  });

  // ============================================================================
  // State Updates
  // ============================================================================

  describe('State Updates', () => {
    it('updates query as user types', () => {
      // Start with empty query
      let state = createEditorState('Hello ((');
      expect(getAutocompleteState(state)?.query).toBe('');

      // Type more
      state = createEditorState('Hello ((t');
      expect(getAutocompleteState(state)?.query).toBe('t');

      state = createEditorState('Hello ((test');
      expect(getAutocompleteState(state)?.query).toBe('test');
    });

    it('initializes with default state values', () => {
      const state = createEditorState('Hello ((');
      const pluginState = getAutocompleteState(state);

      expect(pluginState).toEqual({
        active: true,
        triggerPos: 7,
        query: '',
        results: [],
        selectedIndex: 0,
        isLoading: false,
      });
    });

    it('handles empty document', () => {
      const doc = schema.nodes.doc!.create(null, [schema.nodes.paragraph!.create(null, [])]);

      const state = EditorState.create({
        doc,
        schema,
        plugins: [
          createBlockRefAutocompletePlugin({
            searchBlocks: mockSearchBlocks,
          }),
        ],
      });

      const pluginState = getAutocompleteState(state);
      expect(pluginState?.active).toBe(false);
    });

    it('handles special characters in query', () => {
      const state = createEditorState('((test-123_abc');
      const pluginState = getAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.query).toBe('test-123_abc');
    });
  });

  // ============================================================================
  // Meta Updates
  // ============================================================================

  describe('Meta Updates', () => {
    it('updates state via meta', () => {
      const state = createEditorState('Hello ((test');
      const mockResults: BlockRefResult[] = [
        { blockId: '1', preview: 'Block 1', pageTitle: 'Page 1', pageId: 'p1' },
      ];

      // Apply meta update
      const tr = state.tr.setMeta(autocompletePluginKey, {
        results: mockResults,
        selectedIndex: 0,
        isLoading: false,
      });

      const newState = state.apply(tr);
      const pluginState = getAutocompleteState(newState);

      expect(pluginState?.results).toEqual(mockResults);
      expect(pluginState?.selectedIndex).toBe(0);
      expect(pluginState?.isLoading).toBe(false);
    });

    it('resets state via meta', () => {
      const state = createEditorState('Hello ((test');

      // Set some results first
      let tr = state.tr.setMeta(autocompletePluginKey, {
        results: [{ blockId: '1', preview: 'Block', pageTitle: 'Page', pageId: 'p1' }],
      });
      let newState = state.apply(tr);

      // Now reset
      tr = newState.tr.setMeta(autocompletePluginKey, {
        active: false,
        results: [],
        selectedIndex: 0,
      });
      newState = newState.apply(tr);

      const pluginState = getAutocompleteState(newState);
      expect(pluginState?.active).toBe(false);
      expect(pluginState?.results).toEqual([]);
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe('truncatePreview', () => {
  it('returns short text unchanged', () => {
    expect(truncatePreview('Hello', 50)).toBe('Hello');
  });

  it('truncates long text with ellipsis', () => {
    const longText =
      'This is a very long text that should be truncated because it exceeds the maximum length';
    const result = truncatePreview(longText, 50);

    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles exact length', () => {
    const text = '12345678901234567890123456789012345678901234567890'; // 50 chars
    expect(truncatePreview(text, 50)).toBe(text);
  });

  it('handles empty string', () => {
    expect(truncatePreview('')).toBe('');
  });

  it('uses default max length of 50', () => {
    const longText = 'A'.repeat(60);
    const result = truncatePreview(longText);

    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles text exactly at max length', () => {
    const text = 'A'.repeat(50);
    expect(truncatePreview(text, 50)).toBe(text);
  });

  it('handles text one character over', () => {
    const text = 'A'.repeat(51);
    const result = truncatePreview(text, 50);

    expect(result.length).toBe(50);
    expect(result).toBe('A'.repeat(47) + '...');
  });
});
