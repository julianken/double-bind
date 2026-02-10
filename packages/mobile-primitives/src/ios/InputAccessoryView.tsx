/**
 * iOS Input Accessory View component.
 *
 * Custom toolbar that appears above the keyboard, providing quick actions
 * and formatting controls for text input.
 */

import * as React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  InputAccessoryView as RNInputAccessoryView,
} from 'react-native';
import type { InputAccessoryViewProps, AccessoryButton } from './types';

/**
 * Default colors for light mode.
 */
const DEFAULT_BACKGROUND_COLOR = '#F7F7F7';
const DEFAULT_TINT_COLOR = '#007AFF';
const DEFAULT_BORDER_COLOR = '#C6C6C8';
const DEFAULT_DISABLED_COLOR = '#C7C7CC';

/**
 * Input accessory toolbar component.
 *
 * Provides a custom toolbar above the iOS keyboard with formatting buttons,
 * quick actions, and a done button. Only renders on iOS platform.
 *
 * @example
 * ```tsx
 * function RichTextEditor() {
 *   const [isBold, setIsBold] = useState(false);
 *   const [isItalic, setIsItalic] = useState(false);
 *
 *   return (
 *     <>
 *       <InputAccessoryView
 *         nativeID="richTextToolbar"
 *         leftButtons={[
 *           {
 *             id: 'bold',
 *             label: 'B',
 *             onPress: () => setIsBold(!isBold),
 *             highlighted: isBold,
 *           },
 *           {
 *             id: 'italic',
 *             label: 'I',
 *             onPress: () => setIsItalic(!isItalic),
 *             highlighted: isItalic,
 *           },
 *           {
 *             id: 'link',
 *             label: '[[Link]]',
 *             onPress: () => insertWikiLink(),
 *           },
 *         ]}
 *         rightButtons={[
 *           {
 *             id: 'date',
 *             label: 'Date',
 *             onPress: () => insertDate(),
 *           },
 *         ]}
 *         onDone={() => Keyboard.dismiss()}
 *       />
 *       <TextInput
 *         inputAccessoryViewID="richTextToolbar"
 *         placeholder="Type here..."
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function InputAccessoryView({
  nativeID,
  leftButtons = [],
  rightButtons = [],
  showDoneButton = true,
  doneButtonLabel = 'Done',
  onDone,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  tintColor = DEFAULT_TINT_COLOR,
}: InputAccessoryViewProps): JSX.Element | null {
  // Only render on iOS
  if (Platform.OS !== 'ios') {
    return null;
  }

  /**
   * Render a toolbar button.
   */
  const renderButton = (button: AccessoryButton) => {
    const buttonStyle = [
      styles.button,
      button.disabled && styles.buttonDisabled,
      button.highlighted && { backgroundColor: tintColor + '20' },
    ];

    const textStyle = [
      styles.buttonText,
      { color: button.disabled ? DEFAULT_DISABLED_COLOR : tintColor },
      button.highlighted && { fontWeight: '600' },
    ];

    return (
      <TouchableOpacity
        key={button.id}
        style={buttonStyle}
        onPress={button.onPress}
        disabled={button.disabled}
        activeOpacity={0.6}
      >
        <Text style={textStyle}>{button.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <RNInputAccessoryView nativeID={nativeID}>
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.borderTop} />

        <View style={styles.contentRow}>
          {/* Left buttons section */}
          <View style={styles.leftSection}>{leftButtons.map(renderButton)}</View>

          {/* Right buttons section */}
          <View style={styles.rightSection}>
            {rightButtons.map(renderButton)}

            {/* Done button */}
            {showDoneButton && (
              <TouchableOpacity
                style={[styles.button, styles.doneButton]}
                onPress={onDone}
                activeOpacity={0.6}
              >
                <Text style={[styles.buttonText, styles.doneButtonText, { color: tintColor }]}>
                  {doneButtonLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </RNInputAccessoryView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 44, // iOS minimum touch target
    justifyContent: 'center',
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DEFAULT_BORDER_COLOR,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 44,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 44, // iOS minimum touch target
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '400',
  },
  doneButton: {
    paddingHorizontal: 16,
  },
  doneButtonText: {
    fontWeight: '600',
  },
});
