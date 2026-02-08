/**
 * useTheme - Hook for managing theme preference and application
 *
 * Handles:
 * - Reading theme preference from store
 * - Detecting system preference via prefers-color-scheme
 * - Applying theme to DOM via data-theme attribute
 * - Listening for system preference changes
 */

import { useEffect, useCallback } from 'react';
import { useAppStore, type ThemePreference, type ResolvedTheme } from '../stores/ui-store.js';

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve the actual theme to apply based on preference
 */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

/**
 * Apply theme to the DOM
 */
function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Hook that manages theme state and applies it to the DOM.
 *
 * @returns Object with theme state and setTheme function
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { themePreference, resolvedTheme, setTheme } = useTheme();
 *   return (
 *     <select value={themePreference} onChange={e => setTheme(e.target.value)}>
 *       <option value="light">Light</option>
 *       <option value="dark">Dark</option>
 *       <option value="system">System</option>
 *     </select>
 *   );
 * }
 * ```
 */
export function useTheme() {
  const themePreference = useAppStore((state) => state.themePreference);
  const setThemePreference = useAppStore((state) => state.setThemePreference);

  // Compute resolved theme
  const resolvedTheme = resolveTheme(themePreference);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (themePreference !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  const setTheme = useCallback(
    (preference: ThemePreference) => {
      setThemePreference(preference);
    },
    [setThemePreference]
  );

  return {
    themePreference,
    resolvedTheme,
    setTheme,
  };
}

/**
 * Initialize theme before React renders to prevent flash.
 * Call this in main.tsx before createRoot().
 */
export function initializeTheme(): void {
  if (typeof window === 'undefined') return;

  // Try to read persisted preference from localStorage
  try {
    const stored = localStorage.getItem('double-bind-ui');
    if (stored) {
      const parsed = JSON.parse(stored);
      const preference = parsed?.state?.themePreference as ThemePreference | undefined;
      if (preference && ['light', 'dark', 'system'].includes(preference)) {
        applyTheme(resolveTheme(preference));
        return;
      }
    }
  } catch {
    // localStorage unavailable or invalid, use system preference
  }

  // Default to system preference
  applyTheme(getSystemTheme());
}
