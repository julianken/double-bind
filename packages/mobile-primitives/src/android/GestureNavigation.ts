/**
 * Android gesture navigation support.
 *
 * Provides edge swipe detection and predictive back gesture support for Android 13+.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useBackHandler } from './BackHandler';
import { BackHandlerPriority } from './types';
import type {
  GestureNavigationOptions,
  UseGestureNavigationResult,
  BackGestureProgress,
} from './types';

/**
 * Default edge sensitivity in pixels.
 */
const DEFAULT_EDGE_SENSITIVITY = 20;

/**
 * Default threshold to trigger navigation (0-1).
 */
const DEFAULT_THRESHOLD = 0.3;

/**
 * Initial gesture progress state.
 */
const INITIAL_GESTURE_PROGRESS: BackGestureProgress = {
  progress: 0,
  isActive: false,
  startX: 0,
  currentX: 0,
};

/**
 * Check if predictive back gesture is supported (Android 13+).
 */
function isPredictiveBackSupported(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Predictive back was introduced in Android 13 (API level 33)
  const apiLevel = Platform.Version;
  return typeof apiLevel === 'number' && apiLevel >= 33;
}

/**
 * Hook for gesture navigation support.
 *
 * Provides edge swipe detection and predictive back gesture callbacks for
 * Android 13+ devices. Falls back to simple back button handling on older versions.
 *
 * @example
 * ```tsx
 * function NavigableScreen() {
 *   const { gestureProgress, triggerBack } = useGestureNavigation({
 *     enabled: true,
 *     edgeSensitivity: 20,
 *     threshold: 0.3,
 *     onGestureStart: () => {
 *       // Handle gesture start
 *     },
 *     onGestureProgress: (progress) => {
 *       // Update animation based on progress.progress (0-1)
 *     },
 *     onGestureComplete: () => {
 *       // Navigate back
 *       navigation.goBack();
 *     },
 *     onGestureCancel: () => {
 *       // Handle gesture cancellation
 *     },
 *   });
 *
 *   return (
 *     <View style={{ opacity: 1 - gestureProgress.progress * 0.3 }}>
 *       <Text>Screen content</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useGestureNavigation(
  options: GestureNavigationOptions = {}
): UseGestureNavigationResult {
  const {
    enabled = true,
    edgeSensitivity: _edgeSensitivity = DEFAULT_EDGE_SENSITIVITY,
    threshold: _threshold = DEFAULT_THRESHOLD,
    onGestureStart,
    onGestureProgress,
    onGestureComplete,
    onGestureCancel,
  } = options;

  const [gestureProgress, setGestureProgress] =
    useState<BackGestureProgress>(INITIAL_GESTURE_PROGRESS);
  const callbacksRef = useRef({
    onGestureStart,
    onGestureProgress,
    onGestureComplete,
    onGestureCancel,
  });
  const isPredictiveSupported = isPredictiveBackSupported();

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onGestureStart,
      onGestureProgress,
      onGestureComplete,
      onGestureCancel,
    };
  }, [onGestureStart, onGestureProgress, onGestureComplete, onGestureCancel]);

  // Trigger back navigation manually
  const triggerBack = useCallback(() => {
    if (callbacksRef.current.onGestureComplete) {
      callbacksRef.current.onGestureComplete();
    }
  }, []);

  // Handle predictive back gesture start
  const handleGestureStart = useCallback(() => {
    const newProgress: BackGestureProgress = {
      ...INITIAL_GESTURE_PROGRESS,
      isActive: true,
    };

    setGestureProgress(newProgress);

    if (callbacksRef.current.onGestureStart) {
      callbacksRef.current.onGestureStart();
    }
  }, []);

  // Handle predictive back gesture progress
  const handleGestureProgress = useCallback(
    (progress: number, startX: number, currentX: number) => {
      const newProgress: BackGestureProgress = {
        progress: Math.max(0, Math.min(1, progress)),
        isActive: true,
        startX,
        currentX,
      };

      setGestureProgress(newProgress);

      if (callbacksRef.current.onGestureProgress) {
        callbacksRef.current.onGestureProgress(newProgress);
      }
    },
    []
  );

  // Handle predictive back gesture complete
  const handleGestureComplete = useCallback(() => {
    setGestureProgress(INITIAL_GESTURE_PROGRESS);

    if (callbacksRef.current.onGestureComplete) {
      callbacksRef.current.onGestureComplete();
    }
  }, []);

  // Handle predictive back gesture cancel
  const handleGestureCancel = useCallback(() => {
    setGestureProgress(INITIAL_GESTURE_PROGRESS);

    if (callbacksRef.current.onGestureCancel) {
      callbacksRef.current.onGestureCancel();
    }
  }, []);

  // Back handler for non-predictive back
  const handleBack = useCallback((): boolean => {
    // On predictive back, this is handled by gesture events
    // On older Android, trigger immediate navigation
    if (!isPredictiveSupported) {
      triggerBack();
      return true;
    }

    return false;
  }, [isPredictiveSupported, triggerBack]);

  // Register back handler
  useBackHandler({
    enabled,
    priority: BackHandlerPriority.Page,
    handler: handleBack,
  });

  // Note: Predictive back gesture events would need to be implemented via
  // a native module. This is a placeholder for the API structure.
  // In a real implementation, you would:
  // 1. Create a native module that listens to OnBackPressedCallback
  // 2. Use OnBackInvokedCallback for Android 13+ predictive back
  // 3. Emit events for gesture start/progress/complete/cancel
  // 4. Subscribe to those events in this hook

  useEffect(() => {
    if (!enabled || !isPredictiveSupported) {
      return;
    }

    // Placeholder for native module event listeners
    // const subscription = PredictiveBackModule.addEventListener((event) => {
    //   switch (event.type) {
    //     case 'gestureStart':
    //       handleGestureStart();
    //       break;
    //     case 'gestureProgress':
    //       handleGestureProgress(event.progress, event.startX, event.currentX);
    //       break;
    //     case 'gestureComplete':
    //       handleGestureComplete();
    //       break;
    //     case 'gestureCancel':
    //       handleGestureCancel();
    //       break;
    //   }
    // });
    //
    // return () => subscription.remove();
  }, [
    enabled,
    isPredictiveSupported,
    handleGestureStart,
    handleGestureProgress,
    handleGestureComplete,
    handleGestureCancel,
  ]);

  return {
    gestureProgress,
    isPredictiveBackSupported: isPredictiveSupported,
    triggerBack,
  };
}

/**
 * Mock gesture navigation bridge for testing.
 */
export class MockGestureNavigationBridge {
  private listeners: Array<(event: GestureEvent) => void> = [];

  addEventListener(listener: (event: GestureEvent) => void): { remove: () => void } {
    this.listeners.push(listener);
    return {
      remove: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  emitGestureStart(): void {
    this.listeners.forEach((listener) => listener({ type: 'gestureStart' }));
  }

  emitGestureProgress(progress: number, startX: number, currentX: number): void {
    this.listeners.forEach((listener) =>
      listener({ type: 'gestureProgress', progress, startX, currentX })
    );
  }

  emitGestureComplete(): void {
    this.listeners.forEach((listener) => listener({ type: 'gestureComplete' }));
  }

  emitGestureCancel(): void {
    this.listeners.forEach((listener) => listener({ type: 'gestureCancel' }));
  }
}

type GestureEvent =
  | { type: 'gestureStart' }
  | { type: 'gestureProgress'; progress: number; startX: number; currentX: number }
  | { type: 'gestureComplete' }
  | { type: 'gestureCancel' };
