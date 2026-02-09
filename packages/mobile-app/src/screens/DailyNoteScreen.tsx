/**
 * DailyNoteScreen - Daily note view
 *
 * Shows the daily note for a specific date.
 * Creates a new daily note if one doesn't exist.
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { HomeStackScreenProps } from '../navigation/types';

type Props = HomeStackScreenProps<'DailyNote'>;

export function DailyNoteScreen({ route }: Props): React.ReactElement {
  const date = route.params?.date ?? new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.placeholder}>Daily note content will appear here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  date: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
