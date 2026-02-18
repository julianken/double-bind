/**
 * useSidebarQuietMode - Dims the sidebar while the user is actively typing.
 *
 * Strategy:
 * - Listen for `keydown` events on `contenteditable` elements (ProseMirror editors).
 * - On any keystroke inside an editor: set `sidebarQuiet = true` in AppStore.
 * - After 1500ms of idle (no keystrokes): reset `sidebarQuiet = false`.
 *
 * The Sidebar component already reads `sidebarQuiet` from AppStore and applies
 * `data-quiet` to its container so that CSS can dim it.
 *
 * This hook should be registered once at the App level (e.g., inside App.tsx).
 *
 * @example
 * ```tsx
 * // In App.tsx:
 * useSidebarQuietMode();
 * ```
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Constants
// ============================================================================

/** Milliseconds of idle time before the sidebar recovers full opacity */
const IDLE_TIMEOUT_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

/**
 * useSidebarQuietMode monitors typing activity inside contenteditable regions
 * (ProseMirror editors) and sets `sidebarQuiet` on the AppStore accordingly.
 *
 * It uses a debounced idle timer: each keystroke resets the 1500ms countdown.
 * The sidebar recovers full opacity once the user stops typing for 1500ms.
 */
export function useSidebarQuietMode(): void {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Only react to keystrokes inside a contenteditable region (ProseMirror)
      const isInEditor =
        target.isContentEditable === true ||
        target.getAttribute?.('contenteditable') === 'true';

      if (!isInEditor) return;

      // Ignore modifier-only keypresses (Ctrl, Alt, Shift, Meta alone)
      const isModifierOnly =
        event.key === 'Control' ||
        event.key === 'Alt' ||
        event.key === 'Shift' ||
        event.key === 'Meta' ||
        event.key === 'CapsLock';

      if (isModifierOnly) return;

      // Mark sidebar as quiet immediately
      useAppStore.getState().setSidebarQuiet(true);

      // Reset idle timer
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        useAppStore.getState().setSidebarQuiet(false);
      }, IDLE_TIMEOUT_MS);
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);
}
