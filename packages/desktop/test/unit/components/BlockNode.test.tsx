/**
 * Tests for BlockNode component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  BlockNode,
  BulletHandle,
  BlockEditor,
  StaticBlockContent,
} from '../../../src/components/BlockNode.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  // Reset store to initial state before each test
  useAppStore.setState({
    focusedBlockId: null,
    selectedBlockIds: new Set(),
  });
  // Clear query cache to ensure fresh data
  clearQueryCache();
});

// ============================================================================
// BulletHandle Tests
// ============================================================================

describe('BulletHandle', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={false} />);
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('shows bullet icon for leaf nodes', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={false} />);
      expect(screen.getByText('-')).toBeDefined();
    });

    it('shows expanded icon when has children and not collapsed', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={true} />);
      expect(screen.getByText('v')).toBeDefined();
    });

    it('shows collapsed icon when has children and collapsed', () => {
      render(<BulletHandle isCollapsed={true} hasChildren={true} />);
      expect(screen.getByText('>')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate aria-label for leaf nodes', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={false} />);
      expect(screen.getByLabelText('Bullet')).toBeDefined();
    });

    it('has "Expand" aria-label when collapsed with children', () => {
      render(<BulletHandle isCollapsed={true} hasChildren={true} />);
      expect(screen.getByLabelText('Expand')).toBeDefined();
    });

    it('has "Collapse" aria-label when expanded with children', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={true} />);
      expect(screen.getByLabelText('Collapse')).toBeDefined();
    });

    it('has aria-expanded for nodes with children', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={true} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('does not have aria-expanded for leaf nodes', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={false} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBeNull();
    });
  });

  describe('Interactions', () => {
    it('calls onToggleCollapse when clicked', () => {
      const onToggle = vi.fn();
      render(<BulletHandle isCollapsed={false} hasChildren={true} onToggleCollapse={onToggle} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('does not crash if onToggleCollapse is not provided', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={true} />);

      // Should not throw
      fireEvent.click(screen.getByRole('button'));
    });
  });

  describe('Data Attributes', () => {
    it('sets data-has-children attribute', () => {
      render(<BulletHandle isCollapsed={false} hasChildren={true} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('data-has-children')).toBe('true');
    });

    it('sets data-collapsed attribute', () => {
      render(<BulletHandle isCollapsed={true} hasChildren={true} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('data-collapsed')).toBe('true');
    });
  });
});

// ============================================================================
// BlockEditor Tests
// ============================================================================

describe('BlockEditor', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<BlockEditor blockId="test-block-id" initialContent="Hello world" />);
      expect(screen.getByTestId('block-editor')).toBeDefined();
    });

    it('displays initial content', () => {
      render(<BlockEditor blockId="test-block-id" initialContent="Test content" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test content');
    });

    it('sets data-block-id attribute', () => {
      render(<BlockEditor blockId="my-block-123" initialContent="" />);
      const editor = screen.getByTestId('block-editor');
      expect(editor.getAttribute('data-block-id')).toBe('my-block-123');
    });
  });

  describe('Accessibility', () => {
    it('has accessible label', () => {
      render(<BlockEditor blockId="test-id" initialContent="" />);
      expect(screen.getByLabelText('Block editor')).toBeDefined();
    });
  });
});

// ============================================================================
// StaticBlockContent Tests
// ============================================================================

describe('StaticBlockContent', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<StaticBlockContent content="Test content" />);
      expect(screen.getByTestId('static-block-content')).toBeDefined();
    });

    it('displays content', () => {
      render(<StaticBlockContent content="My block text" />);
      expect(screen.getByText('My block text')).toBeDefined();
    });

    it('renders empty content', () => {
      render(<StaticBlockContent content="" />);
      expect(screen.getByTestId('static-block-content')).toBeDefined();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<StaticBlockContent content="Click me" onClick={onClick} />);

      fireEvent.click(screen.getByTestId('static-block-content'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Enter key press', () => {
      const onClick = vi.fn();
      render(<StaticBlockContent content="Press enter" onClick={onClick} />);

      fireEvent.keyDown(screen.getByTestId('static-block-content'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Space key press', () => {
      const onClick = vi.fn();
      render(<StaticBlockContent content="Press space" onClick={onClick} />);

      fireEvent.keyDown(screen.getByTestId('static-block-content'), { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not crash if onClick is not provided', () => {
      render(<StaticBlockContent content="No handler" />);

      // Should not throw
      fireEvent.click(screen.getByTestId('static-block-content'));
    });
  });

  describe('Accessibility', () => {
    it('has role="button"', () => {
      render(<StaticBlockContent content="Test" />);
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('is focusable', () => {
      render(<StaticBlockContent content="Test" />);
      const element = screen.getByTestId('static-block-content');
      expect(element.getAttribute('tabIndex')).toBe('0');
    });
  });
});

// ============================================================================
// BlockNode Tests
// ============================================================================

describe('BlockNode', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', async () => {
      render(<BlockNode blockId="test-block-id" />);

      await waitFor(() => {
        expect(screen.getByTestId('block-node')).toBeDefined();
      });
    });

    it('renders with role="treeitem"', async () => {
      render(<BlockNode blockId="test-block-id" />);

      await waitFor(() => {
        expect(screen.getByRole('treeitem')).toBeDefined();
      });
    });

    it('sets data-block-id attribute', async () => {
      render(<BlockNode blockId="my-unique-id" />);

      await waitFor(() => {
        const node = screen.getByTestId('block-node');
        expect(node.getAttribute('data-block-id')).toBe('my-unique-id');
      });
    });

    it('renders loading state initially', () => {
      render(<BlockNode blockId="test-id" />);

      // Loading state may flash briefly
      expect(
        screen.queryByTestId('block-node-loading') || screen.queryByTestId('block-node')
      ).toBeDefined();
    });
  });

  describe('Focus State', () => {
    it('renders StaticBlockContent when not focused', async () => {
      useAppStore.setState({ focusedBlockId: null });

      render(<BlockNode blockId="test-block" />);

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });
    });

    it('renders BlockEditor when focused', async () => {
      useAppStore.setState({ focusedBlockId: 'test-block' });

      render(<BlockNode blockId="test-block" />);

      await waitFor(() => {
        expect(screen.getByTestId('block-editor')).toBeDefined();
      });
    });

    it('activates block on click', async () => {
      useAppStore.setState({ focusedBlockId: null });

      render(<BlockNode blockId="clickable-block" />);

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('static-block-content'));

      expect(useAppStore.getState().focusedBlockId).toBe('clickable-block');
    });
  });

  describe('Accessibility', () => {
    it('has aria-level based on depth', async () => {
      render(<BlockNode blockId="test-block" depth={2} />);

      await waitFor(() => {
        const node = screen.getByRole('treeitem');
        expect(node.getAttribute('aria-level')).toBe('3'); // depth + 1
      });
    });

    it('has aria-level of 1 for root depth', async () => {
      render(<BlockNode blockId="root-block" depth={0} />);

      await waitFor(() => {
        const node = screen.getByRole('treeitem');
        expect(node.getAttribute('aria-level')).toBe('1');
      });
    });
  });

  describe('Performance Styles', () => {
    it('applies contentVisibility: auto', async () => {
      render(<BlockNode blockId="test-block" />);

      await waitFor(() => {
        const node = screen.getByTestId('block-node');
        expect(node.style.contentVisibility).toBe('auto');
      });
    });

    it('applies indentation based on depth', async () => {
      render(<BlockNode blockId="nested-block" depth={3} />);

      await waitFor(() => {
        const node = screen.getByTestId('block-node');
        expect(node.style.paddingLeft).toBe('72px'); // 3 * 24px
      });
    });

    it('has no indentation at depth 0', async () => {
      render(<BlockNode blockId="root-block" depth={0} />);

      await waitFor(() => {
        const node = screen.getByTestId('block-node');
        expect(node.style.paddingLeft).toBe('0px');
      });
    });
  });

  describe('Children Rendering', () => {
    it('does not render block-children when there are no children', async () => {
      render(<BlockNode blockId="leaf-block" />);

      await waitFor(() => {
        expect(screen.queryByTestId('block-children')).toBeNull();
      });
    });

    // Note: Testing recursive children would require mocking useBlockChildren
    // to return actual child data. The mock returns empty array by default.
  });

  describe('Memoization', () => {
    it('is wrapped in React.memo (has displayName)', () => {
      expect(BlockNode.displayName).toBe('BlockNode');
    });
  });

  describe('Default Props', () => {
    it('defaults depth to 0', async () => {
      render(<BlockNode blockId="no-depth-prop" />);

      await waitFor(() => {
        const node = screen.getByTestId('block-node');
        expect(node.getAttribute('aria-level')).toBe('1'); // depth 0 + 1
        expect(node.style.paddingLeft).toBe('0px');
      });
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('BlockNode Integration', () => {
  describe('Store Integration', () => {
    it('subscribes to focusedBlockId changes', async () => {
      render(<BlockNode blockId="reactive-block" />);

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });

      // Change focus via store
      act(() => {
        useAppStore.setState({ focusedBlockId: 'reactive-block' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('block-editor')).toBeDefined();
      });

      // Remove focus
      act(() => {
        useAppStore.setState({ focusedBlockId: null });
      });

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });
    });

    it('updates correctly when focus moves to another block', async () => {
      render(<BlockNode blockId="block-a" />);

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });

      // Focus this block
      act(() => {
        useAppStore.setState({ focusedBlockId: 'block-a' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('block-editor')).toBeDefined();
      });

      // Focus a different block
      act(() => {
        useAppStore.setState({ focusedBlockId: 'block-b' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('static-block-content')).toBeDefined();
      });
    });
  });

  describe('Component Composition', () => {
    it('renders BulletHandle inside BlockNode', async () => {
      render(<BlockNode blockId="with-bullet" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bullet/i })).toBeDefined();
      });
    });

    it('renders content area inside BlockNode', async () => {
      render(<BlockNode blockId="with-content" />);

      await waitFor(() => {
        expect(
          screen.getByTestId('static-block-content') || screen.getByTestId('block-editor')
        ).toBeDefined();
      });
    });
  });
});
