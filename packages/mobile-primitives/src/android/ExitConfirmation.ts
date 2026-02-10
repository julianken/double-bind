/**
 * Android exit confirmation hook.
 *
 * Implements double-tap to exit pattern for the home screen.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ToastAndroid, Platform } from 'react-native';
import { useBackHandler } from './BackHandler';
import { BackHandlerPriority } from './types';
import type { ExitConfirmationOptions, UseExitConfirmationResult } from './types';

/**
 * Default confirmation message.
 */
const DEFAULT_MESSAGE = 'Press back again to exit';

/**
 * Default timeout between taps (2 seconds).
 */
const DEFAULT_TIMEOUT = 2000;

/**
 * Hook for implementing double-tap to exit confirmation.
 *
 * Shows a toast message on first back press, exits app on second press
 * within the timeout period.
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   const { isPendingExit } = useExitConfirmation({
 *     enabled: true,
 *     message: 'Press back again to exit',
 *     timeout: 2000,
 *     onConfirmExit: () => {
 *       // Optional: cleanup before exit
 *     },
 *   });
 *
 *   return (
 *     <View>
 *       <Text>Home Screen</Text>
 *       {isPendingExit && <Text>Press back again to exit</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useExitConfirmation(
  options: ExitConfirmationOptions = {}
): UseExitConfirmationResult {
  const {
    enabled = true,
    message = DEFAULT_MESSAGE,
    timeout = DEFAULT_TIMEOUT,
    onConfirmExit,
    onFirstPress,
  } = options;

  const [isPendingExit, setIsPendingExit] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onConfirmExit, onFirstPress });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onConfirmExit, onFirstPress };
  }, [onConfirmExit, onFirstPress]);

  // Reset exit confirmation state
  const resetExitConfirmation = useCallback(() => {
    setIsPendingExit(false);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Trigger exit confirmation (for manual use)
  const triggerExitConfirmation = useCallback(() => {
    if (isPendingExit) {
      // Second press - confirm exit
      if (callbacksRef.current.onConfirmExit) {
        callbacksRef.current.onConfirmExit();
      }
      // Exit handled by BackHandler (don't consume event)
      resetExitConfirmation();
      return false;
    } else {
      // First press - show confirmation
      setIsPendingExit(true);

      if (callbacksRef.current.onFirstPress) {
        callbacksRef.current.onFirstPress();
      }

      // Show toast on Android
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      }

      // Set timeout to reset state
      timeoutRef.current = setTimeout(() => {
        setIsPendingExit(false);
        timeoutRef.current = null;
      }, timeout);

      return true; // Consume the first back press
    }
  }, [isPendingExit, message, timeout, resetExitConfirmation]);

  // Back handler
  const handleBack = useCallback((): boolean => {
    return triggerExitConfirmation();
  }, [triggerExitConfirmation]);

  // Register back handler at root priority
  useBackHandler({
    enabled,
    priority: BackHandlerPriority.Root,
    handler: handleBack,
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isPendingExit,
    triggerExitConfirmation,
    resetExitConfirmation,
  };
}
