/**
 * PageListScreen - Displays all pages in the database.
 *
 * Features:
 * - Full list of all pages sorted by last updated
 * - Pull to refresh
 * - Navigation to individual pages
 * - FAB for creating new pages
 */

import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import type { Page } from '@double-bind/types';
import type { PagesStackScreenProps } from '../navigation/types';
import { useDatabase } from '../hooks/useDatabase';
import { useCreatePage } from '../hooks/useCreatePage';
import { FloatingActionButton, NewPageModal } from '@double-bind/mobile-primitives';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components';

type Props = PagesStackScreenProps<'PageList'>;

export function PageListScreen({ navigation }: Props): ReactElement {
  const { services, isLoading: dbLoading, error: dbError, isReady } = useDatabase();
  const { createPage, isCreating } = useCreatePage();

  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    loadPages();
  }, [isReady, services, loadPages]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPages();
  }, [loadPages]);

  const handleCreatePage = useCallback(
    async (title: string) => {
      // Don't clear error here - let user see it until operation succeeds
      const result = await createPage(title);

      if (result.error) {
        setCreateError(result.error.message);
        return; // Keep modal open
      }

      if (result.page) {
        setCreateError(null); // Clear only on success
        setShowNewPageModal(false);
        // Navigate to the new page
        navigation.navigate('Page', { pageId: result.page.pageId });
        // Refresh the list
        await loadPages();
      }
    },
    [createPage, navigation, loadPages]
  );

  // Show database loading state
  if (dbLoading) {
    return <LoadingSpinner message="Initializing database..." />;
  }

  // Show database error state
  if (dbError) {
    return <ErrorMessage message={dbError} />;
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
          onAction={() => setShowNewPageModal(true)}
        />
        <NewPageModal
          visible={showNewPageModal}
          onClose={() => {
            setShowNewPageModal(false);
            setCreateError(null); // Clear error when modal closes
          }}
          onSubmit={handleCreatePage}
          isLoading={isCreating}
          error={createError}
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
    const pageTitle = item.title || 'Untitled';

    return (
      <TouchableOpacity
        style={styles.pageItem}
        onPress={() => navigation.navigate('Page', { pageId: item.pageId })}
        accessibilityRole="button"
        accessibilityLabel={`Open page ${pageTitle}${isDailyNote ? ', daily note' : ''}`}
      >
        <View style={styles.pageInfo}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {pageTitle}
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

      <FloatingActionButton
        icon="+"
        onPress={() => setShowNewPageModal(true)}
        accessibilityLabel="Create new page"
      />

      <NewPageModal
        visible={showNewPageModal}
        onClose={() => {
          setShowNewPageModal(false);
          setCreateError(null); // Clear error when modal closes
        }}
        onSubmit={handleCreatePage}
        isLoading={isCreating}
        error={createError}
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
    paddingBottom: 80, // Space for FAB
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
