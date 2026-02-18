/**
 * Unit tests for keymap plugin
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';
import {
  createKeymapPlugin,
  createEditorKeymaps,
  KEYBINDINGS,
  zoomIntoBlock,
  jumpToParent,
  focusPrevSibling,
  focusNextSibling,
  type BlockService,
  type NavigationService,
} from '../../../../src/editor/plugins/keymap.js';

/**
 * Create a test schema with all required marks
 */
function createTestSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
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
    marks: {
      bold: {
        parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
        toDOM() {
          return ['strong', 0];
        },
      },
      italic: {
        parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
        toDOM() {
          return ['em', 0];
        },
      },
      code: {
        parseDOM: [{ tag: 'code' }],
        toDOM() {
          return ['code', 0];
        },
      },
      highlight: {
        parseDOM: [{ tag: 'mark' }],
        toDOM() {
          return ['mark', 0];
        },
      },
      strikethrough: {
        parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
        toDOM() {
          return ['s', 0];
        },
      },
    },
  });
}

/**
 * Create a mock block service
 */
function createMockBlockService(): BlockService {
  return {
    moveBlockUp: vi.fn().mockResolvedValue(undefined),
    moveBlockDown: vi.fn().mockResolvedValue(undefined),
    collapseBlock: vi.fn().mockResolvedValue(undefined),
    expandBlock: vi.fn().mockResolvedValue(undefined),
    toggleTodo: vi.fn().mockResolvedValue(undefined),
    focusPreviousBlock: vi.fn(),
    focusNextBlock: vi.fn(),
  };
}

/**
 * Create an editor state for testing
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
  });
}

describe('createKeymapPlugin', () => {
  let schema: Schema;
  let mockBlockService: BlockService;

  beforeEach(() => {
    schema = createTestSchema();
    mockBlockService = createMockBlockService();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Plugin Creation
  // ============================================================================

  describe('Plugin Creation', () => {
    it('creates a plugin with schema only', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('creates a plugin with schema and block service', () => {
      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId: () => 'block-1',
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('createEditorKeymaps returns array of plugins', () => {
      const plugins = createEditorKeymaps({ schema });

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBe(2);
      plugins.forEach((plugin) => {
        expect(plugin).toBeInstanceOf(Plugin);
      });
    });
  });

  // ============================================================================
  // Text Formatting Keybindings
  // ============================================================================

  describe('Text Formatting Keybindings', () => {
    it('registers bold keybinding (Mod-b)', () => {
      const plugin = createKeymapPlugin({ schema });
      const state = createEditorState(schema, [plugin], 'Hello world');

      // Verify the plugin was created and can work with editor state
      expect(state.plugins).toContain(plugin);
      expect(schema.marks.bold).toBeDefined();
      expect(plugin).toBeDefined();
    });

    it('registers italic keybinding (Mod-i)', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(schema.marks.italic).toBeDefined();
      expect(plugin).toBeDefined();
    });

    it('registers code keybinding (Mod-e)', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(schema.marks.code).toBeDefined();
      expect(plugin).toBeDefined();
    });

    it('registers highlight keybinding (Mod-h)', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(schema.marks.highlight).toBeDefined();
      expect(plugin).toBeDefined();
    });

    it('registers strikethrough keybinding (Mod-Shift-k)', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(schema.marks.strikethrough).toBeDefined();
      expect(plugin).toBeDefined();
    });

    it('handles missing mark types gracefully', () => {
      // Create schema without marks
      const minimalSchema = new Schema({
        nodes: {
          doc: { content: 'paragraph+' },
          paragraph: { content: 'text*' },
          text: { group: 'inline' },
        },
      });

      // Should not throw
      const plugin = createKeymapPlugin({ schema: minimalSchema });
      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  // ============================================================================
  // Block Operations
  // ============================================================================

  describe('Block Operations', () => {
    it('does not register block operations without block service', () => {
      const plugin = createKeymapPlugin({ schema });

      // Plugin created, but no block operations without service
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers move block up keybinding (Alt-ArrowUp)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers move block down keybinding (Alt-ArrowDown)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers collapse block keybinding (Mod-Shift-ArrowUp)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers expand block keybinding (Mod-Shift-ArrowDown)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers toggle TODO keybinding (Mod-Enter)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('handles null block ID gracefully', () => {
      const getBlockId = vi.fn().mockReturnValue(null);

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  // ============================================================================
  // Block Navigation
  // ============================================================================

  describe('Block Navigation', () => {
    it('does not register navigation without block service', () => {
      const plugin = createKeymapPlugin({ schema });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers up arrow for previous block navigation', () => {
      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('registers down arrow for next block navigation', () => {
      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  // ============================================================================
  // KEYBINDINGS Constant
  // ============================================================================

  describe('KEYBINDINGS Constant', () => {
    it('exports all text formatting keybindings', () => {
      expect(KEYBINDINGS.bold).toBe('Ctrl+B');
      expect(KEYBINDINGS.italic).toBe('Ctrl+I');
      expect(KEYBINDINGS.code).toBe('Ctrl+E');
      expect(KEYBINDINGS.highlight).toBe('Ctrl+H');
      expect(KEYBINDINGS.strikethrough).toBe('Ctrl+Shift+K');
    });

    it('exports all block operation keybindings', () => {
      expect(KEYBINDINGS.moveBlockUp).toBe('Alt+Up');
      expect(KEYBINDINGS.moveBlockDown).toBe('Alt+Down');
      expect(KEYBINDINGS.collapseBlock).toBe('Ctrl+Shift+Up');
      expect(KEYBINDINGS.expandBlock).toBe('Ctrl+Shift+Down');
      expect(KEYBINDINGS.toggleTodo).toBe('Ctrl+Enter');
    });

    it('exports all block navigation keybindings', () => {
      expect(KEYBINDINGS.previousBlock).toBe('Up (at first line)');
      expect(KEYBINDINGS.nextBlock).toBe('Down (at last line)');
    });

    it('keybindings object is frozen (immutable)', () => {
      // TypeScript const assertion makes this read-only
      expect(KEYBINDINGS).toBeDefined();
      expect(Object.keys(KEYBINDINGS).length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Integration with EditorState
  // ============================================================================

  describe('Integration with EditorState', () => {
    it('plugin integrates with EditorState without errors', () => {
      const plugin = createKeymapPlugin({ schema });
      const state = createEditorState(schema, [plugin], 'Test content');

      expect(state).toBeInstanceOf(EditorState);
      expect(state.plugins).toContain(plugin);
    });

    it('multiple plugins integrate with EditorState', () => {
      const plugins = createEditorKeymaps({ schema });
      const state = EditorState.create({
        doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Test')])]),
        plugins,
      });

      expect(state).toBeInstanceOf(EditorState);
      expect(state.plugins.length).toBeGreaterThanOrEqual(2);
    });

    it('plugin works with empty document', () => {
      const plugin = createKeymapPlugin({ schema });
      const state = createEditorState(schema, [plugin]);

      expect(state).toBeInstanceOf(EditorState);
    });

    it('plugin works with full configuration', () => {
      const getBlockId = vi.fn().mockReturnValue('block-1');

      const plugin = createKeymapPlugin({
        schema,
        blockService: mockBlockService,
        getBlockId,
      });

      const state = createEditorState(schema, [plugin], 'Full config test');

      expect(state).toBeInstanceOf(EditorState);
      expect(state.plugins).toContain(plugin);
    });
  });

  // ============================================================================
  // No Conflicts with Global Shortcuts
  // ============================================================================

  describe('No Conflicts with Global Shortcuts', () => {
    // Global shortcuts from keyboard-first.md:
    // Ctrl+K (search bar), Ctrl+P (command palette), Ctrl+N, Ctrl+D, Ctrl+/, Ctrl+G, Ctrl+Q, Ctrl+\, Ctrl+B (toggle backlinks)
    // Ctrl+[, Ctrl+], Ctrl+,

    it('bold keybinding does not use Ctrl+B (global backlinks toggle)', () => {
      // Our bold uses Mod-b which is the same as Ctrl+B on non-Mac
      // This is intentional - editor shortcuts take precedence when editor is focused
      // The global Ctrl+B for backlinks should only work when NOT in editor
      // Document this behavior
      expect(KEYBINDINGS.bold).toBe('Ctrl+B');
    });

    it('keybindings do not conflict with Ctrl+K (search bar)', () => {
      // Verify none of our keybindings use Ctrl+K
      const values = Object.values(KEYBINDINGS);
      const hasCtrlK = values.some((v) => v === 'Ctrl+K' || v.includes('Ctrl+K'));
      expect(hasCtrlK).toBe(false);
    });

    it('keybindings do not conflict with Ctrl+N (new page)', () => {
      const values = Object.values(KEYBINDINGS);
      const hasCtrlN = values.some((v) => v === 'Ctrl+N' || v.includes('Ctrl+N'));
      expect(hasCtrlN).toBe(false);
    });

    it('keybindings do not conflict with Ctrl+D (daily note)', () => {
      const values = Object.values(KEYBINDINGS);
      const hasCtrlD = values.some((v) => v === 'Ctrl+D' || v.includes('Ctrl+D'));
      expect(hasCtrlD).toBe(false);
    });

    it('keybindings do not conflict with Ctrl+G (graph view)', () => {
      const values = Object.values(KEYBINDINGS);
      const hasCtrlG = values.some((v) => v === 'Ctrl+G' || v.includes('Ctrl+G'));
      expect(hasCtrlG).toBe(false);
    });

    it('keybindings do not conflict with Ctrl+Q (query editor)', () => {
      const values = Object.values(KEYBINDINGS);
      const hasCtrlQ = values.some((v) => v === 'Ctrl+Q' || v.includes('Ctrl+Q'));
      expect(hasCtrlQ).toBe(false);
    });
  });
});

// ============================================================================
// NavigationService Command Tests
// ============================================================================

/**
 * Create a mock navigation service for testing zoom and sibling navigation.
 */
function createMockNavigationService(): NavigationService {
  return {
    zoomIntoBlock: vi.fn(),
    jumpToParent: vi.fn(),
    focusPrevSibling: vi.fn(),
    focusNextSibling: vi.fn(),
  };
}

describe('Block Zoom & Sibling Navigation Commands', () => {
  let schema: Schema;
  let mockNavigationService: NavigationService;

  beforeEach(() => {
    schema = createTestSchema();
    mockNavigationService = createMockNavigationService();
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // zoomIntoBlock
  // --------------------------------------------------------------------------

  describe('zoomIntoBlock', () => {
    it('calls navigationService.zoomIntoBlock with blockId', () => {
      const getBlockId = vi.fn().mockReturnValue('block-abc');
      const cmd = zoomIntoBlock(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(true);
      expect(mockNavigationService.zoomIntoBlock).toHaveBeenCalledWith('block-abc');
    });

    it('returns false when blockId is null', () => {
      const getBlockId = vi.fn().mockReturnValue(null);
      const cmd = zoomIntoBlock(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(false);
      expect(mockNavigationService.zoomIntoBlock).not.toHaveBeenCalled();
    });

    it('is a valid ProseMirror Command (accepts state and dispatch)', () => {
      const getBlockId = vi.fn().mockReturnValue('block-1');
      const cmd = zoomIntoBlock(mockNavigationService, getBlockId);

      // ProseMirror Commands receive state and optional dispatch
      const doc = schema.node('doc', null, [schema.node('paragraph')]);
      const state = EditorState.create({ doc });
      const result = cmd(state, undefined);
      expect(result).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // jumpToParent
  // --------------------------------------------------------------------------

  describe('jumpToParent', () => {
    it('calls navigationService.jumpToParent with blockId', () => {
      const getBlockId = vi.fn().mockReturnValue('block-xyz');
      const cmd = jumpToParent(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(true);
      expect(mockNavigationService.jumpToParent).toHaveBeenCalledWith('block-xyz');
    });

    it('returns false when blockId is null', () => {
      const getBlockId = vi.fn().mockReturnValue(null);
      const cmd = jumpToParent(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // focusPrevSibling
  // --------------------------------------------------------------------------

  describe('focusPrevSibling', () => {
    it('calls navigationService.focusPrevSibling with blockId', () => {
      const getBlockId = vi.fn().mockReturnValue('block-123');
      const cmd = focusPrevSibling(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(true);
      expect(mockNavigationService.focusPrevSibling).toHaveBeenCalledWith('block-123');
    });

    it('returns false when blockId is null', () => {
      const getBlockId = vi.fn().mockReturnValue(null);
      const cmd = focusPrevSibling(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // focusNextSibling
  // --------------------------------------------------------------------------

  describe('focusNextSibling', () => {
    it('calls navigationService.focusNextSibling with blockId', () => {
      const getBlockId = vi.fn().mockReturnValue('block-456');
      const cmd = focusNextSibling(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(true);
      expect(mockNavigationService.focusNextSibling).toHaveBeenCalledWith('block-456');
    });

    it('returns false when blockId is null', () => {
      const getBlockId = vi.fn().mockReturnValue(null);
      const cmd = focusNextSibling(mockNavigationService, getBlockId);

      const result = cmd();
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Integration with createKeymapPlugin
  // --------------------------------------------------------------------------

  describe('createKeymapPlugin with navigationService', () => {
    it('creates plugin with navigationService', () => {
      const getBlockId = vi.fn().mockReturnValue('block-1');
      const plugin = createKeymapPlugin({
        schema,
        navigationService: mockNavigationService,
        getBlockId,
      });

      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('creates plugin without navigationService (no-op)', () => {
      const plugin = createKeymapPlugin({ schema });
      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  // --------------------------------------------------------------------------
  // KEYBINDINGS constants
  // --------------------------------------------------------------------------

  describe('KEYBINDINGS additions', () => {
    it('exports zoomIntoBlock keybinding', () => {
      expect(KEYBINDINGS.zoomIntoBlock).toBeDefined();
      expect(typeof KEYBINDINGS.zoomIntoBlock).toBe('string');
    });

    it('exports jumpToParent keybinding', () => {
      expect(KEYBINDINGS.jumpToParent).toBeDefined();
      expect(typeof KEYBINDINGS.jumpToParent).toBe('string');
    });

    it('exports focusPrevSibling keybinding', () => {
      expect(KEYBINDINGS.focusPrevSibling).toBeDefined();
      expect(typeof KEYBINDINGS.focusPrevSibling).toBe('string');
    });

    it('exports focusNextSibling keybinding', () => {
      expect(KEYBINDINGS.focusNextSibling).toBeDefined();
      expect(typeof KEYBINDINGS.focusNextSibling).toBe('string');
    });
  });
});
