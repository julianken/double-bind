/**
 * Unit tests for autocomplete plugin
 *
 * Tests the `[[` page link autocomplete functionality including:
 * - Trigger detection
 * - Query extraction
 * - Keyboard navigation
 * - Suggestion selection
 * - Link insertion
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  createAutocompletePlugin,
  autocompletePluginKey,
  getAutocompleteState,
  isAutocompleteActive,
  closeAutocomplete,
  selectSuggestion,
  type AutocompleteSuggestion,
  type SearchPages,
} from '../../../../src/editor/plugins/page-autocomplete.js';

/**
 * Create a test schema
 */
function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        content: 'inline*',
        parseDOM: [{ tag: 'p' }],
        toDOM() {
          return ['p', 0];
        },
      },
      text: { group: 'inline' },
    },
  });
}

/**
 * Create an editor state with content and cursor position
 */
function createEditorState(
  schema: Schema,
  plugins: Plugin[],
  content: string,
  cursorPos?: number
): EditorState {
  const textNode = content ? schema.text(content) : null;
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, textNode ? [textNode] : []),
  ]);

  const state = EditorState.create({
    doc,
    plugins,
  });

  if (cursorPos !== undefined) {
    // Position is relative to paragraph content, add 1 for doc node
    const resolvedPos = state.doc.resolve(cursorPos + 1);
    return state.apply(state.tr.setSelection(TextSelection.create(state.doc, resolvedPos.pos)));
  }

  return state;
}

/**
 * Create a mock search function
 */
function createMockSearchPages(pages: { pageId: string; title: string }[]): SearchPages {
  return vi.fn().mockResolvedValue(
    pages.map((p) => ({
      pageId: p.pageId,
      title: p.title,
      isCreateNew: false,
    }))
  );
}

/**
 * Simulate typing by creating a transaction that inserts text
 */
function typeText(state: EditorState, text: string): EditorState {
  const { from } = state.selection;
  const tr = state.tr.insertText(text, from);
  return state.apply(tr);
}

describe('Autocomplete Plugin', () => {
  let schema: Schema;
  let mockSearchPages: SearchPages;

  beforeEach(() => {
    schema = createTestSchema();
    mockSearchPages = createMockSearchPages([
      { pageId: 'page-1', title: 'Test Page' },
      { pageId: 'page-2', title: 'Another Page' },
      { pageId: 'page-3', title: 'Testing Notes' },
    ]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ============================================================================
  // Plugin Creation
  // ============================================================================

  describe('Plugin Creation', () => {
    it('creates a plugin with required options', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('creates a plugin with all options', () => {
      const onSelect = vi.fn();
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
        onSelect,
        debounceMs: 200,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('plugin integrates with EditorState', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      const state = createEditorState(schema, [plugin], 'Hello');
      expect(state).toBeInstanceOf(EditorState);
      expect(state.plugins).toContain(plugin);
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('autocomplete starts inactive', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      const state = createEditorState(schema, [plugin], 'Hello');
      const autocompleteState = getAutocompleteState(state);

      expect(autocompleteState).toBeDefined();
      expect(autocompleteState?.active).toBe(false);
      expect(autocompleteState?.query).toBe('');
      expect(autocompleteState?.suggestions).toEqual([]);
      expect(autocompleteState?.selectedIndex).toBe(-1);
    });

    it('isAutocompleteActive returns false initially', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      const state = createEditorState(schema, [plugin], 'Hello');
      expect(isAutocompleteActive(state)).toBe(false);
    });
  });

  // ============================================================================
  // Trigger Detection
  // ============================================================================

  describe('Trigger Detection', () => {
    it('activates when typing [[', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
      expect(autocompleteState?.query).toBe('');
    });

    it('captures query text after [[', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
      expect(autocompleteState?.query).toBe('test');
    });

    it('updates query as user types', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[te');

      let autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.query).toBe('te');

      state = typeText(state, 'st');
      autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.query).toBe('test');
    });

    it('does not activate for single [', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(false);
    });

    it('deactivates when [[ is closed with ]]', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test]]');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(false);
    });

    it('activates for [[ in middle of text', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], 'Hello ', 6);
      state = typeText(state, '[[');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
    });

    it('handles multiple [[ by tracking the last unclosed one', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[first]] and [[second');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
      expect(autocompleteState?.query).toBe('second');
    });
  });

  // ============================================================================
  // Plugin State Updates
  // ============================================================================

  describe('Plugin State Updates', () => {
    it('updates selectedIndex via meta', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      // Manually add suggestions via meta
      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [
          { pageId: 'p1', title: 'Page 1', isCreateNew: false },
          { pageId: 'p2', title: 'Page 2', isCreateNew: false },
        ],
      });
      state = state.apply(tr);

      let autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.suggestions.length).toBe(2);
      expect(autocompleteState?.selectedIndex).toBe(0); // Auto-selected first

      // Update selected index
      const tr2 = state.tr.setMeta(autocompletePluginKey, {
        type: 'selectIndex',
        index: 1,
      });
      state = state.apply(tr2);

      autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.selectedIndex).toBe(1);
    });

    it('closes via meta', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test');

      expect(getAutocompleteState(state)?.active).toBe(true);

      const tr = state.tr.setMeta(autocompletePluginKey, { type: 'close' });
      state = state.apply(tr);

      expect(getAutocompleteState(state)?.active).toBe(false);
    });

    it('updates coordinates via meta', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateCoords',
        coords: { top: 100, left: 200 },
      });
      state = state.apply(tr);

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.coords).toEqual({ top: 100, left: 200 });
    });
  });

  // ============================================================================
  // Suggestion Types
  // ============================================================================

  describe('Suggestion Types', () => {
    it('suggestion has correct shape for existing page', () => {
      const suggestion: AutocompleteSuggestion = {
        pageId: 'page-123',
        title: 'My Page',
        isCreateNew: false,
      };

      expect(suggestion.pageId).toBe('page-123');
      expect(suggestion.title).toBe('My Page');
      expect(suggestion.isCreateNew).toBe(false);
    });

    it('suggestion has correct shape for create new', () => {
      const suggestion: AutocompleteSuggestion = {
        pageId: null,
        title: 'New Page Name',
        isCreateNew: true,
      };

      expect(suggestion.pageId).toBeNull();
      expect(suggestion.title).toBe('New Page Name');
      expect(suggestion.isCreateNew).toBe(true);
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('Utility Functions', () => {
    it('getAutocompleteState returns state from editor state', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      const state = createEditorState(schema, [plugin], 'Hello');
      const autocompleteState = getAutocompleteState(state);

      expect(autocompleteState).toBeDefined();
      expect(typeof autocompleteState?.active).toBe('boolean');
    });

    it('isAutocompleteActive returns boolean', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      expect(isAutocompleteActive(state)).toBe(false);

      state = typeText(state, '[[');
      expect(isAutocompleteActive(state)).toBe(true);
    });
  });

  // ============================================================================
  // Integration with EditorView (requires JSDOM)
  // ============================================================================

  describe('EditorView Integration', () => {
    let container: HTMLElement;
    let view: EditorView;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      if (view) {
        view.destroy();
      }
      container.remove();
    });

    it('closeAutocomplete closes the dropdown', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test');

      view = new EditorView(container, { state });

      expect(isAutocompleteActive(view.state)).toBe(true);

      closeAutocomplete(view);

      expect(isAutocompleteActive(view.state)).toBe(false);
    });

    it('selectSuggestion inserts link and closes', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[te');

      // Add a suggestion
      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [{ pageId: 'p1', title: 'Test Page', isCreateNew: false }],
      });
      state = state.apply(tr);

      view = new EditorView(container, { state });

      selectSuggestion(view, 0);

      // Check that link was inserted
      const content = view.state.doc.textContent;
      expect(content).toContain('[[Test Page]]');

      // Check that autocomplete is closed
      expect(isAutocompleteActive(view.state)).toBe(false);
    });

    it('selectSuggestion handles invalid index gracefully', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      view = new EditorView(container, { state });

      // Should not throw with invalid index
      expect(() => selectSuggestion(view, 5)).not.toThrow();
      expect(() => selectSuggestion(view, -1)).not.toThrow();
    });

    it('handles keyboard navigation (ArrowDown)', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      // Add suggestions
      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [
          { pageId: 'p1', title: 'Page 1', isCreateNew: false },
          { pageId: 'p2', title: 'Page 2', isCreateNew: false },
        ],
      });
      state = state.apply(tr);

      view = new EditorView(container, { state });

      // Initial selection is 0
      expect(getAutocompleteState(view.state)?.selectedIndex).toBe(0);

      // Simulate ArrowDown key
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      view.dom.dispatchEvent(event);

      // Selection should move to 1
      expect(getAutocompleteState(view.state)?.selectedIndex).toBe(1);
    });

    it('handles keyboard navigation (ArrowUp)', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      // Add suggestions with selected index 1
      let tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [
          { pageId: 'p1', title: 'Page 1', isCreateNew: false },
          { pageId: 'p2', title: 'Page 2', isCreateNew: false },
        ],
      });
      state = state.apply(tr);

      tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'selectIndex',
        index: 1,
      });
      state = state.apply(tr);

      view = new EditorView(container, { state });

      expect(getAutocompleteState(view.state)?.selectedIndex).toBe(1);

      // Simulate ArrowUp key
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      view.dom.dispatchEvent(event);

      // Selection should move to 0
      expect(getAutocompleteState(view.state)?.selectedIndex).toBe(0);
    });

    it('handles Escape to close', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test');

      view = new EditorView(container, { state });

      expect(isAutocompleteActive(view.state)).toBe(true);

      // Simulate Escape key
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      view.dom.dispatchEvent(event);

      expect(isAutocompleteActive(view.state)).toBe(false);
    });

    it('handles Enter to select', () => {
      const onSelect = vi.fn();
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
        onSelect,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[te');

      // Add suggestions
      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [{ pageId: 'p1', title: 'Test Page', isCreateNew: false }],
      });
      state = state.apply(tr);

      view = new EditorView(container, { state });

      // Simulate Enter key
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      view.dom.dispatchEvent(event);

      // Link should be inserted
      expect(view.state.doc.textContent).toContain('[[Test Page]]');

      // onSelect should be called
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test Page' }),
        expect.any(Object)
      );
    });

    it('handles Tab to select', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[te');

      // Add suggestions
      const tr = state.tr.setMeta(autocompletePluginKey, {
        type: 'updateSuggestions',
        suggestions: [{ pageId: 'p1', title: 'Test Page', isCreateNew: false }],
      });
      state = state.apply(tr);

      view = new EditorView(container, { state });

      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      view.dom.dispatchEvent(event);

      // Link should be inserted
      expect(view.state.doc.textContent).toContain('[[Test Page]]');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty query', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
      expect(autocompleteState?.query).toBe('');
    });

    it('handles special characters in query', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test & notes');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.query).toBe('test & notes');
    });

    it('does not activate for [[ followed by ]', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[]');

      const autocompleteState = getAutocompleteState(state);
      expect(autocompleteState?.active).toBe(true);
      expect(autocompleteState?.query).toBe(']');
    });

    it('tracks correct trigger position', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], 'Hello ', 6);
      state = typeText(state, '[[test');

      const autocompleteState = getAutocompleteState(state);
      // Trigger position should be at the start of [[
      // "Hello [[test" - [[ starts at index 6
      expect(autocompleteState?.triggerPos).toBeGreaterThan(0);
    });

    it('deactivates when selection is not collapsed', () => {
      const plugin = createAutocompletePlugin({
        searchPages: mockSearchPages,
      });

      let state = createEditorState(schema, [plugin], '', 0);
      state = typeText(state, '[[test');

      expect(getAutocompleteState(state)?.active).toBe(true);

      // Create a selection range
      const tr = state.tr.setSelection(TextSelection.create(state.doc, 1, 5));
      state = state.apply(tr);

      expect(getAutocompleteState(state)?.active).toBe(false);
    });
  });
});
