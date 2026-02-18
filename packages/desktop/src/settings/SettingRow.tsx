/**
 * SettingRow - Generic layout component for a label + control pair.
 *
 * Used throughout the settings sections to maintain consistent
 * label/description/control layout.
 */

import styles from './SettingRow.module.css';

export interface SettingRowProps {
  /** Primary label text */
  label: string;
  /** Optional descriptive text below the label */
  description?: string;
  /** The control element (toggle, slider, select, etc.) */
  children: React.ReactNode;
  /** Optional id used to associate label with control via htmlFor */
  htmlFor?: string;
}

/**
 * Renders a horizontal row with a label column and a control column.
 *
 * @example
 * ```tsx
 * <SettingRow label="Reduced Motion" description="Minimize animations" htmlFor="reduced-motion">
 *   <SettingToggle id="reduced-motion" checked={value} onChange={setValue} />
 * </SettingRow>
 * ```
 */
export function SettingRow({ label, description, children, htmlFor }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelGroup}>
        {htmlFor ? (
          <label className={styles.label} htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className={styles.label}>{label}</span>
        )}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
