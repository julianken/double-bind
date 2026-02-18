/**
 * AccessibilitySection - Reduced motion, high contrast, and focus ring settings.
 *
 * Acceptance criteria:
 * - Reduced Motion toggle sets `data-reduced-motion` on html
 *
 * Note: Font scale is in the Appearance section.
 */

import { useSettingsStore } from '../stores/settings-store.js';
import type { AccessibilityOverride } from '../stores/settings-store.js';
import { SettingRow } from './SettingRow.js';
import { SettingToggle } from './SettingToggle.js';
import { SegmentedButton } from './SegmentedButton.js';
import styles from './AccessibilitySection.module.css';

const OVERRIDE_OPTIONS: { value: AccessibilityOverride; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

export function AccessibilitySection() {
  const {
    reducedMotion,
    highContrast,
    animateFocusRings,
    setReducedMotion,
    setHighContrast,
    setAnimateFocusRings,
  } = useSettingsStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Accessibility</h2>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Motion &amp; Animation</h3>

        <SettingRow
          label="Reduced Motion"
          description='Minimizes animations. "System" follows the OS preference.'
        >
          <SegmentedButton
            value={reducedMotion}
            options={OVERRIDE_OPTIONS}
            onChange={setReducedMotion}
            aria-label="Reduced motion"
          />
        </SettingRow>

        <SettingRow
          label="Animate Focus Rings"
          description="Show animated outlines when navigating with the keyboard."
          htmlFor="animate-focus-rings"
        >
          <SettingToggle
            id="animate-focus-rings"
            checked={animateFocusRings}
            onChange={setAnimateFocusRings}
          />
        </SettingRow>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Display</h3>

        <SettingRow
          label="High Contrast"
          description='Increases contrast for text and borders. "System" follows the OS preference.'
        >
          <SegmentedButton
            value={highContrast}
            options={OVERRIDE_OPTIONS}
            onChange={setHighContrast}
            aria-label="High contrast"
          />
        </SettingRow>

        <p className={styles.note}>
          To adjust font scaling, see the Font Scale setting in the Appearance section.
        </p>
      </div>
    </div>
  );
}
