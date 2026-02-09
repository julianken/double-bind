/**
 * Android keyboard dismissal on back button.
 *
 * Automatically dismisses keyboard when back button is pressed.
 */

import { useCallback } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useBackHandler } from './BackHandler';
import { BackHandlerPriority } from './types';
import type { KeyboardDismissalOptions } from './types';

/**
 * Hook for dismissing keyboard on back button press.
 *
 * Registers a high-priority back handler that dismisses the keyboard if visible.
 * This should run before page-level navigation handlers.
 *
 * @example
 * ```tsx
 * function SearchScreen() {
 *   const [query, setQuery] = useState('');
 *
 *   useKeyboardDismissal({
 *     enabled: true,
 *     onDismiss: () => {
 *       // Handle keyboard dismissal (e.g., clear focus, analytics)
 *     },
 *   });
 *
 *   return (
 *     <TextInput
 *       value={query}
 *       onChangeText={setQuery}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 * ```
 */
export function useKeyboardDismissal(options: KeyboardDismissalOptions = {}): void {
  const { enabled = true, priority = BackHandlerPriority.Page + 10, onDismiss } = options;

  // Back handler that dismisses keyboard if visible
  const handleBack = useCallback((): boolean => {
    if (Platform.OS !== 'android') {
      return false;
    }

    // Check if keyboard is visible (this is a heuristic - not perfect)
    // We'll attempt to dismiss and let the system handle it
    const wasVisible = Keyboard.isVisible?.() ?? false;

    if (wasVisible) {
      Keyboard.dismiss();
      if (onDismiss) {
        onDismiss();
      }
      return true; // Consume the back press
    }

    return false; // Keyboard not visible, pass through
  }, [onDismiss]);

  // Register back handler with high priority
  useBackHandler({
    enabled,
    priority,
    handler: handleBack,
  });
}

/**
 * Check if keyboard is currently visible.
 * This is a best-effort check and may not be 100% accurate.
 */
export function isKeyboardVisible(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }

  // React Native doesn't provide a reliable way to check keyboard visibility
  // This would need to be implemented with a native module
  return Keyboard.isVisible?.() ?? false;
}
