/**
 * HopSelector — Dropdown to control how many hops from a selected node are shown.
 *
 * Options: 1-hop, 2-hop, 3-hop, All
 * Default: All (show the full graph)
 */

import styles from './HopSelector.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HopCount = 1 | 2 | 3 | 'all';

export interface HopSelectorProps {
  /** Currently selected hop count */
  value: HopCount;
  /** Called when the user changes the hop count */
  onChange: (value: HopCount) => void;
  /** Whether the control is disabled (e.g., no node is selected) */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const OPTIONS: Array<{ value: HopCount; label: string; title: string }> = [
  { value: 1, label: '1 hop', title: 'Show only directly connected nodes' },
  { value: 2, label: '2 hops', title: 'Show nodes up to 2 hops away' },
  { value: 3, label: '3 hops', title: 'Show nodes up to 3 hops away' },
  { value: 'all', label: 'All', title: 'Show the full graph' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hop count selector for graph neighborhood filtering.
 *
 * @example
 * ```tsx
 * <HopSelector
 *   value={hopCount}
 *   onChange={setHopCount}
 *   disabled={selectedNodeId === null}
 * />
 * ```
 */
export function HopSelector({ value, onChange, disabled = false }: HopSelectorProps) {
  return (
    <div
      className={`${styles.container} ${disabled ? styles.containerDisabled : ''}`}
      data-testid="hop-selector"
    >
      <label className={styles.label} htmlFor="hop-selector-select">
        Hops
      </label>
      <div className={styles.buttonGroup} role="group" aria-label="Hop count">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            id={option.value === value ? 'hop-selector-select' : undefined}
            className={`${styles.button} ${value === option.value ? styles.buttonActive : ''}`}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            title={option.title}
            aria-pressed={value === option.value}
            data-testid={`hop-option-${option.value}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
