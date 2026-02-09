/**
 * BlockList - Virtualized list of blocks for mobile
 *
 * Renders a performant, virtualized list of blocks using FlatList.
 * Optimized for large documents with hundreds of blocks.
 *
 * Features:
 * - Virtualized rendering for performance
 * - Pull-to-refresh support
 * - Empty state handling
 * - Keyboard-aware scrolling
 */

import * as React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type ListRenderItemInfo,
} from 'react-native';
import type { Block, BlockId } from '@double-bind/types';
import { BlockView } from './BlockView';

export interface BlockListItem {
  /**
   * The block data
   */
  block: Block;

  /**
   * Nesting depth for indentation
   */
  depth: number;

  /**
   * Whether this block has children
   */
  hasChildren: boolean;
}

export interface BlockListProps {
  /**
   * Array of blocks to render with their metadata
   */
  blocks: BlockListItem[];

  /**
   * Currently selected block ID
   */
  selectedBlockId?: BlockId | null;

  /**
   * Currently focused block ID
   */
  focusedBlockId?: BlockId | null;

  /**
   * Callback when a block is pressed
   */
  onBlockPress?: (blockId: BlockId) => void;

  /**
   * Callback when a block is long-pressed
   */
  onBlockLongPress?: (blockId: BlockId) => void;

  /**
   * Callback when a block's collapse state is toggled
   */
  onBlockToggleCollapse?: (blockId: BlockId) => void;

  /**
   * Callback for pull-to-refresh
   */
  onRefresh?: () => void;

  /**
   * Whether refresh is in progress
   */
  refreshing?: boolean;

  /**
   * Whether the list is loading initially
   */
  loading?: boolean;

  /**
   * Custom empty state component
   */
  emptyComponent?: React.ReactNode;

  /**
   * Custom header component
   */
  headerComponent?: React.ReactNode;

  /**
   * Custom footer component
   */
  footerComponent?: React.ReactNode;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

/**
 * Virtualized block list component for efficient rendering of many blocks.
 *
 * Uses FlatList for virtualization with optimizations:
 * - Dynamic item measurement (items have variable height due to text wrapping)
 * - Memoized renderItem callback
 * - Proper key extraction
 *
 * @example
 * ```tsx
 * <BlockList
 *   blocks={flattenedBlocks}
 *   selectedBlockId={selectedId}
 *   onBlockPress={handleBlockPress}
 *   onBlockLongPress={handleBlockLongPress}
 * />
 * ```
 */
export function BlockList({
  blocks,
  selectedBlockId,
  focusedBlockId,
  onBlockPress,
  onBlockLongPress,
  onBlockToggleCollapse,
  onRefresh,
  refreshing = false,
  loading = false,
  emptyComponent,
  headerComponent,
  footerComponent,
  testID,
}: BlockListProps): React.ReactElement {
  // Memoized key extractor
  const keyExtractor = React.useCallback((item: BlockListItem) => item.block.blockId, []);

  // Memoized render item function for performance
  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<BlockListItem>) => (
      <BlockView
        block={item.block}
        depth={item.depth}
        hasChildren={item.hasChildren}
        isSelected={item.block.blockId === selectedBlockId}
        isFocused={item.block.blockId === focusedBlockId}
        onPress={onBlockPress}
        onLongPress={onBlockLongPress}
        onToggleCollapse={onBlockToggleCollapse}
        testID={testID ? `${testID}-block-${index}` : undefined}
      />
    ),
    [selectedBlockId, focusedBlockId, onBlockPress, onBlockLongPress, onBlockToggleCollapse, testID]
  );

  // Empty state component
  const ListEmptyComponent = React.useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyContainer} testID={`${testID}-loading`}>
          <Text style={styles.emptyText}>Loading blocks...</Text>
        </View>
      );
    }

    if (emptyComponent) {
      return <>{emptyComponent}</>;
    }

    return (
      <View
        style={styles.emptyContainer}
        testID={`${testID}-empty`}
        accessible={true}
        accessibilityLabel="No blocks. Tap to create your first block."
      >
        <Text style={styles.emptyTitle}>No blocks yet</Text>
        <Text style={styles.emptyText}>Tap to start writing</Text>
      </View>
    );
  }, [loading, emptyComponent, testID]);

  // Header component wrapper
  const ListHeaderComponent = React.useMemo(() => {
    if (!headerComponent) return null;
    return <View style={styles.headerContainer}>{headerComponent}</View>;
  }, [headerComponent]);

  // Footer component wrapper
  const ListFooterComponent = React.useMemo(() => {
    if (!footerComponent) return null;
    return <View style={styles.footerContainer}>{footerComponent}</View>;
  }, [footerComponent]);

  return (
    <FlatList
      data={blocks}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      onRefresh={onRefresh}
      refreshing={refreshing}
      style={styles.list}
      contentContainerStyle={blocks.length === 0 ? styles.emptyList : undefined}
      testID={testID}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={21}
      // Accessibility
      accessible={true}
      accessibilityLabel="Block list"
      accessibilityRole="list"
      // Keyboard behavior
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  } as ViewStyle,

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  } as ViewStyle,

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  } as ViewStyle,

  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,

  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  } as TextStyle,

  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  } as ViewStyle,

  footerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  } as ViewStyle,
});

export default BlockList;
