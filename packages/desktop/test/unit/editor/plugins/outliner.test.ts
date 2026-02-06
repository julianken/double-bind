import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import {
  createOutlinerKeymap,
  createOutlinerPlugin,
  outlinerPlugins,
  outlinerPluginKey,
  getContentBeforeCursor,
  getContentAfterCursor,
  type OutlinerContext,
} from '../../../../src/editor/plugins/outliner.js';
import type { BlockService } from '@double-bind/core';
import type { Block, BlockId, PageId } from '@double-bind/types';

// Simple schema for testing
const testSchema = new Schema({
  nodes: {
    doc: { content: 'text*' },
    text: {},
  },
});

// Helper to create a mock block
function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: 'block-1' as BlockId,
    pageId: 'page-1' as PageId,
    content: 'test content',
    order: 'a0',
    parentId: null,
    isCollapsed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
    ...overrides,
  };
}

// Helper to create a mock BlockService
function createMockBlockService(): BlockService {
  return {
    updateContent: vi.fn().mockResolvedValue(undefined),
    createBlock: vi.fn().mockResolvedValue(createMockBlock({ blockId: 'new-block' as BlockId })),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    moveBlock: vi.fn().mockResolvedValue(undefined),
    indentBlock: vi.fn().mockResolvedValue(undefined),
    outdentBlock: vi.fn().mockResolvedValue(undefined),
    toggleCollapse: vi.fn().mockResolvedValue(undefined),
    getBacklinks: vi.fn().mockResolvedValue([]),
  } as unknown as BlockService;
}

// Helper to create a mock OutlinerContext
function createMockContext(overrides: Partial<OutlinerContext> = {}): OutlinerContext {
  return {
    blockId: 'block-1' as BlockId,
    pageId: 'page-1' as PageId,
    previousBlockId: 'block-0' as BlockId,
    getContentBeforeCursor: vi.fn().mockReturnValue('before'),
    getContentAfterCursor: vi.fn().mockReturnValue('after'),
    focusBlock: vi.fn(),
    onBlocksChanged: vi.fn(),
    ...overrides,
  };
}

// Helper to create EditorState with content
function createEditorState(
  content: string,
  plugins: Array<ReturnType<typeof createOutlinerKeymap>> = []
): EditorState {
  return EditorState.create({
    doc: testSchema.node('doc', null, content ? [testSchema.text(content)] : []),
    plugins,
  });
}

// Helper to create EditorView (requires DOM environment from jsdom)
function createEditorView(state: EditorState): EditorView {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new EditorView(container, { state });
}

describe('Outliner Plugin', () => {
  let mockBlockService: BlockService;
  let mockContext: OutlinerContext;
  let getContext: () => OutlinerContext | null;

  beforeEach(() => {
    mockBlockService = createMockBlockService();
    mockContext = createMockContext();
    getContext = () => mockContext;
  });

  // ============================================================================
  // Plugin Creation
  // ============================================================================

  describe('Plugin Creation', () => {
    it('creates outliner keymap plugin', () => {
      const plugin = createOutlinerKeymap(mockBlockService, getContext);
      expect(plugin).toBeDefined();
    });

    it('creates outliner plugin with correct key', () => {
      const plugin = createOutlinerPlugin(mockBlockService, getContext);
      expect(plugin).toBeDefined();
      expect(plugin.spec.key).toBe(outlinerPluginKey);
    });

    it('creates array of plugins with outlinerPlugins()', () => {
      const plugins = outlinerPlugins(mockBlockService, getContext);
      expect(plugins).toHaveLength(2);
    });

    it('plugin key is accessible', () => {
      expect(outlinerPluginKey).toBeDefined();
      expect(outlinerPluginKey.key).toContain('outliner');
    });
  });

  // ============================================================================
  // Content Helper Functions
  // ============================================================================

  describe('Content Helper Functions', () => {
    it('getContentBeforeCursor returns text before cursor', () => {
      const state = createEditorState('hello world');
      const view = createEditorView(state);

      // Set cursor position to middle of text (position 5 = after "hello")
      // In ProseMirror, position 0 is at doc start, text positions start at 0
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(5))
      );
      view.dispatch(tr);

      const content = getContentBeforeCursor(view);
      expect(content).toBe('hello');

      view.destroy();
    });

    it('getContentAfterCursor returns text after cursor', () => {
      const state = createEditorState('hello world');
      const view = createEditorView(state);

      // Set cursor position to after "hello" (position 5)
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(5))
      );
      view.dispatch(tr);

      const content = getContentAfterCursor(view);
      expect(content).toBe(' world');

      view.destroy();
    });

    it('getContentBeforeCursor returns empty string at start', () => {
      const state = createEditorState('hello');
      const view = createEditorView(state);

      // Move cursor to start (position 0)
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(0))
      );
      view.dispatch(tr);

      const content = getContentBeforeCursor(view);
      expect(content).toBe('');

      view.destroy();
    });

    it('getContentAfterCursor returns empty string at end', () => {
      const state = createEditorState('hello');
      const view = createEditorView(state);

      // Move cursor to end position
      const docSize = view.state.doc.content.size;
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(docSize))
      );
      view.dispatch(tr);

      const content = getContentAfterCursor(view);
      expect(content).toBe('');

      view.destroy();
    });
  });

  // ============================================================================
  // Tab Key (Indent)
  // ============================================================================

  describe('Tab Key (Indent)', () => {
    it('calls indentBlock on Tab press', async () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      view.dom.dispatchEvent(event);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.indentBlock).toHaveBeenCalledWith('block-1');
      expect(mockContext.onBlocksChanged).toHaveBeenCalled();

      view.destroy();
    });

    it('does not indent when context is null', async () => {
      const nullContext = () => null;
      const plugins = [createOutlinerKeymap(mockBlockService, nullContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.indentBlock).not.toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Shift+Tab Key (Outdent)
  // ============================================================================

  describe('Shift+Tab Key (Outdent)', () => {
    it('calls outdentBlock on Shift+Tab press', async () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Simulate Shift+Tab key
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.outdentBlock).toHaveBeenCalledWith('block-1');
      expect(mockContext.onBlocksChanged).toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Enter Key (Split Block)
  // ============================================================================

  describe('Enter Key (Split Block)', () => {
    it('splits block on Enter press', async () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Simulate Enter key
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.updateContent).toHaveBeenCalledWith('block-1', 'before');
      expect(mockBlockService.createBlock).toHaveBeenCalledWith('page-1', null, 'after', 'block-1');
      expect(mockContext.onBlocksChanged).toHaveBeenCalled();
      expect(mockContext.focusBlock).toHaveBeenCalledWith('new-block', 'start');

      view.destroy();
    });
  });

  // ============================================================================
  // Shift+Enter Key (Insert Newline)
  // ============================================================================

  describe('Shift+Enter Key (Insert Newline)', () => {
    it('inserts newline on Shift+Enter press', () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Move cursor to middle
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(2))
      );
      view.dispatch(tr);

      // Simulate Shift+Enter key
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      });
      view.dom.dispatchEvent(event);

      // Check that a newline was inserted (document should contain \n)
      expect(view.state.doc.textContent).toContain('\n');

      // Should NOT call block service operations
      expect(mockBlockService.updateContent).not.toHaveBeenCalled();
      expect(mockBlockService.createBlock).not.toHaveBeenCalled();

      view.destroy();
    });

    it('does not split block on Shift+Enter', () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('hello world', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      });
      view.dom.dispatchEvent(event);

      // The document should still be one block
      expect(mockBlockService.createBlock).not.toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Backspace Key (Merge with Previous)
  // ============================================================================

  describe('Backspace Key (Merge with Previous)', () => {
    it('merges with previous block on Backspace at start', async () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Move cursor to start
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(0))
      );
      view.dispatch(tr);

      // Simulate Backspace key
      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.deleteBlock).toHaveBeenCalledWith('block-1');
      expect(mockContext.onBlocksChanged).toHaveBeenCalled();
      expect(mockContext.focusBlock).toHaveBeenCalledWith('block-0', 'end');

      view.destroy();
    });

    it('does not merge when cursor is not at start', async () => {
      const plugins = [createOutlinerKeymap(mockBlockService, getContext)];
      const state = createEditorState('test content', plugins);
      const view = createEditorView(state);

      // Move cursor to middle of text (not at start)
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(5))
      );
      view.dispatch(tr);

      // Backspace at non-start position should not merge
      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // When not at position 0, merge should not happen
      expect(mockBlockService.deleteBlock).not.toHaveBeenCalled();

      view.destroy();
    });

    it('does not merge when there is no previous block', async () => {
      const contextWithNoPrevious = createMockContext({ previousBlockId: null });
      const getCtx = () => contextWithNoPrevious;

      const plugins = [createOutlinerKeymap(mockBlockService, getCtx)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      // Move cursor to start
      const tr = view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(0))
      );
      view.dispatch(tr);

      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockBlockService.deleteBlock).not.toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('handles indent failure gracefully', async () => {
      const failingService = {
        ...createMockBlockService(),
        indentBlock: vi.fn().mockRejectedValue(new Error('Cannot indent')),
      } as unknown as BlockService;

      const plugins = [createOutlinerKeymap(failingService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have tried to indent but not called onBlocksChanged due to error
      expect(failingService.indentBlock).toHaveBeenCalled();
      // onBlocksChanged should NOT be called on error
      expect(mockContext.onBlocksChanged).not.toHaveBeenCalled();

      view.destroy();
    });

    it('handles outdent failure gracefully', async () => {
      const failingService = {
        ...createMockBlockService(),
        outdentBlock: vi.fn().mockRejectedValue(new Error('Cannot outdent')),
      } as unknown as BlockService;

      const plugins = [createOutlinerKeymap(failingService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(failingService.outdentBlock).toHaveBeenCalled();

      view.destroy();
    });

    it('handles split block failure gracefully', async () => {
      const failingService = {
        ...createMockBlockService(),
        updateContent: vi.fn().mockRejectedValue(new Error('Update failed')),
      } as unknown as BlockService;

      const plugins = [createOutlinerKeymap(failingService, getContext)];
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      view.dom.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(failingService.updateContent).toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Plugin Integration
  // ============================================================================

  describe('Plugin Integration', () => {
    it('prevents default Tab behavior', () => {
      const plugins = outlinerPlugins(mockBlockService, getContext);
      const state = createEditorState('test', plugins);
      const view = createEditorView(state);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');

      // Dispatch through the DOM
      view.dom.dispatchEvent(event);

      // The plugin's handleDOMEvents should prevent default
      expect(spy).toHaveBeenCalled();

      view.destroy();
    });

    it('plugins can be added to EditorState', () => {
      const plugins = outlinerPlugins(mockBlockService, getContext);
      const state = EditorState.create({
        schema: testSchema,
        plugins,
      });

      expect(state.plugins).toHaveLength(2);
    });
  });
});
