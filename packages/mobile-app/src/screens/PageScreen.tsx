/**
 * PageScreen - Individual page view with full block tree rendering
 *
 * Displays a single page with its complete block hierarchy.
 * Supports:
 * - Full block tree rendering with proper indentation
 * - Collapsible/expandable nested blocks
 * - Smooth scrolling for large pages
 * - Loading and error states
 */

import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { Block, BlockId } from '@double-bind/types';
import { createServices } from '@double-bind/core';
import { BlockList, type BlockListItem } from '@double-bind/mobile-primitives';
import { useDatabase } from '../hooks/useDatabase';
import type { PagesStackScreenProps } from '../navigation/types';

type Props = PagesStackScreenProps<'Page'>;

/**
 * Build a flat list of blocks with hierarchy information for FlatList rendering.
 * This function traverses the block tree and creates a flattened structure
 * with depth information for proper indentation.
 *
 * @param blocks - All blocks for the page
 * @param parentId - Current parent ID to filter children (null = root blocks)
 * @param depth - Current nesting depth
 * @param collapsedBlocks - Set of collapsed block IDs
 * @returns Flattened array of blocks with depth and hierarchy metadata
 */
function buildBlockTree(
  blocks: Block[],
  parentId: BlockId | null,
  depth: number,
  collapsedBlocks: Set<BlockId>
): BlockListItem[] {
  // Get direct children of the current parent
  const children = blocks
    .filter((block) => block.parentId === parentId && !block.isDeleted)
    .sort((a, b) => a.order.localeCompare(b.order));

  const result: BlockListItem[] = [];

  for (const block of children) {
    // Check if this block has children
    const hasChildren = blocks.some((b) => b.parentId === block.blockId && !b.isDeleted);

    // Add this block to the result
    result.push({
      block,
      depth,
      hasChildren,
    });

    // Recursively add children if not collapsed
    if (hasChildren && !collapsedBlocks.has(block.blockId)) {
      result.push(...buildBlockTree(blocks, block.blockId, depth + 1, collapsedBlocks));
    }
  }

  return result;
}

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

  // Load page data
  const loadPage = React.useCallback(async () => {
    if (!db) return;

    try {
      setError(null);
      const services = createServices(db);
      const pageWithBlocks = await services.pageService.getPageWithBlocks(pageId);

      setPage(pageWithBlocks.page);
      setBlocks(pageWithBlocks.blocks);

      // Set navigation title
      navigation.setOptions({
        title: pageWithBlocks.page.title || 'Untitled',
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

  // Handle pull to refresh
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    void loadPage();
  }, [loadPage]);

  // Handle block press (select)
  const handleBlockPress = React.useCallback((blockId: BlockId) => {
    setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  // Handle block long press (future: show context menu)
  const handleBlockLongPress = React.useCallback((_blockId: BlockId) => {
    // TODO: Show context menu for block actions (edit, delete, etc.)
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

  // Build flat block list for FlatList
  const blockList = React.useMemo(
    () => buildBlockTree(blocks, null, 0, collapsedBlocks),
    [blocks, collapsedBlocks]
  );

  // Loading state
  if (dbStatus === 'initializing' || isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {dbStatus === 'initializing' ? 'Initializing database...' : 'Loading page...'}
        </Text>
      </View>
    );
  }

  // Error state
  if (dbStatus === 'error' || error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'Database initialization failed'}</Text>
      </View>
    );
  }

  // Empty state (no blocks)
  if (blockList.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>{page?.title || 'Untitled'}</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No blocks yet</Text>
          <Text style={styles.emptySubtext}>Tap to start writing</Text>
        </View>
      </View>
    );
  }

  // Render page with blocks
  return (
    <View style={styles.container}>
      <BlockList
        blocks={blockList}
        selectedBlockId={selectedBlockId}
        onBlockPress={handleBlockPress}
        onBlockLongPress={handleBlockLongPress}
        onBlockToggleCollapse={handleToggleCollapse}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        headerComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.pageTitle}>{page?.title || 'Untitled'}</Text>
            <Text style={styles.blockCount}>
              {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
            </Text>
          </View>
        }
        testID="page-screen-block-list"
      />
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
