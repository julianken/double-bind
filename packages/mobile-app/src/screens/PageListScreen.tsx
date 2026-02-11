/**
 * PageListScreen - Displays all pages in the database.
 *
 * Uses NewPageModal from mobile-primitives for creating new pages.
 * The modal uses ModalOverlay (workaround for RN Modal rendering bug).
 */

import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    if (!services) return;

    try {
      setError(null);
      const allPages = await services.pageService.getAllPages();
      setPages(allPages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to load pages');
    } finally {
      setIsLoading(false);
    }
  }, [services]);

  useEffect(() => {
    if (!isReady || !services) return;
    loadPages();
  }, [isReady, services, loadPages]);

  const handleCreatePage = useCallback(
    async (title: string) => {
      const result = await createPage(title);

      if (result.error) {
        setCreateError(result.error.message);
        return;
      }

      if (result.page) {
        setCreateError(null);
        setShowNewPageModal(false);
        navigation.navigate('Page', { pageId: result.page.pageId });
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
          onAction={() => setShowNewPageModal(true)}
        />
        <NewPageModal
          visible={showNewPageModal}
          onClose={() => setShowNewPageModal(false)}
          onSubmit={handleCreatePage}
          isLoading={isCreating}
          error={createError}
        />
      </View>
    );
  }

  // Show page list (with FAB + Modal that starts hidden)
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Found {pages.length} pages</Text>
      {pages.map((page) => (
        <Text
          key={page.pageId}
          style={styles.pageItem}
          onPress={() => navigation.navigate('Page', { pageId: page.pageId })}
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${page.title || 'Untitled'}`}
        >
          {page.title || 'Untitled'}
        </Text>
      ))}
      <FloatingActionButton
        icon="+"
        onPress={() => setShowNewPageModal(true)}
        accessibilityLabel="Create new page"
      />
      <NewPageModal
        visible={showNewPageModal}
        onClose={() => setShowNewPageModal(false)}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  text: {
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
  },
  pageItem: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
