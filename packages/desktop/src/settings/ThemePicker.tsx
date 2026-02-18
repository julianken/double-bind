/**
 * ThemePicker - Visual theme selection grid for the settings window.
 *
 * Shows theme swatches for all available theme options.
 * Selecting a theme writes to SettingsStore and syncs via localStorage.
 */

import type { ThemePreference } from '../stores/ui-store.js';
import styles from './ThemePicker.module.css';

// ============================================================================
// Theme data
// ============================================================================

interface ThemeOption {
  value: ThemePreference;
  label: string;
  /** Preview background colour */
  bg: string;
  /** Preview surface colour */
  surface: string;
  /** Preview text colour */
  text: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light',    label: 'Light',    bg: '#ffffff', surface: '#f5f5f5', text: '#1a1a1a' },
  { value: 'dark',     label: 'Dark',     bg: '#1a1a2e', surface: '#16213e', text: '#e2e8f0' },
  { value: 'dim',      label: 'Dim',      bg: '#1e2432', surface: '#252d3a', text: '#cad3e0' },
  { value: 'sepia',    label: 'Sepia',    bg: '#f5ead7', surface: '#ede2c8', text: '#3b2f1e' },
  { value: 'hc-light', label: 'HC Light', bg: '#ffffff', surface: '#f0f0f0', text: '#000000' },
  { value: 'hc-dark',  label: 'HC Dark',  bg: '#000000', surface: '#111111', text: '#ffffff' },
  { value: 'system',   label: 'System',   bg: 'linear-gradient(135deg, #ffffff 50%, #1a1a2e 50%)', surface: '#888', text: '#888' },
];

// ============================================================================
// Component
// ============================================================================

export interface ThemePickerProps {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}

/**
 * Grid of theme swatches for the Appearance settings section.
 *
 * @example
 * ```tsx
 * <ThemePicker value={themePreference} onChange={setThemePreference} />
 * ```
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="Choose theme">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`${styles.swatch} ${option.value === value ? styles['swatch--active'] : ''}`}
          onClick={() => onChange(option.value)}
          title={option.label}
          aria-label={option.label}
        >
          <span
            className={styles.preview}
            style={{ background: option.bg }}
            aria-hidden="true"
          >
            <span
              className={styles.previewBar}
              style={{ background: option.value === 'system' ? '#888' : option.surface }}
            />
            <span
              className={styles.previewLine}
              style={{ background: option.value === 'system' ? '#ccc' : option.text, opacity: 0.6 }}
            />
            <span
              className={styles.previewLine}
              style={{ background: option.value === 'system' ? '#ccc' : option.text, opacity: 0.3, width: '55%' }}
            />
          </span>
          <span className={styles.label}>{option.label}</span>
          {option.value === value && (
            <span className={styles.checkmark} aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
