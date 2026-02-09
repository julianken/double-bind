/**
 * useAppLifecycle - Manages app lifecycle events for database operations.
 *
 * This hook subscribes to React Native's AppState API and coordinates
 * database suspend/resume operations when the app transitions between
 * foreground and background states.
 *
 * Key behaviors:
 * - Calls db.suspend() when app goes to background (flushes pending writes)
 * - Calls db.resume() when app returns to foreground (validates state)
 * - Handles rapid state transitions with debouncing
 * - Tracks pending operations to prevent state corruption
 *
 * @see MobileGraphDB - Database implementation with suspend/resume methods
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { MobileGraphDB } from '@double-bind/mobile';

/**
 * Options for the useAppLifecycle hook.
 */
export interface UseAppLifecycleOptions {
  /**
   * Callback invoked when app enters background.
   * Called after database suspend completes.
   */
  onBackground?: () => void;

  /**
   * Callback invoked when app returns to foreground.
   * Called after database resume completes.
   */
  onForeground?: () => void;

  /**
   * Callback invoked when lifecycle operation encounters an error.
   */
  onError?: (error: Error, operation: 'suspend' | 'resume') => void;

  /**
   * Minimum time (ms) between state transitions to prevent rapid switching.
   * Default: 100ms
   */
  debounceMs?: number;
}

/**
 * Lifecycle state tracking for the hook.
 */
interface LifecycleState {
  /** Whether a suspend/resume operation is currently in progress */
  operationInProgress: boolean;
  /** The last processed app state */
  lastState: AppStateStatus;
  /** Timestamp of last state transition */
  lastTransitionTime: number;
  /** Pending state that arrived during an operation */
  pendingState: AppStateStatus | null;
}

/**
 * Hook to manage app lifecycle events and coordinate database operations.
 *
 * @param db - MobileGraphDB instance to manage
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * function App() {
 *   const { db } = useDatabase();
 *
 *   useAppLifecycle(db, {
 *     onBackground: () => analytics.track('app_backgrounded'),
 *     onForeground: () => analytics.track('app_foregrounded'),
 *     onError: (err, op) => reportError(`${op} failed:`, err),
 *   });
 *
 *   return <MainScreen />;
 * }
 * ```
 */
export function useAppLifecycle(
  db: MobileGraphDB | null,
  options: UseAppLifecycleOptions = {}
): void {
  const { onBackground, onForeground, onError, debounceMs = 100 } = options;

  // Track lifecycle state across renders
  const stateRef = useRef<LifecycleState>({
    operationInProgress: false,
    lastState: AppState.currentState,
    lastTransitionTime: 0,
    pendingState: null,
  });

  // Store callbacks in refs to avoid re-subscribing on callback changes
  const callbacksRef = useRef({ onBackground, onForeground, onError });
  callbacksRef.current = { onBackground, onForeground, onError };

  /**
   * Handle a state transition, with debouncing and operation tracking.
   */
  const handleStateTransition = useCallback(
    async (nextState: AppStateStatus) => {
      const state = stateRef.current;
      const now = Date.now();

      // Debounce rapid transitions
      if (now - state.lastTransitionTime < debounceMs) {
        state.pendingState = nextState;
        return;
      }

      // If an operation is already in progress, queue this state
      if (state.operationInProgress) {
        state.pendingState = nextState;
        return;
      }

      // Skip if state hasn't actually changed
      if (nextState === state.lastState) {
        return;
      }

      // Skip if no database available
      if (!db) {
        state.lastState = nextState;
        state.lastTransitionTime = now;
        return;
      }

      state.operationInProgress = true;
      state.lastTransitionTime = now;
      const previousState = state.lastState;
      state.lastState = nextState;

      try {
        // App is going to background
        if (nextState === 'background' && previousState === 'active') {
          await db.suspend();
          callbacksRef.current.onBackground?.();
        }
        // App is returning to foreground
        else if (nextState === 'active' && previousState === 'background') {
          await db.resume();
          callbacksRef.current.onForeground?.();
        }
        // Handle inactive -> background (iOS specific)
        else if (nextState === 'background' && previousState === 'inactive') {
          await db.suspend();
          callbacksRef.current.onBackground?.();
        }
        // Handle background -> active (skip inactive state)
        else if (nextState === 'active' && previousState !== 'active') {
          await db.resume();
          callbacksRef.current.onForeground?.();
        }
      } catch (error) {
        const operation = nextState === 'background' ? 'suspend' : 'resume';
        callbacksRef.current.onError?.(error as Error, operation);
      } finally {
        state.operationInProgress = false;

        // Process any pending state that arrived during the operation
        if (state.pendingState && state.pendingState !== state.lastState) {
          const pending = state.pendingState;
          state.pendingState = null;
          // Use setTimeout to avoid stack overflow on rapid transitions
          setTimeout(() => {
            void handleStateTransition(pending);
          }, 0);
        }
      }
    },
    [db, debounceMs]
  );

  useEffect(() => {
    // Subscribe to AppState changes
    const subscription = AppState.addEventListener('change', (nextState) => {
      void handleStateTransition(nextState);
    });

    // Initialize state tracking
    stateRef.current.lastState = AppState.currentState;

    return () => {
      subscription.remove();
    };
  }, [handleStateTransition]);
}

/**
 * Result type for useAppLifecycleState hook.
 */
export interface AppLifecycleState {
  /** Current app state */
  appState: AppStateStatus;
  /** Whether the app is in the foreground (active state) */
  isActive: boolean;
  /** Whether the app is in the background */
  isBackground: boolean;
  /** Whether a lifecycle operation is in progress */
  isTransitioning: boolean;
}

/**
 * Hook to observe app lifecycle state without database integration.
 *
 * Use this for components that need to react to app state changes
 * without managing database lifecycle.
 *
 * @returns Current app lifecycle state
 *
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const { isActive, isBackground } = useAppLifecycleState();
 *
 *   return (
 *     <Text>
 *       {isActive ? 'Active' : isBackground ? 'Background' : 'Inactive'}
 *     </Text>
 *   );
 * }
 * ```
 */
export function useAppLifecycleState(): AppLifecycleState {
  const stateRef = useRef<AppLifecycleState>({
    appState: AppState.currentState,
    isActive: AppState.currentState === 'active',
    isBackground: AppState.currentState === 'background',
    isTransitioning: false,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      stateRef.current = {
        appState: nextState,
        isActive: nextState === 'active',
        isBackground: nextState === 'background',
        isTransitioning: false,
      };
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return stateRef.current;
}
