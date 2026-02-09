/**
 * PageListScreen - Page list view
 *
 * Shows all pages in the database with:
 * - Search/filter capability
 * - Sort options
 * - Page creation
 */

import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PagesStackScreenProps } from '../navigation/types';

type Props = PagesStackScreenProps<'PageList'>;

export function PageListScreen({ navigation }: Props): React.ReactElement {
  // Placeholder page for demonstration
  const handlePagePress = (pageId: string) => {
    navigation.navigate('Page', { pageId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.pageItem}
          onPress={() => handlePagePress('example-page-id')}
          accessibilityRole="button"
          accessibilityLabel="Example page"
        >
          <Text style={styles.pageTitle}>Example Page</Text>
          <Text style={styles.pageSubtitle}>Tap to view</Text>
        </TouchableOpacity>

        <Text style={styles.placeholder}>Your pages will appear here.</Text>
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
  pageItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
