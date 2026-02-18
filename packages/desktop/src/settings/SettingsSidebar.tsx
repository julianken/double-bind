/**
 * SettingsSidebar - Navigation sidebar for the settings window.
 *
 * Lists the five settings sections. Clicking a nav item activates
 * the corresponding content area via the activeSection prop.
 */

import styles from './SettingsSidebar.module.css';

// ============================================================================
// Section definitions
// ============================================================================

export type SettingsSection =
  | 'appearance'
  | 'editor'
  | 'hotkeys'
  | 'data-storage'
  | 'accessibility';

interface SectionItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
}

function AppearanceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function EditorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function HotkeysIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function AccessibilityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 22v-8" />
      <path d="M5 9l7-3 7 3" />
      <path d="M5 22l3-6 4 2 4-2 3 6" />
    </svg>
  );
}

const SECTIONS: SectionItem[] = [
  { id: 'appearance',    label: 'Appearance',    icon: <AppearanceIcon /> },
  { id: 'editor',        label: 'Editor',        icon: <EditorIcon /> },
  { id: 'hotkeys',       label: 'Hotkeys',       icon: <HotkeysIcon /> },
  { id: 'data-storage',  label: 'Data & Storage', icon: <StorageIcon /> },
  { id: 'accessibility', label: 'Accessibility', icon: <AccessibilityIcon /> },
];

// ============================================================================
// Component
// ============================================================================

export interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Settings sections">
      <ul className={styles.list} role="list">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              className={`${styles.item} ${section.id === activeSection ? styles['item--active'] : ''}`}
              onClick={() => onSectionChange(section.id)}
              aria-current={section.id === activeSection ? 'page' : undefined}
            >
              <span className={styles.icon}>{section.icon}</span>
              <span className={styles.label}>{section.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
