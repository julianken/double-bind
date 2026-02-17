/**
 * PageListScreen - Displays all pages in the database.
 *
 * Uses NewPageModal from mobile-primitives for creating new pages.
 * The modal uses ModalOverlay (workaround for RN Modal rendering bug).
 *
 * Phase 1 Redesign:
 * - FlatList virtualization for performance
 * - PageCard component with shadow and metadata
 * - Memoized components to prevent re-renders
 * - Brand indigo (#5856D6) FAB color
 */

import React, { useEffect, useState, useCallback, type ReactElement, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  type ListRenderItemInfo,
} from 'react-native';
import type { Page, PageId } from '@double-bind/types';
import type { PagesStackScreenProps } from '../navigation/types';
import { useDatabase } from '../hooks/useDatabase';
import { useCreatePage } from '../hooks/useCreatePage';
import { FloatingActionButton, NewPageModal } from '@double-bind/mobile-primitives';
import { ErrorMessage, EmptyState, PageListSkeleton } from '../components';

// ============================================================================
// Constants
// ============================================================================

/** Brand indigo color for primary actions */
const BRAND_INDIGO = '#5856D6';

/** iOS system gray background */
const BACKGROUND_COLOR = '#F2F2F7';

/** Minimum touch target per iOS HIG */
const MIN_TOUCH_TARGET = 44;

// ============================================================================
// PageCard Component
// ============================================================================

interface PageCardProps {
  page: Page;
  onPress: (pageId: PageId) => void;
}

/**
 * Memoized page card with shadow and metadata.
 * Prevents re-renders when parent list updates.
 */
const PageCard = memo(function PageCard({ page, onPress }: PageCardProps) {
  const handlePress = useCallback(() => {
    onPress(page.pageId);
  }, [onPress, page.pageId]);

  // Format date for display
  const formattedDate = new Date(page.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const isDailyNote = Boolean(page.dailyNoteDate);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${page.title || 'Untitled'}${isDailyNote ? ', daily note' : ''}`}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {page.title || 'Untitled'}
        </Text>
        <View style={styles.cardMeta}>
          {isDailyNote && (
            <View style={styles.dailyNoteBadge}>
              <Text style={styles.dailyNoteBadgeText}>Daily</Text>
            </View>
          )}
          <Text style={styles.cardDate}>{formattedDate}</Text>
        </View>
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
});

// ============================================================================
// PageListScreen Component
// ============================================================================

type Props = PagesStackScreenProps<'PageList'>;

export function PageListScreen({ navigation }: Props): ReactElement {
  const { services, isLoading: dbLoading, error: dbError, isReady } = useDatabase();
  const { createPage, isCreating } = useCreatePage();

  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const handleNavigateToPage = useCallback(
    (pageId: PageId) => {
      navigation.navigate('Page', { pageId });
    },
    [navigation]
  );

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

  const handleOpenModal = useCallback(() => {
    setShowNewPageModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowNewPageModal(false);
    setCreateError(null);
  }, []);

  // Render individual page item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Page>) => <PageCard page={item} onPress={handleNavigateToPage} />,
    [handleNavigateToPage]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Page) => item.pageId, []);

  // Show database loading state with skeleton
  if (dbLoading) {
    return <PageListSkeleton count={6} />;
  }

  // Show database error state
  if (dbError) {
    const errorMsg = typeof dbError === 'string' ? dbError : String(dbError);
    return <ErrorMessage message={errorMsg} />;
  }

  // Show content loading state with skeleton
  if (isLoading) {
    return <PageListSkeleton count={6} />;
  }

  // Show error state
  if (error) {
    return <ErrorMessage message={error} onRetry={loadPages} />;
  }

  // Main content (empty or list)
  return (
    <View style={styles.container}>
      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Create your first page to start taking notes"
          actionLabel="Create Page"
          onAction={handleOpenModal}
        />
      ) : (
        <FlatList
          data={pages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND_INDIGO}
            />
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          // Accessibility
          accessibilityRole="list"
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </Text>
          }
        />
      )}

      {/* FAB with brand indigo color */}
      <FloatingActionButton
        icon="+"
        onPress={handleOpenModal}
        accessibilityLabel="Create new page"
        style={styles.fab}
      />

      {/* Single modal instance - prevents duplication bug */}
      <NewPageModal
        visible={showNewPageModal}
        onClose={handleCloseModal}
        onSubmit={handleCreatePage}
        isLoading={isCreating}
        error={createError}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  dailyNoteBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dailyNoteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976D2',
  },
  cardChevron: {
    fontSize: 22,
    color: '#C6C6C8',
    marginLeft: 8,
  },
  fab: {
    backgroundColor: BRAND_INDIGO,
  },
});
