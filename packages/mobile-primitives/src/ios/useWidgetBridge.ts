/**
 * useWidgetBridge.ts - Hook for widget communication
 *
 * Provides a React hook for managing iOS widget communication,
 * including data updates and handling widget tap actions.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { WidgetUpdatePayload, WidgetTapAction } from './WidgetTypes';

/**
 * Bridge interface for platform-specific widget communication
 * Implemented by native iOS module
 */
export interface WidgetBridge {
  /**
   * Update widget content
   * Sends data to iOS WidgetKit to refresh widget display
   */
  updateWidget(payload: WidgetUpdatePayload): Promise<void>;

  /**
   * Register handler for widget tap actions
   * Called when user taps on widget
   */
  onWidgetTap(handler: (action: WidgetTapAction) => void): () => void;

  /**
   * Check if widget support is available
   */
  isSupported(): boolean;
}

/**
 * Mock implementation of WidgetBridge for testing
 */
export class MockWidgetBridge implements WidgetBridge {
  private tapHandler: ((action: WidgetTapAction) => void) | null = null;
  private updateHistory: WidgetUpdatePayload[] = [];

  async updateWidget(payload: WidgetUpdatePayload): Promise<void> {
    this.updateHistory.push(payload);
  }

  onWidgetTap(handler: (action: WidgetTapAction) => void): () => void {
    this.tapHandler = handler;
    return () => {
      this.tapHandler = null;
    };
  }

  isSupported(): boolean {
    return true;
  }

  // Test utilities
  simulateTap(action: WidgetTapAction): void {
    if (this.tapHandler) {
      this.tapHandler(action);
    }
  }

  getUpdateHistory(): WidgetUpdatePayload[] {
    return [...this.updateHistory];
  }

  clearHistory(): void {
    this.updateHistory = [];
  }
}

/**
 * Widget tap action handler
 */
export type WidgetTapHandler = (action: WidgetTapAction) => void | Promise<void>;

/**
 * Options for useWidgetBridge hook
 */
export interface UseWidgetBridgeOptions {
  /**
   * Handler called when widget is tapped
   */
  onTap?: WidgetTapHandler;

  /**
   * Whether to automatically register tap handler on mount
   */
  autoRegister?: boolean;
}

/**
 * Result returned by useWidgetBridge hook
 */
export interface UseWidgetBridgeResult {
  /**
   * Update widget content
   */
  updateWidget: (payload: WidgetUpdatePayload) => Promise<void>;

  /**
   * Check if widgets are supported
   */
  isSupported: boolean;

  /**
   * Register widget tap handler
   */
  registerTapHandler: (handler: WidgetTapHandler) => void;

  /**
   * Unregister widget tap handler
   */
  unregisterTapHandler: () => void;
}

/**
 * Hook for iOS widget communication
 *
 * Provides methods to update widget content and handle widget tap actions.
 * Automatically manages handler registration and cleanup.
 *
 * @param bridge - Widget bridge implementation (native or mock)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function WidgetManager({ bridge }: { bridge: WidgetBridge }) {
 *   const { updateWidget, isSupported } = useWidgetBridge(bridge, {
 *     onTap: async (action) => {
 *       if (action.payload?.pageId) {
 *         navigation.navigate('Page', { pageId: action.payload.pageId });
 *       }
 *     },
 *   });
 *
 *   const refreshWidget = async () => {
 *     await updateWidget({
 *       widgetId: 'widget-123',
 *       kind: WidgetKind.RecentNotes,
 *       data: { notes: [], lastUpdated: Date.now() },
 *       timestamp: Date.now(),
 *     });
 *   };
 *
 *   if (!isSupported) {
 *     return <Text>Widgets not supported</Text>;
 *   }
 *
 *   return <Button onPress={refreshWidget}>Refresh Widget</Button>;
 * }
 * ```
 */
export function useWidgetBridge(
  bridge: WidgetBridge,
  options: UseWidgetBridgeOptions = {}
): UseWidgetBridgeResult {
  const { onTap, autoRegister = true } = options;

  // Store handler ref to avoid re-registering on every render
  const handlerRef = useRef<WidgetTapHandler | null>(onTap ?? null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update handler ref when onTap changes
  useEffect(() => {
    handlerRef.current = onTap ?? null;
  }, [onTap]);

  /**
   * Register tap handler with the bridge
   */
  const registerTapHandler = useCallback(
    (handler: WidgetTapHandler) => {
      // Unregister existing handler
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Update handler ref
      handlerRef.current = handler;

      // Register new handler that uses the ref (supports dynamic updates)
      unsubscribeRef.current = bridge.onWidgetTap((action) => {
        if (handlerRef.current) {
          handlerRef.current(action);
        }
      });
    },
    [bridge]
  );

  /**
   * Unregister tap handler
   */
  const unregisterTapHandler = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  /**
   * Update widget content
   */
  const updateWidget = useCallback(
    async (payload: WidgetUpdatePayload): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Widget bridge not supported on this platform');
        return;
      }

      try {
        await bridge.updateWidget(payload);
      } catch (error) {
        console.error('Failed to update widget:', error);
        throw error;
      }
    },
    [bridge]
  );

  // Auto-register handler on mount if enabled
  useEffect(() => {
    if (autoRegister && handlerRef.current) {
      registerTapHandler(handlerRef.current);
    }

    // Cleanup on unmount
    return () => {
      unregisterTapHandler();
    };
  }, [autoRegister, registerTapHandler, unregisterTapHandler]);

  return {
    updateWidget,
    isSupported: bridge.isSupported(),
    registerTapHandler,
    unregisterTapHandler,
  };
}
