/**
 * useSettingsSync - Cross-window settings synchronisation hook.
 *
 * The SettingsStore persists to `localStorage` under the key
 * `double-bind-settings`. When this window writes to localStorage,
 * the browser fires a `storage` event in *other* windows that share
 * the same origin.
 *
 * This hook:
 * 1. In the SETTINGS window — subscribes to SettingsStore and applies
 *    DOM side-effects (theme, font-scale, reduced-motion) immediately
 *    so the settings window itself reflects the chosen values.
 * 2. In the MAIN window — listens for `storage` events from the
 *    settings window and re-hydrates the SettingsStore so the main
 *    window reflects the chosen values immediately.
 *
 * Both windows call this hook; the direction of sync is symmetric —
 * whichever window changed the value, the other window picks it up.
 */

import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settings-store.js';

const SETTINGS_STORAGE_KEY = 'double-bind-settings';

/**
 * Apply settings DOM side-effects from a parsed settings state snapshot.
 * Shared between initial load and storage-event updates.
 */
function applySettingsToDOM(state: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;

  // Theme
  const themePreference = state.themePreference as string | undefined;
  if (themePreference) {
    const resolved =
      themePreference === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : themePreference;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  // Font scale
  const fontScale = state.fontScale as number | undefined;
  if (fontScale !== undefined) {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }

  // Reduced motion
  const reducedMotion = state.reducedMotion as string | undefined;
  if (reducedMotion) {
    document.documentElement.dataset.reducedMotion = reducedMotion;
  }
}

/**
 * Hook that enables cross-window settings sync via localStorage storage events.
 *
 * Mount this hook in both the main window App and the SettingsApp so that
 * changes made in either window propagate to the other immediately.
 *
 * @example
 * ```tsx
 * function App() {
 *   useSettingsSync();
 *   return <AppShell />;
 * }
 * ```
 */
export function useSettingsSync(): void {
  // Apply DOM side-effects whenever this window's store changes.
  // This ensures the settings window itself reflects live changes.
  const themePreference = useSettingsStore((s) => s.themePreference);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const resolved =
      themePreference === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : themePreference;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [themePreference]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  // Listen for settings changes made by another window.
  useEffect(() => {
    function handleStorageEvent(event: StorageEvent): void {
      if (event.key !== SETTINGS_STORAGE_KEY || !event.newValue) return;

      try {
        const parsed = JSON.parse(event.newValue) as { state?: Record<string, unknown> };
        const newState = parsed.state;
        if (!newState) return;

        // Re-hydrate the Zustand store with the new state so that any
        // components subscribed to SettingsStore update automatically.
        // Cast through unknown because the parsed type is Record<string, unknown>
        // but we validated the key before calling setState.
        useSettingsStore.setState(newState as unknown as Parameters<typeof useSettingsStore.setState>[0]);

        // Also apply DOM side-effects directly so the change takes effect
        // even before the next React render cycle.
        applySettingsToDOM(newState);
      } catch {
        // Malformed localStorage value — ignore.
      }
    }

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);
}
