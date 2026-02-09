/**
 * BlockView - Touch-optimized block component for mobile
 *
 * Renders a single block with proper touch handling:
 * - Tap to focus/edit
 * - Long press for context actions
 * - Minimum 44pt touch targets per iOS Human Interface Guidelines
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/components/menus-and-actions/buttons
 */

import * as React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Pressable, Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Block, BlockId } from '@double-bind/types';

// Minimum touch target size per iOS HIG (44pt)
const MIN_TOUCH_TARGET = 44;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

export interface BlockViewProps {
  /**
   * The block data to render
   */
  block: Block;

  /**
   * Nesting depth for indentation (0 = root level)
   */
  depth?: number;

  /**
   * Whether this block has child blocks
   */
  hasChildren?: boolean;

  /**
   * Whether this block is selected
   */
  isSelected?: boolean;

  /**
   * Whether this block is focused for editing
   */
  isFocused?: boolean;

  /**
   * Callback when block is tapped
   */
  onPress?: (blockId: BlockId) => void;

  /**
   * Callback when block is long-pressed (for context menu)
   */
  onLongPress?: (blockId: BlockId) => void;

  /**
   * Callback when collapse toggle is pressed
   */
  onToggleCollapse?: (blockId: BlockId) => void;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

/**
 * Touch-optimized block component for displaying block content.
 *
 * Features:
 * - Minimum 44pt touch target for accessibility
 * - Visual feedback on press
 * - Gesture handler for tap and long-press
 * - Proper accessibility labels
 *
 * @example
 * ```tsx
 * <BlockView
 *   block={block}
 *   depth={0}
 *   onPress={handlePress}
 *   onLongPress={handleLongPress}
 * />
 * ```
 */
export function BlockView({
  block,
  depth = 0,
  hasChildren = false,
  isSelected = false,
  isFocused = false,
  onPress,
  onLongPress,
  onToggleCollapse,
  testID,
}: BlockViewProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress?.(block.blockId);
  }, [block.blockId, onPress]);

  const handleLongPress = React.useCallback(() => {
    onLongPress?.(block.blockId);
  }, [block.blockId, onLongPress]);

  const handleToggleCollapse = React.useCallback(() => {
    onToggleCollapse?.(block.blockId);
  }, [block.blockId, onToggleCollapse]);

  // Set up gesture handlers
  const tapGesture = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd(handlePress);

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(10)
    .onEnd(handleLongPress);

  // Ensure single tap waits for long press check
  tapGesture.requireExternalGestureToFail(longPressGesture);

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // Calculate indentation
  const marginLeft = depth * INDENT_SIZE;

  // Determine visual state styles
  const containerStyle: ViewStyle[] = [
    styles.container,
    { marginLeft },
    isSelected && styles.containerSelected,
    isFocused && styles.containerFocused,
  ];

  // Render content based on block type
  const renderContent = () => {
    switch (block.contentType) {
      case 'heading':
        return <Text style={styles.headingText}>{block.content}</Text>;
      case 'code':
        return (
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{block.content}</Text>
          </View>
        );
      case 'todo':
        return (
          <View style={styles.todoContainer}>
            <View style={styles.todoCheckbox} />
            <Text style={styles.contentText}>{block.content}</Text>
          </View>
        );
      case 'query':
        return (
          <View style={styles.queryContainer}>
            <Text style={styles.queryLabel}>Query</Text>
            <Text style={styles.codeText}>{block.content}</Text>
          </View>
        );
      default:
        return <Text style={styles.contentText}>{block.content}</Text>;
    }
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={containerStyle}
        testID={testID}
        accessible={true}
        accessibilityLabel={`Block: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`}
        accessibilityHint="Double tap to edit. Long press for more options."
        accessibilityRole="button"
        accessibilityState={{
          selected: isSelected,
          expanded: hasChildren ? !block.isCollapsed : undefined,
        }}
      >
        {/* Bullet/Collapse Toggle */}
        <Pressable
          style={styles.bulletContainer}
          onPress={handleToggleCollapse}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={
            hasChildren ? (block.isCollapsed ? 'Expand block' : 'Collapse block') : 'Block bullet'
          }
          accessibilityRole="button"
          testID={testID ? `${testID}-bullet` : undefined}
        >
          {hasChildren ? (
            <View
              style={[
                styles.collapseTriangle,
                !block.isCollapsed && styles.collapseTriangleExpanded,
              ]}
            />
          ) : (
            <View style={styles.bullet} />
          )}
        </Pressable>

        {/* Block Content */}
        <View style={styles.contentContainer}>{renderContent()}</View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  } as ViewStyle,

  containerSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  } as ViewStyle,

  containerFocused: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderLeftWidth: 2,
    borderLeftColor: '#007AFF',
  } as ViewStyle,

  bulletContainer: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  } as ViewStyle,

  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
  } as ViewStyle,

  collapseTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#8E8E93',
    borderRightColor: 'transparent',
    transform: [{ rotate: '0deg' }],
  } as ViewStyle,

  collapseTriangleExpanded: {
    transform: [{ rotate: '90deg' }],
  } as ViewStyle,

  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET - 16, // Account for padding
  } as ViewStyle,

  contentText: {
    fontSize: 17,
    lineHeight: 22,
    color: '#000000',
  } as TextStyle,

  headingText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    color: '#000000',
  } as TextStyle,

  codeContainer: {
    backgroundColor: '#F5F5F7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  } as ViewStyle,

  codeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
    color: '#1C1C1E',
  } as TextStyle,

  todoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  todoCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8E8E93',
    marginRight: 8,
  } as ViewStyle,

  queryContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
    padding: 8,
  } as ViewStyle,

  queryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  } as TextStyle,
});

export default BlockView;
