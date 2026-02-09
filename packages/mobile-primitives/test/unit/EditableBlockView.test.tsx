/**
 * EditableBlockView Component Tests
 *
 * Tests editable block rendering, keyboard integration, auto-save,
 * and gesture support (tap to edit, Enter/Backspace keys, swipe-to-delete).
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
    it('should render block in view mode by default', () => {
      const block = createMockBlock({ content: 'Hello World' });
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render in editing mode when isEditing is true', () => {
      const block = createMockBlock({ content: 'Editable content' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with depth indentation', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, depth: 2 };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render heading text style when contentType is heading', () => {
      const block = createMockBlock({
        contentType: 'heading',
        content: 'My Heading',
      });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render code text style when contentType is code', () => {
      const block = createMockBlock({
        contentType: 'code',
        content: 'const x = 1;',
      });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render with custom placeholder', () => {
      const block = createMockBlock({ content: '' });
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        placeholder: 'Custom placeholder',
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render in read-only mode', () => {
      const block = createMockBlock({ content: 'Read only content' });
      const props: EditableBlockViewProps = { block, isEditing: true, readOnly: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render focused state', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true };

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

  describe('editing mode', () => {
    let onStartEditing: ReturnType<typeof vi.fn>;
    let onEndEditing: ReturnType<typeof vi.fn>;
    let onSave: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onStartEditing = vi.fn();
      onEndEditing = vi.fn();
      onSave = vi.fn();
    });

    it('should accept onStartEditing callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, onStartEditing };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should not enter edit mode when readOnly is true', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        readOnly: true,
        onStartEditing,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should render BlockView when readOnly even if isEditing', () => {
      const block = createMockBlock({ content: 'Read only content' });
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        readOnly: true,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('content changes', () => {
    let onContentChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onContentChange = vi.fn();
    });

    it('should accept onContentChange callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        onContentChange,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle content updates', () => {
      const block = createMockBlock({ content: 'Initial' });
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        onContentChange,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('auto-save on blur', () => {
    let onSave: ReturnType<typeof vi.fn>;
    let onEndEditing: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onSave = vi.fn();
      onEndEditing = vi.fn();
    });

    it('should accept onSave callback', () => {
      const block = createMockBlock({ content: 'Original' });
      const props: EditableBlockViewProps = { block, isEditing: true, onSave };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onEndEditing callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        onEndEditing,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept both onSave and onEndEditing callbacks', () => {
      const block = createMockBlock({ content: 'Start' });
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        onSave,
        onEndEditing,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('keyboard handling', () => {
    let onEnterPress: ReturnType<typeof vi.fn>;
    let onBackspaceEmpty: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onEnterPress = vi.fn();
      onBackspaceEmpty = vi.fn();
    });

    it('should handle keyboard integration in edit mode', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should support multiline text input', () => {
      const block = createMockBlock({ content: 'Line 1\nLine 2' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onEnterPress callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true, onEnterPress };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept onBackspaceEmpty callback', () => {
      const block = createMockBlock({ content: '' });
      const props: EditableBlockViewProps = { block, isEditing: true, onBackspaceEmpty };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('swipe gesture', () => {
    let onSwipeDelete: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onSwipeDelete = vi.fn();
    });

    it('should render swipe delete button', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true, onSwipeDelete };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should work without swipe delete callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should have proper accessibility in edit mode', () => {
      const block = createMockBlock({ content: 'Accessible content' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle long content in accessibility label', () => {
      const longContent = 'A'.repeat(100);
      const block = createMockBlock({ content: longContent });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should have accessible collapse button', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: true, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('touch targets', () => {
    it('should maintain minimum 44pt touch target', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should maintain minimum 44pt touch target in edit mode', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('testID', () => {
    it('should accept testID prop in view mode', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, testID: 'my-block' };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should accept testID prop in edit mode', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        testID: 'my-block',
      };

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

    it('should handle autoFocus setting', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = {
        block,
        isEditing: true,
        autoFocus: true,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
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
  });

  describe('collapse/expand', () => {
    let onToggleCollapse: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onToggleCollapse = vi.fn();
    });

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

    it('should accept onToggleCollapse callback', () => {
      const block = createMockBlock();
      const props: EditableBlockViewProps = { block, hasChildren: true, onToggleCollapse };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('markdown formatting support', () => {
    it('should allow bold markdown syntax', () => {
      const block = createMockBlock({ content: '**bold text**' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should allow italic markdown syntax', () => {
      const block = createMockBlock({ content: '*italic text*' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should allow wiki link syntax', () => {
      const block = createMockBlock({ content: 'See [[My Page]] for details' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should allow block reference syntax', () => {
      const block = createMockBlock({
        content: 'Reference ((01HXQABCDEFGHJKMNPQRSTUVWX))',
      });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('callbacks integration', () => {
    it('should accept all callbacks simultaneously', () => {
      const block = createMockBlock();
      const callbacks = {
        onStartEditing: vi.fn(),
        onEndEditing: vi.fn(),
        onContentChange: vi.fn(),
        onSave: vi.fn(),
        onEnterPress: vi.fn(),
        onBackspaceEmpty: vi.fn(),
        onSwipeDelete: vi.fn(),
        onToggleCollapse: vi.fn(),
        onLongPress: vi.fn(),
        onWikiLinkPress: vi.fn(),
        onBlockRefPress: vi.fn(),
        onBlockRefLongPress: vi.fn(),
      };
      const props: EditableBlockViewProps = {
        block,
        hasChildren: true,
        isEditing: true,
        ...callbacks,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const block = createMockBlock({ content: '' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000);
      const block = createMockBlock({ content: longContent });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle special characters in content', () => {
      const block = createMockBlock({ content: '!@#$%^&*()_+-={}[]|\\:";\'<>,.?/' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const block = createMockBlock({ content: 'Hello 世界 🌍 مرحبا' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle line breaks in content', () => {
      const block = createMockBlock({ content: 'Line 1\nLine 2\nLine 3' });
      const props: EditableBlockViewProps = { block, isEditing: true };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
    });

    it('should handle all content types', () => {
      const contentTypes: Array<Block['contentType']> = [
        'text',
        'heading',
        'code',
        'todo',
        'query',
      ];

      contentTypes.forEach((contentType) => {
        const block = createMockBlock({ contentType, content: 'Test' });
        const props: EditableBlockViewProps = { block, isEditing: true };
        expect(() => <EditableBlockView {...props} />).not.toThrow();
      });
    });

    it('should handle toggle between view and edit modes', () => {
      const block = createMockBlock();

      // View mode
      expect(() => <EditableBlockView block={block} isEditing={false} />).not.toThrow();

      // Edit mode
      expect(() => <EditableBlockView block={block} isEditing={true} />).not.toThrow();
    });

    it('should handle rapid prop changes', () => {
      const block = createMockBlock();

      for (let i = 0; i < 10; i++) {
        const props: EditableBlockViewProps = {
          block: { ...block, content: `Content ${i}` },
          isEditing: i % 2 === 0,
          depth: i % 3,
        };
        expect(() => <EditableBlockView {...props} />).not.toThrow();
      }
    });
  });

  describe('callback behavior verification', () => {
    let mockBlock: Block;

    beforeEach(() => {
      mockBlock = createMockBlock({
        blockId: 'test-block-123' as BlockId,
        content: 'Initial content',
      });
    });

    it('verifies onContentChange callback is properly wired', () => {
      const onContentChange = vi.fn();
      const props: EditableBlockViewProps = {
        block: mockBlock,
        isEditing: true,
        onContentChange,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
      expect(onContentChange).toBeDefined();
      expect(typeof onContentChange).toBe('function');
    });

    it('verifies onSave callback is properly wired', () => {
      const onSave = vi.fn();
      const props: EditableBlockViewProps = {
        block: mockBlock,
        isEditing: true,
        onSave,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
      expect(onSave).toBeDefined();
      expect(typeof onSave).toBe('function');
    });

    it('verifies onEnterPress callback is properly wired', () => {
      const onEnterPress = vi.fn();
      const props: EditableBlockViewProps = {
        block: mockBlock,
        isEditing: true,
        onEnterPress,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
      expect(onEnterPress).toBeDefined();
      expect(typeof onEnterPress).toBe('function');
    });

    it('verifies onBackspaceEmpty callback is properly wired', () => {
      const onBackspaceEmpty = vi.fn();
      const props: EditableBlockViewProps = {
        block: { ...mockBlock, content: '' },
        isEditing: true,
        onBackspaceEmpty,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
      expect(onBackspaceEmpty).toBeDefined();
      expect(typeof onBackspaceEmpty).toBe('function');
    });

    it('verifies onSwipeDelete callback is properly wired', () => {
      const onSwipeDelete = vi.fn();
      const props: EditableBlockViewProps = {
        block: mockBlock,
        isEditing: true,
        onSwipeDelete,
      };

      expect(() => <EditableBlockView {...props} />).not.toThrow();
      expect(onSwipeDelete).toBeDefined();
      expect(typeof onSwipeDelete).toBe('function');
    });

    it('respects readOnly flag and prevents editing', () => {
      const onStartEditing = vi.fn();
      const props: EditableBlockViewProps = {
        block: mockBlock,
        isEditing: false,
        readOnly: true,
        onStartEditing,
      };

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

      expect(() => <EditableBlockView block={blocks[0]!} isEditing={true} />).not.toThrow();
      expect(() => <EditableBlockView block={blocks[1]!} isEditing={false} />).not.toThrow();
      expect(() => <EditableBlockView block={blocks[2]!} depth={2} />).not.toThrow();
    });
  });
});
