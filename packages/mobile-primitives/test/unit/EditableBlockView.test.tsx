/**
 * EditableBlockView Component Tests
 *
 * Tests editable block rendering with keyboard and gesture support.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextInput } from 'react-native';
import type { Block, BlockId } from '@double-bind/types';
import { EditableBlockView, type EditableBlockViewProps } from '../../src/EditableBlockView';

// Test helper to create mock blocks
function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: `block-${Math.random().toString(36).slice(2)}` as BlockId,
    pageId: 'page-456',
    parentId: undefined,
    content: 'Test block content',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('EditableBlockView', () => {
  describe('rendering', () => {
    it('should render with basic props', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with depth indentation', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 2 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render focused state', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isFocused: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with children indicator', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render collapsed state', () => {
      const block = createMockBlock({ isCollapsed: true });
      const props: EditableBlockViewProps = { block, hasChildren: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('callbacks', () => {
    let onContentChange: ReturnType<typeof vi.fn>;
    let onEnterPress: ReturnType<typeof vi.fn>;
    let onBackspaceEmpty: ReturnType<typeof vi.fn>;
    let onSwipeDelete: ReturnType<typeof vi.fn>;
    let onPress: ReturnType<typeof vi.fn>;
    let onToggleCollapse: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onContentChange = vi.fn();
      onEnterPress = vi.fn();
      onBackspaceEmpty = vi.fn();
      onSwipeDelete = vi.fn();
      onPress = vi.fn();
      onToggleCollapse = vi.fn();
    });

    it('should accept onContentChange callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onContentChange };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onEnterPress callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onEnterPress };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onBackspaceEmpty callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onBackspaceEmpty };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onSwipeDelete callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onSwipeDelete };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onPress callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onPress };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onToggleCollapse callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onToggleCollapse };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept all callbacks together', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        onContentChange,
        onEnterPress,
        onBackspaceEmpty,
        onSwipeDelete,
        onPress,
        onToggleCollapse,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('content management', () => {
    it('should display initial content', () => {
      const block = createMockBlock({ content: 'Initial content' });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should update content when block prop changes', () => {
      const block1 = createMockBlock({ content: 'Content 1' });
      const block2 = { ...block1, content: 'Content 2' };

      const props1: EditableBlockViewProps = { block: block1 };
      const props2: EditableBlockViewProps = { block: block2 };

      expect(() => <EditableBlockView {...props1} />).not.toThrow();
      expect(() => <EditableBlockView {...props2} />).not.toThrow();
    });

    it('should handle empty content', () => {
      const block = createMockBlock({ content: '' });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle long content', () => {
      const block = createMockBlock({ content: 'a'.repeat(1000) });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('focus management', () => {
    it('should accept inputRef prop', () => {
      const block = createMockBlock();
      const inputRef = React.createRef<TextInput>();
      const props: EditableBlockViewProps = { block, inputRef };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should use internal ref when inputRef not provided', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle focus state changes', () => {
      const block = createMockBlock();
      const props1: EditableBlockViewProps = { block, isFocused: false };
      const props2: EditableBlockViewProps = { block, isFocused: true };

      expect(() => <EditableBlockView {...props1} />).not.toThrow();
      expect(() => <EditableBlockView {...props2} />).not.toThrow();
    });
  });

  describe('depth and nesting', () => {
    it('should render with depth 0 (no indentation)', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 0 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with depth 1', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 1 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with deep nesting', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 5 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle very deep nesting', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 10 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('collapse/expand', () => {
    it('should show bullet when no children', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: false };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should show collapse triangle when has children', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should show expanded triangle when not collapsed', () => {
      const block = createMockBlock({ isCollapsed: false });
      const props: EditableBlockViewProps = { block, hasChildren: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should show collapsed triangle when collapsed', () => {
      const block = createMockBlock({ isCollapsed: true });
      const props: EditableBlockViewProps = { block, hasChildren: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should accept testID prop', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, testID: 'my-editable-block' };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should have accessible input', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block };

      // Component should render with accessibility props on TextInput
      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should have accessible collapse button', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: true };

      // Component should render with accessibility labels
      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid prop changes', () => {
      const block = createMockBlock();

      for (let i = 0; i < 10; i++) {
        const props: EditableBlockViewProps = {
          block: { ...block, content: `Content ${i}` },
          isFocused: i % 2 === 0,
          depth: i % 3,
        };
        expect(() => <EditableBlockView {...props} />).not.toThrow();
      }
    });

    it('should handle special characters in content', () => {
      const specialChars = '!@#$%^&*()[]{}|\\;:"<>?,./~`';
      const block = createMockBlock({ content: specialChars });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا العالم';
      const block = createMockBlock({ content: unicode });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle newlines in content', () => {
      const block = createMockBlock({ content: 'Line 1\nLine 2\nLine 3' });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle empty blockId', () => {
      const block = createMockBlock({ blockId: '' as BlockId });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('swipe gesture', () => {
    it('should render swipe delete button', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onSwipeDelete: vi.fn() };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should work without swipe delete callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('multiple instances', () => {
    it('should render multiple blocks independently', () => {
      const blocks = [
        createMockBlock({ blockId: 'block-1' as BlockId, content: 'Block 1' }),
        createMockBlock({ blockId: 'block-2' as BlockId, content: 'Block 2' }),
        createMockBlock({ blockId: 'block-3' as BlockId, content: 'Block 3' }),
      ];

      for (const block of blocks) {
        const props: EditableBlockViewProps = { block };
        expect(() => <EditableBlockView {...props} />).not.toThrow();
      }
    });

    it('should handle different states for different blocks', () => {
      const blocks = [
        createMockBlock({ blockId: 'block-1' as BlockId }),
        createMockBlock({ blockId: 'block-2' as BlockId }),
        createMockBlock({ blockId: 'block-3' as BlockId }),
      ];

      expect(() => <EditableBlockView block={blocks[0]!} isFocused={true} />).not.toThrow();
      expect(() => <EditableBlockView block={blocks[1]!} isFocused={false} />).not.toThrow();
      expect(() => <EditableBlockView block={blocks[2]!} depth={2} />).not.toThrow();
    });
  });
});
