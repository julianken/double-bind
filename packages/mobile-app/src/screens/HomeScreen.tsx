/**
 * HomeScreen - Main dashboard/daily notes screen
 *
 * Entry point for the app showing:
 * - Today's daily note (quick access)
 * - Recent pages
 * - Quick actions
 */

import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { HomeStackScreenProps } from '../navigation/types';

type Props = HomeStackScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props): React.ReactElement {
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Double Bind</Text>
        <Text style={styles.subtitle}>Your graph-native note-taking app</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('DailyNote', { date: today })}
          accessibilityRole="button"
          accessibilityLabel="Open today's daily note"
        >
          <Text style={styles.buttonText}>Today&apos;s Daily Note</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Pages</Text>
          <Text style={styles.placeholder}>No recent pages yet</Text>
        </View>
      </View>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
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
