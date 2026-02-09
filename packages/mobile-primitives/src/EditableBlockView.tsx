/**
 * EditableBlockView - Editable block component with keyboard and gesture support
 *
 * Extends BlockView with editing capabilities:
 * - Enter key creates new block
 * - Backspace/delete removes empty blocks
 * - Swipe-to-delete gesture
 * - Focus management
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/patterns/entering-data
 */

import * as React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { Block, BlockId } from '@double-bind/types';

// Minimum touch target size per iOS HIG (44pt)
const MIN_TOUCH_TARGET = 44;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

// Swipe threshold to trigger delete (in pixels)
const SWIPE_DELETE_THRESHOLD = -80;

export interface EditableBlockViewProps {
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
   * Whether this block is focused for editing
   */
  isFocused?: boolean;

  /**
   * Callback when block content changes
   */
  onContentChange?: (blockId: BlockId, content: string) => void;

  /**
   * Callback when Enter key is pressed (create new block)
   */
  onEnterPress?: (blockId: BlockId) => void;

  /**
   * Callback when Backspace is pressed on empty block (delete block)
   */
  onBackspaceEmpty?: (blockId: BlockId) => void;

  /**
   * Callback when block is swiped to delete
   */
  onSwipeDelete?: (blockId: BlockId) => void;

  /**
   * Callback when block is tapped
   */
  onPress?: (blockId: BlockId) => void;

  /**
   * Callback when collapse toggle is pressed
   */
  onToggleCollapse?: (blockId: BlockId) => void;

  /**
   * Ref to the TextInput for focus management
   */
  inputRef?: React.RefObject<TextInput>;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

/**
 * Editable block component with keyboard and gesture support.
 *
 * Features:
 * - Text editing with auto-focus
 * - Enter key creates new block below
 * - Backspace on empty block deletes it
 * - Swipe left to reveal delete action
 * - Proper touch targets (44pt minimum)
 *
 * @example
 * ```tsx
 * <EditableBlockView
 *   block={block}
 *   depth={0}
 *   isFocused={focusedBlockId === block.blockId}
 *   onContentChange={handleContentChange}
 *   onEnterPress={handleCreateBlock}
 *   onBackspaceEmpty={handleDeleteBlock}
 *   onSwipeDelete={handleSwipeDelete}
 *   inputRef={inputRefs.current.get(block.blockId)}
 * />
 * ```
 */
export function EditableBlockView({
  block,
  depth = 0,
  hasChildren = false,
  isFocused = false,
  onContentChange,
  onEnterPress,
  onBackspaceEmpty,
  onSwipeDelete,
  onPress,
  onToggleCollapse,
  inputRef,
  testID,
}: EditableBlockViewProps): React.ReactElement {
  const [content, setContent] = React.useState(block.content);
  const internalInputRef = React.useRef<TextInput>(null);
  const actualInputRef = inputRef ?? internalInputRef;

  // Swipe animation state
  const translateX = useSharedValue(0);
  const deleteRevealed = useSharedValue(false);

  // Update content when block prop changes
  React.useEffect(() => {
    setContent(block.content);
  }, [block.content]);

  // Auto-focus when isFocused becomes true
  React.useEffect(() => {
    if (isFocused && actualInputRef.current) {
      actualInputRef.current.focus();
    }
  }, [isFocused, actualInputRef]);

  /**
   * Handle content change
   */
  const handleChangeText = React.useCallback(
    (text: string) => {
      setContent(text);
      onContentChange?.(block.blockId, text);
    },
    [block.blockId, onContentChange]
  );

  /**
   * Handle key press events
   */
  const handleKeyPress = React.useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;

      if (key === 'Enter') {
        // Prevent default newline insertion
        e.preventDefault();
        // Create new block
        onEnterPress?.(block.blockId);
      } else if (key === 'Backspace' && content.length === 0) {
        // Delete empty block
        onBackspaceEmpty?.(block.blockId);
      }
    },
    [block.blockId, content.length, onEnterPress, onBackspaceEmpty]
  );

  /**
   * Handle press on the block (for selection)
   */
  const handlePress = React.useCallback(() => {
    onPress?.(block.blockId);
  }, [block.blockId, onPress]);

  /**
   * Handle collapse toggle
   */
  const handleToggleCollapse = React.useCallback(() => {
    onToggleCollapse?.(block.blockId);
  }, [block.blockId, onToggleCollapse]);

  /**
   * Handle swipe delete
   */
  const handleSwipeDelete = React.useCallback(() => {
    onSwipeDelete?.(block.blockId);
  }, [block.blockId, onSwipeDelete]);

  /**
   * Swipe gesture for delete action
   */
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // Only allow swipe left (negative translation)
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, SWIPE_DELETE_THRESHOLD * 1.5);
      }
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_DELETE_THRESHOLD) {
        // Threshold reached - trigger delete
        deleteRevealed.value = true;
        translateX.value = withSpring(SWIPE_DELETE_THRESHOLD, {}, () => {
          runOnJS(handleSwipeDelete)();
        });
      } else {
        // Snap back
        deleteRevealed.value = false;
        translateX.value = withSpring(0);
      }
    });

  /**
   * Animated style for swipe
   */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  /**
   * Animated style for delete button
   */
  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: deleteRevealed.value
      ? 1
      : Math.abs(translateX.value) / Math.abs(SWIPE_DELETE_THRESHOLD),
  }));

  // Calculate indentation
  const marginLeft = depth * INDENT_SIZE;

  // Container style
  const containerStyle: ViewStyle[] = [
    styles.container,
    { marginLeft },
    isFocused && styles.containerFocused,
  ];

  return (
    <View style={styles.wrapper} testID={testID}>
      {/* Delete button (revealed on swipe) */}
      <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
        <View style={styles.deleteButtonInner} />
      </Animated.View>

      {/* Main content (swipeable) */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[containerStyle, animatedStyle]}>
          {/* Bullet/Collapse Toggle */}
          <View
            style={styles.bulletContainer}
            onTouchEnd={handleToggleCollapse}
            accessibilityLabel={
              hasChildren ? (block.isCollapsed ? 'Expand block' : 'Collapse block') : 'Block bullet'
            }
            accessibilityRole="button"
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
          </View>

          {/* Editable Content */}
          <TextInput
            ref={actualInputRef}
            style={styles.input}
            value={content}
            onChangeText={handleChangeText}
            onKeyPress={handleKeyPress}
            onFocus={handlePress}
            multiline={true}
            placeholder="Type something..."
            placeholderTextColor="#8E8E93"
            testID={testID ? `${testID}-input` : undefined}
            accessible={true}
            accessibilityLabel={`Block content: ${content || 'empty'}`}
            accessibilityHint="Type to edit. Press Enter for new block. Backspace on empty to delete."
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  } as ViewStyle,

  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  } as ViewStyle,

  containerFocused: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
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

  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: '#000000',
    minHeight: MIN_TOUCH_TARGET - 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
  } as TextStyle,

  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  } as ViewStyle,

  deleteButtonInner: {
    width: 24,
    height: 3,
    backgroundColor: '#FFFFFF',
  } as ViewStyle,
});

export default EditableBlockView;
