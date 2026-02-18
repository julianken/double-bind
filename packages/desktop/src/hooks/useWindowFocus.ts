/**
 * useWindowFocus - Subscribes to Tauri window focus/blur events.
 *
 * Keeps `windowFocused` in the Zustand store in sync with the OS window state
 * and mirrors it to `document.documentElement.dataset.windowFocused` so CSS
 * selectors can react to focus changes without a full re-render cascade.
 *
 * Falls back gracefully when running outside the Tauri context (browser dev
 * mode or unit tests) by leaving the attribute set to "true".
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/index.js';

export function useWindowFocus(): void {
  const setWindowFocused = useAppStore((s) => s.setWindowFocused);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function setup() {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const unlisten = await appWindow.onFocusChanged(({ payload }) => {
          setWindowFocused(payload);
          document.documentElement.dataset.windowFocused = payload ? 'true' : 'false';
        });
        cleanup = unlisten;
      } catch {
        // Not in Tauri context (browser dev mode)
        document.documentElement.dataset.windowFocused = 'true';
      }
    }

    setup();
    return () => cleanup?.();
  }, [setWindowFocused]);
}
