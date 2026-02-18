/**
 * ShortcutEditor - Inline keyboard shortcut rebinding component.
 *
 * Shows the current chord for an action. Clicking the badge enters
 * recording mode where the next key combination is captured.
 * Escape cancels; recording the same chord is a no-op.
 * Pressing Backspace/Delete clears the binding.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ShortcutEditor.module.css';

// ============================================================================
// Utilities
// ============================================================================

/** Convert a KeyboardEvent to a human-readable chord string like "Cmd+K" */
function eventToChord(event: KeyboardEvent): string | null {
  const parts: string[] = [];

  if (event.metaKey) parts.push('Cmd');
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  const key = event.key;

  // Ignore modifier-only keypresses
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return null;

  // Map special keys to readable names
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
  };

  parts.push(keyMap[key] ?? key.toUpperCase());
  return parts.join('+');
}

// ============================================================================
// Component
// ============================================================================

export interface ShortcutEditorProps {
  /** The action identifier */
  action: string;
  /** The current chord string, or null if unbound */
  chord: string | null;
  /** Default chord shown as a hint when there is no custom binding */
  defaultChord?: string;
  /** Called with the new chord (null = clear binding) */
  onChange: (action: string, chord: string | null) => void;
}

/**
 * Inline shortcut rebinding badge.
 *
 * @example
 * ```tsx
 * <ShortcutEditor
 *   action="openSettings"
 *   chord={customBindings['openSettings'] ?? null}
 *   defaultChord="Cmd+,"
 *   onChange={(action, chord) => setCustomBinding(action, chord)}
 * />
 * ```
 */
export function ShortcutEditor({ action, chord, defaultChord, onChange }: ShortcutEditorProps) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayChord = chord ?? defaultChord ?? 'Unbound';
  const isCustom = chord !== null;

  const startRecording = useCallback(() => {
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
  }, []);

  // Capture keys while in recording mode
  useEffect(() => {
    if (!recording) return;

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      // Escape cancels
      if (event.key === 'Escape') {
        stopRecording();
        return;
      }

      // Backspace/Delete clears the binding
      if (event.key === 'Backspace' || event.key === 'Delete') {
        onChange(action, null);
        stopRecording();
        return;
      }

      const newChord = eventToChord(event);
      if (newChord) {
        onChange(action, newChord);
        stopRecording();
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [recording, action, onChange, stopRecording]);

  // Click outside to cancel recording
  useEffect(() => {
    if (!recording) return;

    function handleClickOutside(event: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        stopRecording();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [recording, stopRecording]);

  return (
    <div className={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.badge} ${recording ? styles['badge--recording'] : ''} ${isCustom ? styles['badge--custom'] : ''}`}
        onClick={recording ? stopRecording : startRecording}
        aria-label={recording ? 'Recording shortcut — press keys or Escape to cancel' : `Edit shortcut: currently ${displayChord}`}
        title={recording ? 'Press keys, Escape to cancel, Backspace to clear' : 'Click to rebind'}
      >
        {recording ? (
          <span className={styles.recordingLabel}>Recording...</span>
        ) : (
          displayChord.split('+').map((part, i) => (
            <span key={i}>
              {i > 0 && <span className={styles.plus}>+</span>}
              <kbd className={styles.key}>{part}</kbd>
            </span>
          ))
        )}
      </button>
      {isCustom && !recording && (
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => onChange(action, null)}
          aria-label="Reset to default shortcut"
          title="Reset to default"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}
    </div>
  );
}
