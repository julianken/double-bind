/**
 * EditableBlockView - Touch-optimized editable block component for mobile
 *
 * Extends BlockView with editing capabilities:
 * - Tap to enter edit mode
 * - Mobile keyboard integration via TextInput
 * - Auto-save on blur
 * - Text formatting support (markdown syntax)
 * - Maintains 44pt minimum touch targets per iOS HIG
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/components/content/text-fields
 */

import * as React from 'react';
import { View, TextInput, StyleSheet, Keyboard } from 'react-native';
import type { ViewStyle, TextStyle, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { BlockId } from '@double-bind/types';
import { BlockView, type BlockViewProps } from './BlockView';

// Minimum touch target size per iOS HIG (44pt)
const MIN_TOUCH_TARGET = 44;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

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
}

/**
 * Editable block component with mobile keyboard integration.
 *
 * Features:
 * - Tap to edit inline with TextInput
 * - Mobile keyboard appears automatically
 * - Auto-save on blur
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
 * />
 * ```
 */
export function EditableBlockView({
  block,
  depth = 0,
  isEditing = false,
  onStartEditing,
  onEndEditing,
  onContentChange,
  onSave,
  autoFocus = false,
  placeholder = 'Type here...',
  readOnly = false,
  testID,
  ...blockViewProps
}: EditableBlockViewProps): React.ReactElement {
  const [localContent, setLocalContent] = React.useState(block.content);
  const inputRef = React.useRef<TextInput>(null);

  // Sync local state when block prop changes
  React.useEffect(() => {
    setLocalContent(block.content);
  }, [block.content]);

  // Auto-focus when entering edit mode
  React.useEffect(() => {
    if (isEditing && autoFocus && inputRef.current) {
      // Small delay to ensure layout is complete
      const timeout = setTimeout(() => {
        try {
          inputRef.current?.focus();
        } catch {
          // Focus may fail if component is unmounting or input is not mounted
          // This is not a critical error, just ignore and continue
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isEditing, autoFocus]);

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

  const handleSubmitEditing = React.useCallback(() => {
    // Dismiss keyboard on submit (Return key)
    Keyboard.dismiss();
  }, []);

  // Set up tap gesture for entering edit mode
  const tapGesture = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd(handleTap);

  // Calculate indentation
  const marginLeft = depth * INDENT_SIZE;

  // If in edit mode, render TextInput
  if (isEditing && !readOnly) {
    const containerStyle: ViewStyle[] = [
      styles.editContainer,
      { marginLeft },
    ];

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

    return (
      <View
        style={containerStyle}
        testID={testID ? `${testID}-editing` : undefined}
      >
        {/* Bullet placeholder (non-interactive during edit) */}
        <View style={styles.bulletContainer}>
          <View style={styles.bullet} />
        </View>

        {/* Editable TextInput */}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, textStyle]}
          value={localContent}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#C7C7CC"
          multiline={true}
          returnKeyType="done"
          blurOnSubmit={true}
          autoCorrect={true}
          autoCapitalize="sentences"
          accessibilityLabel={`Edit block: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`}
          accessibilityHint="Type to edit block content. Press Return to finish."
          testID={testID ? `${testID}-input` : undefined}
        />
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
          isFocused={isEditing}
          testID={testID ? `${testID}-view` : undefined}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
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
});

export default EditableBlockView;
