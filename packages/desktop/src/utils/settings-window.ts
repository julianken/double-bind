/**
 * settings-window - Utility for opening the Settings Tauri webview.
 *
 * The settings window is pre-configured in tauri.conf.json with
 * label "settings" and visible: false. We show it on demand and
 * set focus so it appears instantly.
 *
 * In browser dev mode, falls back to navigating to the /settings route.
 */

import { useAppStore } from '../stores/ui-store.js';

/**
 * Opens (or focuses) the settings window.
 *
 * In Tauri: reveals the pre-created hidden window and sets focus.
 * In browser: navigates to the /settings route within the main app.
 *
 * @example
 * ```ts
 * await openSettingsWindow();
 * ```
 */
export async function openSettingsWindow(): Promise<void> {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const settingsWindow = await WebviewWindow.getByLabel('settings');

    if (!settingsWindow) {
      useAppStore.getState().navigateToPage('settings');
      return;
    }

    await settingsWindow.show();
    await settingsWindow.setFocus();
    await settingsWindow.unminimize();
  } catch {
    useAppStore.getState().navigateToPage('settings');
  }
}

/**
 * Closes the settings window without destroying it (hides it instead).
 * The window is kept alive so re-opening it is instant.
 */
export async function closeSettingsWindow(): Promise<void> {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const settingsWindow = await WebviewWindow.getByLabel('settings');
    if (settingsWindow) {
      await settingsWindow.hide();
    }
  } catch {
    // Not in Tauri context — ignore.
  }
}
