/**
 * DatabaseSettingsScreen - Database management
 *
 * Provides options for:
 * - Backup/restore
 * - Clear cache
 * - Export data
 */

import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { SettingsStackScreenProps } from '../navigation/types';

type Props = SettingsStackScreenProps<'DatabaseSettings'>;

interface ActionButtonProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  destructive?: boolean;
}

function ActionButton({
  title,
  subtitle,
  onPress,
  destructive,
}: ActionButtonProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={[styles.actionTitle, destructive && styles.destructive]}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export function DatabaseSettingsScreen(_props: Props): React.ReactElement {
  const handleBackup = () => {
    Alert.alert('Backup', 'Database backup feature coming soon.');
  };

  const handleRestore = () => {
    Alert.alert('Restore', 'Database restore feature coming soon.');
  };

  const handleExport = () => {
    Alert.alert('Export', 'Data export feature coming soon.');
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will clear temporary data. Your notes will not be affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {} },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Backup & Restore</Text>
        <ActionButton
          title="Create Backup"
          subtitle="Save a copy of your database"
          onPress={handleBackup}
        />
        <ActionButton
          title="Restore from Backup"
          subtitle="Load a previous backup"
          onPress={handleRestore}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Data Management</Text>
        <ActionButton
          title="Export Data"
          subtitle="Export as JSON or Markdown"
          onPress={handleExport}
        />
        <ActionButton
          title="Clear Cache"
          subtitle="Remove temporary files"
          onPress={handleClearCache}
          destructive
        />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Your data is stored locally on this device using CozoDB with SQLite.
        </Text>
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
  actionButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  actionTitle: {
    fontSize: 17,
    color: '#007AFF',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  destructive: {
    color: '#FF3B30',
  },
  infoSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
});
