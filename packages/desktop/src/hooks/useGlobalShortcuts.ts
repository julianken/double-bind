/**
 * useGlobalShortcuts - Global keyboard shortcut handler
 *
 * Registers global keyboard shortcuts that work anywhere in the app.
 * These are app-level navigation shortcuts that should be active
 * regardless of what component has focus.
 *
 * Shortcuts:
 * - Ctrl+[ (or Cmd+[ on Mac): Navigate back in history
 * - Ctrl+] (or Cmd+] on Mac): Navigate forward in history
 * - Ctrl+G (or Cmd+G on Mac): Open graph view
 * - Ctrl+\ (or Cmd+\ on Mac): Cycle sidebar mode (open → rail → closed → open)
 * - Ctrl+K (or Cmd+K on Mac): Open command palette
 * - Ctrl+Shift+K (or Cmd+Shift+K on Mac): Focus quick capture
 * - Ctrl+, (or Cmd+, on Mac): Open settings window
 * - Ctrl+Shift+F (or Cmd+Shift+F on Mac): Toggle focus mode
 * - Ctrl+Shift+T (or Cmd+Shift+T on Mac): Toggle typewriter mode
 *
 * See docs/frontend/keyboard-first.md for the full shortcut documentation.
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/ui-store.js';
import { openSettingsWindow } from '../utils/settings-window.js';

/**
 * Checks if the event matches a keyboard shortcut with Ctrl (or Cmd on Mac).
 * @param event - The keyboard event
 * @param key - The key to match (e.g., '[', ']', 'g')
 */
function isCtrlKey(event: KeyboardEvent, key: string): boolean {
  // Check for Ctrl on Windows/Linux or Cmd on Mac
  const isModifierPressed = event.ctrlKey || event.metaKey;
  return isModifierPressed && event.key.toLowerCase() === key.toLowerCase();
}

/**
 * Hook that registers global keyboard shortcuts for navigation.
 *
 * Shortcuts:
 * - Ctrl+[ (or Cmd+[ on Mac): Navigate back in history
 * - Ctrl+] (or Cmd+] on Mac): Navigate forward in history
 * - Ctrl+G (or Cmd+G on Mac): Open graph view
 * - Ctrl+\ (or Cmd+\ on Mac): Cycle sidebar mode (open → rail → closed → open)
 * - Ctrl+K (or Cmd+K on Mac): Open command palette
 * - Ctrl+Shift+K (or Cmd+Shift+K on Mac): Focus quick capture
 * - Ctrl+, (or Cmd+, on Mac): Open settings window
 * - Ctrl+Shift+F (or Cmd+Shift+F on Mac): Toggle focus mode
 * - Ctrl+Shift+T (or Cmd+Shift+T on Mac): Toggle typewriter mode
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

      // Ctrl+G - Open graph view
      if (isCtrlKey(event, 'g')) {
        event.preventDefault();
        useAppStore.getState().navigateToPage('graph');
        return;
      }

      // Ctrl+\ - Cycle sidebar mode (open → rail → closed → open)
      if (isCtrlKey(event, '\\')) {
        event.preventDefault();
        useAppStore.getState().cycleSidebarMode();
        return;
      }

      // Ctrl+Shift+K - Focus quick capture (check shift first to avoid conflict with Ctrl+K)
      if (isCtrlKey(event, 'k') && event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().setQuickCaptureFocused(true);
        return;
      }

      // Ctrl+K - Open command palette
      if (isCtrlKey(event, 'k')) {
        event.preventDefault();
        useAppStore.getState().toggleCommandPalette();
        return;
      }

      // Ctrl+, - Open settings window
      if (isCtrlKey(event, ',')) {
        event.preventDefault();
        void openSettingsWindow();
        return;
      }

      // Ctrl+Shift+F - Toggle focus mode
      if (isCtrlKey(event, 'f') && event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().toggleFocusMode();
        return;
      }

      // Ctrl+Shift+T - Toggle typewriter mode
      if (isCtrlKey(event, 't') && event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().toggleTypewriter();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
