/**
 * useGlobalKeyboardShortcuts - Global keyboard shortcuts handler
 *
 * Registers and manages global keyboard shortcuts that work anywhere in the app.
 * Shortcuts are defined in docs/frontend/keyboard-first.md.
 *
 * Currently supported shortcuts:
 * - Ctrl+N / Cmd+N: Create new page
 *
 * Note: This hook handles only non-editor shortcuts. Editor shortcuts
 * (Enter, Tab, etc.) are handled by ProseMirror's keymap plugin.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { UseCreatePageResult } from './useCreatePage.js';

/**
 * Actions that can be triggered by keyboard shortcuts.
 */
export interface KeyboardShortcutActions {
  /** Action for Ctrl+N: create new page */
  onCreateNewPage?: () => void;
}

/**
 * Options for useGlobalKeyboardShortcuts hook.
 */
export interface UseGlobalKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Hook that registers global keyboard shortcuts.
 *
 * Listens for keyboard events on the window and triggers
 * corresponding actions when shortcut keys are pressed.
 *
 * @param actions - Object containing action callbacks for each shortcut
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function App() {
 *   const { createPage } = useCreatePage();
 *
 *   useGlobalKeyboardShortcuts({
 *     onCreateNewPage: () => createPage(),
 *   });
 *
 *   return <MainContent />;
 * }
 * ```
 */
export function useGlobalKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  options: UseGlobalKeyboardShortcutsOptions = {}
): void {
  const { enabled = true } = options;

  // Use ref to avoid stale closures in event handler
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check for Ctrl+N or Cmd+N (Mac)
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (isCtrlOrCmd && event.key.toLowerCase() === 'n') {
      // Prevent default browser behavior (new window)
      event.preventDefault();

      if (actionsRef.current.onCreateNewPage) {
        actionsRef.current.onCreateNewPage();
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Convenience hook that combines useCreatePage with useGlobalKeyboardShortcuts.
 *
 * This is the recommended way to set up keyboard shortcuts for page creation.
 *
 * @param createPageResult - Result from useCreatePage hook
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function App() {
 *   const createPageResult = useCreatePage();
 *
 *   useNewPageShortcut(createPageResult);
 *
 *   return <MainContent />;
 * }
 * ```
 */
export function useNewPageShortcut(
  createPageResult: UseCreatePageResult,
  options: UseGlobalKeyboardShortcutsOptions = {}
): void {
  const { createPage, isCreating } = createPageResult;

  useGlobalKeyboardShortcuts(
    {
      onCreateNewPage: () => {
        // Don't trigger if already creating
        if (!isCreating) {
          createPage();
        }
      },
    },
    options
  );
}
