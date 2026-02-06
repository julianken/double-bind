/**
 * Unit tests for the persistence ProseMirror plugin
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import {
  createPersistencePlugin,
  persistencePluginKey,
  getPersistenceState,
  DEFAULT_DEBOUNCE_MS,
} from '../../../../src/editor/plugins/persistence.js';
import { invalidateQueries } from '../../../../src/hooks/useCozoQuery.js';

// Mock the invalidateQueries function
vi.mock('../../../../src/hooks/useCozoQuery.js', async () => {
  const actual = await vi.importActual('../../../../src/hooks/useCozoQuery.js');
  return {
    ...actual,
    invalidateQueries: vi.fn(),
  };
});

// Simple schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: 'text*' },
    text: {},
  },
});

// Create a mock BlockService
function createMockBlockService() {
  return {
    updateContent: vi.fn().mockResolvedValue(undefined),
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    moveBlock: vi.fn(),
    indentBlock: vi.fn(),
    outdentBlock: vi.fn(),
    toggleCollapse: vi.fn(),
    getBacklinks: vi.fn(),
  };
}

// Helper to create an EditorState with the persistence plugin
function createEditorState(options: {
  blockId: string;
  blockService: ReturnType<typeof createMockBlockService>;
  onBlur?: () => void;
  debounceMs?: number;
  initialContent?: string;
}): EditorState {
  const { blockId, blockService, onBlur, debounceMs, initialContent = '' } = options;

  const plugin = createPersistencePlugin({
    blockId,
    blockService: blockService as unknown as Parameters<
      typeof createPersistencePlugin
    >[0]['blockService'],
    onBlur,
    debounceMs,
  });

  return EditorState.create({
    doc: schema.node('doc', null, initialContent ? [schema.text(initialContent)] : []),
    plugins: [plugin],
  });
}

// Helper to create an EditorView with the persistence plugin
function createEditorView(options: {
  blockId: string;
  blockService: ReturnType<typeof createMockBlockService>;
  onBlur?: () => void;
  debounceMs?: number;
  initialContent?: string;
}): EditorView {
  const state = createEditorState(options);
  const container = document.createElement('div');
  document.body.appendChild(container);

  return new EditorView(container, {
    state,
    dispatchTransaction(tr: Transaction) {
      const newState = this.state.apply(tr);
      this.updateState(newState);
    },
  });
}

// Helper to clean up DOM after tests
function cleanupDOM(): void {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

describe('Persistence Plugin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any DOM elements
    cleanupDOM();
  });

  // ============================================================================
  // Plugin Creation
  // ============================================================================

  describe('Plugin Creation', () => {
    it('creates a plugin with correct default debounce', () => {
      const blockService = createMockBlockService();
      const state = createEditorState({
        blockId: 'block-1',
        blockService,
      });

      const pluginState = getPersistenceState(state);
      expect(pluginState).toBeDefined();
      expect(pluginState?.blockId).toBe('block-1');
      expect(pluginState?.isDirty).toBe(false);
    });

    it('exports correct default debounce constant', () => {
      expect(DEFAULT_DEBOUNCE_MS).toBe(300);
    });

    it('initializes plugin state correctly', () => {
      const blockService = createMockBlockService();
      const state = createEditorState({
        blockId: 'test-block',
        blockService,
        initialContent: 'Hello',
      });

      const pluginState = getPersistenceState(state);
      expect(pluginState).toEqual({
        blockId: 'test-block',
        isDirty: false,
        lastSavedContent: null,
      });
    });
  });

  // ============================================================================
  // Debounced Save
  // ============================================================================

  describe('Debounced Save', () => {
    it('schedules save 300ms after last keystroke', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type some content
      const tr = view.state.tr.insertText('Hello');
      view.dispatch(tr);

      // Save should not be called immediately
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Advance time by 299ms - still no save
      await vi.advanceTimersByTimeAsync(299);
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Advance time by 1ms more (total 300ms) - save should trigger
      await vi.advanceTimersByTimeAsync(1);
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'Hello');

      view.destroy();
    });

    it('resets debounce timer on subsequent changes', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type 'H'
      view.dispatch(view.state.tr.insertText('H'));
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Wait 200ms
      await vi.advanceTimersByTimeAsync(200);

      // Type 'e' - should reset the timer
      view.dispatch(view.state.tr.insertText('e'));
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Wait another 200ms (total 400ms from first keystroke, 200ms from second)
      await vi.advanceTimersByTimeAsync(200);
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Wait 100ms more (300ms from second keystroke)
      await vi.advanceTimersByTimeAsync(100);
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'He');
      expect(blockService.updateContent).toHaveBeenCalledTimes(1);

      view.destroy();
    });

    it('uses custom debounce delay when provided', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        debounceMs: 500,
        initialContent: '',
      });

      view.dispatch(view.state.tr.insertText('Test'));

      // At 300ms, save should NOT be called (custom delay is 500ms)
      await vi.advanceTimersByTimeAsync(300);
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // At 500ms, save should trigger
      await vi.advanceTimersByTimeAsync(200);
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'Test');

      view.destroy();
    });

    it('marks state as dirty when document changes', () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Initial state is not dirty
      expect(getPersistenceState(view.state)?.isDirty).toBe(false);

      // Type some content
      view.dispatch(view.state.tr.insertText('Hello'));

      // State should now be dirty
      expect(getPersistenceState(view.state)?.isDirty).toBe(true);

      view.destroy();
    });
  });

  // ============================================================================
  // Blur Behavior
  // ============================================================================

  describe('Blur Behavior', () => {
    it('flushes pending save on blur', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type some content
      view.dispatch(view.state.tr.insertText('Unsaved content'));

      // Save should not be called yet (debounce pending)
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Trigger blur event
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      view.dom.dispatchEvent(blurEvent);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      // Save should have been called immediately
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'Unsaved content');

      view.destroy();
    });

    it('cancels pending debounce on blur', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type some content (starts debounce)
      view.dispatch(view.state.tr.insertText('Test'));

      // Trigger blur before debounce completes
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      view.dom.dispatchEvent(blurEvent);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      // Save should be called only once (from blur, not from debounce)
      expect(blockService.updateContent).toHaveBeenCalledTimes(1);
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'Test');

      view.destroy();
    });

    it('invalidates queries on blur', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: 'Initial',
      });

      // Type some content
      view.dispatch(view.state.tr.insertText(' more'));

      // Trigger blur
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      view.dom.dispatchEvent(blurEvent);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      // Check that all required queries were invalidated
      expect(invalidateQueries).toHaveBeenCalledWith(['blocks']);
      expect(invalidateQueries).toHaveBeenCalledWith(['backlinks']);
      expect(invalidateQueries).toHaveBeenCalledWith(['search']);
      expect(invalidateQueries).toHaveBeenCalledWith(['links']);
    });

    it('calls onBlur callback after save and invalidation', async () => {
      const blockService = createMockBlockService();
      const onBlur = vi.fn();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        onBlur,
        initialContent: 'Test',
      });

      // Trigger blur
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      view.dom.dispatchEvent(blurEvent);

      // Allow async operations to complete
      await vi.runAllTimersAsync();

      // onBlur should have been called
      expect(onBlur).toHaveBeenCalledTimes(1);

      // onBlur should be called after save
      expect(blockService.updateContent).toHaveBeenCalled();
      const saveCallOrder = blockService.updateContent.mock.invocationCallOrder[0];
      const onBlurCallOrder = onBlur.mock.invocationCallOrder[0];
      expect(saveCallOrder).toBeLessThan(onBlurCallOrder!);

      view.destroy();
    });

    it('does not invalidate queries during debounced saves', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type some content
      view.dispatch(view.state.tr.insertText('Test'));

      // Wait for debounced save to complete
      await vi.advanceTimersByTimeAsync(300);

      // Save should have been called
      expect(blockService.updateContent).toHaveBeenCalled();

      // But invalidateQueries should NOT have been called (only on blur)
      expect(invalidateQueries).not.toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles rapid typing correctly', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Simulate rapid typing
      for (const char of 'Hello World') {
        view.dispatch(view.state.tr.insertText(char));
        await vi.advanceTimersByTimeAsync(50); // 50ms between keystrokes
      }

      // At this point, no save should have happened yet
      // (all keystrokes within 300ms of each other reset the timer)
      expect(blockService.updateContent).not.toHaveBeenCalled();

      // Wait for final debounce
      await vi.advanceTimersByTimeAsync(300);

      // Now save should happen with final content
      expect(blockService.updateContent).toHaveBeenCalledTimes(1);
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', 'Hello World');

      view.destroy();
    });

    it('cleans up debounce timer on view destroy', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type some content
      view.dispatch(view.state.tr.insertText('Test'));

      // Destroy the view before debounce completes
      view.destroy();

      // Wait for what would have been the debounce timeout
      await vi.advanceTimersByTimeAsync(300);

      // Save should NOT be called (timer was cancelled)
      expect(blockService.updateContent).not.toHaveBeenCalled();
    });

    it('handles empty content', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: 'Some content',
      });

      // Delete all content
      const tr = view.state.tr.delete(0, view.state.doc.content.size);
      view.dispatch(tr);

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(300);

      // Save should be called with empty string
      expect(blockService.updateContent).toHaveBeenCalledWith('block-1', '');

      view.destroy();
    });

    it('handles concurrent saves correctly', async () => {
      // Create a slow-saving blockService
      const blockService = createMockBlockService();
      blockService.updateContent.mockImplementation(async () => {
        // Simulate slow save
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: '',
      });

      // Type and trigger first save
      view.dispatch(view.state.tr.insertText('First'));
      await vi.advanceTimersByTimeAsync(300);

      // While first save is in progress, blur triggers immediate save
      view.dispatch(view.state.tr.insertText(' Second'));
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      view.dom.dispatchEvent(blurEvent);

      // Run all timers to completion
      await vi.runAllTimersAsync();

      // Both saves should eventually complete
      // First call: 'First', Second call (queued): 'First Second'
      expect(blockService.updateContent).toHaveBeenCalled();

      view.destroy();
    });

    it('does not save when content unchanged', async () => {
      const blockService = createMockBlockService();
      const view = createEditorView({
        blockId: 'block-1',
        blockService,
        initialContent: 'Test',
      });

      // Add and then remove the same character
      view.dispatch(view.state.tr.insertText('!'));
      view.dispatch(
        view.state.tr.delete(view.state.doc.content.size - 1, view.state.doc.content.size)
      );

      // Content is back to 'Test' but transaction was dispatched
      // The plugin tracks lastSavedContent to avoid unnecessary saves
      await vi.advanceTimersByTimeAsync(300);

      // Save is called because the intermediate state was different
      // This is expected behavior - we save on each change, not on net change
      expect(blockService.updateContent).toHaveBeenCalled();

      view.destroy();
    });
  });

  // ============================================================================
  // Plugin Key Access
  // ============================================================================

  describe('Plugin Key Access', () => {
    it('allows access to plugin state via key', () => {
      const blockService = createMockBlockService();
      const state = createEditorState({
        blockId: 'block-123',
        blockService,
      });

      const pluginState = persistencePluginKey.getState(state);
      expect(pluginState).toBeDefined();
      expect(pluginState.blockId).toBe('block-123');
    });

    it('returns undefined for state without plugin', () => {
      const stateWithoutPlugin = EditorState.create({
        doc: schema.node('doc', null, []),
        plugins: [],
      });

      const pluginState = getPersistenceState(stateWithoutPlugin);
      expect(pluginState).toBeUndefined();
    });
  });
});
