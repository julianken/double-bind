/**
 * SettingsApp - Root component for the settings Tauri webview.
 *
 * Mounts the settings window layout and activates cross-window
 * settings sync via the useSettingsSync hook.
 */

import { useSettingsSync } from '../hooks/useSettingsSync.js';
import { SettingsWindow } from './SettingsWindow.js';

/**
 * Root component rendered in settings.html.
 * Handles cross-window sync initialization.
 */
export function SettingsApp() {
  // Sync settings changes from this window to the main window
  useSettingsSync();

  return <SettingsWindow />;
}
