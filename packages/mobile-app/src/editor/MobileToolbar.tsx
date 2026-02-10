/**
 * MobileToolbar - Floating formatting toolbar for mobile editor.
 *
 * Provides quick access to text formatting options (bold, italic, etc.)
 * and reference insertion (wiki links, block refs, tags).
 *
 * The toolbar is positioned above the keyboard when visible.
 *
 * @see packages/desktop/src/editor/AutocompleteDropdown.tsx for reference
 */

import * as React from 'react';
import { memo } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';

import type { MobileToolbarProps } from './types';

// ============================================================================
// Types
// ============================================================================

interface ToolbarButtonProps {
  /** Icon or label for the button */
  label: string;
  /** Whether the button is currently active */
  isActive: boolean;
  /** Press handler */
  onPress: () => void;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Optional test ID */
  testID?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Individual toolbar button with active state.
 */
const ToolbarButton = memo(function ToolbarButton({
  label,
  isActive,
  onPress,
  accessibilityLabel,
  testID,
}: ToolbarButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, isActive && styles.buttonActive]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      testID={testID}
    >
      <Text style={[styles.buttonText, isActive && styles.buttonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

/**
 * Divider between button groups.
 */
const ToolbarDivider = memo(function ToolbarDivider() {
  return <View style={styles.divider} />;
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * MobileToolbar - Floating formatting toolbar.
 *
 * Displays formatting buttons above the keyboard when the editor is focused.
 * Supports text formatting marks and reference insertion.
 *
 * @example
 * ```tsx
 * <MobileToolbar
 *   selection={editorSelection}
 *   isVisible={keyboardVisible}
 *   keyboardHeight={keyboardHeight}
 *   onToggleBold={() => editorRef.current?.toggleMark('bold')}
 *   onToggleItalic={() => editorRef.current?.toggleMark('italic')}
 *   onToggleCode={() => editorRef.current?.toggleMark('code')}
 *   onToggleHighlight={() => editorRef.current?.toggleMark('highlight')}
 *   onToggleStrikethrough={() => editorRef.current?.toggleMark('strikethrough')}
 *   onInsertPageLink={() => showPageLinkPicker()}
 *   onInsertBlockRef={() => showBlockRefPicker()}
 *   onInsertTag={() => showTagPicker()}
 *   onDismissKeyboard={() => Keyboard.dismiss()}
 * />
 * ```
 */
export const MobileToolbar = memo(function MobileToolbar({
  selection,
  isVisible,
  keyboardHeight,
  onToggleBold,
  onToggleItalic,
  onToggleCode,
  onToggleHighlight,
  onToggleStrikethrough,
  onInsertPageLink,
  onInsertBlockRef,
  onInsertTag,
  onDismissKeyboard,
}: MobileToolbarProps) {
  // Check if a mark is active
  const isBold = selection.activeMarks.includes('bold');
  const isItalic = selection.activeMarks.includes('italic');
  const isCode = selection.activeMarks.includes('code');
  const isHighlight = selection.activeMarks.includes('highlight');
  const isStrikethrough = selection.activeMarks.includes('strikethrough');

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Calculate bottom position (above keyboard)
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <View
      style={[styles.container, { bottom: bottomOffset }]}
      accessibilityRole="toolbar"
      accessibilityLabel="Formatting toolbar"
    >
      <View style={styles.toolbar}>
        {/* Formatting Group */}
        <View style={styles.buttonGroup}>
          <ToolbarButton
            label="B"
            isActive={isBold}
            onPress={onToggleBold}
            accessibilityLabel="Bold"
            testID="toolbar-bold"
          />
          <ToolbarButton
            label="I"
            isActive={isItalic}
            onPress={onToggleItalic}
            accessibilityLabel="Italic"
            testID="toolbar-italic"
          />
          <ToolbarButton
            label="<>"
            isActive={isCode}
            onPress={onToggleCode}
            accessibilityLabel="Code"
            testID="toolbar-code"
          />
          <ToolbarButton
            label="Hi"
            isActive={isHighlight}
            onPress={onToggleHighlight}
            accessibilityLabel="Highlight"
            testID="toolbar-highlight"
          />
          <ToolbarButton
            label="S"
            isActive={isStrikethrough}
            onPress={onToggleStrikethrough}
            accessibilityLabel="Strikethrough"
            testID="toolbar-strikethrough"
          />
        </View>

        <ToolbarDivider />

        {/* References Group */}
        <View style={styles.buttonGroup}>
          <ToolbarButton
            label="[["
            isActive={false}
            onPress={onInsertPageLink}
            accessibilityLabel="Insert page link"
            testID="toolbar-page-link"
          />
          <ToolbarButton
            label="(("
            isActive={false}
            onPress={onInsertBlockRef}
            accessibilityLabel="Insert block reference"
            testID="toolbar-block-ref"
          />
          <ToolbarButton
            label="#"
            isActive={false}
            onPress={onInsertTag}
            accessibilityLabel="Insert tag"
            testID="toolbar-tag"
          />
        </View>

        <View style={styles.spacer} />

        {/* Done Button */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDismissKeyboard}
          accessibilityLabel="Dismiss keyboard"
          accessibilityRole="button"
          testID="toolbar-done"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        backgroundColor: '#F2F2F7',
      },
      android: {
        backgroundColor: '#FAFAFA',
        elevation: 4,
      },
    }),
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  buttonActive: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C43',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
    }),
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: '#C6C6C8',
    marginHorizontal: 8,
  },
  spacer: {
    flex: 1,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
});

// ============================================================================
// Exports
// ============================================================================

export type { MobileToolbarProps };
