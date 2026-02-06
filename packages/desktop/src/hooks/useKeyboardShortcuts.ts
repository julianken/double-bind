/**
 * useKeyboardShortcuts - Global keyboard shortcut handling
 *
 * Registers and manages global keyboard shortcuts for the desktop app.
 * Shortcuts are registered on mount and cleaned up on unmount.
 *
 * Standard shortcuts:
 * - Ctrl+D / Cmd+D: Navigate to daily notes view
 * - Ctrl+K / Cmd+K: Toggle command palette (future)
 * - Ctrl+[ / Cmd+[: Navigate back (future)
 * - Ctrl+] / Cmd+]: Navigate forward (future)
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key code (e.g., 'd', 'k', 'Escape') */
  key: string;
  /** Require Ctrl key (Windows/Linux) or Cmd key (macOS) */
  ctrlOrCmd?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Require Alt key */
  alt?: boolean;
  /** Handler function called when shortcut is triggered */
  handler: () => void;
  /** Description for help/documentation */
  description?: string;
}

/**
 * Options for useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled. Defaults to true. */
  enabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if the current platform uses Cmd key (macOS) or Ctrl key (Windows/Linux)
 */
function isMacOS(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Check key match (case-insensitive)
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // Check Ctrl/Cmd modifier
  if (shortcut.ctrlOrCmd) {
    const expectedModifier = isMacOS() ? event.metaKey : event.ctrlKey;
    if (!expectedModifier) {
      return false;
    }
  }

  // Check Shift modifier
  if (shortcut.shift && !event.shiftKey) {
    return false;
  }

  // Check Alt modifier
  if (shortcut.alt && !event.altKey) {
    return false;
  }

  return true;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to register and handle global keyboard shortcuts
 *
 * @param shortcuts - Array of shortcut definitions to register
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * function App() {
 *   const { navigateToPage } = useAppStore();
 *
 *   useKeyboardShortcuts([
 *     {
 *       key: 'd',
 *       ctrlOrCmd: true,
 *       handler: () => navigateToPage(null), // Go to daily notes
 *       description: 'Open daily notes',
 *     },
 *   ]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options?: UseKeyboardShortcutsOptions
): void {
  const enabled = options?.enabled ?? true;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if shortcuts are disabled
      if (!enabled) {
        return;
      }

      // Skip if focus is in an input element (except for Escape)
      const target = event.target as HTMLElement;
      // Check for contenteditable via property (true/false), attribute ('true'), or string property ('true')
      const isContentEditable =
        target.isContentEditable === true ||
        target.getAttribute?.('contenteditable') === 'true' ||
        (target as { contentEditable?: string }).contentEditable === 'true';
      const isInputElement =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || isContentEditable;

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          // Allow Escape to work in input elements, but block other shortcuts
          if (isInputElement && shortcut.key.toLowerCase() !== 'escape') {
            continue;
          }

          // Prevent default browser behavior
          event.preventDefault();
          event.stopPropagation();

          // Execute handler
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Register global keydown listener
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

// ============================================================================
// Pre-built Shortcut Hooks
// ============================================================================

/**
 * Hook that registers the standard app keyboard shortcuts
 *
 * Shortcuts:
 * - Ctrl+D / Cmd+D: Navigate to daily notes view (sets currentPageId to null)
 *
 * @param options - Optional configuration
 */
export function useAppKeyboardShortcuts(options?: UseKeyboardShortcutsOptions): void {
  // Get navigation action from store
  // Note: We need to get the store state/actions without causing re-renders
  const setCurrentPageToNull = useCallback(() => {
    // Setting currentPageId to null shows the daily notes view (default component)
    useAppStore.setState({ currentPageId: null });
  }, []);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'd',
      ctrlOrCmd: true,
      handler: setCurrentPageToNull,
      description: 'Navigate to daily notes',
    },
  ];

  useKeyboardShortcuts(shortcuts, options);
}

export default useKeyboardShortcuts;
