/**
 * Unit tests for tag autocomplete plugin
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  createTagAutocompletePlugin,
  tagAutocompletePluginKey,
  getTagAutocompleteState,
  isTagAutocompleteActive,
  filterSuggestions,
  isValidTagChar,
  type TagSuggestion,
} from '../../../../src/editor/plugins/tag-autocomplete.js';

/**
 * Create a test schema
 */
function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        group: 'block',
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
 * Mock tag data for testing
 */
const mockTags: TagSuggestion[] = [
  { tag: 'important', count: 50 },
  { tag: 'todo', count: 30 },
  { tag: 'work', count: 25 },
  { tag: 'personal', count: 20 },
  { tag: 'idea', count: 15 },
  { tag: 'meeting', count: 10 },
  { tag: 'project', count: 8 },
  { tag: 'research', count: 5 },
];

/**
 * Create a mock tag provider
 */
function createMockTagProvider(): () => Promise<TagSuggestion[]> {
  return vi.fn().mockResolvedValue([...mockTags]);
}

/**
 * Create an editor state with the tag autocomplete plugin
 */
function createEditorState(schema: Schema, plugins: Plugin[], content?: string): EditorState {
  const doc = content
    ? schema.node('doc', null, [
        schema.node('paragraph', null, content ? [schema.text(content)] : []),
      ])
    : schema.node('doc', null, [schema.node('paragraph')]);

  return EditorState.create({
    doc,
    plugins,
    selection: TextSelection.atEnd(doc),
  });
}

/**
 * Create an editor view for testing
 * Reserved for future integration tests that require a DOM.
 */
function _createEditorView(state: EditorState, container: HTMLElement): EditorView {
  return new EditorView(container, {
    state,
    dispatchTransaction(tr) {
      const newState = this.state.apply(tr);
      this.updateState(newState);
    },
  });
}

// ============================================================================
// filterSuggestions Tests
// ============================================================================

describe('filterSuggestions', () => {
  it('returns all tags when filter is empty', () => {
    const result = filterSuggestions(mockTags, '');

    // Should return up to 10 tags, sorted by count
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result[0].tag).toBe('important');
    expect(result[0].count).toBe(50);
  });

  it('filters tags by prefix match', () => {
    const result = filterSuggestions(mockTags, 'imp');

    expect(result.length).toBe(2); // 'important' + create option
    expect(result[0].tag).toBe('important');
    expect(result[1].isCreate).toBe(true);
    expect(result[1].tag).toBe('imp');
  });

  it('filters tags by substring match', () => {
    const result = filterSuggestions(mockTags, 'or');

    // Should match 'work', 'important'
    const tagNames = result.filter((t) => !t.isCreate).map((t) => t.tag);
    expect(tagNames).toContain('work');
    expect(tagNames).toContain('important');
  });

  it('prioritizes prefix matches over substring matches', () => {
    const result = filterSuggestions(mockTags, 'to');

    // 'todo' starts with 'to', should come before matches that contain 'to'
    expect(result[0].tag).toBe('todo');
  });

  it('adds "Create" option when no exact match exists', () => {
    const result = filterSuggestions(mockTags, 'newtag');

    expect(result.length).toBe(1);
    expect(result[0].isCreate).toBe(true);
    expect(result[0].tag).toBe('newtag');
    expect(result[0].count).toBe(0);
  });

  it('does not add "Create" option when exact match exists', () => {
    const result = filterSuggestions(mockTags, 'todo');

    // Should have 'todo' but no create option for 'todo'
    const createOptions = result.filter((t) => t.isCreate);
    expect(createOptions.length).toBe(0);
    expect(result[0].tag).toBe('todo');
  });

  it('is case-insensitive', () => {
    const result = filterSuggestions(mockTags, 'TODO');

    expect(result[0].tag).toBe('todo');
  });

  it('limits results to 10 suggestions', () => {
    const manyTags: TagSuggestion[] = Array.from({ length: 20 }, (_, i) => ({
      tag: `tag${i}`,
      count: 20 - i,
    }));

    const result = filterSuggestions(manyTags, '');

    // 10 tags + possibly 1 create option
    expect(result.filter((t) => !t.isCreate).length).toBeLessThanOrEqual(10);
  });

  it('handles empty tag list', () => {
    const result = filterSuggestions([], 'test');

    expect(result.length).toBe(1);
    expect(result[0].isCreate).toBe(true);
    expect(result[0].tag).toBe('test');
  });

  it('handles empty filter with empty tag list', () => {
    const result = filterSuggestions([], '');

    expect(result.length).toBe(0);
  });
});

// ============================================================================
// isValidTagChar Tests
// ============================================================================

describe('isValidTagChar', () => {
  it('accepts lowercase letters', () => {
    expect(isValidTagChar('a')).toBe(true);
    expect(isValidTagChar('z')).toBe(true);
  });

  it('accepts uppercase letters', () => {
    expect(isValidTagChar('A')).toBe(true);
    expect(isValidTagChar('Z')).toBe(true);
  });

  it('accepts digits', () => {
    expect(isValidTagChar('0')).toBe(true);
    expect(isValidTagChar('9')).toBe(true);
  });

  it('accepts hyphens', () => {
    expect(isValidTagChar('-')).toBe(true);
  });

  it('accepts underscores', () => {
    expect(isValidTagChar('_')).toBe(true);
  });

  it('rejects spaces', () => {
    expect(isValidTagChar(' ')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidTagChar('!')).toBe(false);
    expect(isValidTagChar('@')).toBe(false);
    expect(isValidTagChar('#')).toBe(false);
    expect(isValidTagChar('$')).toBe(false);
    expect(isValidTagChar('.')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTagChar('')).toBe(false);
  });

  it('rejects multi-character strings', () => {
    expect(isValidTagChar('ab')).toBe(false);
  });
});

// ============================================================================
// createTagAutocompletePlugin Tests
// ============================================================================

describe('createTagAutocompletePlugin', () => {
  let schema: Schema;
  let mockTagProvider: ReturnType<typeof createMockTagProvider>;
  let container: HTMLElement;

  beforeEach(() => {
    schema = createTestSchema();
    mockTagProvider = createMockTagProvider();

    // Create a container element for the editor
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  describe('Plugin Creation', () => {
    it('creates a plugin with required options', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('creates a plugin with all options', () => {
      const onTagSelect = vi.fn();
      const renderDropdown = vi.fn().mockReturnValue(null);

      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
        onTagSelect,
        renderDropdown,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  describe('Initial State', () => {
    it('initializes with inactive state', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      const state = createEditorState(schema, [plugin]);
      const pluginState = getTagAutocompleteState(state);

      expect(pluginState).toBeDefined();
      expect(pluginState?.active).toBe(false);
      expect(pluginState?.triggerPos).toBeNull();
      expect(pluginState?.filter).toBe('');
      expect(pluginState?.suggestions).toEqual([]);
      expect(pluginState?.selectedIndex).toBe(0);
    });

    it('isTagAutocompleteActive returns false initially', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      const state = createEditorState(schema, [plugin]);

      expect(isTagAutocompleteActive(state)).toBe(false);
    });
  });

  describe('Plugin Key', () => {
    it('exports the plugin key', () => {
      expect(tagAutocompletePluginKey).toBeDefined();
      // ProseMirror appends $ + optional counter to key names; exact suffix
      // depends on module load order across test files in singleFork mode
      expect(tagAutocompletePluginKey.key).toMatch(/^tagAutocomplete\$/);
    });

    it('can retrieve state using plugin key', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      const state = createEditorState(schema, [plugin]);
      const pluginState = tagAutocompletePluginKey.getState(state);

      expect(pluginState).toBeDefined();
      expect(pluginState?.active).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('activates on trigger action', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Dispatch activate action
      const tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });

      state = state.apply(tr);
      const pluginState = getTagAutocompleteState(state);

      expect(pluginState?.active).toBe(true);
      expect(pluginState?.triggerPos).toBe(6);
    });

    it('updates suggestions on update action', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // First activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Then update
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'update',
        filter: 'to',
        suggestions: [{ tag: 'todo', count: 30 }],
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);

      expect(pluginState?.filter).toBe('to');
      expect(pluginState?.suggestions).toEqual([{ tag: 'todo', count: 30 }]);
      expect(pluginState?.selectedIndex).toBe(0);
    });

    it('navigates down in suggestions', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Add suggestions
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'update',
        filter: '',
        suggestions: mockTags.slice(0, 3),
      });
      state = state.apply(tr);

      // Navigate down
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'navigate',
        direction: 'down',
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.selectedIndex).toBe(1);
    });

    it('navigates up in suggestions', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Add suggestions
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'update',
        filter: '',
        suggestions: mockTags.slice(0, 3),
      });
      state = state.apply(tr);

      // Navigate up (should wrap to end)
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'navigate',
        direction: 'up',
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.selectedIndex).toBe(2); // Wraps to last item
    });

    it('wraps around when navigating past end', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Add 2 suggestions
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'update',
        filter: '',
        suggestions: mockTags.slice(0, 2),
      });
      state = state.apply(tr);

      // Navigate down twice (0 -> 1 -> 0)
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'navigate',
        direction: 'down',
      });
      state = state.apply(tr);

      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'navigate',
        direction: 'down',
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.selectedIndex).toBe(0); // Wraps to first item
    });

    it('selects specific index', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Add suggestions
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'update',
        filter: '',
        suggestions: mockTags.slice(0, 5),
      });
      state = state.apply(tr);

      // Select index 3
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'select',
        index: 3,
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.selectedIndex).toBe(3);
    });

    it('deactivates on deactivate action', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      expect(getTagAutocompleteState(state)?.active).toBe(true);

      // Deactivate
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'deactivate',
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.active).toBe(false);
      expect(pluginState?.triggerPos).toBeNull();
    });
  });

  describe('Integration with EditorState', () => {
    it('plugin integrates with EditorState without errors', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      const state = createEditorState(schema, [plugin], 'Test content');

      expect(state).toBeInstanceOf(EditorState);
      expect(state.plugins).toContain(plugin);
    });

    it('plugin works with empty document', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      const state = createEditorState(schema, [plugin]);

      expect(state).toBeInstanceOf(EditorState);
      expect(getTagAutocompleteState(state)).toBeDefined();
    });
  });

  describe('Decorations', () => {
    it('creates decorations when active', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      const tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      expect(pluginState?.decorations).toBeDefined();

      // Decorations should have one inline decoration
      const found = pluginState?.decorations.find();
      expect(found?.length).toBeGreaterThan(0);
    });

    it('removes decorations when deactivated', () => {
      const plugin = createTagAutocompletePlugin({
        tagProvider: mockTagProvider,
      });

      let state = createEditorState(schema, [plugin], 'Hello ');

      // Activate
      let tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'activate',
        triggerPos: 6,
      });
      state = state.apply(tr);

      // Deactivate
      tr = state.tr.setMeta(tagAutocompletePluginKey, {
        type: 'deactivate',
      });
      state = state.apply(tr);

      const pluginState = getTagAutocompleteState(state);
      const found = pluginState?.decorations.find();
      expect(found?.length ?? 0).toBe(0);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let schema: Schema;
  let mockTagProvider: ReturnType<typeof createMockTagProvider>;

  beforeEach(() => {
    schema = createTestSchema();
    mockTagProvider = createMockTagProvider();
  });

  it('handles navigation with empty suggestions gracefully', () => {
    const plugin = createTagAutocompletePlugin({
      tagProvider: mockTagProvider,
    });

    let state = createEditorState(schema, [plugin], 'Hello ');

    // Activate
    let tr = state.tr.setMeta(tagAutocompletePluginKey, {
      type: 'activate',
      triggerPos: 6,
    });
    state = state.apply(tr);

    // Navigate with empty suggestions (should not crash)
    tr = state.tr.setMeta(tagAutocompletePluginKey, {
      type: 'navigate',
      direction: 'down',
    });
    state = state.apply(tr);

    const pluginState = getTagAutocompleteState(state);
    expect(pluginState?.selectedIndex).toBe(0);
  });

  it('update action has no effect when not active', () => {
    const plugin = createTagAutocompletePlugin({
      tagProvider: mockTagProvider,
    });

    let state = createEditorState(schema, [plugin], 'Hello ');

    // Try to update without activating first
    const tr = state.tr.setMeta(tagAutocompletePluginKey, {
      type: 'update',
      filter: 'test',
      suggestions: mockTags,
    });
    state = state.apply(tr);

    const pluginState = getTagAutocompleteState(state);
    expect(pluginState?.active).toBe(false);
    expect(pluginState?.filter).toBe('');
    expect(pluginState?.suggestions).toEqual([]);
  });

  it('handles special characters in filter text', () => {
    // filterSuggestions should handle special regex characters
    const result = filterSuggestions(mockTags, 'test.*');

    // Should not crash and should create a "create" option
    expect(result.length).toBe(1);
    expect(result[0].isCreate).toBe(true);
  });
});
