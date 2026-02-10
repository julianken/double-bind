/**
 * React hook for handling iOS Spotlight search interactions.
 *
 * Provides a hook for registering search result handlers and parsing
 * deep links when users tap on Spotlight search results.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { SpotlightSearchContinuation } from './SpotlightTypes.js';

/**
 * Handler function called when a Spotlight search result is tapped.
 */
export type SpotlightSearchHandler = (continuation: SpotlightSearchContinuation) => void;

/**
 * Native bridge interface for Spotlight search event handling.
 * Implemented by platform-specific code (e.g., React Native module).
 */
export interface SpotlightSearchBridge {
  /**
   * Register a handler for Spotlight search result taps.
   * Returns a cleanup function to unregister the handler.
   */
  addListener(handler: SpotlightSearchHandler): () => void;

  /**
   * Parse a deep link URL from Spotlight.
   * Returns continuation data or null if URL is not a Spotlight deep link.
   */
  parseDeepLink(url: string): SpotlightSearchContinuation | null;

  /**
   * Check if Spotlight search is available on this device.
   */
  isAvailable(): boolean;
}

/**
 * Mock implementation of SpotlightSearchBridge for testing.
 */
export class MockSpotlightSearchBridge implements SpotlightSearchBridge {
  private handlers: SpotlightSearchHandler[] = [];
  private available = true;

  addListener(handler: SpotlightSearchHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  parseDeepLink(url: string): SpotlightSearchContinuation | null {
    // Parse URL format: doublebind://page/{pageId}?query={searchQuery}
    const match = url.match(/^doublebind:\/\/page\/([^?]+)(\?query=(.+))?$/);
    if (!match) {
      return null;
    }

    return {
      itemIdentifier: match[1],
      pageId: match[1],
      searchQuery: match[3] ? decodeURIComponent(match[3]) : undefined,
    };
  }

  isAvailable(): boolean {
    return this.available;
  }

  // Test helpers
  simulateSearchResult(continuation: SpotlightSearchContinuation): void {
    this.handlers.forEach((handler) => handler(continuation));
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  getHandlerCount(): number {
    return this.handlers.length;
  }
}

/**
 * Options for useSpotlightSearch hook.
 */
export interface UseSpotlightSearchOptions {
  /**
   * Bridge implementation for native Spotlight integration.
   * Defaults to platform-specific implementation if available.
   */
  bridge?: SpotlightSearchBridge;

  /**
   * Whether to enable the search handler.
   * Useful for conditional activation.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Result from useSpotlightSearch hook.
 */
export interface UseSpotlightSearchResult {
  /**
   * Whether Spotlight search is available on this device.
   */
  isAvailable: boolean;

  /**
   * Parse a deep link URL and extract continuation data.
   */
  parseDeepLink: (url: string) => SpotlightSearchContinuation | null;
}

/**
 * React hook for handling Spotlight search result taps.
 *
 * Registers a handler that is called when users tap on Spotlight
 * search results for your app. Automatically cleans up on unmount.
 *
 * @param handler - Function to call when a search result is tapped
 * @param options - Configuration options
 * @returns Object with utility methods
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isAvailable } = useSpotlightSearch((continuation) => {
 *     // Navigate to the selected page
 *     navigation.navigate('Page', { pageId: continuation.pageId });
 *   });
 *
 *   if (!isAvailable) {
 *     return <Text>Spotlight not available</Text>;
 *   }
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useSpotlightSearch(
  handler: SpotlightSearchHandler,
  options: UseSpotlightSearchOptions = {}
): UseSpotlightSearchResult {
  const { bridge, enabled = true } = options;

  // Store handler in a ref to avoid re-registering on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Store bridge in a ref to maintain stable reference
  const bridgeRef = useRef(bridge);
  if (bridge && bridgeRef.current !== bridge) {
    bridgeRef.current = bridge;
  }

  useEffect(() => {
    if (!enabled || !bridgeRef.current) {
      return;
    }

    const currentBridge = bridgeRef.current;

    // Wrap handler to use the latest version from ref
    const wrappedHandler: SpotlightSearchHandler = (continuation) => {
      handlerRef.current(continuation);
    };

    // Register the handler
    const cleanup = currentBridge.addListener(wrappedHandler);

    // Return cleanup function
    return cleanup;
  }, [enabled]); // Only re-run if enabled changes

  const parseDeepLink = useCallback((url: string): SpotlightSearchContinuation | null => {
    if (!bridgeRef.current) {
      return null;
    }
    return bridgeRef.current.parseDeepLink(url);
  }, []);

  return {
    isAvailable: bridgeRef.current?.isAvailable() ?? false,
    parseDeepLink,
  };
}

/**
 * Simple hook to check if Spotlight is available.
 *
 * @param bridge - Optional bridge implementation
 * @returns Whether Spotlight is available
 *
 * @example
 * ```tsx
 * function FeatureGate() {
 *   const hasSpotlight = useHasSpotlight();
 *   return hasSpotlight ? <SpotlightFeature /> : <Fallback />;
 * }
 * ```
 */
export function useHasSpotlight(bridge?: SpotlightSearchBridge): boolean {
  return bridge?.isAvailable() ?? false;
}
