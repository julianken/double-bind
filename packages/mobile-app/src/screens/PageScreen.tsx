/**
 * PageScreen - Individual page view
 *
 * Displays a single page with its blocks.
 * Supports editing, navigation to linked pages, and block operations.
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PagesStackScreenProps } from '../navigation/types';

type Props = PagesStackScreenProps<'Page'>;

export function PageScreen({ route }: Props): React.ReactElement {
  const { pageId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.pageId}>Page ID: {pageId}</Text>
        <Text style={styles.placeholder}>Page content will appear here.</Text>
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
  },
});
