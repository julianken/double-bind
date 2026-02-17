/**
 * HomeScreen - Today's daily note with inline block editing
 *
 * Shows today's daily note directly on the home screen with:
 * - Inline block editing (tap to edit, Enter for new block)
 * - FAB to create new blocks
 * - Date navigation via calendar FAB
 */

import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// TODO: Re-enable once react-native-external-keyboard native module is fixed
// import { KeyboardExtendedBaseView } from 'react-native-external-keyboard';
// import type { OnKeyPress } from 'react-native-external-keyboard';
import type { Block, BlockId, PageId } from '@double-bind/types';

// iOS Escape key code (UIKeyboardHIDUsage.keyboardEscape)
const ESCAPE_KEY_CODE = 41;
import { CommonActions } from '@react-navigation/native';
import { FloatingActionButton, RichText } from '@double-bind/mobile-primitives';
import type { HomeStackScreenProps } from '../navigation/types';
import { useDailyNote } from '../hooks/useDailyNote';
import { useDatabase } from '../hooks/useDatabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { buildBlockTree } from '../utils/blockTree';

type Props = HomeStackScreenProps<'Home'>;

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

export function HomeScreen({ navigation }: Props): React.ReactElement {
  const today = new Date().toISOString().split('T')[0]!;
  const { dailyNote, isLoading, error, refetch } = useDailyNote(today);
  const { services, status: dbStatus } = useDatabase();

  // Block state
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Set<BlockId>>(new Set());
  const [editingBlockId, setEditingBlockId] = React.useState<BlockId | null>(null);
  const [editingContent, setEditingContent] = React.useState('');

  // Format today's date for display
  const formattedDate = new Date(today + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Load blocks when daily note is available
  const loadBlocks = React.useCallback(async () => {
    if (!dailyNote || !services) return;

    try {
      setBlocksLoading(true);
      const pageWithBlocks = await services.pageService.getPageWithBlocks(dailyNote.pageId);
      setBlocks(pageWithBlocks.blocks);
    } catch (err) {
      console.error('Failed to load blocks:', err);
    } finally {
      setBlocksLoading(false);
      setRefreshing(false);
    }
  }, [dailyNote, services]);

  // Load blocks when daily note changes
  React.useEffect(() => {
    if (dailyNote && dbStatus === 'ready') {
      void loadBlocks();
    }
  }, [dailyNote, dbStatus, loadBlocks]);

  // Handle pull to refresh
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch();
    void loadBlocks();
  }, [refetch, loadBlocks]);

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

  // Handle block press - start editing
  const handleBlockPress = React.useCallback((blockId: BlockId, content: string) => {
    setEditingBlockId(blockId);
    setEditingContent(content);
  }, []);

  // Handle save edit
  const handleSaveEdit = React.useCallback(async () => {
    if (!editingBlockId || !services) return;

    try {
      await services.blockService.updateContent(editingBlockId, editingContent);
      setEditingBlockId(null);
      setEditingContent('');
      await loadBlocks();
    } catch (err) {
      console.error('Failed to save block:', err);
    }
  }, [editingBlockId, editingContent, services, loadBlocks]);

  // Handle Enter key - save current block and create new block
  const handleEnterPress = React.useCallback(
    async (contentBeforeEnter: string) => {
      if (!editingBlockId || !services || !dailyNote) return;

      try {
        // Save current block
        await services.blockService.updateContent(editingBlockId, contentBeforeEnter);

        // Find current block to get parentId
        const currentBlock = blocks.find((b) => b.blockId === editingBlockId);
        const parentId = currentBlock?.parentId ?? null;

        // Create new block after current one
        const newBlock = await services.blockService.createBlock(
          dailyNote.pageId as PageId,
          parentId,
          '',
          editingBlockId
        );

        await loadBlocks();
        setEditingBlockId(newBlock.blockId);
        setEditingContent('');
      } catch (err) {
        console.error('Failed to create block:', err);
      }
    },
    [editingBlockId, blocks, dailyNote, services, loadBlocks]
  );

  // Handle text change - detect Enter key
  const handleTextChange = React.useCallback(
    (text: string) => {
      if (text.includes('\n')) {
        const contentBeforeEnter = text.split('\n')[0];
        setEditingContent(contentBeforeEnter ?? '');
        void handleEnterPress(contentBeforeEnter ?? '');
      } else {
        setEditingContent(text);
      }
    },
    [handleEnterPress]
  );

  // Handle Escape key - delete empty block or save and deselect
  const handleEscapePress = React.useCallback(async () => {
    if (!editingBlockId || !services) return;

    const trimmedContent = editingContent.trim();

    if (trimmedContent === '') {
      // Empty block - delete it
      try {
        await services.blockService.deleteBlock(editingBlockId);
        await loadBlocks();
      } catch (err) {
        console.error('Failed to delete block:', err);
      }
    } else {
      // Block has content - save it
      try {
        await services.blockService.updateContent(editingBlockId, editingContent);
        await loadBlocks();
      } catch (err) {
        console.error('Failed to save block:', err);
      }
    }

    // Exit editing mode
    setEditingBlockId(null);
    setEditingContent('');
  }, [editingBlockId, editingContent, services, loadBlocks]);

  // TODO: Re-enable hardware keyboard handling once native module is fixed
  // const handleHardwareKeyPress = React.useCallback(
  //   (e: OnKeyPress) => {
  //     const keyCode = e.nativeEvent.keyCode;
  //     // Check for Escape key (iOS keyCode 41)
  //     if (keyCode === ESCAPE_KEY_CODE) {
  //       void handleEscapePress();
  //     }
  //   },
  //   [handleEscapePress]
  // );

  // Check if a page exists by title
  const checkPageExists = React.useCallback(
    async (pageTitle: string): Promise<boolean> => {
      if (!services) return false;
      try {
        const page = await services.pageService.getByTitle(pageTitle);
        return page !== null;
      } catch {
        return false;
      }
    },
    [services]
  );

  // Handle wiki link press - navigate to page via Pages tab with proper stack setup
  const handleWikiLinkPress = React.useCallback(
    async (pageTitle: string) => {
      if (!services) return;
      try {
        const page = await services.pageService.getOrCreateByTitle(pageTitle);
        // Reset navigation to ensure PagesTab has proper stack: [PageList, Page]
        // This prevents orphaned Page screens without PageList in the history
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: 'MainTabs',
                state: {
                  index: 1, // PagesTab is at index 1
                  routes: [
                    { name: 'HomeTab' },
                    {
                      name: 'PagesTab',
                      state: {
                        index: 1,
                        routes: [
                          { name: 'PageList' },
                          { name: 'Page', params: { pageId: page.pageId } },
                        ],
                      },
                    },
                    { name: 'SearchTab' },
                    { name: 'GraphTab' },
                    { name: 'SettingsTab' },
                  ],
                },
              },
            ],
          })
        );
      } catch (err) {
        console.error('Failed to navigate to wiki link:', err);
      }
    },
    [services, navigation]
  );

  // Handle create new block
  const handleCreateBlock = React.useCallback(async () => {
    if (!services || !dailyNote) return;

    try {
      // Find the last root-level block
      const rootBlocks = blocks.filter((b) => b.parentId === null);
      const lastRootBlock = rootBlocks[rootBlocks.length - 1];

      const newBlock = await services.blockService.createBlock(
        dailyNote.pageId as PageId,
        null,
        '',
        lastRootBlock?.blockId
      );
      await loadBlocks();
      setEditingBlockId(newBlock.blockId);
      setEditingContent('');
    } catch (err) {
      console.error('Failed to create block:', err);
    }
  }, [blocks, dailyNote, services, loadBlocks]);

  // Build flat block list for rendering
  const blockList = React.useMemo(() => {
    return buildBlockTree(blocks, null, 0, collapsedBlocks);
  }, [blocks, collapsedBlocks]);

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <ErrorMessage message={error} onRetry={refetch} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date Header */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{formattedDate}</Text>
      </View>

      {/* Block Content */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {blocksLoading ? (
            <LoadingSpinner />
          ) : blockList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Start your day</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first note</Text>
            </View>
          ) : (
            blockList.map((item) => {
              const { block, depth, hasChildren } = item;
              const isEditing = editingBlockId === block.blockId;
              const marginLeft = depth * INDENT_SIZE;

              return (
                <TouchableOpacity
                  key={block.blockId}
                  onPress={() => handleBlockPress(block.blockId, String(block.content))}
                  style={[styles.blockContainer, { marginLeft }, isEditing && styles.blockEditing]}
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
                      <View style={styles.editingRow}>
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
                        >
                          <Text style={styles.cancelButtonText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void handleSaveEdit()}
                          style={styles.saveButton}
                          accessibilityLabel="Save block"
                        >
                          <Text style={styles.saveButtonText}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    ) : block.content ? (
                      <RichText
                        content={String(block.content)}
                        checkPageExists={checkPageExists}
                        onWikiLinkPress={handleWikiLinkPress}
                        textStyle={styles.blockText}
                        testID={`block-richtext-${block.blockId}`}
                      />
                    ) : (
                      <Text style={styles.blockText}>Tap to edit...</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB for creating new block */}
      <FloatingActionButton
        icon="+"
        onPress={handleCreateBlock}
        accessibilityLabel="Create new block"
        testID="create-block-fab"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FAFAFA',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#8E8E93',
  },
  blockContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  blockEditing: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderRadius: 8,
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
  editingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    fontSize: 18,
    fontWeight: '600',
  },
});
