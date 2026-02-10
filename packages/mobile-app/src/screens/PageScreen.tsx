/**
 * PageScreen - Individual page view with full block tree rendering and edit mode
 *
 * Displays a single page with its complete block hierarchy.
 * Supports:
 * - Full block tree rendering with proper indentation
 * - Collapsible/expandable nested blocks
 * - Smooth scrolling for large pages
 * - Loading and error states
 * - Edit mode with inline block editing
 * - Drag-and-drop block reordering (edit mode)
 * - Undo/redo support (edit mode)
 * - FAB for creating new blocks (edit mode)
 * - Wiki link autocomplete with [[ trigger (edit mode)
 */

import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import type { Block, BlockId, PageId } from '@double-bind/types';
import { createServices, type BlockService as CoreBlockService } from '@double-bind/core';
import {
  BlockList,
  DraggableBlockList,
  EditableBlockView,
  FloatingActionButton,
  useBlockOperations,
  type BlockService,
  type RenderBlockItemInfo,
} from '@double-bind/mobile-primitives';
import { useDatabase } from '../hooks/useDatabase';
import { useWikiLinkAutocomplete } from '../hooks/useWikiLinkAutocomplete';
import { useKeyboard } from '../editor/useKeyboard';
import { WikiLinkSuggestions } from '../editor/WikiLinkSuggestions';
import type { AutocompleteSuggestion } from '../editor/types';
import type { PagesStackScreenProps } from '../navigation/types';
import { buildBlockTree } from '../utils/blockTree';

type Props = PagesStackScreenProps<'Page'>;

/**
 * Adapter to make core BlockService compatible with mobile-primitives BlockService interface
 */
function createBlockServiceAdapter(
  coreBlockService: CoreBlockService,
  pageId: PageId
): BlockService {
  return {
    createBlock: async (
      _pageId: PageId,
      parentId: BlockId | null,
      content: string,
      afterBlockId?: BlockId
    ): Promise<Block> => {
      return coreBlockService.createBlock(pageId, parentId, content, afterBlockId);
    },
    deleteBlock: async (blockId: BlockId): Promise<void> => {
      return coreBlockService.deleteBlock(blockId);
    },
    updateContent: async (blockId: BlockId, content: string): Promise<void> => {
      return coreBlockService.updateContent(blockId, content);
    },
    getById: async (blockId: BlockId): Promise<Block | null> => {
      return coreBlockService.getById(blockId);
    },
  };
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

  // Edit mode state
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingBlockId, setEditingBlockId] = React.useState<BlockId | null>(null);

  // Wiki link autocomplete state
  const keyboard = useKeyboard();
  const {
    isActive: isAutocompleteActive,
    query: autocompleteQuery,
    suggestions,
    // isLoading is available but WikiLinkSuggestions handles empty state
    handleTrigger,
    handleSelect: handleAutocompleteSelect,
    handleDismiss: handleAutocompleteDismiss,
  } = useWikiLinkAutocomplete();
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState(0);

  // Track content for autocomplete trigger detection
  const contentByBlockRef = React.useRef<Map<BlockId, string>>(new Map());

  // Create services and block operations hook
  const services = React.useMemo(() => {
    if (!db) return null;
    return createServices(db);
  }, [db]);

  const blockServiceAdapter = React.useMemo(() => {
    if (!services) return null;
    return createBlockServiceAdapter(services.blockService, pageId as PageId);
  }, [services, pageId]);

  const { createBlock, deleteBlock, updateBlockContent, undo, redo, canUndo, canRedo } =
    useBlockOperations(
      blockServiceAdapter ?? {
        createBlock: async () => {
          throw new Error('Database not ready');
        },
        deleteBlock: async () => {
          throw new Error('Database not ready');
        },
        updateContent: async () => {
          throw new Error('Database not ready');
        },
        getById: async () => null,
      }
    );

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

  // Update header with edit/done button
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            setIsEditMode((prev) => {
              if (prev) {
                // Exiting edit mode - clear editing state
                setEditingBlockId(null);
              }
              return !prev;
            });
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={isEditMode ? 'Done editing' : 'Edit page'}
          accessibilityState={{ selected: isEditMode }}
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

  // Handle block press (select in view mode, start editing in edit mode)
  const handleBlockPress = React.useCallback(
    (blockId: BlockId) => {
      if (isEditMode) {
        setEditingBlockId(blockId);
        setSelectedBlockId(null);
      } else {
        setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
      }
    },
    [isEditMode]
  );

  // Handle block long press (future: show context menu)
  const handleBlockLongPress = React.useCallback((_blockId: BlockId) => {
    // In edit mode, long press initiates drag (handled by DraggableBlockList)
    // In view mode, could show context menu
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

  // Handle content save from EditableBlockView
  const handleContentSave = React.useCallback(
    async (blockId: BlockId, content: string) => {
      try {
        await updateBlockContent(blockId, content);
        // Reload to get the updated content
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save content');
      }
    },
    [updateBlockContent, loadPage]
  );

  // Handle Enter key press in EditableBlockView - create new sibling block
  const handleEnterPress = React.useCallback(
    async (blockId: BlockId) => {
      try {
        const currentBlock = blocks.find((b) => b.blockId === blockId);
        if (!currentBlock) return;

        const newBlock = await createBlock({
          pageId: pageId as PageId,
          parentId: currentBlock.parentId,
          content: '',
          afterBlockId: blockId,
        });
        await loadPage();
        setEditingBlockId(newBlock.blockId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create block');
      }
    },
    [blocks, createBlock, pageId, loadPage]
  );

  // Handle backspace on empty block - delete it
  const handleBackspaceEmpty = React.useCallback(
    async (blockId: BlockId) => {
      try {
        // Find the block before this one to focus after deletion
        const blockList = buildBlockTree(blocks, null, 0, collapsedBlocks);
        const currentIndex = blockList.findIndex((item) => item.block.blockId === blockId);
        const previousBlock = currentIndex > 0 ? blockList[currentIndex - 1] : null;

        await deleteBlock(blockId);
        await loadPage();

        // Focus previous block if available
        if (previousBlock) {
          setEditingBlockId(previousBlock.block.blockId);
        } else {
          setEditingBlockId(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete block');
      }
    },
    [blocks, collapsedBlocks, deleteBlock, loadPage]
  );

  // Handle swipe to delete
  const handleSwipeDelete = React.useCallback(
    async (blockId: BlockId) => {
      try {
        await deleteBlock(blockId);
        await loadPage();
        if (editingBlockId === blockId) {
          setEditingBlockId(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete block');
      }
    },
    [deleteBlock, loadPage, editingBlockId]
  );

  // Handle content change for autocomplete trigger detection
  const handleContentChange = React.useCallback(
    (blockId: BlockId, content: string) => {
      const previousContent = contentByBlockRef.current.get(blockId) || '';
      contentByBlockRef.current.set(blockId, content);

      // Detect [[ trigger pattern
      // Look for [[ that was just typed (not already in the previous content at same position)
      const bracketIndex = content.lastIndexOf('[[');
      if (bracketIndex !== -1) {
        // Get the query after [[
        const afterBrackets = content.substring(bracketIndex + 2);

        // Check if there's a closing ]] - if so, the link is already complete
        if (afterBrackets.includes(']]')) {
          // Link is complete, dismiss autocomplete if active
          if (isAutocompleteActive) {
            handleAutocompleteDismiss();
          }
          return;
        }

        // Check if this is a new trigger or continued typing
        const prevBracketIndex = previousContent.lastIndexOf('[[');
        const isNewTrigger =
          bracketIndex !== prevBracketIndex ||
          (bracketIndex === prevBracketIndex &&
            content.length > previousContent.length &&
            content.substring(bracketIndex).startsWith('[['));

        if (isNewTrigger || isAutocompleteActive) {
          // Trigger autocomplete with the query after [[
          handleTrigger('page', afterBrackets);
          setSelectedSuggestionIndex(0);
        }
      } else if (isAutocompleteActive) {
        // [[ was removed, dismiss autocomplete
        handleAutocompleteDismiss();
      }
    },
    [isAutocompleteActive, handleTrigger, handleAutocompleteDismiss]
  );

  // Handle autocomplete suggestion selection
  const handleSuggestionSelect = React.useCallback(
    async (suggestion: AutocompleteSuggestion, index: number) => {
      try {
        setSelectedSuggestionIndex(index);

        const result = await handleAutocompleteSelect(suggestion);
        if (!result.text || !editingBlockId) return;

        // Get the current content for the editing block
        const currentContent = contentByBlockRef.current.get(editingBlockId) || '';

        // Find the [[ position and replace [[query with the wiki link
        const bracketIndex = currentContent.lastIndexOf('[[');
        if (bracketIndex !== -1) {
          // Replace [[query with the wiki link
          const beforeBrackets = currentContent.substring(0, bracketIndex);
          const newContent = beforeBrackets + result.text;

          // Update content and save
          contentByBlockRef.current.set(editingBlockId, newContent);
          await handleContentSave(editingBlockId, newContent);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to insert wiki link');
      }
    },
    [handleAutocompleteSelect, editingBlockId, handleContentSave]
  );

  // Render function for editable blocks in edit mode
  const renderEditableBlock = React.useCallback(
    (info: RenderBlockItemInfo): React.ReactElement => {
      return (
        <EditableBlockView
          block={info.item.block}
          depth={info.item.depth}
          hasChildren={info.item.hasChildren}
          isEditing={editingBlockId === info.item.block.blockId}
          isSelected={info.isSelected}
          onStartEditing={(blockId) => setEditingBlockId(blockId)}
          onEndEditing={() => {
            setEditingBlockId(null);
            // Dismiss autocomplete when editing ends
            if (isAutocompleteActive) {
              handleAutocompleteDismiss();
            }
          }}
          onContentChange={handleContentChange}
          onSave={handleContentSave}
          onEnterPress={handleEnterPress}
          onBackspaceEmpty={handleBackspaceEmpty}
          onSwipeDelete={handleSwipeDelete}
          onToggleCollapse={info.onToggleCollapse}
          autoFocus={true}
          testID={info.testID}
        />
      );
    },
    [
      editingBlockId,
      isAutocompleteActive,
      handleAutocompleteDismiss,
      handleContentChange,
      handleContentSave,
      handleEnterPress,
      handleBackspaceEmpty,
      handleSwipeDelete,
    ]
  );

  // Handle block reorder
  const handleBlockReorder = React.useCallback(
    async (blockId: BlockId, newParentId: BlockId | null, afterBlockId: BlockId | null) => {
      if (!services) return;
      try {
        await services.blockService.moveBlock(blockId, newParentId, afterBlockId ?? undefined);
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to move block');
      }
    },
    [services, loadPage]
  );

  // Handle FAB press - create new block at end
  const handleFabPress = React.useCallback(async () => {
    try {
      // Find the last root-level block
      const rootBlocks = blocks.filter((b) => b.parentId === null && !b.isDeleted);
      const lastRootBlock = rootBlocks[rootBlocks.length - 1];

      const newBlock = await createBlock({
        pageId: pageId as PageId,
        parentId: null,
        content: '',
        afterBlockId: lastRootBlock?.blockId,
      });
      await loadPage();
      setEditingBlockId(newBlock.blockId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create block');
    }
  }, [blocks, createBlock, pageId, loadPage]);

  // Handle undo
  const handleUndo = React.useCallback(async () => {
    try {
      await undo();
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    }
  }, [undo, loadPage]);

  // Handle redo
  const handleRedo = React.useCallback(async () => {
    try {
      await redo();
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redo');
    }
  }, [redo, loadPage]);

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

  // Header component
  const headerComponent = (
    <View style={styles.headerContainer}>
      <Text style={styles.pageTitle}>{page?.title || 'Untitled'}</Text>
      <View style={styles.headerRow}>
        <Text style={styles.blockCount}>
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </Text>
        {isEditMode && (
          <View style={styles.undoRedoContainer}>
            <TouchableOpacity
              onPress={handleUndo}
              disabled={!canUndo}
              style={[styles.undoRedoButton, !canUndo && styles.undoRedoButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Undo"
              accessibilityState={{ disabled: !canUndo }}
              testID="undo-button"
            >
              <Text style={[styles.undoRedoText, !canUndo && styles.undoRedoTextDisabled]}>
                Undo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRedo}
              disabled={!canRedo}
              style={[styles.undoRedoButton, !canRedo && styles.undoRedoButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Redo"
              accessibilityState={{ disabled: !canRedo }}
              testID="redo-button"
            >
              <Text style={[styles.undoRedoText, !canRedo && styles.undoRedoTextDisabled]}>
                Redo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  // Empty state (no blocks) - edit mode shows FAB to create first block
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
            onPress={handleFabPress}
            accessibilityLabel="Create new block"
            testID="create-block-fab"
          />
        )}
      </View>
    );
  }

  // Render page with blocks
  return (
    <View style={styles.container}>
      {isEditMode ? (
        // Edit mode: Use DraggableBlockList with EditableBlockView
        <DraggableBlockList
          blocks={blockList}
          selectedBlockId={selectedBlockId}
          focusedBlockId={editingBlockId}
          onBlockPress={handleBlockPress}
          onBlockLongPress={handleBlockLongPress}
          onBlockToggleCollapse={handleToggleCollapse}
          onBlockReorder={handleBlockReorder}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          headerComponent={headerComponent}
          renderBlockItem={renderEditableBlock}
          testID="page-screen-block-list"
        />
      ) : (
        // View mode: Use BlockList
        <BlockList
          blocks={blockList}
          selectedBlockId={selectedBlockId}
          onBlockPress={handleBlockPress}
          onBlockLongPress={handleBlockLongPress}
          onBlockToggleCollapse={handleToggleCollapse}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          headerComponent={headerComponent}
          testID="page-screen-block-list"
        />
      )}
      {isEditMode && (
        <FloatingActionButton
          icon="+"
          onPress={handleFabPress}
          accessibilityLabel="Create new block"
          testID="create-block-fab"
        />
      )}

      {/* Wiki link autocomplete popup - positioned above keyboard */}
      {isEditMode && (
        <WikiLinkSuggestions
          isVisible={isAutocompleteActive}
          type="page"
          query={autocompleteQuery}
          suggestions={suggestions}
          selectedIndex={selectedSuggestionIndex}
          bottomOffset={keyboard.height}
          onSelect={handleSuggestionSelect}
          onClose={handleAutocompleteDismiss}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  undoRedoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  undoRedoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    minHeight: 32,
    justifyContent: 'center',
  },
  undoRedoButtonDisabled: {
    backgroundColor: '#F2F2F7',
  },
  undoRedoText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  undoRedoTextDisabled: {
    color: '#C7C7CC',
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
