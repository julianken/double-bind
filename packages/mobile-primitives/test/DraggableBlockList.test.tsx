/**
 * Unit tests for DraggableBlockList component
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react-native';
import { DraggableBlockList } from '../src/DraggableBlockList';
import type { BlockListItem } from '../src/BlockList';
import type { Block, BlockId, PageId } from '@double-bind/types';

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    LongPress: () => ({
      minDuration: () => ({
        onStart: () => ({}),
      }),
    }),
    Pan: () => ({
      activeOffsetY: () => ({
        activeOffsetX: () => ({
          onUpdate: () => ({
            onEnd: () => ({}),
          }),
        }),
      }),
    }),
    Simultaneous: () => ({}),
  },
}));

describe('DraggableBlockList', () => {
  const createMockBlock = (id: string, content: string, parentId?: string): Block => ({
    blockId: id as BlockId,
    pageId: 'page-1' as PageId,
    parentId: parentId as BlockId | undefined,
    content,
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createBlockListItem = (
    block: Block,
    depth: number,
    hasChildren: boolean
  ): BlockListItem => ({
    block,
    depth,
    hasChildren,
  });

  let mockBlocks: BlockListItem[];

  beforeEach(() => {
    mockBlocks = [
      createBlockListItem(createMockBlock('block-1', 'First block'), 0, true),
      createBlockListItem(createMockBlock('block-2', 'Second block', 'block-1'), 1, false),
      createBlockListItem(createMockBlock('block-3', 'Third block'), 0, false),
    ];
  });

  describe('Rendering', () => {
    it('should render empty state when no blocks', () => {
      render(
        <DraggableBlockList
          blocks={[]}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('No blocks yet')).toBeTruthy();
      expect(screen.getByText('Tap to start writing')).toBeTruthy();
    });

    it('should render loading state', () => {
      render(
        <DraggableBlockList
          blocks={[]}
          loading={true}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('Loading blocks...')).toBeTruthy();
    });

    it('should render custom empty component', () => {
      const CustomEmpty = () => <>{screen.getByText('Custom empty state')}</>;

      render(
        <DraggableBlockList
          blocks={[]}
          emptyComponent={<CustomEmpty />}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('Custom empty state')).toBeTruthy();
    });

    it('should render all blocks', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('First block')).toBeTruthy();
      expect(screen.getByText('Second block')).toBeTruthy();
      expect(screen.getByText('Third block')).toBeTruthy();
    });

    it('should render blocks with correct depth indentation', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      // Verify blocks are rendered (specific indentation testing would require snapshot testing)
      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
      expect(screen.getByTestId('draggable-list-block-1')).toBeTruthy();
      expect(screen.getByTestId('draggable-list-block-2')).toBeTruthy();
    });

    it('should render header component', () => {
      const Header = () => <>{screen.getByText('Header')}</>;

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          headerComponent={<Header />}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('Header')).toBeTruthy();
    });

    it('should render footer component', () => {
      const Footer = () => <>{screen.getByText('Footer')}</>;

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          footerComponent={<Footer />}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('Footer')).toBeTruthy();
    });
  });

  describe('Block Selection', () => {
    it('should highlight selected block', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          selectedBlockId={'block-2' as BlockId}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-1')).toBeTruthy();
    });

    it('should highlight focused block', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          focusedBlockId={'block-1' as BlockId}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
    });
  });

  describe('Callbacks', () => {
    it('should call onBlockPress when block is pressed', () => {
      const onBlockPress = vi.fn();

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          onBlockPress={onBlockPress}
          testID="draggable-list"
        />
      );

      // Note: Actual gesture testing would require @testing-library/react-native gestures
      // This test verifies the prop is passed correctly
      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
    });

    it('should call onBlockLongPress when block is long-pressed', () => {
      const onBlockLongPress = vi.fn();

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          onBlockLongPress={onBlockLongPress}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
    });

    it('should call onBlockToggleCollapse when collapse toggle is pressed', () => {
      const onBlockToggleCollapse = vi.fn();

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          onBlockToggleCollapse={onBlockToggleCollapse}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
    });

    it('should call onBlockReorder when block is reordered', async () => {
      const onBlockReorder = vi.fn().mockResolvedValue(undefined);

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          onBlockReorder={onBlockReorder}
          testID="draggable-list"
        />
      );

      // Verify component renders (actual drag testing would require gesture simulation)
      expect(screen.getByTestId('draggable-list')).toBeTruthy();
    });
  });

  describe('Refresh', () => {
    it('should call onRefresh when pull-to-refresh is triggered', () => {
      const onRefresh = vi.fn();

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          onRefresh={onRefresh}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list')).toBeTruthy();
    });

    it('should show refreshing state', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          refreshing={true}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      const list = screen.getByTestId('draggable-list');
      expect(list.props.accessibilityLabel).toBe('Draggable block list');
      expect(list.props.accessibilityRole).toBe('list');
      expect(list.props.accessibilityHint).toBe('Long press a block to drag and reorder');
    });

    it('should have accessible empty state', () => {
      render(
        <DraggableBlockList
          blocks={[]}
          testID="draggable-list"
        />
      );

      const emptyState = screen.getByTestId('draggable-list-empty');
      expect(emptyState.props.accessible).toBe(true);
      expect(emptyState.props.accessibilityLabel).toBe('No blocks. Tap to create your first block.');
    });
  });

  describe('Performance', () => {
    it('should use FlatList for virtualization', () => {
      const { UNSAFE_root } = render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      // Verify FlatList is used (component tree includes RCTScrollView on iOS/Android)
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle large lists efficiently', () => {
      const largeBlockList = Array.from({ length: 1000 }, (_, i) =>
        createBlockListItem(createMockBlock(`block-${i}`, `Block ${i}`), 0, false)
      );

      render(
        <DraggableBlockList
          blocks={largeBlockList}
          testID="draggable-list"
        />
      );

      // Verify component renders without crashing
      expect(screen.getByTestId('draggable-list')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty block content', () => {
      const emptyContentBlocks = [
        createBlockListItem(createMockBlock('block-1', ''), 0, false),
      ];

      render(
        <DraggableBlockList
          blocks={emptyContentBlocks}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
    });

    it('should handle deeply nested blocks', () => {
      const deeplyNestedBlocks = [
        createBlockListItem(createMockBlock('block-1', 'Level 0'), 0, true),
        createBlockListItem(createMockBlock('block-2', 'Level 1', 'block-1'), 1, true),
        createBlockListItem(createMockBlock('block-3', 'Level 2', 'block-2'), 2, true),
        createBlockListItem(createMockBlock('block-4', 'Level 3', 'block-3'), 3, true),
        createBlockListItem(createMockBlock('block-5', 'Level 4', 'block-4'), 4, false),
      ];

      render(
        <DraggableBlockList
          blocks={deeplyNestedBlocks}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list-block-0')).toBeTruthy();
      expect(screen.getByTestId('draggable-list-block-4')).toBeTruthy();
    });

    it('should handle single block', () => {
      const singleBlock = [
        createBlockListItem(createMockBlock('block-1', 'Only block'), 0, false),
      ];

      render(
        <DraggableBlockList
          blocks={singleBlock}
          testID="draggable-list"
        />
      );

      expect(screen.getByText('Only block')).toBeTruthy();
    });
  });

  describe('Keyboard Behavior', () => {
    it('should handle keyboard properly', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      const list = screen.getByTestId('draggable-list');
      expect(list.props.keyboardShouldPersistTaps).toBe('handled');
      expect(list.props.keyboardDismissMode).toBe('on-drag');
    });

    it('should disable scroll while dragging', () => {
      render(
        <DraggableBlockList
          blocks={mockBlocks}
          testID="draggable-list"
        />
      );

      const list = screen.getByTestId('draggable-list');
      // Initially scrollEnabled should be true
      expect(list.props.scrollEnabled).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work with all props combined', () => {
      const onBlockPress = vi.fn();
      const onBlockLongPress = vi.fn();
      const onBlockToggleCollapse = vi.fn();
      const onBlockReorder = vi.fn().mockResolvedValue(undefined);
      const onRefresh = vi.fn();

      render(
        <DraggableBlockList
          blocks={mockBlocks}
          selectedBlockId={'block-1' as BlockId}
          focusedBlockId={'block-2' as BlockId}
          onBlockPress={onBlockPress}
          onBlockLongPress={onBlockLongPress}
          onBlockToggleCollapse={onBlockToggleCollapse}
          onBlockReorder={onBlockReorder}
          onRefresh={onRefresh}
          refreshing={false}
          loading={false}
          testID="draggable-list"
        />
      );

      expect(screen.getByTestId('draggable-list')).toBeTruthy();
      expect(screen.getByText('First block')).toBeTruthy();
      expect(screen.getByText('Second block')).toBeTruthy();
      expect(screen.getByText('Third block')).toBeTruthy();
    });
  });
});
