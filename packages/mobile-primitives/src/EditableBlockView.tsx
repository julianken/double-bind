/**
 * EditableBlockView - Touch-optimized editable block component for mobile
 *
 * Combines editing capabilities from DBB-392 and DBB-393:
 * - Tap to enter edit mode (DBB-392)
 * - Mobile keyboard integration via TextInput (DBB-392)
 * - Auto-save on blur (DBB-392)
 * - Text formatting support based on contentType (DBB-392)
 * - Enter key creates new block (DBB-393)
 * - Backspace/delete removes empty blocks (DBB-393)
 * - Swipe-to-delete gesture (DBB-393)
 * - Maintains 44pt minimum touch targets per iOS HIG
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/components/content/text-fields
 * @see https://developer.apple.com/design/human-interface-guidelines/patterns/entering-data
 */

import * as React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Keyboard,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  TextInputFocusEventData,
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
import { BlockView, type BlockViewProps } from './BlockView';

// Minimum touch target size per iOS HIG (44pt)
const MIN_TOUCH_TARGET = 44;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

// Swipe threshold to trigger delete (in pixels)
const SWIPE_DELETE_THRESHOLD = -80;

export interface EditableBlockViewProps extends Omit<BlockViewProps, 'onPress' | 'isFocused'> {
  /**
   * Whether this block is in edit mode
   */
  isEditing?: boolean;

  /**
   * Callback when edit mode is entered (tap to edit)
   */
  onStartEditing?: (blockId: BlockId) => void;

  /**
   * Callback when edit mode ends (blur)
   */
  onEndEditing?: (blockId: BlockId) => void;

  /**
   * Callback when content changes during editing
   */
  onContentChange?: (blockId: BlockId, content: string) => void;

  /**
   * Callback when content should be saved (auto-save on blur)
   */
  onSave?: (blockId: BlockId, content: string) => void;

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
   * Whether to auto-focus when entering edit mode
   */
  autoFocus?: boolean;

  /**
   * Placeholder text when block is empty
   */
  placeholder?: string;

  /**
   * Whether the block is read-only
   */
  readOnly?: boolean;

  /**
   * Ref to the TextInput for external focus management
   */
  inputRef?: React.RefObject<TextInput>;
}

/**
 * Editable block component with mobile keyboard integration.
 *
 * Features:
 * - Tap to edit inline with TextInput
 * - Mobile keyboard appears automatically
 * - Auto-save on blur
 * - Enter key creates new block below
 * - Backspace on empty block deletes it
 * - Swipe left to reveal delete action
 * - Markdown syntax support (bold, italic via ** and *)
 * - Minimum 44pt touch target for accessibility
 * - Proper keyboard dismiss handling
 *
 * @example
 * ```tsx
 * <EditableBlockView
 *   block={block}
 *   depth={0}
 *   isEditing={editingBlockId === block.blockId}
 *   onStartEditing={handleStartEdit}
 *   onSave={handleSave}
 *   onEnterPress={handleCreateBlock}
 *   onBackspaceEmpty={handleDeleteBlock}
 *   onSwipeDelete={handleSwipeDelete}
 * />
 * ```
 */
export function EditableBlockView({
  block,
  depth = 0,
  hasChildren = false,
  isEditing = false,
  onStartEditing,
  onEndEditing,
  onContentChange,
  onSave,
  onEnterPress,
  onBackspaceEmpty,
  onSwipeDelete,
  autoFocus = false,
  placeholder = 'Type here...',
  readOnly = false,
  inputRef,
  testID,
  onToggleCollapse,
  ...blockViewProps
}: EditableBlockViewProps): React.ReactElement {
  const [localContent, setLocalContent] = React.useState(block.content);
  const internalInputRef = React.useRef<TextInput>(null);
  const actualInputRef = inputRef ?? internalInputRef;

  // Swipe animation state
  const translateX = useSharedValue(0);
  const deleteRevealed = useSharedValue(false);

  // Sync local state when block prop changes
  React.useEffect(() => {
    setLocalContent(block.content);
  }, [block.content]);

  // Auto-focus when entering edit mode
  React.useEffect(() => {
    if (isEditing && autoFocus && actualInputRef.current) {
      // Small delay to ensure layout is complete
      const timeout = setTimeout(() => {
        try {
          actualInputRef.current?.focus();
        } catch {
          // Focus may fail if component is unmounting or input is not mounted
          // This is not a critical error, just ignore and continue
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isEditing, autoFocus, actualInputRef]);

  const handleTap = React.useCallback(() => {
    if (!isEditing && !readOnly) {
      onStartEditing?.(block.blockId);
    }
  }, [isEditing, readOnly, block.blockId, onStartEditing]);

  const handleChangeText = React.useCallback(
    (text: string) => {
      // Note: Input sanitization (HTML escaping) is not needed here.
      // React Native's TextInput and Text components do not render HTML by default,
      // so XSS via HTML injection is not a risk. User input is treated as plain text.
      setLocalContent(text);
      onContentChange?.(block.blockId, text);
    },
    [block.blockId, onContentChange]
  );

  const handleBlur = React.useCallback(
    (_e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      // Auto-save on blur
      if (localContent !== block.content) {
        onSave?.(block.blockId, localContent);
      }
      onEndEditing?.(block.blockId);
    },
    [block.blockId, block.content, localContent, onSave, onEndEditing]
  );

  const handleKeyPress = React.useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;

      if (key === 'Enter') {
        // Prevent default newline insertion
        e.preventDefault?.();
        // Create new block
        onEnterPress?.(block.blockId);
      } else if (key === 'Backspace' && localContent.length === 0) {
        // Delete empty block
        onBackspaceEmpty?.(block.blockId);
      }
    },
    [block.blockId, localContent.length, onEnterPress, onBackspaceEmpty]
  );

  const handleSubmitEditing = React.useCallback(() => {
    // Dismiss keyboard on submit (Return key)
    Keyboard.dismiss();
  }, []);

  const handleToggleCollapse = React.useCallback(() => {
    onToggleCollapse?.(block.blockId);
  }, [block.blockId, onToggleCollapse]);

  /**
   * Handle swipe delete
   */
  const handleSwipeDelete = React.useCallback(() => {
    onSwipeDelete?.(block.blockId);
  }, [block.blockId, onSwipeDelete]);

  // Set up tap gesture for entering edit mode
  const tapGesture = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd(handleTap);

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

  // If in edit mode, render TextInput with swipe support
  if (isEditing && !readOnly) {
    // Determine text style based on content type
    let textStyle: TextStyle;
    switch (block.contentType) {
      case 'heading':
        textStyle = styles.headingText;
        break;
      case 'code':
        textStyle = styles.codeText;
        break;
      default:
        textStyle = styles.contentText;
    }

    const containerStyle: ViewStyle[] = [
      styles.editContainer,
      { marginLeft },
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

            {/* Editable TextInput */}
            <TextInput
              ref={actualInputRef}
              style={[styles.textInput, textStyle]}
              value={localContent}
              onChangeText={handleChangeText}
              onBlur={handleBlur}
              onKeyPress={handleKeyPress}
              onSubmitEditing={handleSubmitEditing}
              placeholder={placeholder}
              placeholderTextColor="#C7C7CC"
              multiline={true}
              returnKeyType="done"
              blurOnSubmit={true}
              autoCorrect={true}
              autoCapitalize="sentences"
              accessibilityLabel={`Edit block: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`}
              accessibilityHint="Type to edit. Press Enter for new block. Backspace on empty to delete."
              testID={testID ? `${testID}-input` : undefined}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }

  // If not in edit mode, render BlockView with tap gesture
  return (
    <GestureDetector gesture={tapGesture}>
      <View testID={testID}>
        <BlockView
          {...blockViewProps}
          block={block}
          depth={depth}
          hasChildren={hasChildren}
          isFocused={isEditing}
          onToggleCollapse={onToggleCollapse}
          testID={testID ? `${testID}-view` : undefined}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  } as ViewStyle,

  editContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    paddingHorizontal: 12,
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

  textInput: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 16, // Account for padding
    paddingVertical: 0, // Remove default padding
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  } as TextStyle,

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

  codeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
    color: '#1C1C1E',
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
