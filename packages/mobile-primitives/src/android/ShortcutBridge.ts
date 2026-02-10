/**
 * ShortcutBridge.ts - Native bridge for Android shortcuts
 *
 * Provides React hook and mock implementation for managing Android shortcuts.
 * Handles communication with native ShortcutManager API.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Shortcut, ShortcutLaunchEvent } from './ShortcutTypes';

/**
 * Bridge interface for platform-specific shortcut communication
 * Implemented by native Android module
 */
export interface ShortcutBridge {
  /**
   * Set static shortcuts
   * Updates static shortcuts defined in manifest
   */
  setStaticShortcuts(shortcuts: Shortcut[]): Promise<void>;

  /**
   * Set dynamic shortcuts
   * Replaces all existing dynamic shortcuts
   */
  setDynamicShortcuts(shortcuts: Shortcut[]): Promise<void>;

  /**
   * Add dynamic shortcuts
   * Adds to existing dynamic shortcuts (up to system limit)
   */
  addDynamicShortcuts(shortcuts: Shortcut[]): Promise<void>;

  /**
   * Remove dynamic shortcuts by IDs
   */
  removeDynamicShortcuts(shortcutIds: string[]): Promise<void>;

  /**
   * Remove all dynamic shortcuts
   */
  removeAllDynamicShortcuts(): Promise<void>;

  /**
   * Update shortcuts (static or dynamic)
   */
  updateShortcuts(shortcuts: Shortcut[]): Promise<void>;

  /**
   * Disable shortcuts by IDs
   * Disabled shortcuts appear grayed out
   */
  disableShortcuts(shortcutIds: string[], message?: string): Promise<void>;

  /**
   * Enable previously disabled shortcuts
   */
  enableShortcuts(shortcutIds: string[]): Promise<void>;

  /**
   * Register handler for shortcut launches
   * Called when user taps a shortcut
   */
  onShortcutLaunch(handler: (event: ShortcutLaunchEvent) => void): () => void;

  /**
   * Check if shortcuts are supported
   * Requires Android 7.1+ (API 25)
   */
  isSupported(): boolean;

  /**
   * Get max shortcut count for dynamic shortcuts
   * Typically 4-5 depending on launcher
   */
  getMaxShortcutCount(): number;
}

/**
 * Mock implementation of ShortcutBridge for testing
 */
export class MockShortcutBridge implements ShortcutBridge {
  private launchHandler: ((event: ShortcutLaunchEvent) => void) | null = null;
  private staticShortcuts: Shortcut[] = [];
  private dynamicShortcuts: Shortcut[] = [];
  private disabledShortcutIds: Set<string> = new Set();
  private updateHistory: Array<{
    type: string;
    shortcuts: Shortcut[];
    timestamp: number;
  }> = [];

  async setStaticShortcuts(shortcuts: Shortcut[]): Promise<void> {
    this.staticShortcuts = [...shortcuts];
    this.updateHistory.push({
      type: 'setStatic',
      shortcuts: [...shortcuts],
      timestamp: Date.now(),
    });
  }

  async setDynamicShortcuts(shortcuts: Shortcut[]): Promise<void> {
    this.dynamicShortcuts = [...shortcuts];
    this.updateHistory.push({
      type: 'setDynamic',
      shortcuts: [...shortcuts],
      timestamp: Date.now(),
    });
  }

  async addDynamicShortcuts(shortcuts: Shortcut[]): Promise<void> {
    this.dynamicShortcuts.push(...shortcuts);
    this.updateHistory.push({
      type: 'addDynamic',
      shortcuts: [...shortcuts],
      timestamp: Date.now(),
    });
  }

  async removeDynamicShortcuts(shortcutIds: string[]): Promise<void> {
    this.dynamicShortcuts = this.dynamicShortcuts.filter((s) => !shortcutIds.includes(s.id));
  }

  async removeAllDynamicShortcuts(): Promise<void> {
    this.dynamicShortcuts = [];
  }

  async updateShortcuts(shortcuts: Shortcut[]): Promise<void> {
    shortcuts.forEach((updated) => {
      // Update in static shortcuts
      const staticIndex = this.staticShortcuts.findIndex((s) => s.id === updated.id);
      if (staticIndex !== -1) {
        this.staticShortcuts[staticIndex] = updated;
      }

      // Update in dynamic shortcuts
      const dynamicIndex = this.dynamicShortcuts.findIndex((s) => s.id === updated.id);
      if (dynamicIndex !== -1) {
        this.dynamicShortcuts[dynamicIndex] = updated;
      }
    });

    this.updateHistory.push({
      type: 'update',
      shortcuts: [...shortcuts],
      timestamp: Date.now(),
    });
  }

  async disableShortcuts(shortcutIds: string[]): Promise<void> {
    shortcutIds.forEach((id) => this.disabledShortcutIds.add(id));
  }

  async enableShortcuts(shortcutIds: string[]): Promise<void> {
    shortcutIds.forEach((id) => this.disabledShortcutIds.delete(id));
  }

  onShortcutLaunch(handler: (event: ShortcutLaunchEvent) => void): () => void {
    this.launchHandler = handler;
    return () => {
      this.launchHandler = null;
    };
  }

  isSupported(): boolean {
    return true;
  }

  getMaxShortcutCount(): number {
    return 4;
  }

  // Test utilities
  simulateLaunch(event: ShortcutLaunchEvent): void {
    if (this.launchHandler) {
      this.launchHandler(event);
    }
  }

  getStaticShortcuts(): Shortcut[] {
    return [...this.staticShortcuts];
  }

  getDynamicShortcuts(): Shortcut[] {
    return [...this.dynamicShortcuts];
  }

  getAllShortcuts(): Shortcut[] {
    return [...this.staticShortcuts, ...this.dynamicShortcuts];
  }

  getDisabledShortcutIds(): string[] {
    return Array.from(this.disabledShortcutIds);
  }

  getUpdateHistory(): typeof this.updateHistory {
    return [...this.updateHistory];
  }

  clearHistory(): void {
    this.updateHistory = [];
  }

  reset(): void {
    this.staticShortcuts = [];
    this.dynamicShortcuts = [];
    this.disabledShortcutIds.clear();
    this.updateHistory = [];
    this.launchHandler = null;
  }
}

/**
 * Shortcut launch event handler
 */
export type ShortcutLaunchHandler = (event: ShortcutLaunchEvent) => void | Promise<void>;

/**
 * Options for useShortcutBridge hook
 */
export interface UseShortcutBridgeOptions {
  /**
   * Handler called when shortcut is launched
   */
  onLaunch?: ShortcutLaunchHandler;

  /**
   * Whether to automatically register launch handler on mount
   */
  autoRegister?: boolean;
}

/**
 * Result returned by useShortcutBridge hook
 */
export interface UseShortcutBridgeResult {
  /**
   * Set static shortcuts
   */
  setStaticShortcuts: (shortcuts: Shortcut[]) => Promise<void>;

  /**
   * Set dynamic shortcuts
   */
  setDynamicShortcuts: (shortcuts: Shortcut[]) => Promise<void>;

  /**
   * Add dynamic shortcuts
   */
  addDynamicShortcuts: (shortcuts: Shortcut[]) => Promise<void>;

  /**
   * Remove dynamic shortcuts
   */
  removeDynamicShortcuts: (shortcutIds: string[]) => Promise<void>;

  /**
   * Remove all dynamic shortcuts
   */
  removeAllDynamicShortcuts: () => Promise<void>;

  /**
   * Update shortcuts
   */
  updateShortcuts: (shortcuts: Shortcut[]) => Promise<void>;

  /**
   * Disable shortcuts
   */
  disableShortcuts: (shortcutIds: string[], message?: string) => Promise<void>;

  /**
   * Enable shortcuts
   */
  enableShortcuts: (shortcutIds: string[]) => Promise<void>;

  /**
   * Check if shortcuts are supported
   */
  isSupported: boolean;

  /**
   * Max shortcut count
   */
  maxShortcutCount: number;

  /**
   * Register launch handler
   */
  registerLaunchHandler: (handler: ShortcutLaunchHandler) => void;

  /**
   * Unregister launch handler
   */
  unregisterLaunchHandler: () => void;
}

/**
 * Hook for Android shortcut communication
 *
 * Provides methods to manage shortcuts and handle shortcut launches.
 * Automatically manages handler registration and cleanup.
 *
 * @param bridge - Shortcut bridge implementation (native or mock)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function ShortcutManager({ bridge }: { bridge: ShortcutBridge }) {
 *   const { setDynamicShortcuts, isSupported } = useShortcutBridge(bridge, {
 *     onLaunch: async (event) => {
 *       if (event.payload?.pageId) {
 *         navigation.navigate('Page', { pageId: event.payload.pageId });
 *       }
 *     },
 *   });
 *
 *   const updateShortcuts = async (shortcuts: Shortcut[]) => {
 *     await setDynamicShortcuts(shortcuts);
 *   };
 *
 *   if (!isSupported) {
 *     return <Text>Shortcuts not supported</Text>;
 *   }
 *
 *   return <Button onPress={() => updateShortcuts([])}>Update</Button>;
 * }
 * ```
 */
export function useShortcutBridge(
  bridge: ShortcutBridge,
  options: UseShortcutBridgeOptions = {}
): UseShortcutBridgeResult {
  const { onLaunch, autoRegister = true } = options;

  // Store handler ref to avoid re-registering on every render
  const handlerRef = useRef<ShortcutLaunchHandler | null>(onLaunch ?? null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update handler ref when onLaunch changes
  useEffect(() => {
    handlerRef.current = onLaunch ?? null;
  }, [onLaunch]);

  /**
   * Register launch handler with the bridge
   */
  const registerLaunchHandler = useCallback(
    (handler: ShortcutLaunchHandler) => {
      // Unregister existing handler
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Update handler ref
      handlerRef.current = handler;

      // Register new handler that uses the ref (supports dynamic updates)
      unsubscribeRef.current = bridge.onShortcutLaunch((event) => {
        if (handlerRef.current) {
          handlerRef.current(event);
        }
      });
    },
    [bridge]
  );

  /**
   * Unregister launch handler
   */
  const unregisterLaunchHandler = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // Wrap bridge methods with error handling
  const setStaticShortcuts = useCallback(
    async (shortcuts: Shortcut[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.setStaticShortcuts(shortcuts);
      } catch (error) {
        console.error('Failed to set static shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const setDynamicShortcuts = useCallback(
    async (shortcuts: Shortcut[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.setDynamicShortcuts(shortcuts);
      } catch (error) {
        console.error('Failed to set dynamic shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const addDynamicShortcuts = useCallback(
    async (shortcuts: Shortcut[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.addDynamicShortcuts(shortcuts);
      } catch (error) {
        console.error('Failed to add dynamic shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const removeDynamicShortcuts = useCallback(
    async (shortcutIds: string[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.removeDynamicShortcuts(shortcutIds);
      } catch (error) {
        console.error('Failed to remove dynamic shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const removeAllDynamicShortcuts = useCallback(async (): Promise<void> => {
    if (!bridge.isSupported()) {
      console.warn('Shortcuts not supported on this platform');
      return;
    }
    try {
      await bridge.removeAllDynamicShortcuts();
    } catch (error) {
      console.error('Failed to remove all dynamic shortcuts:', error);
      throw error;
    }
  }, [bridge]);

  const updateShortcuts = useCallback(
    async (shortcuts: Shortcut[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.updateShortcuts(shortcuts);
      } catch (error) {
        console.error('Failed to update shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const disableShortcuts = useCallback(
    async (shortcutIds: string[], message?: string): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.disableShortcuts(shortcutIds, message);
      } catch (error) {
        console.error('Failed to disable shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  const enableShortcuts = useCallback(
    async (shortcutIds: string[]): Promise<void> => {
      if (!bridge.isSupported()) {
        console.warn('Shortcuts not supported on this platform');
        return;
      }
      try {
        await bridge.enableShortcuts(shortcutIds);
      } catch (error) {
        console.error('Failed to enable shortcuts:', error);
        throw error;
      }
    },
    [bridge]
  );

  // Auto-register handler on mount if enabled
  useEffect(() => {
    if (autoRegister && handlerRef.current) {
      registerLaunchHandler(handlerRef.current);
    }

    // Cleanup on unmount
    return () => {
      unregisterLaunchHandler();
    };
  }, [autoRegister, registerLaunchHandler, unregisterLaunchHandler]);

  return {
    setStaticShortcuts,
    setDynamicShortcuts,
    addDynamicShortcuts,
    removeDynamicShortcuts,
    removeAllDynamicShortcuts,
    updateShortcuts,
    disableShortcuts,
    enableShortcuts,
    isSupported: bridge.isSupported(),
    maxShortcutCount: bridge.getMaxShortcutCount(),
    registerLaunchHandler,
    unregisterLaunchHandler,
  };
}
