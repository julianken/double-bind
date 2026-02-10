/**
 * Android back button handling hook.
 *
 * Provides priority-based back button handler registration with automatic cleanup.
 */

import { useEffect, useRef } from 'react';
import { BackHandler as RNBackHandler, Platform } from 'react-native';
import type { BackHandler, UseBackHandlerOptions } from './types';

/**
 * Global registry of back handlers sorted by priority.
 */
interface HandlerEntry {
  handler: BackHandler;
  priority: number;
  id: string;
}

const handlers: HandlerEntry[] = [];
let isListening = false;
let nextId = 0;

/**
 * Global back handler that dispatches to registered handlers in priority order.
 */
function globalBackHandler(): boolean {
  // Sort handlers by priority (highest first)
  const sortedHandlers = [...handlers].sort((a, b) => b.priority - a.priority);

  // Execute handlers in priority order until one consumes the event
  for (const entry of sortedHandlers) {
    try {
      const consumed = entry.handler();
      if (consumed) {
        return true; // Handler consumed the event
      }
    } catch {
      // Ignore errors and continue to next handler
      // In production, this would be logged to an error tracking service
    }
  }

  return false; // No handler consumed the event, pass to system
}

/**
 * Register a handler in the global registry.
 */
function registerHandler(handler: BackHandler, priority: number): string {
  const id = `handler-${nextId++}`;
  handlers.push({ handler, priority, id });

  // Start listening if this is the first handler
  if (!isListening) {
    RNBackHandler.addEventListener('hardwareBackPress', globalBackHandler);
    isListening = true;
  }

  return id;
}

/**
 * Unregister a handler from the global registry.
 */
function unregisterHandler(id: string): void {
  const index = handlers.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    handlers.splice(index, 1);
  }

  // Stop listening if no handlers remain
  if (handlers.length === 0 && isListening) {
    RNBackHandler.removeEventListener('hardwareBackPress', globalBackHandler);
    isListening = false;
  }
}

/**
 * Hook for registering a back button handler.
 *
 * Handlers are executed in priority order (highest first). Return true from
 * the handler to consume the event, false to pass through to lower priority
 * handlers or the system.
 *
 * @example
 * ```tsx
 * function MyModal({ visible, onClose }: Props) {
 *   useBackHandler({
 *     enabled: visible,
 *     priority: BackHandlerPriority.Modal,
 *     handler: () => {
 *       onClose();
 *       return true; // Consume the event
 *     },
 *   });
 *
 *   return <Modal visible={visible}>...</Modal>;
 * }
 * ```
 */
export function useBackHandler(options: UseBackHandlerOptions): void {
  const { enabled = true, priority = 50, handler } = options;

  const handlerRef = useRef(handler);
  const handlerIdRef = useRef<string | null>(null);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Skip on non-Android platforms
    if (Platform.OS !== 'android') {
      return;
    }

    // Skip if disabled
    if (!enabled) {
      // Cleanup existing handler if disabled
      if (handlerIdRef.current !== null) {
        unregisterHandler(handlerIdRef.current);
        handlerIdRef.current = null;
      }
      return;
    }

    // Wrapper handler that calls the ref
    const wrappedHandler = () => handlerRef.current();

    // Register the handler
    handlerIdRef.current = registerHandler(wrappedHandler, priority);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (handlerIdRef.current !== null) {
        unregisterHandler(handlerIdRef.current);
        handlerIdRef.current = null;
      }
    };
  }, [enabled, priority]);
}

/**
 * Manually exit the app (for testing purposes).
 */
export function exitApp(): void {
  if (Platform.OS === 'android') {
    RNBackHandler.exitApp();
  }
}

/**
 * Get the number of registered handlers (for testing).
 */
export function getHandlerCount(): number {
  return handlers.length;
}

/**
 * Clear all handlers (for testing).
 */
export function clearAllHandlers(): void {
  handlers.length = 0;
  if (isListening) {
    RNBackHandler.removeEventListener('hardwareBackPress', globalBackHandler);
    isListening = false;
  }
}
