/**
 * SettingsWindow - Root layout for the settings webview.
 *
 * Two-column layout: SettingsSidebar (left) + content area (right).
 * Manages the active section state and renders the matching section component.
 */

import { useState } from 'react';
import { SettingsSidebar, type SettingsSection } from './SettingsSidebar.js';
import { AppearanceSection } from './AppearanceSection.js';
import { EditorSection } from './EditorSection.js';
import { HotkeysSection } from './HotkeysSection.js';
import { DataStorageSection } from './DataStorageSection.js';
import { AccessibilitySection } from './AccessibilitySection.js';
import styles from './SettingsWindow.module.css';

// ============================================================================
// Section content router
// ============================================================================

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'appearance':    return <AppearanceSection />;
    case 'editor':        return <EditorSection />;
    case 'hotkeys':       return <HotkeysSection />;
    case 'data-storage':  return <DataStorageSection />;
    case 'accessibility': return <AccessibilitySection />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function SettingsWindow() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

  return (
    <div className={styles.window}>
      <div className={styles.dragRegion} data-tauri-drag-region />
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <main className={styles.content} key={activeSection}>
        <div className={styles.scrollArea}>
          <SectionContent section={activeSection} />
        </div>
      </main>
    </div>
  );
}
