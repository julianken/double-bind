/**
 * SearchScreen - Full-text search with real-time results
 *
 * Provides full-text search across:
 * - Page titles
 * - Block content
 *
 * Features:
 * - Real-time search with 300ms debounce
 * - Result previews with context
 * - Navigation to search results
 * - Keyboard handling (search button, dismiss)
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import type { SearchStackScreenProps } from '../navigation/types';
import type { SearchResult } from '@double-bind/types';
import { SearchService } from '@double-bind/core';
import { useDatabase } from '../hooks/useDatabase';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';

type Props = SearchStackScreenProps<'Search'>;

const DEBOUNCE_DELAY_MS = 300;
const MAX_SNIPPET_LENGTH = 150;
const MIN_QUERY_LENGTH = 2;

export function SearchScreen({ navigation, route }: Props): ReactElement {
  const { db, status: dbStatus } = useDatabase();
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    // Reset state if query is too short
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }

    // Set searching state immediately
    setIsSearching(true);
    setError(null);

    // Debounce the actual search
    const timeoutId = setTimeout(async () => {
      if (!db || dbStatus !== 'ready') {
        setIsSearching(false);
        setError('Database not ready');
        return;
      }

      try {
        const searchService = new SearchService(db);
        const searchResults = await searchService.search(query.trim(), {
          limit: 50,
          minScore: 0,
        });
        setResults(searchResults);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_DELAY_MS);

    // Cleanup timeout on query change or unmount
    return () => clearTimeout(timeoutId);
  }, [query, db, dbStatus]);

  const handleClearQuery = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss();
      // Navigate to the page containing the result
      // For now, navigate to Page screen with pageId
      navigation.navigate('SearchResults', { query: result.pageId });
    },
    [navigation]
  );

  const truncateSnippet = (content: string): string => {
    if (content.length <= MAX_SNIPPET_LENGTH) {
      return content;
    }
    return content.slice(0, MAX_SNIPPET_LENGTH) + '...';
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.type === 'page' ? 'Page' : 'Block'}: ${item.title}`}
    >
      <View style={styles.resultHeader}>
        <Text style={styles.resultType}>{item.type === 'page' ? 'PAGE' : 'BLOCK'}</Text>
        <Text style={styles.resultTitle}>{item.title}</Text>
      </View>
      <Text style={styles.resultContent} numberOfLines={3}>
        {truncateSnippet(item.content)}
      </Text>
      <Text style={styles.resultScore}>Relevance: {item.score.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    // Database not ready
    if (dbStatus !== 'ready') {
      return (
        <EmptyState
          title="Database Loading"
          description="Please wait while the database initializes..."
        />
      );
    }

    // Error state
    if (error) {
      return (
        <ErrorMessage
          message={error}
          onRetry={() => {
            setError(null);
            setQuery(query); // Trigger search again
          }}
        />
      );
    }

    // Empty query state
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return (
        <EmptyState
          title="Start Searching"
          description={`Enter at least ${MIN_QUERY_LENGTH} characters to search pages and blocks.`}
        />
      );
    }

    // Searching state
    if (isSearching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      );
    }

    // No results state
    if (results.length === 0) {
      return <EmptyState title="No Results" description={`No pages or blocks match "${query}"`} />;
    }

    // Results list
    return (
      <FlatList
        data={results}
        renderItem={renderSearchResult}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        keyboardShouldPersistTaps="handled"
      />
    );
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
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search input"
          onSubmitEditing={Keyboard.dismiss}
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearQuery}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderContent()}
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
    alignItems: 'center',
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
  clearButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minHeight: 44,
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: 44,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
  },
  resultTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  resultContent: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 20,
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
