/**
 * PageScreen - Individual page view with full block tree rendering and edit mode
 *
 * Displays a single page with its complete block hierarchy.
 * NOTE: Uses ScrollView instead of FlatList due to a React Native render bug.
 *
 * Supports:
 * - Full block tree rendering with proper indentation
 * - Collapsible/expandable nested blocks
 * - Smooth scrolling for large pages
 * - Loading and error states
 * - Edit mode toggle
 */

import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import type { Block, BlockId } from '@double-bind/types';
import { createServices } from '@double-bind/core';
import { BlockView, FloatingActionButton } from '@double-bind/mobile-primitives';
import { useDatabase } from '../hooks/useDatabase';
import type { PagesStackScreenProps } from '../navigation/types';
import { buildBlockTree } from '../utils/blockTree';

type Props = PagesStackScreenProps<'Page'>;

export function PageScreen({ route, navigation }: Props): React.ReactElement {
  const { pageId } = route.params;
  const { db, status: dbStatus } = useDatabase();

  const [page, setPage] = React.useState<{ title: string } | null>(null);
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Set<BlockId>>(new Set());
  const [selectedBlockId, setSelectedBlockId] = React.useState<BlockId | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Load page data
  const loadPage = React.useCallback(async () => {
    if (!db) return;

    try {
      setError(null);
      const loadedServices = createServices(db);
      const pageWithBlocks = await loadedServices.pageService.getPageWithBlocks(pageId);

      setPage(pageWithBlocks.page);
      setBlocks(pageWithBlocks.blocks);

      // Set navigation title
      const navTitle = String(pageWithBlocks.page.title || 'Untitled');
      navigation.setOptions({
        title: navTitle,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [db, pageId, navigation]);

  // Initial load
  React.useEffect(() => {
    if (dbStatus === 'ready' && db) {
      void loadPage();
    }
  }, [dbStatus, db, loadPage]);

  // Update header with edit/done button
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setIsEditMode((prev) => !prev)}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={isEditMode ? 'Done editing' : 'Edit page'}
          testID="edit-mode-toggle"
        >
          <Text style={styles.headerButtonText}>{isEditMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditMode]);

  // Handle pull to refresh
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    void loadPage();
  }, [loadPage]);

  // Handle block press
  const handleBlockPress = React.useCallback(
    (blockId: BlockId) => {
      setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
    },
    []
  );

  // Handle block long press
  const handleBlockLongPress = React.useCallback((_blockId: BlockId) => {
    // Future: show context menu
  }, []);

  // Handle toggle collapse
  const handleToggleCollapse = React.useCallback((blockId: BlockId) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  // Build flat block list for rendering
  const blockList = React.useMemo(() => {
    return buildBlockTree(blocks, null, 0, collapsedBlocks);
  }, [blocks, collapsedBlocks]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading page...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{String(error)}</Text>
        <TouchableOpacity onPress={() => loadPage()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Header component
  const headerComponent = (
    <View style={styles.headerContainer}>
      <Text style={styles.pageTitle}>{String(page?.title || 'Untitled')}</Text>
      <Text style={styles.blockCount}>
        {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
      </Text>
    </View>
  );

  // Empty state
  if (blockList.length === 0) {
    return (
      <View style={styles.container}>
        {headerComponent}
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No blocks yet</Text>
          <Text style={styles.emptySubtext}>
            {isEditMode ? 'Tap + to start writing' : 'Tap Edit to start writing'}
          </Text>
        </View>
        {isEditMode && (
          <FloatingActionButton
            icon="+"
            onPress={() => {
              // Future: create new block
            }}
            accessibilityLabel="Create new block"
            testID="create-block-fab"
          />
        )}
      </View>
    );
  }

  // Main render with ScrollView (workaround for FlatList bug)
  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {headerComponent}
        {blockList.map((item) => (
          <BlockView
            key={item.block.blockId}
            block={item.block}
            depth={item.depth}
            hasChildren={item.hasChildren}
            isSelected={selectedBlockId === item.block.blockId}
            onPress={handleBlockPress}
            onLongPress={handleBlockLongPress}
            onToggleCollapse={handleToggleCollapse}
            testID={`block-${item.block.blockId}`}
          />
        ))}
      </ScrollView>
      {isEditMode && (
        <FloatingActionButton
          icon="+"
          onPress={() => {
            // Future: create new block
          }}
          accessibilityLabel="Create new block"
          testID="create-block-fab"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  scrollContent: {
    paddingBottom: 100, // Space for FAB
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  blockCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
