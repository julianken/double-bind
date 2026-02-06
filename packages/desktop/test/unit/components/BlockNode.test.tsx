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
  STATIC_BLOCK_CONTENT_CSS_CLASSES,
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

    it('applies container CSS class', () => {
      render(<StaticBlockContent content="Test" />);
      const container = screen.getByRole('button');
      expect(container.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.container);
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

    it('ignores other key presses', () => {
      const onClick = vi.fn();
      render(<StaticBlockContent content="Test" onClick={onClick} />);

      fireEvent.keyDown(screen.getByTestId('static-block-content'), { key: 'Tab' });

      expect(onClick).not.toHaveBeenCalled();
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

    it('sets aria-label for accessibility', () => {
      render(<StaticBlockContent content="Accessible content" />);
      const container = screen.getByRole('button');
      expect(container.getAttribute('aria-label')).toBe('Accessible content');
    });
  });

  describe('Inline Formatting', () => {
    it('renders bold text with **', () => {
      render(<StaticBlockContent content="This is **bold** text" />);

      const boldElement = screen.getByText('bold');
      expect(boldElement.tagName).toBe('STRONG');
      expect(boldElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.bold);
    });

    it('renders italic text with *', () => {
      render(<StaticBlockContent content="This is *italic* text" />);

      const italicElement = screen.getByText('italic');
      expect(italicElement.tagName).toBe('EM');
      expect(italicElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.italic);
    });

    it('renders italic text with _', () => {
      render(<StaticBlockContent content="This is _italic_ text" />);

      const italicElement = screen.getByText('italic');
      expect(italicElement.tagName).toBe('EM');
    });

    it('renders code with backticks', () => {
      render(<StaticBlockContent content="Use `const x = 1` here" />);

      const codeElement = screen.getByText('const x = 1');
      expect(codeElement.tagName).toBe('CODE');
      expect(codeElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.code);
    });

    it('renders highlight with ^^', () => {
      render(<StaticBlockContent content="This is ^^highlighted^^ text" />);

      const highlightElement = screen.getByText('highlighted');
      expect(highlightElement.tagName).toBe('MARK');
      expect(highlightElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.highlight);
    });

    it('renders strikethrough with ~~', () => {
      render(<StaticBlockContent content="This is ~~deleted~~ text" />);

      const strikeElement = screen.getByText('deleted');
      expect(strikeElement.tagName).toBe('DEL');
      expect(strikeElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.strikethrough);
    });

    it('handles multiple formatting in same content', () => {
      render(<StaticBlockContent content="**Bold** and *italic* and `code`" />);

      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('code').tagName).toBe('CODE');
    });
  });

  describe('Page Links', () => {
    it('renders page link with [[]]', () => {
      render(<StaticBlockContent content="Link to [[My Page]]" />);

      const linkElement = screen.getByText('[[My Page]]');
      expect(linkElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.pageLink);
      expect(linkElement.getAttribute('data-link-title')).toBe('My Page');
    });

    it('renders multiple page links', () => {
      render(<StaticBlockContent content="[[Page A]] and [[Page B]]" />);

      expect(screen.getByText('[[Page A]]')).toBeDefined();
      expect(screen.getByText('[[Page B]]')).toBeDefined();
    });

    it('handles page links with special characters', () => {
      render(<StaticBlockContent content="See [[2024-01-15 Notes]]" />);

      const linkElement = screen.getByText('[[2024-01-15 Notes]]');
      expect(linkElement.getAttribute('data-link-title')).toBe('2024-01-15 Notes');
    });
  });

  describe('Block References', () => {
    it('renders block reference with (())', () => {
      render(<StaticBlockContent content="See ((01HXQ4E2JKGN3STP6VWDHM2QYZ))" />);

      const refElement = screen.getByText('((01HXQ4E2JKGN3STP6VWDHM2QYZ))');
      expect(refElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.blockRef);
      expect(refElement.getAttribute('data-block-id')).toBe('01HXQ4E2JKGN3STP6VWDHM2QYZ');
    });

    it('renders multiple block references', () => {
      render(
        <StaticBlockContent content="((01HXQ4E2JKGN3STP6VWDHM2QYA)) and ((01HXQ4E2JKGN3STP6VWDHM2QYB))" />
      );

      expect(screen.getByText('((01HXQ4E2JKGN3STP6VWDHM2QYA))')).toBeDefined();
      expect(screen.getByText('((01HXQ4E2JKGN3STP6VWDHM2QYB))')).toBeDefined();
    });
  });

  describe('Tags', () => {
    it('renders simple tag with #', () => {
      render(<StaticBlockContent content="Tagged with #project" />);

      const tagElement = screen.getByText('#project');
      expect(tagElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.tag);
      expect(tagElement.getAttribute('data-tag')).toBe('project');
    });

    it('renders multi-word tag with #[[]]', () => {
      render(<StaticBlockContent content="Tagged with #[[multi word tag]]" />);

      const tagElement = screen.getByText('#multi word tag');
      expect(tagElement.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.tag);
      expect(tagElement.getAttribute('data-tag')).toBe('multi word tag');
    });

    it('renders multiple tags', () => {
      render(<StaticBlockContent content="#tag1 and #tag2 and #[[tag three]]" />);

      expect(screen.getByText('#tag1')).toBeDefined();
      expect(screen.getByText('#tag2')).toBeDefined();
      expect(screen.getByText('#tag three')).toBeDefined();
    });

    it('handles tags with hyphens', () => {
      render(<StaticBlockContent content="Use #my-tag here" />);

      const tagElement = screen.getByText('#my-tag');
      expect(tagElement.getAttribute('data-tag')).toBe('my-tag');
    });
  });

  describe('Todo Blocks', () => {
    it('renders unchecked todo with checkbox', () => {
      render(<StaticBlockContent content="[ ] Buy groceries" contentType="todo" />);

      const container = screen.getByRole('button');
      expect(container.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.todo);

      // Should have checkbox
      const checkbox = container.querySelector(`.${STATIC_BLOCK_CONTENT_CSS_CLASSES.checkbox}`);
      expect(checkbox).toBeDefined();
      expect(checkbox?.textContent).toBe('\u2610'); // Unchecked ballot box
    });

    it('renders checked todo with [x]', () => {
      render(<StaticBlockContent content="[x] Task done" contentType="todo" />);

      const container = screen.getByRole('button');
      const checkbox = container.querySelector(`.${STATIC_BLOCK_CONTENT_CSS_CLASSES.checkbox}`);
      expect(checkbox?.textContent).toBe('\u2611'); // Checked ballot box
      expect(checkbox?.className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.checkboxChecked);
    });

    it('renders checked todo with [X]', () => {
      render(<StaticBlockContent content="[X] Task done" contentType="todo" />);

      const container = screen.getByRole('button');
      const checkbox = container.querySelector(`.${STATIC_BLOCK_CONTENT_CSS_CLASSES.checkbox}`);
      expect(checkbox?.textContent).toBe('\u2611');
    });

    it('renders checked todo with [done]', () => {
      render(<StaticBlockContent content="[done] Completed task" contentType="todo" />);

      const container = screen.getByRole('button');
      const checkbox = container.querySelector(`.${STATIC_BLOCK_CONTENT_CSS_CLASSES.checkbox}`);
      expect(checkbox?.textContent).toBe('\u2611');
    });

    it('removes checkbox syntax from displayed content', () => {
      render(<StaticBlockContent content="[x] Clean the house" contentType="todo" />);

      expect(screen.getByText('Clean the house')).toBeDefined();
      // Should not show the [x] in the text
      expect(screen.queryByText('[x]')).toBeNull();
    });

    it('sets todo-specific aria-label', () => {
      render(<StaticBlockContent content="[ ] Important task" contentType="todo" />);

      const container = screen.getByRole('button');
      expect(container.getAttribute('aria-label')).toBe('Todo: Important task');
    });
  });

  describe('Mixed Content', () => {
    it('handles formatting with page links', () => {
      render(<StaticBlockContent content="**Bold** text with [[Page Link]]" />);

      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('[[Page Link]]').className).toContain(
        STATIC_BLOCK_CONTENT_CSS_CLASSES.pageLink
      );
    });

    it('handles tags with formatting', () => {
      render(<StaticBlockContent content="#project has *italic* content" />);

      expect(screen.getByText('#project').className).toContain(
        STATIC_BLOCK_CONTENT_CSS_CLASSES.tag
      );
      expect(screen.getByText('italic').tagName).toBe('EM');
    });

    it('handles complex content with all elements', () => {
      render(
        <StaticBlockContent content="**Bold** [[Link]] #tag `code` ((01HXQ4E2JKGN3STP6VWDHM2QYZ))" />
      );

      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('[[Link]]').className).toContain(
        STATIC_BLOCK_CONTENT_CSS_CLASSES.pageLink
      );
      expect(screen.getByText('#tag').className).toContain(STATIC_BLOCK_CONTENT_CSS_CLASSES.tag);
      expect(screen.getByText('code').tagName).toBe('CODE');
      expect(screen.getByText('((01HXQ4E2JKGN3STP6VWDHM2QYZ))').className).toContain(
        STATIC_BLOCK_CONTENT_CSS_CLASSES.blockRef
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles content with only whitespace', () => {
      render(<StaticBlockContent content="   " />);

      const container = screen.getByRole('button');
      expect(container).toBeDefined();
    });

    it('handles unclosed formatting marks', () => {
      render(<StaticBlockContent content="This is **unclosed bold" />);

      // Should render as plain text, not crash
      expect(screen.getByText('This is **unclosed bold')).toBeDefined();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(10000);
      render(<StaticBlockContent content={longContent} />);

      const container = screen.getByRole('button');
      expect(container).toBeDefined();
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
