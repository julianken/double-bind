/**
 * Unit tests for BlockEditor component
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { EditorState } from 'prosemirror-state';
import { BlockEditor, type BlockEditorProps } from '../../../src/editor/BlockEditor.js';

/**
 * Type for EditorView constructor props
 */
interface MockEditorViewProps {
  state: EditorState;
  editable?: () => boolean;
  handleDOMEvents?: {
    focus?: (view: unknown, event: FocusEvent) => boolean;
    blur?: (view: unknown, event: FocusEvent) => boolean;
  };
  attributes?: Record<string, string>;
}

/**
 * Type for mock EditorView instance
 */
interface MockEditorViewInstance {
  state: EditorState;
  dom: HTMLDivElement;
  _props: MockEditorViewProps;
  _element: HTMLElement;
  _destroyed: boolean;
  hasFocus: Mock;
  focus: Mock;
  destroy: Mock;
  updateState: Mock;
  setProps: Mock;
}

/**
 * Type for the mocked EditorView constructor
 */
interface MockedEditorView extends Mock {
  mock: {
    calls: [HTMLElement, MockEditorViewProps][];
    results: { value: MockEditorViewInstance }[];
  };
}

// Mock ProseMirror view to avoid JSDOM issues with contenteditable
vi.mock('prosemirror-view', async () => {
  const actual = await vi.importActual('prosemirror-view');

  return {
    ...actual,
    EditorView: vi.fn().mockImplementation(function (
      this: MockEditorViewInstance,
      element: HTMLElement,
      props: MockEditorViewProps
    ) {
      // Create a simple mock editor
      this.state = props.state;
      this.dom = document.createElement('div');
      this.dom.setAttribute('contenteditable', 'true');
      this.dom.setAttribute('role', 'textbox');
      this.dom.textContent = props.state.doc.textContent;
      element.appendChild(this.dom);

      // Store props for testing
      this._props = props;
      this._element = element;
      this._destroyed = false;

      // Focus handling
      this.hasFocus = vi.fn(() => document.activeElement === this.dom);
      this.focus = vi.fn(() => {
        this.dom.focus();
        props.handleDOMEvents?.focus?.(this, new FocusEvent('focus'));
      });

      this.destroy = vi.fn(() => {
        this._destroyed = true;
        if (this.dom.parentNode) {
          this.dom.parentNode.removeChild(this.dom);
        }
      });

      this.updateState = vi.fn((newState: EditorState) => {
        this.state = newState;
      });

      this.setProps = vi.fn((newProps: Partial<MockEditorViewProps>) => {
        Object.assign(this._props, newProps);
      });

      return this;
    }),
  };
});

describe('BlockEditor', () => {
  const defaultProps: BlockEditorProps = {
    blockId: 'test-block-123',
    initialContent: 'Hello, world!',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // Mounting and Rendering
  // ============================================================================

  describe('Mounting and Rendering', () => {
    it('renders a container element', () => {
      render(<BlockEditor {...defaultProps} />);

      const container = screen.getByTestId(`block-editor-${defaultProps.blockId}`);
      expect(container).toBeDefined();
    });

    it('applies custom className', () => {
      render(<BlockEditor {...defaultProps} className="custom-class" />);

      const container = screen.getByTestId(`block-editor-${defaultProps.blockId}`);
      expect(container.className).toContain('block-editor');
      expect(container.className).toContain('custom-class');
    });

    it('applies custom style', () => {
      render(<BlockEditor {...defaultProps} style={{ backgroundColor: 'red' }} />);

      const container = screen.getByTestId(`block-editor-${defaultProps.blockId}`);
      expect(container.style.backgroundColor).toBe('red');
    });

    it('applies custom testId', () => {
      render(<BlockEditor {...defaultProps} testId="custom-test-id" />);

      const container = screen.getByTestId('custom-test-id');
      expect(container).toBeDefined();
    });

    it('sets data-block-id attribute', () => {
      render(<BlockEditor {...defaultProps} />);

      const container = screen.getByTestId(`block-editor-${defaultProps.blockId}`);
      expect(container.getAttribute('data-block-id')).toBe(defaultProps.blockId);
    });
  });

  // ============================================================================
  // EditorView Initialization
  // ============================================================================

  describe('EditorView Initialization', () => {
    it('creates EditorView with initial content', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} />);

      // EditorView should have been created
      expect(MockedView).toHaveBeenCalledTimes(1);

      // Check that it was called with a DOM element
      const [element] = MockedView.mock.calls[0];
      expect(element).toBeInstanceOf(HTMLElement);
    });

    it('creates EditorView with empty content when initialContent is empty', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} initialContent="" />);

      expect(MockedView).toHaveBeenCalledTimes(1);
    });

    it('initializes with readOnly state when readOnly is true', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} readOnly={true} />);

      // Check the editable prop
      const [, props] = MockedView.mock.calls[0];
      expect(props.editable?.()).toBe(false);
    });

    it('initializes with editable state when readOnly is false', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} readOnly={false} />);

      const [, props] = MockedView.mock.calls[0];
      expect(props.editable?.()).toBe(true);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('destroys EditorView on unmount', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      const { unmount } = render(<BlockEditor {...defaultProps} />);

      // Get the mock instance
      const instance = MockedView.mock.results[0].value;
      expect(instance._destroyed).toBe(false);

      unmount();

      expect(instance.destroy).toHaveBeenCalled();
    });

    it('recreates EditorView when blockId changes', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      const { rerender } = render(<BlockEditor {...defaultProps} />);

      expect(MockedView).toHaveBeenCalledTimes(1);

      // Change blockId
      rerender(<BlockEditor {...defaultProps} blockId="new-block-id" />);

      // Should destroy old and create new
      expect(MockedView).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Focus Handling
  // ============================================================================

  describe('Focus Handling', () => {
    it('calls onFocus when editor receives focus', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;
      const onFocus = vi.fn();

      render(<BlockEditor {...defaultProps} onFocus={onFocus} />);

      const [, props] = MockedView.mock.calls[0];

      // Simulate focus event
      props.handleDOMEvents?.focus?.({}, new FocusEvent('focus'));

      expect(onFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur when editor loses focus', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;
      const onBlur = vi.fn();

      render(<BlockEditor {...defaultProps} onBlur={onBlur} />);

      const [, props] = MockedView.mock.calls[0];

      // Simulate blur event
      props.handleDOMEvents?.blur?.({}, new FocusEvent('blur'));

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('auto-focuses when autoFocus is true', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} autoFocus={true} />);

      const instance = MockedView.mock.results[0].value;
      expect(instance.focus).toHaveBeenCalled();
    });

    it('does not auto-focus when autoFocus is false', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} autoFocus={false} />);

      const instance = MockedView.mock.results[0].value;
      expect(instance.focus).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ReadOnly State Changes
  // ============================================================================

  describe('ReadOnly State Changes', () => {
    it('updates editable state when readOnly changes', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      const { rerender } = render(<BlockEditor {...defaultProps} readOnly={false} />);

      const instance = MockedView.mock.results[0].value;

      // Change to readOnly
      rerender(<BlockEditor {...defaultProps} readOnly={true} />);

      expect(instance.setProps).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('sets role attribute on EditorView', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} />);

      const [, props] = MockedView.mock.calls[0];
      expect(props.attributes?.role).toBe('textbox');
    });

    it('sets aria-multiline attribute', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} />);

      const [, props] = MockedView.mock.calls[0];
      expect(props.attributes?.['aria-multiline']).toBe('false');
    });

    it('sets aria-label attribute', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} />);

      const [, props] = MockedView.mock.calls[0];
      expect(props.attributes?.['aria-label']).toBe('Block content');
    });

    it('sets placeholder data attribute when provided', async () => {
      const { EditorView } = await import('prosemirror-view');
      const MockedView = EditorView as MockedEditorView;

      render(<BlockEditor {...defaultProps} placeholder="Type here..." />);

      const [, props] = MockedView.mock.calls[0];
      expect(props.attributes?.['data-placeholder']).toBe('Type here...');
    });
  });
});
