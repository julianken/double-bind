/**
 * HomeScreen - Main dashboard/daily notes screen
 *
 * Entry point for the app showing:
 * - Today's daily note (quick access)
 * - Recent pages
 * - Quick actions
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FloatingActionButton } from '@double-bind/mobile-primitives';
import type { HomeStackScreenProps } from '../navigation/types';

type Props = HomeStackScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props): React.ReactElement {
  const today = new Date().toISOString().split('T')[0]!;

  const handleDailyNote = React.useCallback(() => {
    navigation.navigate('DailyNote', { date: today });
  }, [navigation, today]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Pages</Text>
          <Text style={styles.placeholder}>No recent pages yet</Text>
        </View>
      </View>
      <FloatingActionButton
        icon="📅"
        onPress={handleDailyNote}
        accessibilityLabel="Open today's daily note"
        testID="daily-note-fab"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
