/**
 * ModalOverlay - Workaround for React Native Modal rendering bug
 *
 * React Native 0.73.x Modal component causes "Objects are not valid as a React child"
 * errors. This component provides the same visual behavior using absolutely positioned
 * Views instead.
 *
 * @example
 * ```tsx
 * <ModalOverlay visible={showModal} onClose={() => setShowModal(false)}>
 *   <View style={styles.content}>
 *     <Text>Modal content</Text>
 *   </View>
 * </ModalOverlay>
 * ```
 */

import React, { type ReactElement, type ReactNode } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

/**
 * Props for ModalOverlay component.
 */
export interface ModalOverlayProps {
  /** Whether the modal overlay is visible */
  visible: boolean;
  /** Called when backdrop is pressed */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Whether to add keyboard avoiding behavior (default: true) */
  keyboardAvoiding?: boolean;
}

/**
 * Modal overlay component that simulates React Native Modal behavior
 * using absolutely positioned Views.
 *
 * Features:
 * - Backdrop press to close
 * - Keyboard avoiding (iOS)
 * - Content touch passthrough prevention
 */
export function ModalOverlay({
  visible,
  onClose,
  children,
  keyboardAvoiding = true,
}: ModalOverlayProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  const content = (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        pointerEvents="box-none"
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
