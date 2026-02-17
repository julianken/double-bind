/**
 * PagesScreen - Displays all pages in the database.
 *
 * Features:
 * - Full list of all pages sorted by last updated
 * - Pull to refresh
 * - Navigation to individual pages
 */

import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import type { Page } from '@double-bind/types';
import { useDatabase } from '../hooks/useDatabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

export interface PagesScreenProps {
  /** Navigation handler for page selection */
  onPagePress?: (pageId: string) => void;
  /** Handler to create a new page */
  onCreatePage?: () => void;
}

export function PagesScreen({ onPagePress, onCreatePage }: PagesScreenProps): ReactElement {
  const { services, isLoading: dbLoading, error: dbError, isReady } = useDatabase();

  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPages = useCallback(async () => {
    if (!services) return;

    try {
      setError(null);
      const allPages = await services.pageService.getAllPages();
      setPages(allPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [services]);

  useEffect(() => {
    if (!isReady || !services) return;

    let mounted = true;

    async function load() {
      if (!services) return;

      try {
        setError(null);
        const allPages = await services.pageService.getAllPages();
        if (mounted) setPages(allPages);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load pages');
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isReady, services]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPages();
  }, [loadPages]);

  // Show database loading state
  if (dbLoading) {
    return <LoadingSpinner message="Initializing database..." />;
  }

  // Show database error state - ensure dbError is a string
  if (dbError) {
    const errorMsg = typeof dbError === 'string' ? dbError : String(dbError);
    return <ErrorMessage message={errorMsg} />;
  }

  // Show content loading state
  if (isLoading) {
    return <LoadingSpinner message="Loading pages..." />;
  }

  // Show error state
  if (error) {
    return <ErrorMessage message={error} onRetry={loadPages} />;
  }

  // Show empty state
  if (pages.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No pages yet"
          description="Create your first page to start taking notes"
          actionLabel="Create Page"
          onAction={onCreatePage}
        />
      </View>
    );
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPageItem = ({ item }: { item: Page }) => {
    const isDailyNote = item.dailyNoteDate !== null;

    return (
      <TouchableOpacity
        style={styles.pageItem}
        onPress={() => onPagePress?.(item.pageId)}
        accessibilityRole="button"
        accessibilityLabel={`Open page ${item.title || 'Untitled'}${isDailyNote ? ', daily note' : ''}`}
      >
        <View style={styles.pageInfo}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {item.title || 'Untitled'}
          </Text>
          <Text style={styles.pageDate}>Updated {formatDate(item.updatedAt)}</Text>
        </View>
        {isDailyNote && (
          <View style={styles.dailyNoteBadge}>
            <Text style={styles.dailyNoteBadgeText}>Daily</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pages}
        keyExtractor={(item) => item.pageId}
        renderItem={renderPageItem}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.headerText}>{pages.length} pages</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContent: {
    paddingBottom: 16,
  },
  headerText: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pageItem: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  pageInfo: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  pageDate: {
    fontSize: 13,
    color: '#999',
  },
  dailyNoteBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  dailyNoteBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1976D2',
  },
});
