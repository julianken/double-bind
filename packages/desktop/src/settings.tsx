/**
 * Settings window entry point (WP-6).
 *
 * Mounts the full settings UI in the secondary Tauri webview
 * (label: "settings", defined in tauri.conf.json).
 *
 * The SettingsApp component handles:
 *   - Five settings sections (Appearance, Editor, Hotkeys, Data/Storage, Accessibility)
 *   - Cross-window sync via localStorage storage events
 *   - DOM side-effects (theme, font-scale, reduced-motion)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Design system — tokens, reset, and global styles
import '@double-bind/ui-primitives/styles';

import { initializeTheme } from './hooks/useTheme.js';
import { SettingsApp } from './settings/SettingsApp.js';

// Apply persisted theme before React renders to prevent flash
initializeTheme();

const rootElement = document.getElementById('settings-root');
if (!rootElement) {
  throw new Error('Failed to find settings-root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
);
