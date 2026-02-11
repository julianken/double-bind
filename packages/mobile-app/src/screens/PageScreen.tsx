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
 * - Edit mode with inline text editing
 */

import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardExtendedBaseView } from 'react-native-external-keyboard';
import type { OnKeyPress } from 'react-native-external-keyboard';
import type { Block, BlockId, PageId } from '@double-bind/types';
import { createServices } from '@double-bind/core';
import { FloatingActionButton } from '@double-bind/mobile-primitives';
import { useDatabase } from '../hooks/useDatabase';
import type { PagesStackScreenProps } from '../navigation/types';
import { buildBlockTree } from '../utils/blockTree';

// iOS Escape key code (UIKeyboardHIDUsage.keyboardEscape)
const ESCAPE_KEY_CODE = 41;

type Props = PagesStackScreenProps<'Page'>;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

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
  const [editingBlockId, setEditingBlockId] = React.useState<BlockId | null>(null);
  const [editingContent, setEditingContent] = React.useState('');

  // Services ref for block operations
  const servicesRef = React.useRef<ReturnType<typeof createServices> | null>(null);

  // Load page data
  const loadPage = React.useCallback(async () => {
    if (!db) return;

    try {
      setError(null);
      const loadedServices = createServices(db);
      servicesRef.current = loadedServices;
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
          onPress={() => {
            if (isEditMode && editingBlockId) {
              // Save current edit before exiting edit mode
              void handleSaveEdit();
            }
            setIsEditMode((prev) => !prev);
            setEditingBlockId(null);
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={isEditMode ? 'Done editing' : 'Edit page'}
          testID="edit-mode-toggle"
        >
          <Text style={styles.headerButtonText}>{isEditMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditMode, editingBlockId]);

  // Handle pull to refresh
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    void loadPage();
  }, [loadPage]);

  // Handle block press - start editing in edit mode
  const handleBlockPress = React.useCallback(
    (blockId: BlockId, content: string) => {
      if (isEditMode) {
        // Save previous edit if switching blocks
        if (editingBlockId && editingBlockId !== blockId) {
          void handleSaveEdit();
        }
        setEditingBlockId(blockId);
        setEditingContent(content);
      } else {
        setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
      }
    },
    [isEditMode, editingBlockId]
  );

  // Handle save edit
  const handleSaveEdit = React.useCallback(async () => {
    if (!editingBlockId || !servicesRef.current) return;

    try {
      await servicesRef.current.blockService.updateContent(editingBlockId, editingContent);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [editingBlockId, editingContent, loadPage]);

  // Handle Enter key - save current block and create new block below (Roam-like behavior)
  const handleEnterPress = React.useCallback(
    async (contentBeforeEnter: string) => {
      if (!editingBlockId || !servicesRef.current) return;

      try {
        // Save current block with content (without the newline)
        await servicesRef.current.blockService.updateContent(editingBlockId, contentBeforeEnter);

        // Find the current block to get its parentId (for creating sibling)
        const currentBlock = blocks.find((b) => b.blockId === editingBlockId);
        const parentId = currentBlock?.parentId ?? null;

        // Create new block after current one
        const newBlock = await servicesRef.current.blockService.createBlock(
          pageId as PageId,
          parentId, // Same parent = sibling
          '', // empty content
          editingBlockId // afterBlockId - place after current block
        );

        await loadPage();
        // Start editing the new block
        setEditingBlockId(newBlock.blockId);
        setEditingContent('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create block');
      }
    },
    [editingBlockId, blocks, pageId, loadPage]
  );

  // Handle text change - detect Enter key press
  const handleTextChange = React.useCallback(
    (text: string) => {
      // Check if Enter was pressed (newline added)
      if (text.includes('\n')) {
        // Get content before the newline
        const contentBeforeEnter = text.split('\n')[0];
        setEditingContent(contentBeforeEnter);
        void handleEnterPress(contentBeforeEnter);
      } else {
        setEditingContent(text);
      }
    },
    [handleEnterPress]
  );

  // Handle Escape key - delete empty block or save and deselect
  const handleEscapePress = React.useCallback(async () => {
    if (!editingBlockId || !servicesRef.current) return;

    const trimmedContent = editingContent.trim();

    if (trimmedContent === '') {
      // Empty block - delete it
      try {
        await servicesRef.current.blockService.deleteBlock(editingBlockId);
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete block');
      }
    } else {
      // Block has content - save it
      try {
        await servicesRef.current.blockService.updateContent(editingBlockId, editingContent);
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    }

    // Exit editing mode
    setEditingBlockId(null);
    setEditingContent('');
  }, [editingBlockId, editingContent, loadPage]);

  // Handle hardware keyboard key press events (via react-native-external-keyboard)
  const handleHardwareKeyPress = React.useCallback(
    (e: OnKeyPress) => {
      const keyCode = e.nativeEvent.keyCode;
      // Check for Escape key (iOS keyCode 41)
      if (keyCode === ESCAPE_KEY_CODE) {
        void handleEscapePress();
      }
    },
    [handleEscapePress]
  );

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

  // Handle create new block
  const handleCreateBlock = React.useCallback(async () => {
    if (!servicesRef.current) return;

    try {
      // Find the last root-level block
      const rootBlocks = blocks.filter((b) => b.parentId === null);
      const lastRootBlock = rootBlocks[rootBlocks.length - 1];

      const newBlock = await servicesRef.current.blockService.createBlock(
        pageId as PageId,
        null, // parentId
        '', // empty content
        lastRootBlock?.blockId // afterBlockId
      );
      await loadPage();
      // Start editing the new block
      setEditingBlockId(newBlock.blockId);
      setEditingContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create block');
    }
  }, [blocks, pageId, loadPage]);

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
        <TouchableOpacity
          onPress={() => {
            setError(null);
            void loadPage();
          }}
          style={styles.retryButton}
        >
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
            onPress={handleCreateBlock}
            accessibilityLabel="Create new block"
            testID="create-block-fab"
          />
        )}
      </View>
    );
  }

  // Render a single block
  const renderBlock = (item: { block: Block; depth: number; hasChildren: boolean }) => {
    const { block, depth, hasChildren } = item;
    const isEditing = editingBlockId === block.blockId;
    const isSelected = selectedBlockId === block.blockId;
    const marginLeft = depth * INDENT_SIZE;

    return (
      <TouchableOpacity
        key={block.blockId}
        onPress={() => handleBlockPress(block.blockId, String(block.content))}
        style={[
          styles.blockContainer,
          { marginLeft },
          isSelected && styles.blockSelected,
          isEditing && styles.blockEditing,
        ]}
        activeOpacity={0.7}
        testID={`block-${block.blockId}`}
      >
        {/* Bullet */}
        <TouchableOpacity
          onPress={() => hasChildren && handleToggleCollapse(block.blockId)}
          style={styles.bulletContainer}
        >
          {hasChildren ? (
            <Text style={styles.collapseIcon}>
              {collapsedBlocks.has(block.blockId) ? '▶' : '▼'}
            </Text>
          ) : (
            <View style={styles.bullet} />
          )}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.contentContainer}>
          {isEditing ? (
            <KeyboardExtendedBaseView
              style={styles.editingRow}
              focusable
              onKeyDownPress={handleHardwareKeyPress}
            >
              <TextInput
                style={styles.textInput}
                value={editingContent}
                onChangeText={handleTextChange}
                autoFocus
                multiline
                blurOnSubmit={false}
                placeholder="Type here..."
                placeholderTextColor="#8E8E93"
                testID={`block-input-${block.blockId}`}
              />
              <TouchableOpacity
                onPress={() => void handleEscapePress()}
                style={styles.cancelButton}
                accessibilityLabel="Cancel editing"
                testID={`cancel-block-${block.blockId}`}
              >
                <Text style={styles.cancelButtonText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  void handleSaveEdit();
                  setEditingBlockId(null);
                }}
                style={styles.saveButton}
                accessibilityLabel="Save block"
                testID={`save-block-${block.blockId}`}
              >
                <Text style={styles.saveButtonText}>✓</Text>
              </TouchableOpacity>
            </KeyboardExtendedBaseView>
          ) : (
            <Text style={styles.blockText}>
              {String(block.content) || (isEditMode ? 'Tap to edit...' : '')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Main render with ScrollView (workaround for FlatList bug)
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {headerComponent}
        {blockList.map(renderBlock)}
      </ScrollView>
      {isEditMode && (
        <FloatingActionButton
          icon="+"
          onPress={handleCreateBlock}
          accessibilityLabel="Create new block"
          testID="create-block-fab"
        />
      )}
    </KeyboardAvoidingView>
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
  // Block styles
  blockContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  blockSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  blockEditing: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  bulletContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
  },
  collapseIcon: {
    fontSize: 10,
    color: '#8E8E93',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 28,
  },
  blockText: {
    fontSize: 17,
    lineHeight: 22,
    color: '#000000',
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: '#000000',
    padding: 0,
    margin: 0,
    minHeight: 22,
  },
  editingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
