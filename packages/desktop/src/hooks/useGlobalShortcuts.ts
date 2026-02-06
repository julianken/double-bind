/**
 * useGlobalShortcuts - Global keyboard shortcut handler
 *
 * Registers global keyboard shortcuts that work anywhere in the app.
 * These are app-level navigation shortcuts (Ctrl+[ for back, Ctrl+] for forward)
 * that should be active regardless of what component has focus.
 *
 * See docs/frontend/keyboard-first.md for the full shortcut documentation.
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/ui-store.js';

/**
 * Checks if the event matches a keyboard shortcut with Ctrl (or Cmd on Mac).
 * @param event - The keyboard event
 * @param key - The key to match (e.g., '[', ']')
 */
function isCtrlKey(event: KeyboardEvent, key: string): boolean {
  // Check for Ctrl on Windows/Linux or Cmd on Mac
  const isModifierPressed = event.ctrlKey || event.metaKey;
  return isModifierPressed && event.key === key;
}

/**
 * Hook that registers global keyboard shortcuts for navigation.
 *
 * Shortcuts:
 * - Ctrl+[ (or Cmd+[ on Mac): Navigate back in history
 * - Ctrl+] (or Cmd+] on Mac): Navigate forward in history
 *
 * These shortcuts work anywhere in the app and are not blocked by
 * editor focus or other components.
 *
 * @example
 * ```tsx
 * function App() {
 *   useGlobalShortcuts();
 *
 *   return (
 *     <AppShell>
 *       <Router routes={routes} />
 *     </AppShell>
 *   );
 * }
 * ```
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // Ctrl+[ - Navigate back
      if (isCtrlKey(event, '[')) {
        event.preventDefault();
        useAppStore.getState().goBack();
        return;
      }

      // Ctrl+] - Navigate forward
      if (isCtrlKey(event, ']')) {
        event.preventDefault();
        useAppStore.getState().goForward();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
