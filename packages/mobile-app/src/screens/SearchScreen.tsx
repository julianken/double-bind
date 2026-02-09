/**
 * SearchScreen - Search input screen
 *
 * Provides full-text search across:
 * - Page titles
 * - Block content
 * - Tags
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import type { SearchStackScreenProps } from '../navigation/types';

type Props = SearchStackScreenProps<'Search'>;

export function SearchScreen({ navigation, route }: Props): ReactElement {
  const [query, setQuery] = useState(route.params?.query ?? '');

  const handleSearch = () => {
    if (query.trim()) {
      navigation.navigate('SearchResults', { query: query.trim() });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search pages and blocks..."
          placeholderTextColor="#8E8E93"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search input"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>Enter a search query to find pages and blocks.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#000000',
  },
  searchButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
