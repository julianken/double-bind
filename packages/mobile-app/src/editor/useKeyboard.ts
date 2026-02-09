/**
 * useKeyboard - Hook for tracking keyboard visibility and height.
 *
 * Provides keyboard state for positioning the toolbar and autocomplete popup.
 * Works on both iOS and Android with platform-specific event handling.
 */

import { useState, useEffect, useCallback } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import type { KeyboardState } from './types';

/**
 * Default keyboard state.
 */
const DEFAULT_STATE: KeyboardState = {
  isVisible: false,
  height: 0,
};

/**
 * Hook for tracking keyboard visibility and height.
 *
 * @returns KeyboardState with isVisible and height
 *
 * @example
 * ```tsx
 * function EditorScreen() {
 *   const keyboard = useKeyboard();
 *
 *   return (
 *     <View style={{ marginBottom: keyboard.height }}>
 *       <MobileEditor />
 *       {keyboard.isVisible && <MobileToolbar />}
 *     </View>
 *   );
 * }
 * ```
 */
export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(DEFAULT_STATE);

  const handleKeyboardShow = useCallback((event: KeyboardEvent) => {
    setState({
      isVisible: true,
      height: event.endCoordinates.height,
    });
  }, []);

  const handleKeyboardHide = useCallback(() => {
    setState({
      isVisible: false,
      height: 0,
    });
  }, []);

  useEffect(() => {
    // iOS uses Will events for smoother animation
    // Android uses Did events which fire after animation
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [handleKeyboardShow, handleKeyboardHide]);

  return state;
}

/**
 * Hook for keyboard dismiss functionality.
 *
 * @returns Object with dismiss function
 *
 * @example
 * ```tsx
 * function ToolbarButton() {
 *   const { dismiss } = useKeyboardDismiss();
 *   return <Button onPress={dismiss} title="Done" />;
 * }
 * ```
 */
export function useKeyboardDismiss(): { dismiss: () => void } {
  const dismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return { dismiss };
}

/**
 * Hook to dismiss keyboard when tapping outside.
 *
 * @returns Object with handlers for dismissible area
 *
 * @example
 * ```tsx
 * function Screen() {
 *   const { onPress } = useDismissKeyboardOnTap();
 *   return (
 *     <TouchableWithoutFeedback onPress={onPress}>
 *       <View style={styles.container}>
 *         <Editor />
 *       </View>
 *     </TouchableWithoutFeedback>
 *   );
 * }
 * ```
 */
export function useDismissKeyboardOnTap(): { onPress: () => void } {
  const { dismiss } = useKeyboardDismiss();
  return { onPress: dismiss };
}
