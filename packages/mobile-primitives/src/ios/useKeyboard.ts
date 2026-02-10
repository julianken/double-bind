/**
 * React hook for iOS keyboard state management.
 *
 * Tracks keyboard visibility, height, and hardware keyboard detection.
 * Provides callbacks for keyboard lifecycle events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';
import type {
  KeyboardState,
  HardwareKeyboardState,
  UseKeyboardOptions,
  UseKeyboardResult,
  KeyboardEvent,
} from './types';

/**
 * Default keyboard state.
 */
const DEFAULT_KEYBOARD_STATE: KeyboardState = {
  isVisible: false,
  height: 0,
  duration: 0,
  easing: 'keyboard',
  endCoordinates: {
    screenX: 0,
    screenY: 0,
    width: 0,
    height: 0,
  },
};

/**
 * Default hardware keyboard state.
 */
const DEFAULT_HARDWARE_KEYBOARD_STATE: HardwareKeyboardState = {
  isConnected: false,
  isActive: false,
  lastDetectedAt: null,
};

/**
 * Convert keyboard easing string to typed value.
 */
function parseKeyboardEasing(easing: string): KeyboardState['easing'] {
  const easingLower = easing.toLowerCase();
  if (easingLower.includes('easein')) return 'easeIn';
  if (easingLower.includes('easeout')) return 'easeOut';
  if (easingLower.includes('easeinout')) return 'easeInOut';
  if (easingLower.includes('linear')) return 'linear';
  return 'keyboard';
}

/**
 * Parse React Native keyboard event into our KeyboardState format.
 */
function parseKeyboardEvent(event: KeyboardEvent): Omit<KeyboardState, 'isVisible'> {
  return {
    height: event.endCoordinates.height,
    duration: event.duration * 1000, // Convert to milliseconds
    easing: parseKeyboardEasing(event.easing),
    endCoordinates: event.endCoordinates,
  };
}

/**
 * Hook for monitoring iOS keyboard state.
 *
 * Provides real-time keyboard visibility, height, and hardware keyboard detection.
 * Automatically subscribes to keyboard events on mount and cleans up on unmount.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { keyboardState, hardwareKeyboard, dismiss } = useKeyboard({
 *     enabled: true,
 *     onShow: (state) => {
 *       // Handle keyboard show
 *     },
 *     onHide: () => {
 *       // Handle keyboard hide
 *     },
 *   });
 *
 *   return (
 *     <View>
 *       <Text>Keyboard visible: {keyboardState.isVisible}</Text>
 *       <Text>Keyboard height: {keyboardState.height}px</Text>
 *       {hardwareKeyboard.isConnected && <Text>Hardware keyboard connected</Text>}
 *       <Button title="Dismiss" onPress={dismiss} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useKeyboard(options: UseKeyboardOptions = {}): UseKeyboardResult {
  const { enabled = true, onShow, onHide, onHeightChange, onHardwareKeyboardDetected } = options;

  const [keyboardState, setKeyboardState] = useState<KeyboardState>(DEFAULT_KEYBOARD_STATE);
  const [hardwareKeyboard, setHardwareKeyboard] = useState<HardwareKeyboardState>(
    DEFAULT_HARDWARE_KEYBOARD_STATE
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const callbacksRef = useRef({ onShow, onHide, onHeightChange, onHardwareKeyboardDetected });
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousHeightRef = useRef(0);

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onShow, onHide, onHeightChange, onHardwareKeyboardDetected };
  }, [onShow, onHide, onHeightChange, onHardwareKeyboardDetected]);

  // Detect hardware keyboard (keyboard height = 0 on show means hardware keyboard)
  const detectHardwareKeyboard = useCallback((height: number) => {
    const now = Date.now();
    const isHardwareKeyboard = height === 0 || height < 50; // Very small height = hardware keyboard

    setHardwareKeyboard((prev) => {
      const isConnected = isHardwareKeyboard;
      const hasChanged = prev.isConnected !== isConnected;

      if (hasChanged && callbacksRef.current.onHardwareKeyboardDetected) {
        callbacksRef.current.onHardwareKeyboardDetected(isConnected);
      }

      return {
        isConnected,
        isActive: isConnected,
        lastDetectedAt: isConnected ? now : prev.lastDetectedAt,
      };
    });
  }, []);

  // Handle keyboard will show event
  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios') {
      return;
    }

    const subscription = Keyboard.addListener('keyboardWillShow', (event: unknown) => {
      const parsedEvent = parseKeyboardEvent(event as KeyboardEvent);
      const newState: KeyboardState = {
        ...parsedEvent,
        isVisible: true,
      };

      setKeyboardState(newState);
      setIsAnimating(true);

      // Clear existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Detect hardware keyboard
      detectHardwareKeyboard(parsedEvent.height);

      // Call onShow callback
      if (callbacksRef.current.onShow) {
        callbacksRef.current.onShow(newState);
      }

      // Call onHeightChange callback if height changed
      if (callbacksRef.current.onHeightChange && parsedEvent.height !== previousHeightRef.current) {
        callbacksRef.current.onHeightChange(parsedEvent.height);
        previousHeightRef.current = parsedEvent.height;
      }

      // Set animation timeout
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, parsedEvent.duration);
    });

    return () => subscription.remove();
  }, [enabled, detectHardwareKeyboard]);

  // Handle keyboard will hide event
  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios') {
      return;
    }

    const subscription = Keyboard.addListener('keyboardWillHide', (event: unknown) => {
      const parsedEvent = parseKeyboardEvent(event as KeyboardEvent);
      const newState: KeyboardState = {
        ...parsedEvent,
        height: 0,
        isVisible: false,
      };

      setKeyboardState(newState);
      setIsAnimating(true);

      // Clear existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Call onHide callback
      if (callbacksRef.current.onHide) {
        callbacksRef.current.onHide(newState);
      }

      // Call onHeightChange callback if height changed
      if (callbacksRef.current.onHeightChange && previousHeightRef.current !== 0) {
        callbacksRef.current.onHeightChange(0);
        previousHeightRef.current = 0;
      }

      // Reset hardware keyboard state when keyboard is hidden
      setHardwareKeyboard((prev) => ({
        ...prev,
        isActive: false,
      }));

      // Set animation timeout
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, parsedEvent.duration);
    });

    return () => subscription.remove();
  }, [enabled]);

  // Cleanup animation timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Dismiss keyboard function
  const dismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return {
    keyboardState,
    hardwareKeyboard,
    dismiss,
    isAnimating,
  };
}
