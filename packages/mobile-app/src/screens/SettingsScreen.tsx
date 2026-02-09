/**
 * SettingsScreen - Main settings screen
 *
 * App configuration including:
 * - Theme settings
 * - Database settings
 * - About
 */

import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { SettingsStackScreenProps } from '../navigation/types';

type Props = SettingsStackScreenProps<'Settings'>;

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
}

function SettingsItem({ title, subtitle, onPress }: SettingsItemProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.settingsItemContent}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export function SettingsScreen({ navigation }: Props): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Appearance</Text>
        <SettingsItem
          title="Theme"
          subtitle="Light"
          onPress={() => navigation.navigate('ThemeSettings')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Data</Text>
        <SettingsItem
          title="Database"
          subtitle="Manage your data"
          onPress={() => navigation.navigate('DatabaseSettings')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Information</Text>
        <SettingsItem title="About" onPress={() => navigation.navigate('About')} />
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
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 17,
    color: '#000000',
  },
  settingsItemSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '600',
  },
});
