/**
 * SearchResultsScreen - Search results display
 *
 * Shows search results with:
 * - Matching pages
 * - Matching blocks with context
 * - Result highlighting
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SearchStackScreenProps } from '../navigation/types';

type Props = SearchStackScreenProps<'SearchResults'>;

export function SearchResultsScreen({ route }: Props): React.ReactElement {
  const { query } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.queryLabel}>Searching for:</Text>
        <Text style={styles.query}>&quot;{query}&quot;</Text>
        <Text style={styles.placeholder}>Search results will appear here.</Text>
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
  queryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  query: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
