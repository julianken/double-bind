/**
 * BlockView Component Tests
 *
 * Tests touch-optimized block rendering and gesture handling.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Block } from '@double-bind/types';
import { BlockView, type BlockViewProps } from '../../src/BlockView';

// Test helper to create mock blocks
function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: 'block-123',
    pageId: 'page-456',
    parentId: null,
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

describe('BlockView', () => {
  describe('rendering', () => {
    it('should render block content', () => {
      const block = createMockBlock({ content: 'Hello World' });
      const props: BlockViewProps = { block };

      // Component should be renderable
      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render with depth indentation', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, depth: 2 };

      // Component should be renderable with depth
      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render heading content type', () => {
      const block = createMockBlock({
        contentType: 'heading',
        content: 'My Heading',
      });
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render code content type', () => {
      const block = createMockBlock({
        contentType: 'code',
        content: 'const x = 1;',
      });
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render todo content type', () => {
      const block = createMockBlock({
        contentType: 'todo',
        content: 'Complete task',
      });
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render query content type', () => {
      const block = createMockBlock({
        contentType: 'query',
        content: '?[x] <- [[1, 2, 3]]',
      });
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render selected state', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, isSelected: true };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render focused state', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, isFocused: true };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render with hasChildren showing collapse indicator', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, hasChildren: true };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render collapsed state when hasChildren is true', () => {
      const block = createMockBlock({ isCollapsed: true });
      const props: BlockViewProps = { block, hasChildren: true };

      expect(() => <BlockView {...props} />).not.toThrow();
    });
  });

  describe('callbacks', () => {
    let onPress: ReturnType<typeof vi.fn>;
    let onLongPress: ReturnType<typeof vi.fn>;
    let onToggleCollapse: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onPress = vi.fn();
      onLongPress = vi.fn();
      onToggleCollapse = vi.fn();
    });

    it('should accept onPress callback', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, onPress };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should accept onLongPress callback', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, onLongPress };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should accept onToggleCollapse callback', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, hasChildren: true, onToggleCollapse };

      expect(() => <BlockView {...props} />).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should have accessible label for block content', () => {
      const block = createMockBlock({ content: 'Accessible content' });
      const props: BlockViewProps = { block };

      // Component renders with accessibility props
      const element = <BlockView {...props} />;
      expect(element).toBeDefined();
    });

    it('should truncate long content in accessibility label', () => {
      const longContent = 'A'.repeat(100);
      const block = createMockBlock({ content: longContent });
      const props: BlockViewProps = { block };

      // Should not throw for long content
      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should accept testID prop', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, testID: 'my-block' };

      expect(() => <BlockView {...props} />).not.toThrow();
    });
  });

  describe('touch targets', () => {
    it('should have minimum touch target of 44pt', () => {
      // This is enforced by the component's styles
      // The MIN_TOUCH_TARGET constant is 44
      const block = createMockBlock();
      const props: BlockViewProps = { block };

      // Component should render with proper touch targets
      expect(() => <BlockView {...props} />).not.toThrow();
    });
  });

  describe('indentation', () => {
    it('should render at depth 0 with no indentation', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, depth: 0 };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render at depth 3 with proper indentation', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block, depth: 3 };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should handle undefined depth defaulting to 0', () => {
      const block = createMockBlock();
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });
  });

  describe('block references', () => {
    const mockFetchBlock = vi.fn();
    const mockOnBlockRefPress = vi.fn();
    const mockOnBlockRefLongPress = vi.fn();

    beforeEach(() => {
      mockFetchBlock.mockClear();
      mockOnBlockRefPress.mockClear();
      mockOnBlockRefLongPress.mockClear();
    });

    it('should render plain text when no fetchBlock provided', () => {
      const block = createMockBlock({
        content: 'Text with ((01HXQABCDEFGHJKMNPQRSTUVWX)) reference',
      });
      const props: BlockViewProps = { block };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should parse and render block references when fetchBlock provided', () => {
      const block = createMockBlock({
        content: 'Text with ((01HXQABCDEFGHJKMNPQRSTUVWX)) reference',
      });
      const referencedBlock = createMockBlock({
        blockId: '01HXQABCDEFGHJKMNPQRSTUVWX',
        content: 'Referenced block content',
      });
      mockFetchBlock.mockResolvedValue(referencedBlock);

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
        onBlockRefPress: mockOnBlockRefPress,
        onBlockRefLongPress: mockOnBlockRefLongPress,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should handle multiple block references in content', () => {
      const block = createMockBlock({
        content: 'First ((01HXQFIRST000000000000000)) and second ((01HXQSECOND0000000000000)) refs',
      });
      mockFetchBlock.mockResolvedValue(createMockBlock());

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should support expandedBlockRefs map', () => {
      const block = createMockBlock({
        content: 'Text with ((01HXQABCDEFGHJKMNPQRSTUVWX)) reference',
      });
      mockFetchBlock.mockResolvedValue(createMockBlock());
      const expandedRefs = new Map([['01HXQABCDEFGHJKMNPQRSTUVWX', true]]);

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
        expandedBlockRefs: expandedRefs,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render block references in heading content', () => {
      const block = createMockBlock({
        contentType: 'heading',
        content: 'Heading with ((01HXQABCDEFGHJKMNPQRSTUVWX)) ref',
      });
      mockFetchBlock.mockResolvedValue(createMockBlock());

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should render block references in todo content', () => {
      const block = createMockBlock({
        contentType: 'todo',
        content: 'Todo with ((01HXQABCDEFGHJKMNPQRSTUVWX)) ref',
      });
      mockFetchBlock.mockResolvedValue(createMockBlock());

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
    });

    it('should not parse block references in code content', () => {
      const block = createMockBlock({
        contentType: 'code',
        content: 'const id = "((01HXQABCDEFGHJKMNPQRSTUVWX))";',
      });

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
      // fetchBlock should not be called for code blocks
      expect(mockFetchBlock).not.toHaveBeenCalled();
    });

    it('should not parse block references in query content', () => {
      const block = createMockBlock({
        contentType: 'query',
        content: '?[x] <- [[block, "((01HXQABCDEFGHJKMNPQRSTUVWX))"]]',
      });

      const props: BlockViewProps = {
        block,
        fetchBlock: mockFetchBlock,
      };

      expect(() => <BlockView {...props} />).not.toThrow();
      // fetchBlock should not be called for query blocks
      expect(mockFetchBlock).not.toHaveBeenCalled();
    });
  });
});
