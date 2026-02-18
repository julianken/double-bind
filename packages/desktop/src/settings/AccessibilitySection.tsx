/**
 * AccessibilitySection - Reduced motion, high contrast, font scale, focus rings.
 *
 * Acceptance criteria:
 * - Reduced Motion toggle sets `data-reduced-motion` on html
 * - Font scale slider updates `--font-scale` in both windows
 */

import { useSettingsStore } from '../stores/settings-store.js';
import type { AccessibilityOverride, FontScale } from '../stores/settings-store.js';
import { SettingRow } from './SettingRow.js';
import { SettingToggle } from './SettingToggle.js';
import { SettingSlider } from './SettingSlider.js';
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
    fontScale,
    setReducedMotion,
    setHighContrast,
    setAnimateFocusRings,
    setFontScale,
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

        <SettingRow
          label="Font Scale"
          description="Scales all UI text proportionally. Applies to both windows immediately."
          htmlFor="a11y-font-scale"
        >
          <SettingSlider
            id="a11y-font-scale"
            value={fontScale}
            min={0.8}
            max={1.2}
            step={0.1}
            onChange={(v) => setFontScale(v as FontScale)}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </SettingRow>
      </div>
    </div>
  );
}
