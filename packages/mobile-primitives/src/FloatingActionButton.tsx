/**
 * FloatingActionButton - Material Design FAB for primary actions.
 *
 * A circular button that floats above the UI, following Material Design guidelines:
 * - 56dp (56px) size for primary FAB
 * - 44x44pt minimum touch target (iOS HIG)
 * - Elevated shadow for depth
 * - Icon-only design
 *
 * @example
 * ```tsx
 * <FloatingActionButton
 *   icon="+"
 *   onPress={() => createNewPage()}
 *   accessibilityLabel="Create new page"
 * />
 * ```
 */

import type { ReactElement } from 'react';
import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from 'react-native';

/**
 * Props for FloatingActionButton component.
 */
export interface FloatingActionButtonProps {
  /** Icon text to display (e.g., "+", "✎") */
  icon: string;
  /** Press handler */
  onPress: () => void;
  /** Accessibility label (required for screen readers) */
  accessibilityLabel: string;
  /** Optional test ID for testing */
  testID?: string;
  /** Optional additional styles */
  style?: ViewStyle;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Floating Action Button component following Material Design guidelines.
 *
 * Features:
 * - 56px diameter (Material Design standard)
 * - 44pt touch target minimum (iOS HIG compliance)
 * - Elevated shadow
 * - Icon-centered design
 * - Accessible to screen readers
 */
export function FloatingActionButton({
  icon,
  onPress,
  accessibilityLabel,
  testID = 'floating-action-button',
  style,
  disabled = false,
}: FloatingActionButtonProps): ReactElement {
  return (
    <TouchableOpacity
      style={[styles.fab, disabled && styles.fabDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    // Size: 56dp per Material Design
    width: 56,
    height: 56,
    borderRadius: 28,

    // Primary color (iOS blue)
    backgroundColor: '#007AFF',

    // Elevation/shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6, // Android elevation

    // Center icon
    justifyContent: 'center',
    alignItems: 'center',

    // Position
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  fabDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0.1,
  },
  icon: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
