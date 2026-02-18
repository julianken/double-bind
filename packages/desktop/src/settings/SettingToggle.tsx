/**
 * SettingToggle - Accessible toggle switch for boolean settings.
 *
 * Renders a styled checkbox that visually appears as a pill-shaped
 * on/off switch. Uses native checkbox semantics for accessibility.
 */

import styles from './SettingToggle.module.css';

export interface SettingToggleProps {
  /** Controlled checked state */
  checked: boolean;
  /** Called when the user toggles the switch */
  onChange: (checked: boolean) => void;
  /** Optional id for associating with a label via htmlFor */
  id?: string;
  /** Accessible label when no visible label is provided */
  'aria-label'?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

/**
 * Pill-shaped toggle switch component.
 *
 * @example
 * ```tsx
 * <SettingToggle
 *   id="reduced-motion"
 *   checked={reducedMotion === 'on'}
 *   onChange={(checked) => setReducedMotion(checked ? 'on' : 'off')}
 * />
 * ```
 */
export function SettingToggle({
  checked,
  onChange,
  id,
  'aria-label': ariaLabel,
  disabled = false,
}: SettingToggleProps) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles['toggle--disabled'] : ''}`}>
      <input
        type="checkbox"
        id={id}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className={`${styles.track} ${checked ? styles['track--on'] : ''}`} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
