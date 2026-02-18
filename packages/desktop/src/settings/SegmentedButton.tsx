/**
 * SegmentedButton - Segmented control for selecting one option from several.
 *
 * Renders a row of connected buttons where exactly one is active at a time.
 * Suitable for compact multi-choice settings like line spacing or block type.
 */

import styles from './SegmentedButton.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional accessible label when the label alone is insufficient */
  ariaLabel?: string;
}

export interface SegmentedButtonProps<T extends string> {
  /** The currently selected value */
  value: T;
  /** Available options */
  options: SegmentedOption<T>[];
  /** Called when the user selects an option */
  onChange: (value: T) => void;
  /** Accessible group label */
  'aria-label': string;
}

/**
 * Segmented control component.
 *
 * @example
 * ```tsx
 * <SegmentedButton
 *   value={lineSpacing}
 *   options={[
 *     { value: 'compact', label: 'Compact' },
 *     { value: 'comfortable', label: 'Comfortable' },
 *     { value: 'relaxed', label: 'Relaxed' },
 *   ]}
 *   onChange={setLineSpacing}
 *   aria-label="Line spacing"
 * />
 * ```
 */
export function SegmentedButton<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedButtonProps<T>) {
  return (
    <div className={styles.group} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.option} ${option.value === value ? styles['option--active'] : ''}`}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
