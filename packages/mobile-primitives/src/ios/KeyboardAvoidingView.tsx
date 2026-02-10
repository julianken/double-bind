/**
 * iOS Keyboard Avoiding View component.
 *
 * Wrapper component that automatically adjusts layout when keyboard appears.
 * Supports multiple behaviors: height, position, and padding adjustments.
 */

import * as React from 'react';
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import type { KeyboardAvoidingViewProps } from './types';

/**
 * Default keyboard vertical offset for iOS.
 * Accounts for typical navigation bar and status bar height.
 */
const DEFAULT_IOS_OFFSET = 0;

/**
 * KeyboardAvoidingView wrapper with iOS-specific optimizations.
 *
 * Automatically adjusts content position when keyboard appears, preventing
 * input fields from being obscured. Supports different adjustment behaviors
 * and custom offsets.
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   return (
 *     <KeyboardAvoidingView
 *       behavior="padding"
 *       keyboardVerticalOffset={100} // Header height
 *     >
 *       <TextInput placeholder="Name" />
 *       <TextInput placeholder="Email" />
 *       <Button title="Submit" />
 *     </KeyboardAvoidingView>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With scroll view for long forms
 * function LongForm() {
 *   return (
 *     <KeyboardAvoidingView behavior="position">
 *       <ScrollView>
 *         <TextInput placeholder="Field 1" />
 *         <TextInput placeholder="Field 2" />
 *         // ... many more fields
 *       </ScrollView>
 *     </KeyboardAvoidingView>
 *   );
 * }
 * ```
 */
export function KeyboardAvoidingView({
  children,
  behavior = 'padding',
  keyboardVerticalOffset = DEFAULT_IOS_OFFSET,
  enabled = true,
  style,
  contentContainerStyle,
  ...rest
}: KeyboardAvoidingViewProps): JSX.Element {
  // Only enable on iOS
  const isEnabled = enabled && Platform.OS === 'ios';

  return (
    <RNKeyboardAvoidingView
      behavior={isEnabled ? behavior : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
      enabled={isEnabled}
      style={[styles.container, style]}
      contentContainerStyle={contentContainerStyle}
      {...rest}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
