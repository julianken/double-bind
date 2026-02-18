/**
 * SettingSlider - Range slider component for numeric settings.
 *
 * Renders a styled range input with min/max labels and a live value
 * readout. Suitable for font scale, editor width, etc.
 */

import styles from './SettingSlider.module.css';

export interface SettingSliderProps {
  /** Current value */
  value: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step between values */
  step?: number;
  /** Called with the new value when changed */
  onChange: (value: number) => void;
  /** Optional id for associating with a label */
  id?: string;
  /** Format the displayed value string */
  formatValue?: (value: number) => string;
  /** Whether the slider is disabled */
  disabled?: boolean;
}

/**
 * Range slider with live value display.
 *
 * @example
 * ```tsx
 * <SettingSlider
 *   id="font-scale"
 *   value={fontScale}
 *   min={0.8}
 *   max={1.2}
 *   step={0.1}
 *   onChange={setFontScale}
 *   formatValue={(v) => `${Math.round(v * 100)}%`}
 * />
 * ```
 */
export function SettingSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  id,
  formatValue,
  disabled = false,
}: SettingSliderProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className={styles.container}>
      <input
        type="range"
        id={id}
        className={styles.slider}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
      />
      <span className={styles.value}>{displayValue}</span>
    </div>
  );
}
