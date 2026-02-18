/**
 * settings-window - Utility for opening the Settings Tauri webview.
 *
 * The settings window is pre-configured in tauri.conf.json with
 * label "settings" and visible: false. We show it on demand and
 * set focus so it appears instantly.
 *
 * Falls back gracefully in non-Tauri contexts (browser dev/E2E).
 */

/**
 * Opens (or focuses) the settings window.
 *
 * In Tauri: reveals the pre-created hidden window and sets focus.
 * In browser: silently ignores so development workflows are unaffected.
 *
 * @example
 * ```ts
 * await openSettingsWindow();
 * ```
 */
export async function openSettingsWindow(): Promise<void> {
  try {
    const { Window } = await import('@tauri-apps/api/window');
    const settingsWindow = await Window.getByLabel('settings');

    if (!settingsWindow) {
      console.warn('[settings-window] Settings window not found in Tauri window list.');
      return;
    }

    // Show the window if it is hidden, then bring it to the front.
    await settingsWindow.show();
    await settingsWindow.setFocus();
    await settingsWindow.unminimize();
  } catch {
    // Not in a Tauri context (browser dev or E2E test).
    // Silently ignore so development workflows are unaffected.
  }
}

/**
 * Closes the settings window without destroying it (hides it instead).
 * The window is kept alive so re-opening it is instant.
 */
export async function closeSettingsWindow(): Promise<void> {
  try {
    const { Window } = await import('@tauri-apps/api/window');
    const settingsWindow = await Window.getByLabel('settings');
    if (settingsWindow) {
      await settingsWindow.hide();
    }
  } catch {
    // Not in Tauri context — ignore.
  }
}
