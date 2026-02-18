/**
 * DataStorageSection - Storage info, import/export, and reset actions.
 */

import { useSettingsStore } from '../stores/settings-store.js';
import styles from './DataStorageSection.module.css';

export function DataStorageSection() {
  const { resetToDefaults } = useSettingsStore();

  function handleResetDefaults() {
    if (
      window.confirm(
        'Reset all settings to their defaults? This cannot be undone.'
      )
    ) {
      resetToDefaults();
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Data &amp; Storage</h2>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Storage</h3>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Database</span>
          <span className={styles.infoValue}>SQLite (local)</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Settings</span>
          <span className={styles.infoValue}>localStorage</span>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Danger Zone</h3>
        <div className={styles.dangerCard}>
          <div className={styles.dangerInfo}>
            <span className={styles.dangerLabel}>Reset All Settings</span>
            <p className={styles.dangerDescription}>
              Restores appearance, editor, hotkey, and accessibility settings to their defaults.
              Your notes are not affected.
            </p>
          </div>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={handleResetDefaults}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
