/**
 * EditorSection - Editor behavior settings (default block type, auto-save, etc.)
 */

import { useSettingsStore } from '../stores/settings-store.js';
import type { DefaultBlockType } from '../stores/settings-store.js';
import { SettingRow } from './SettingRow.js';
import { SettingToggle } from './SettingToggle.js';
import { SegmentedButton } from './SegmentedButton.js';
import styles from './EditorSection.module.css';

const BLOCK_TYPE_OPTIONS: { value: DefaultBlockType; label: string }[] = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'heading', label: 'Heading' },
];

export function EditorSection() {
  const {
    defaultBlockType,
    markdownRendering,
    focusModeDefault,
    setDefaultBlockType,
    setMarkdownRendering,
    setFocusModeDefault,
  } = useSettingsStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Editor</h2>

      <div className={styles.group}>
        <h3 className={styles.groupHeading}>Behavior</h3>

        <SettingRow
          label="Default Block Type"
          description="The block type created when pressing Enter on an empty page."
        >
          <SegmentedButton
            value={defaultBlockType}
            options={BLOCK_TYPE_OPTIONS}
            onChange={setDefaultBlockType}
            aria-label="Default block type"
          />
        </SettingRow>

        <SettingRow
          label="Markdown Rendering"
          description="Render markdown syntax in the editor (bold, italics, headings)."
          htmlFor="markdown-rendering"
        >
          <SettingToggle
            id="markdown-rendering"
            checked={markdownRendering}
            onChange={setMarkdownRendering}
          />
        </SettingRow>

        <SettingRow
          label="Focus Mode by Default"
          description="Start new sessions with focus mode enabled."
          htmlFor="focus-mode-default"
        >
          <SettingToggle
            id="focus-mode-default"
            checked={focusModeDefault}
            onChange={setFocusModeDefault}
          />
        </SettingRow>
      </div>
    </div>
  );
}
