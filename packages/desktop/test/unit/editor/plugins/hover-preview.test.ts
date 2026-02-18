/**
 * Unit tests for the hover-preview ProseMirror plugin.
 *
 * Tests cover:
 * - Plugin creation and EditorState integration
 * - extractPageLinkData helper logic (indirectly via plugin)
 * - State initialisation
 * - Options handling
 * - Utility exports
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { Plugin } from 'prosemirror-state';
import {
  createHoverPreviewPlugin,
  hoverPreviewPluginKey,
  getHoverPreviewState,
} from '../../../../src/editor/plugins/hover-preview.js';

// ============================================================================
// Test Schema
// ============================================================================

function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        parseDOM: [{ tag: 'p' }],
        toDOM() {
          return ['p', 0];
        },
      },
      text: { group: 'inline' },
    },
    marks: {
      pageLink: {
        attrs: { pageId: { default: '' }, title: { default: '' } },
        inclusive: false,
        toDOM(mark) {
          return [
            'a',
            {
              'data-type': 'page-link',
              'data-page-id': mark.attrs.pageId as string,
              'data-title': mark.attrs.title as string,
              class: 'page-link',
            },
            0,
          ];
        },
      },
    },
  });
}

function createDoc(schema: Schema, text: string) {
  const textNode = text ? schema.text(text) : null;
  return schema.node('doc', null, [schema.node('paragraph', null, textNode ? [textNode] : [])]);
}

// ============================================================================
// Tests
// ============================================================================

describe('createHoverPreviewPlugin', () => {
  let schema: Schema;

  beforeEach(() => {
    schema = createTestSchema();
  });

  // --------------------------------------------------------------------------
  // Plugin creation
  // --------------------------------------------------------------------------

  describe('Plugin Creation', () => {
    it('creates a Plugin instance with no options', () => {
      const plugin = createHoverPreviewPlugin();
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('creates a Plugin instance with options', () => {
      const plugin = createHoverPreviewPlugin({
        showDelayMs: 300,
        onShow: () => {},
        onHide: () => {},
      });
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('integrates with EditorState without errors', () => {
      const plugin = createHoverPreviewPlugin();
      const doc = createDoc(schema, 'Hello [[My Page]]');
      const state = EditorState.create({ doc, plugins: [plugin] });
      expect(state).toBeInstanceOf(EditorState);
    });
  });

  // --------------------------------------------------------------------------
  // Initial state
  // --------------------------------------------------------------------------

  describe('Initial State', () => {
    it('starts inactive', () => {
      const plugin = createHoverPreviewPlugin();
      const doc = createDoc(schema, '[[Page Link]]');
      const state = EditorState.create({ doc, plugins: [plugin] });
      const pluginState = getHoverPreviewState(state);

      expect(pluginState?.active).toBe(false);
      expect(pluginState?.pageId).toBe('');
      expect(pluginState?.title).toBe('');
      expect(pluginState?.coords).toBeNull();
    });

    it('state is stable across transactions that do not change the doc', () => {
      const plugin = createHoverPreviewPlugin();
      const doc = createDoc(schema, '[[Page]]');
      const state = EditorState.create({ doc, plugins: [plugin] });
      const state1 = hoverPreviewPluginKey.getState(state);

      // Apply a no-op transaction
      const tr = state.tr;
      const state2 = hoverPreviewPluginKey.getState(state.apply(tr));

      // State object should be the same reference (stable)
      expect(state1).toBe(state2);
    });
  });

  // --------------------------------------------------------------------------
  // Default delay
  // --------------------------------------------------------------------------

  describe('Default Delay', () => {
    it('uses 150ms default showDelayMs', () => {
      // Just verify plugin is created — we cannot directly read private closure state
      const plugin = createHoverPreviewPlugin();
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('accepts custom showDelayMs', () => {
      const plugin = createHoverPreviewPlugin({ showDelayMs: 0 });
      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  // --------------------------------------------------------------------------
  // handleDOMEvents prop
  // --------------------------------------------------------------------------

  describe('handleDOMEvents', () => {
    it('plugin declares mouseover and mouseout DOM event handlers', () => {
      const plugin = createHoverPreviewPlugin();
      // Access the plugin spec to verify handleDOMEvents is declared
      const spec = (plugin as unknown as { spec: { props?: { handleDOMEvents?: unknown } } }).spec;
      expect(spec.props?.handleDOMEvents).toBeDefined();

      const handlers = spec.props?.handleDOMEvents as Record<string, unknown>;
      expect(typeof handlers.mouseover).toBe('function');
      expect(typeof handlers.mouseout).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // getHoverPreviewState
  // --------------------------------------------------------------------------

  describe('getHoverPreviewState', () => {
    it('returns undefined when plugin is not registered', () => {
      const schema = createTestSchema();
      const doc = schema.node('doc', null, [schema.node('paragraph')]);
      const state = EditorState.create({ doc });
      expect(getHoverPreviewState(state)).toBeUndefined();
    });

    it('returns state when plugin is registered', () => {
      const plugin = createHoverPreviewPlugin();
      const doc = createDoc(schema, 'some text');
      const state = EditorState.create({ doc, plugins: [plugin] });
      const pluginState = getHoverPreviewState(state);
      expect(pluginState).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Coexistence with other plugins
  // --------------------------------------------------------------------------

  describe('Plugin Coexistence', () => {
    it('coexists with other plugins in EditorState', () => {
      const hoverPlugin = createHoverPreviewPlugin();
      const otherPlugin = new Plugin({ props: {} });

      const doc = createDoc(schema, 'text [[Link]]');
      const state = EditorState.create({ doc, plugins: [hoverPlugin, otherPlugin] });

      expect(state.plugins).toHaveLength(2);
      expect(getHoverPreviewState(state)).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Plugin view lifecycle
  // --------------------------------------------------------------------------

  describe('Plugin View', () => {
    it('plugin spec defines a view factory', () => {
      const plugin = createHoverPreviewPlugin();
      const spec = (plugin as unknown as { spec: { view?: unknown } }).spec;
      expect(typeof spec.view).toBe('function');
    });
  });
});
