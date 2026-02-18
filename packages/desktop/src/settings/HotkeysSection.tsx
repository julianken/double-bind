/**
 * HotkeysSection - Display and rebind keyboard shortcuts.
 *
 * Shows the full shortcut table with current bindings (custom or default).
 * Each shortcut can be rebound inline via ShortcutEditor.
 */

import { useSettingsStore } from '../stores/settings-store.js';
import { SettingRow } from './SettingRow.js';
import { ShortcutEditor } from './ShortcutEditor.js';
import styles from './HotkeysSection.module.css';

// ============================================================================
// Shortcut definitions
// ============================================================================

interface ShortcutDef {
  action: string;
  label: string;
  description: string;
  defaultChord: string;
}

const SHORTCUT_GROUPS: { heading: string; shortcuts: ShortcutDef[] }[] = [
  {
    heading: 'Navigation',
    shortcuts: [
      { action: 'goBack',          label: 'Go Back',          description: 'Navigate back in history',         defaultChord: 'Cmd+[' },
      { action: 'goForward',       label: 'Go Forward',       description: 'Navigate forward in history',      defaultChord: 'Cmd+]' },
      { action: 'openGraph',       label: 'Open Graph',       description: 'Switch to graph view',             defaultChord: 'Cmd+G' },
      { action: 'toggleSidebar',   label: 'Toggle Sidebar',   description: 'Cycle sidebar mode',               defaultChord: 'Cmd+\\' },
    ],
  },
  {
    heading: 'Commands',
    shortcuts: [
      { action: 'commandPalette',  label: 'Command Palette',  description: 'Open command palette',             defaultChord: 'Cmd+K' },
      { action: 'quickCapture',    label: 'Quick Capture',    description: 'Focus quick capture input',        defaultChord: 'Cmd+Shift+K' },
      { action: 'openSettings',    label: 'Open Settings',    description: 'Open the settings window',         defaultChord: 'Cmd+,' },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export function HotkeysSection() {
  const { customBindings, setCustomBinding } = useSettingsStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Hotkeys</h2>
      <p className={styles.intro}>
        Click a shortcut badge to rebind it. Press Backspace to clear a binding and restore the default.
      </p>

      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.heading} className={styles.group}>
          <h3 className={styles.groupHeading}>{group.heading}</h3>
          {group.shortcuts.map((shortcut) => (
            <SettingRow
              key={shortcut.action}
              label={shortcut.label}
              description={shortcut.description}
            >
              <ShortcutEditor
                action={shortcut.action}
                chord={customBindings[shortcut.action] ?? null}
                defaultChord={shortcut.defaultChord}
                onChange={setCustomBinding}
              />
            </SettingRow>
          ))}
        </div>
      ))}
    </div>
  );
}
