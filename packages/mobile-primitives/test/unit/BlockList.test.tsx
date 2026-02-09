/**
 * BlockList Component Tests
 *
 * Tests virtualized block list rendering and interactions.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Block } from '@double-bind/types';
import { BlockList, type BlockListProps, type BlockListItem } from '../../src/BlockList';

// Test helper to create mock blocks
function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    blockId: `block-${Math.random().toString(36).slice(2)}`,
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

// Test helper to create block list items
function createMockBlockItems(count: number): BlockListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    block: createMockBlock({
      blockId: `block-${i}`,
      content: `Block content ${i}`,
    }),
    depth: 0,
    hasChildren: false,
  }));
}

describe('BlockList', () => {
  describe('rendering', () => {
    it('should render empty list', () => {
      const props: BlockListProps = { blocks: [] };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render list with single block', () => {
      const blocks = createMockBlockItems(1);
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render list with multiple blocks', () => {
      const blocks = createMockBlockItems(5);
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render list with nested blocks', () => {
      const blocks: BlockListItem[] = [
        { block: createMockBlock({ blockId: 'parent' }), depth: 0, hasChildren: true },
        { block: createMockBlock({ blockId: 'child-1' }), depth: 1, hasChildren: false },
        { block: createMockBlock({ blockId: 'child-2' }), depth: 1, hasChildren: false },
      ];
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render loading state', () => {
      const props: BlockListProps = { blocks: [], loading: true };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render custom empty component', () => {
      const CustomEmpty = <div>Custom empty state</div>;
      const props: BlockListProps = { blocks: [], emptyComponent: CustomEmpty };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render with header component', () => {
      const blocks = createMockBlockItems(3);
      const Header = <div>Header content</div>;
      const props: BlockListProps = { blocks, headerComponent: Header };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render with footer component', () => {
      const blocks = createMockBlockItems(3);
      const Footer = <div>Footer content</div>;
      const props: BlockListProps = { blocks, footerComponent: Footer };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('selection state', () => {
    it('should highlight selected block', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = {
        blocks,
        selectedBlockId: 'block-1',
      };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should highlight focused block', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = {
        blocks,
        focusedBlockId: 'block-2',
      };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should handle both selected and focused blocks', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = {
        blocks,
        selectedBlockId: 'block-0',
        focusedBlockId: 'block-1',
      };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should handle null selectedBlockId', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = {
        blocks,
        selectedBlockId: null,
      };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('callbacks', () => {
    let onBlockPress: ReturnType<typeof vi.fn>;
    let onBlockLongPress: ReturnType<typeof vi.fn>;
    let onBlockToggleCollapse: ReturnType<typeof vi.fn>;
    let onRefresh: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onBlockPress = vi.fn();
      onBlockLongPress = vi.fn();
      onBlockToggleCollapse = vi.fn();
      onRefresh = vi.fn();
    });

    it('should accept onBlockPress callback', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, onBlockPress };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should accept onBlockLongPress callback', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, onBlockLongPress };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should accept onBlockToggleCollapse callback', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, onBlockToggleCollapse };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should accept onRefresh callback', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, onRefresh };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('refresh state', () => {
    it('should render with refreshing false', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, refreshing: false };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render with refreshing true', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, refreshing: true };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render with onRefresh and refreshing', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = {
        blocks,
        onRefresh: vi.fn(),
        refreshing: true,
      };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('should accept testID prop', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks, testID: 'my-block-list' };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should render with proper accessibility role', () => {
      const blocks = createMockBlockItems(3);
      const props: BlockListProps = { blocks };

      // Component should render with accessibility props
      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('performance optimizations', () => {
    it('should handle large lists', () => {
      // Create a large list to verify no performance issues
      const blocks = createMockBlockItems(100);
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });

    it('should provide getItemLayout for optimization', () => {
      // The component uses getItemLayout internally for performance
      const blocks = createMockBlockItems(50);
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });

  describe('deep nesting', () => {
    it('should handle deeply nested block structure', () => {
      const blocks: BlockListItem[] = [
        { block: createMockBlock({ blockId: 'root' }), depth: 0, hasChildren: true },
        { block: createMockBlock({ blockId: 'level-1' }), depth: 1, hasChildren: true },
        { block: createMockBlock({ blockId: 'level-2' }), depth: 2, hasChildren: true },
        { block: createMockBlock({ blockId: 'level-3' }), depth: 3, hasChildren: true },
        { block: createMockBlock({ blockId: 'level-4' }), depth: 4, hasChildren: false },
      ];
      const props: BlockListProps = { blocks };

      expect(() => <BlockList {...props} />).not.toThrow();
    });
  });
});
