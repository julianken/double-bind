/**
 * WidgetBridge.ts - Hook for Android widget communication
 *
 * Provides a React hook for managing Android widget communication,
 * including data updates and handling widget tap actions.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { AndroidWidgetUpdatePayload, AndroidWidgetTapAction } from './WidgetTypes';

/**
 * Bridge interface for platform-specific widget communication
 * Implemented by native Android module
 */
export interface AndroidWidgetBridge {
  /**
   * Update widget content
   * Sends data to Android AppWidgetProvider to refresh widget display
   */
  updateWidget(payload: AndroidWidgetUpdatePayload): Promise<void>;

  /**
   * Register handler for widget tap actions
   * Called when user taps on widget
   */
  onWidgetTap(handler: (action: AndroidWidgetTapAction) => void): () => void;

  /**
   * Check if widget support is available
   */
  isSupported(): boolean;

  /**
   * Register widget with Android system
   * Called when app registers a new widget instance
   */
  registerWidget(widgetId: string): Promise<void>;

  /**
   * Unregister widget from Android system
   * Called when widget is removed from home screen
   */
  unregisterWidget(widgetId: string): Promise<void>;
}

/**
 * Mock implementation of AndroidWidgetBridge for testing
 */
export class MockAndroidWidgetBridge implements AndroidWidgetBridge {
  private tapHandler: ((action: AndroidWidgetTapAction) => void) | null = null;
  private updateHistory: AndroidWidgetUpdatePayload[] = [];
  private registeredWidgets = new Set<string>();

  async updateWidget(payload: AndroidWidgetUpdatePayload): Promise<void> {
    this.updateHistory.push(payload);
  }

  onWidgetTap(handler: (action: AndroidWidgetTapAction) => void): () => void {
    this.tapHandler = handler;
    return () => {
      this.tapHandler = null;
    };
  }

  isSupported(): boolean {
    return true;
  }

  async registerWidget(widgetId: string): Promise<void> {
    this.registeredWidgets.add(widgetId);
  }

  async unregisterWidget(widgetId: string): Promise<void> {
    this.registeredWidgets.delete(widgetId);
  }

  // Test utilities
  simulateTap(action: AndroidWidgetTapAction): void {
    if (this.tapHandler) {
      this.tapHandler(action);
    }
  }

  getUpdateHistory(): AndroidWidgetUpdatePayload[] {
    return [...this.updateHistory];
  }

  getRegisteredWidgets(): Set<string> {
    return new Set(this.registeredWidgets);
  }

  clearHistory(): void {
    this.updateHistory = [];
  }

  reset(): void {
    this.updateHistory = [];
    this.registeredWidgets.clear();
    this.tapHandler = null;
  }
}

/**
 * Widget tap action handler
 */
export type AndroidWidgetTapHandler = (action: AndroidWidgetTapAction) => void | Promise<void>;

/**
 * Options for useAndroidWidgetBridge hook
 */
export interface UseAndroidWidgetBridgeOptions {
  /**
   * Handler called when widget is tapped
   */
  onTap?: AndroidWidgetTapHandler;

  /**
   * Whether to automatically register tap handler on mount
   */
  autoRegister?: boolean;
}

/**
 * Result returned by useAndroidWidgetBridge hook
 */
export interface UseAndroidWidgetBridgeResult {
  /**
   * Update widget content
   */
  updateWidget: (payload: AndroidWidgetUpdatePayload) => Promise<void>;

  /**
   * Check if widgets are supported
   */
  isSupported: boolean;

  /**
   * Register widget tap handler
   */
  registerTapHandler: (handler: AndroidWidgetTapHandler) => void;

  /**
   * Unregister widget tap handler
   */
  unregisterTapHandler: () => void;

  /**
   * Register widget with Android system
   */
  registerWidget: (widgetId: string) => Promise<void>;

  /**
   * Unregister widget from Android system
   */
  unregisterWidget: (widgetId: string) => Promise<void>;
}

/**
 * Hook for Android widget communication
 *
 * Provides methods to update widget content and handle widget tap actions.
 * Automatically manages handler registration and cleanup.
 *
 * @param bridge - Widget bridge implementation (native or mock)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function WidgetManager({ bridge }: { bridge: AndroidWidgetBridge }) {
 *   const { updateWidget, isSupported, registerWidget } = useAndroidWidgetBridge(bridge, {
 *     onTap: async (action) => {
 *       if (action.payload?.pageId) {
 *         navigation.navigate('Page', { pageId: action.payload.pageId });
 *       }
 *     },
 *   });
 *
 *   const setupWidget = async () => {
 *     await registerWidget('widget-123');
 *     await updateWidget({
 *       widgetId: 'widget-123',
 *       kind: AndroidWidgetKind.RecentNotes,
 *       data: { notes: [], lastUpdated: Date.now() },
 *       timestamp: Date.now(),
 *     });
 *   };
 *
 *   if (!isSupported) {
 *     return <Text>Widgets not supported</Text>;
 *   }
 *
 *   return <Button onPress={setupWidget}>Setup Widget</Button>;
 * }
 * ```
 */
export function useAndroidWidgetBridge(
  bridge: AndroidWidgetBridge,
  options: UseAndroidWidgetBridgeOptions = {}
): UseAndroidWidgetBridgeResult {
  const { onTap, autoRegister = true } = options;

  // Store handler ref to avoid re-registering on every render
  const handlerRef = useRef<AndroidWidgetTapHandler | null>(onTap ?? null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update handler ref when onTap changes
  useEffect(() => {
    handlerRef.current = onTap ?? null;
  }, [onTap]);

  /**
   * Register tap handler with the bridge
   */
  const registerTapHandler = useCallback(
    (handler: AndroidWidgetTapHandler) => {
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
    async (payload: AndroidWidgetUpdatePayload): Promise<void> => {
      if (!bridge.isSupported()) {
        // eslint-disable-next-line no-console
        console.warn('Widget bridge not supported on this platform');
        return;
      }

      try {
        await bridge.updateWidget(payload);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update widget:', error);
        throw error;
      }
    },
    [bridge]
  );

  /**
   * Register widget with Android system
   */
  const registerWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      if (!bridge.isSupported()) {
        // eslint-disable-next-line no-console
        console.warn('Widget bridge not supported on this platform');
        return;
      }

      try {
        await bridge.registerWidget(widgetId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to register widget:', error);
        throw error;
      }
    },
    [bridge]
  );

  /**
   * Unregister widget from Android system
   */
  const unregisterWidget = useCallback(
    async (widgetId: string): Promise<void> => {
      if (!bridge.isSupported()) {
        // eslint-disable-next-line no-console
        console.warn('Widget bridge not supported on this platform');
        return;
      }

      try {
        await bridge.unregisterWidget(widgetId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to unregister widget:', error);
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
    registerWidget,
    unregisterWidget,
  };
}
