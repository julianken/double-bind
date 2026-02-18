/**
 * AppearanceSection - Theme, font scale, line spacing, and editor width settings.
 */

import { useSettingsStore } from '../stores/settings-store.js';
import type { LineSpacing, FontScale } from '../stores/settings-store.js';
import { SettingRow } from './SettingRow.js';
import { SettingSlider } from './SettingSlider.js';
import { SegmentedButton } from './SegmentedButton.js';
import { ThemePicker } from './ThemePicker.js';
import styles from './AppearanceSection.module.css';

const LINE_SPACING_OPTIONS: { value: LineSpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'relaxed', label: 'Relaxed' },
];

export function AppearanceSection() {
  const {
    themePreference,
    fontScale,
    lineSpacing,
    editorMaxWidth,
    setThemePreference,
    setFontScale,
    setLineSpacing,
    setEditorMaxWidth,
  } = useSettingsStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Appearance</h2>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Theme</h3>
        <ThemePicker value={themePreference} onChange={setThemePreference} />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Text</h3>
        <SettingRow
          label="Font Scale"
          description="Scales all UI text proportionally."
          htmlFor="font-scale"
        >
          <SettingSlider
            id="font-scale"
            value={fontScale}
            min={0.8}
            max={1.2}
            step={0.1}
            onChange={(v) => setFontScale(v as FontScale)}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </SettingRow>

        <SettingRow label="Line Spacing" description="Space between lines in the editor.">
          <SegmentedButton
            value={lineSpacing}
            options={LINE_SPACING_OPTIONS}
            onChange={setLineSpacing}
            aria-label="Line spacing"
          />
        </SettingRow>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Editor</h3>
        <SettingRow
          label="Editor Max Width"
          description="Maximum content width in pixels."
          htmlFor="editor-max-width"
        >
          <SettingSlider
            id="editor-max-width"
            value={editorMaxWidth}
            min={480}
            max={1200}
            step={40}
            onChange={setEditorMaxWidth}
            formatValue={(v) => `${v}px`}
          />
        </SettingRow>
      </div>
    </div>
  );
}
