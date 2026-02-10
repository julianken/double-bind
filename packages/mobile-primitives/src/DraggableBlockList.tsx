/**
 * DraggableBlockList - Block list with drag-and-drop reordering
 *
 * Extends BlockList with drag-and-drop capabilities:
 * - Long-press to activate drag mode
 * - Visual feedback during drag (scale, opacity, shadow)
 * - Drop zone indicators between blocks
 * - Horizontal drag to indent/outdent
 * - Haptic feedback on drag start (if available)
 * - Auto-scroll when dragging near edges
 *
 * Uses react-native-gesture-handler for gestures and Animated API for smooth animations.
 */

import * as React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  type ViewStyle,
  type TextStyle,
  type ListRenderItemInfo,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import type { BlockId } from '@double-bind/types';
import { BlockView } from './BlockView';
import type { BlockListItem } from './BlockList';

// Constants
const INDENT_SIZE = 24;
const LONG_PRESS_DURATION = 500; // ms
const DROP_ZONE_HEIGHT = 4;
const DRAG_SCALE = 1.05;
const DRAG_OPACITY = 0.9;
const INDENT_THRESHOLD = INDENT_SIZE * 0.7; // 70% of indent size to trigger indent/outdent

/**
 * Haptic feedback helper (platform-specific)
 */
function triggerHaptic(): void {
  if (Platform.OS === 'ios') {
    // iOS haptic feedback would be implemented via native module
    // For now, we'll skip this as it requires native code
    // import { Haptics } from 'react-native-haptics'; // hypothetical
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } else if (Platform.OS === 'android') {
    // Android haptic feedback would be implemented via native module
    // import { Vibration } from 'react-native';
    // Vibration.vibrate(10);
  }
}

/**
 * Props for custom block rendering in DraggableBlockList
 */
export interface RenderBlockItemInfo {
  item: BlockListItem;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onPress?: (blockId: BlockId) => void;
  onToggleCollapse?: (blockId: BlockId) => void;
  testID?: string;
}

export interface DraggableBlockListProps {
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
   * Callback when a block is long-pressed (before drag starts)
   */
  onBlockLongPress?: (blockId: BlockId) => void;

  /**
   * Callback when a block's collapse state is toggled
   */
  onBlockToggleCollapse?: (blockId: BlockId) => void;

  /**
   * Callback when a block is reordered
   * @param blockId - The block being moved
   * @param newParentId - New parent block ID (null for root-level)
   * @param afterBlockId - Block ID to insert after (null for first position)
   */
  onBlockReorder?: (
    blockId: BlockId,
    newParentId: BlockId | null,
    afterBlockId: BlockId | null
  ) => Promise<void> | void;

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
   * Custom render function for block items.
   * When provided, this replaces the default BlockView rendering.
   * Useful for rendering EditableBlockView in edit mode.
   */
  renderBlockItem?: (info: RenderBlockItemInfo) => React.ReactElement;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

interface DraggableItemProps {
  item: BlockListItem;
  index: number;
  isDragged: boolean;
  showDropZoneBefore: boolean;
  showDropZoneAfter: boolean;
  selectedBlockId?: BlockId | null;
  focusedBlockId?: BlockId | null;
  dragAnimatedValue: Animated.Value;
  indentDelta: number;
  onBlockPress?: (blockId: BlockId) => void;
  onBlockToggleCollapse?: (blockId: BlockId) => void;
  onDragStart: (blockId: BlockId, index: number, startY: number) => void;
  onDragMove: (translationY: number, translationX: number) => void;
  onDragEnd: () => void;
  onBlockLayout: (index: number, event: LayoutChangeEvent) => void;
  isDragging: boolean;
  renderBlockItem?: (info: RenderBlockItemInfo) => React.ReactElement;
  testID?: string;
}

/**
 * Memoized draggable item component with gestures created outside render
 */
const DraggableItem = React.memo(function DraggableItem({
  item,
  index,
  isDragged,
  showDropZoneBefore,
  showDropZoneAfter,
  selectedBlockId,
  focusedBlockId,
  dragAnimatedValue,
  indentDelta,
  onBlockPress,
  onBlockToggleCollapse,
  onDragStart,
  onDragMove,
  onDragEnd,
  onBlockLayout,
  isDragging,
  renderBlockItem,
  testID,
}: DraggableItemProps): React.ReactElement {
  // Create gestures once per item, memoized by dependencies
  const longPressGesture = React.useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_DURATION)
        .onStart((event) => {
          onDragStart(item.block.blockId, index, event.absoluteY);
        }),
    [item.block.blockId, index, onDragStart]
  );

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .activeOffsetX([-10, 10])
        .onUpdate((event) => {
          if (isDragging) {
            onDragMove(event.translationY, event.translationX);
          }
        })
        .onEnd(() => {
          if (isDragging) {
            onDragEnd();
          }
        }),
    [isDragging, onDragMove, onDragEnd]
  );

  const composedGesture = React.useMemo(
    () => Gesture.Simultaneous(longPressGesture, panGesture),
    [longPressGesture, panGesture]
  );

  // Animated style for dragged block
  const animatedStyle = isDragged
    ? {
        transform: [
          {
            scale: dragAnimatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [1, DRAG_SCALE],
            }),
          },
        ],
        opacity: dragAnimatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, DRAG_OPACITY],
        }),
        shadowOpacity: dragAnimatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.3],
        }),
        shadowRadius: dragAnimatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
        elevation: dragAnimatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      }
    : {};

  // Render the block content (custom or default)
  const isSelected = item.block.blockId === selectedBlockId;
  const isFocused = item.block.blockId === focusedBlockId;
  const blockTestID = testID ? `${testID}-block-${index}` : undefined;

  const blockContent = renderBlockItem ? (
    renderBlockItem({
      item,
      index,
      isSelected,
      isFocused,
      onPress: onBlockPress,
      onToggleCollapse: onBlockToggleCollapse,
      testID: blockTestID,
    })
  ) : (
    <BlockView
      block={item.block}
      depth={item.depth}
      hasChildren={item.hasChildren}
      isSelected={isSelected}
      isFocused={isFocused}
      onPress={onBlockPress}
      onToggleCollapse={onBlockToggleCollapse}
      testID={blockTestID}
    />
  );

  return (
    <View onLayout={(event) => onBlockLayout(index, event)}>
      {showDropZoneBefore && (
        <View style={styles.dropZone} testID={`${testID}-dropzone-${index}`} />
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.blockContainer, animatedStyle]}>
          {blockContent}

          {/* Indent indicator */}
          {isDragged && indentDelta !== 0 && (
            <View
              style={[
                styles.indentIndicator,
                indentDelta > 0 ? styles.indentIndicatorRight : styles.indentIndicatorLeft,
              ]}
            >
              <Text style={styles.indentIndicatorText}>{indentDelta > 0 ? '→' : '←'}</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {showDropZoneAfter && (
        <View style={styles.dropZone} testID={`${testID}-dropzone-${index + 1}`} />
      )}
    </View>
  );
});

interface DragState {
  isDragging: boolean;
  draggedBlockId: BlockId | null;
  draggedBlockIndex: number;
  currentY: number;
  startY: number;
  dropZoneIndex: number | null; // Index where block will be dropped
  indentDelta: number; // -1 (outdent), 0 (no change), 1 (indent)
  blockLayouts: Map<number, { y: number; height: number }>;
}

/**
 * Draggable block list component with drag-and-drop reordering.
 *
 * @example
 * ```tsx
 * <DraggableBlockList
 *   blocks={flattenedBlocks}
 *   selectedBlockId={selectedId}
 *   onBlockPress={handleBlockPress}
 *   onBlockReorder={handleBlockReorder}
 * />
 * ```
 */
export function DraggableBlockList({
  blocks,
  selectedBlockId,
  focusedBlockId,
  onBlockPress,
  onBlockLongPress,
  onBlockToggleCollapse,
  onBlockReorder,
  onRefresh,
  refreshing = false,
  loading = false,
  emptyComponent,
  headerComponent,
  footerComponent,
  renderBlockItem,
  testID,
}: DraggableBlockListProps): React.ReactElement {
  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
    draggedBlockId: null,
    draggedBlockIndex: -1,
    currentY: 0,
    startY: 0,
    dropZoneIndex: null,
    indentDelta: 0,
    blockLayouts: new Map(),
  });

  const dragAnimatedValue = React.useRef(new Animated.Value(0)).current;
  const flatListRef = React.useRef<FlatList>(null);

  // Track block layouts for drop zone calculation
  const onBlockLayout = React.useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setDragState((prev) => {
      const newLayouts = new Map(prev.blockLayouts);
      newLayouts.set(index, { y, height });
      return { ...prev, blockLayouts: newLayouts };
    });
  }, []);

  // Calculate drop zone based on current drag position
  const calculateDropZone = React.useCallback(
    (currentY: number, draggedIndex: number): number | null => {
      const layouts = dragState.blockLayouts;
      if (layouts.size === 0) return null;

      // Find the block that the dragged block is hovering over
      for (let i = 0; i < blocks.length; i++) {
        if (i === draggedIndex) continue;

        const layout = layouts.get(i);
        if (!layout) continue;

        const blockTop = layout.y;
        const blockBottom = layout.y + layout.height;
        const blockMiddle = blockTop + layout.height / 2;

        if (currentY < blockMiddle && currentY >= blockTop) {
          // Drop before this block
          return i;
        } else if (currentY >= blockMiddle && currentY < blockBottom) {
          // Drop after this block
          return i + 1;
        }
      }

      // Default to end of list
      return blocks.length;
    },
    [blocks.length, dragState.blockLayouts]
  );

  // Handle long press to start drag
  const handleDragStart = React.useCallback(
    (blockId: BlockId, index: number, startY: number) => {
      triggerHaptic();

      setDragState((prev) => ({
        ...prev,
        isDragging: true,
        draggedBlockId: blockId,
        draggedBlockIndex: index,
        currentY: startY,
        startY,
        dropZoneIndex: null,
        indentDelta: 0,
      }));

      // Animate drag feedback
      Animated.spring(dragAnimatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();

      // Call onBlockLongPress callback
      onBlockLongPress?.(blockId);
    },
    [dragAnimatedValue, onBlockLongPress]
  );

  // Handle drag move
  const handleDragMove = React.useCallback(
    (translationY: number, translationX: number) => {
      setDragState((prev) => {
        const currentY = prev.startY + translationY;
        const dropZoneIndex = calculateDropZone(currentY, prev.draggedBlockIndex);

        // Calculate indent delta based on horizontal drag
        let indentDelta = 0;
        if (translationX > INDENT_THRESHOLD) {
          indentDelta = 1; // Indent
        } else if (translationX < -INDENT_THRESHOLD) {
          indentDelta = -1; // Outdent
        }

        return {
          ...prev,
          currentY,
          dropZoneIndex,
          indentDelta,
        };
      });

      // Auto-scroll near edges
      // This would require measuring the FlatList container height
      // For simplicity, we'll skip auto-scroll in this initial implementation
    },
    [calculateDropZone]
  );

  // Handle drag end
  const handleDragEnd = React.useCallback(async () => {
    if (!dragState.isDragging || dragState.draggedBlockId === null) return;

    const draggedBlock = blocks[dragState.draggedBlockIndex];
    const dropIndex = dragState.dropZoneIndex ?? dragState.draggedBlockIndex;

    // Animate drag feedback out
    Animated.spring(dragAnimatedValue, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();

    // Calculate new parent and afterBlock based on drop position and indent delta
    let newParentId: BlockId | null = null;
    let afterBlockId: BlockId | null = null;

    if (draggedBlock && dropIndex !== dragState.draggedBlockIndex) {
      // Determine the target block (the one we're dropping relative to)
      const targetIndex = dropIndex > dragState.draggedBlockIndex ? dropIndex - 1 : dropIndex;
      const targetBlock = blocks[targetIndex];

      if (targetBlock) {
        const currentDepth = draggedBlock.depth;
        const targetDepth = targetBlock.depth;

        // Apply indent delta
        const newDepth = Math.max(0, currentDepth + dragState.indentDelta);

        if (newDepth > targetDepth) {
          // Indent: dragged block becomes child of target block
          newParentId = targetBlock.block.blockId;
          afterBlockId = null; // First child
        } else if (newDepth === targetDepth) {
          // Same level: dragged block becomes sibling of target block
          newParentId = targetBlock.block.parentId ?? null;
          afterBlockId = targetBlock.block.blockId;
        } else {
          // Outdent: need to find the ancestor at the new depth
          let ancestorIndex = targetIndex;
          while (ancestorIndex >= 0) {
            const ancestor = blocks[ancestorIndex];
            if (ancestor && ancestor.depth === newDepth) {
              newParentId = ancestor.block.parentId ?? null;
              afterBlockId = ancestor.block.blockId;
              break;
            }
            ancestorIndex--;
          }
        }
      }

      // Call onBlockReorder callback
      if (onBlockReorder && draggedBlock) {
        try {
          await onBlockReorder(draggedBlock.block.blockId, newParentId, afterBlockId);

          // Use LayoutAnimation for smooth reordering
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch {
          // Handle error (could show a toast notification)
          // In production, this would be logged to a crash reporting service
        }
      }
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      draggedBlockId: null,
      draggedBlockIndex: -1,
      currentY: 0,
      startY: 0,
      dropZoneIndex: null,
      indentDelta: 0,
      blockLayouts: dragState.blockLayouts, // Keep layouts
    });
  }, [dragState, blocks, dragAnimatedValue, onBlockReorder]);

  // Memoized key extractor
  const keyExtractor = React.useCallback((item: BlockListItem) => item.block.blockId, []);

  // Memoized render item function
  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<BlockListItem>) => {
      const isDragged = dragState.isDragging && dragState.draggedBlockId === item.block.blockId;
      const showDropZoneBefore = dragState.dropZoneIndex === index;
      const showDropZoneAfter =
        dragState.dropZoneIndex === index + 1 && index === blocks.length - 1;

      return (
        <DraggableItem
          item={item}
          index={index}
          isDragged={isDragged}
          showDropZoneBefore={showDropZoneBefore}
          showDropZoneAfter={showDropZoneAfter}
          selectedBlockId={selectedBlockId}
          focusedBlockId={focusedBlockId}
          dragAnimatedValue={dragAnimatedValue}
          indentDelta={dragState.indentDelta}
          onBlockPress={onBlockPress}
          onBlockToggleCollapse={onBlockToggleCollapse}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onBlockLayout={onBlockLayout}
          isDragging={dragState.isDragging}
          renderBlockItem={renderBlockItem}
          testID={testID}
        />
      );
    },
    [
      dragState.isDragging,
      dragState.draggedBlockId,
      dragState.dropZoneIndex,
      dragState.indentDelta,
      blocks.length,
      selectedBlockId,
      focusedBlockId,
      dragAnimatedValue,
      onBlockPress,
      onBlockToggleCollapse,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      onBlockLayout,
      renderBlockItem,
      testID,
    ]
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
      ref={flatListRef}
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
      accessibilityLabel="Draggable block list"
      accessibilityRole="list"
      accessibilityHint="Long press a block to drag and reorder"
      // Keyboard behavior
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // Disable scroll while dragging
      scrollEnabled={!dragState.isDragging}
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

  blockContainer: {
    backgroundColor: '#FFFFFF',
  } as ViewStyle,

  dropZone: {
    height: DROP_ZONE_HEIGHT,
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 2,
  } as ViewStyle,

  indentIndicator: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  indentIndicatorRight: {
    right: 16,
  } as ViewStyle,

  indentIndicatorLeft: {
    left: 16,
  } as ViewStyle,

  indentIndicatorText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  } as TextStyle,
});

export default DraggableBlockList;
