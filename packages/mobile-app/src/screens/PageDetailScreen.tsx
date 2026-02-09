/**
 * PageDetailScreen - Modal page detail view
 *
 * Full-screen modal for viewing/editing a page.
 * Accessible from anywhere in the app via deep link.
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'PageDetail'>;

export function PageDetailScreen({ route }: Props): React.ReactElement {
  const { pageId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.pageId}>Page ID: {pageId}</Text>
        <Text style={styles.placeholder}>
          Page content will appear here. This is a modal view accessible from anywhere in the app.
        </Text>
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
  pageId: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8E8E93',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 22,
  },
});
