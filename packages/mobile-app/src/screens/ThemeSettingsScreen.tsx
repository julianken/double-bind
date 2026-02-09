/**
 * ThemeSettingsScreen - Theme configuration
 *
 * Allows users to select:
 * - Light mode
 * - Dark mode
 * - System default
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { SettingsStackScreenProps } from '../navigation/types';

type Props = SettingsStackScreenProps<'ThemeSettings'>;

interface ThemeOptionProps {
  title: string;
  selected: boolean;
  onPress: () => void;
}

function ThemeOption({ title, selected, onPress }: ThemeOptionProps): ReactElement {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      <Text style={styles.optionTitle}>{title}</Text>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

type ThemeMode = 'light' | 'dark' | 'system';

export function ThemeSettingsScreen(_props: Props): ReactElement {
  // Placeholder - will be connected to theme context
  // Using state so TypeScript doesn't narrow the type
  const [selectedTheme] = useState<ThemeMode>('light');

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <ThemeOption
          title="Light"
          selected={selectedTheme === 'light'}
          onPress={() => {
            /* TODO: Set theme */
          }}
        />
        <ThemeOption
          title="Dark"
          selected={selectedTheme === 'dark'}
          onPress={() => {
            /* TODO: Set theme */
          }}
        />
        <ThemeOption
          title="System"
          selected={selectedTheme === 'system'}
          onPress={() => {
            /* TODO: Set theme */
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  optionTitle: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
  },
  checkmark: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
});
