/**
 * DailyNoteScreen - Daily note view with inline block editing
 *
 * Shows the daily note for a specific date with:
 * - Current date display
 * - Previous/next day navigation (44px touch targets)
 * - Date picker for jumping to any date
 * - Auto-creation of daily notes if they don't exist
 * - Inline block editing (shared functionality with PageScreen)
 */

import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import type { Block, BlockId, PageId } from '@double-bind/types';
import type { HomeStackScreenProps } from '../navigation/types';
import { useDailyNote } from '../hooks/useDailyNote';
import { useDatabase } from '../hooks/useDatabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FloatingActionButton } from '@double-bind/mobile-primitives';
import { buildBlockTree } from '../utils/blockTree';

type Props = HomeStackScreenProps<'DailyNote'>;

/**
 * Format a date string for display (e.g., "February 9, 2026")
 */
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get the date for the previous day
 */
function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0]!;
}

/**
 * Get the date for the next day
 */
function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0]!;
}

/**
 * Check if a date is today
 */
function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

// Indentation per nesting level (in pixels)
const INDENT_SIZE = 24;

export function DailyNoteScreen({ route, navigation }: Props): React.ReactElement {
  const [currentDate, setCurrentDate] = React.useState(
    route.params?.date ?? new Date().toISOString().split('T')[0]!
  );
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());

  const { dailyNote, isLoading, error, refetch } = useDailyNote(currentDate);
  const { services, status: dbStatus } = useDatabase();

  // Block state
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Set<BlockId>>(new Set());
  const [editingBlockId, setEditingBlockId] = React.useState<BlockId | null>(null);
  const [editingContent, setEditingContent] = React.useState('');

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

  // Update navigation title with formatted date and Edit button
  React.useEffect(() => {
    navigation.setOptions({
      title: formatDateForDisplay(currentDate),
    });
  }, [currentDate, navigation]);

  const handlePreviousDay = () => {
    setCurrentDate(getPreviousDay(currentDate));
  };

  const handleNextDay = () => {
    setCurrentDate(getNextDay(currentDate));
  };

  const handleToday = () => {
    setCurrentDate(new Date().toISOString().split('T')[0]!);
  };

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
  const handleBlockPress = React.useCallback(
    (blockId: BlockId, content: string) => {
      setEditingBlockId(blockId);
      setEditingContent(content);
    },
    []
  );

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
        setEditingContent(contentBeforeEnter);
        void handleEnterPress(contentBeforeEnter);
      } else {
        setEditingContent(text);
      }
    },
    [handleEnterPress]
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

  const handleDateSelect = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0]!;
    setCurrentDate(dateStr);
    setShowDatePicker(false);
  };

  const handleOpenDatePicker = () => {
    // Initialize picker to current date
    const date = new Date(currentDate + 'T00:00:00');
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth());
    setShowDatePicker(true);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={refetch} />
      </View>
    );
  }

  if (!dailyNote) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load daily note</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePreviousDay}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={handleOpenDatePicker}
          accessibilityRole="button"
          accessibilityLabel="Select date"
        >
          <Text style={styles.dateText}>{formatDateForDisplay(currentDate)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNextDay}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Today Button (only show if not already on today) */}
      {!isToday(currentDate) && (
        <TouchableOpacity
          style={styles.todayButton}
          onPress={handleToday}
          accessibilityRole="button"
          accessibilityLabel="Go to today"
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}

      {/* Block Content */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {blocksLoading ? (
            <LoadingSpinner />
          ) : blockList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtext}>Tap + to start writing</Text>
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
                  style={[
                    styles.blockContainer,
                    { marginLeft },
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
                          onPress={() => void handleSaveEdit()}
                          style={styles.saveButton}
                          accessibilityLabel="Save block"
                        >
                          <Text style={styles.saveButtonText}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.blockText}>
                        {String(block.content) || 'Tap to edit...'}
                      </Text>
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

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
            >
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Date</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <SimpleDatePicker
            year={selectedYear}
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onDateSelect={handleDateSelect}
          />
        </View>
      </Modal>
    </View>
  );
}

/**
 * Simple date picker component with month/year selection
 */
interface SimpleDatePickerProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onDateSelect: (year: number, month: number, day: number) => void;
}

function SimpleDatePicker({
  year,
  month,
  onYearChange,
  onMonthChange,
  onDateSelect,
}: SimpleDatePickerProps): React.ReactElement {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Generate array of day numbers
  const days: (number | null)[] = [];
  // Add empty slots for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Add actual days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <ScrollView style={styles.pickerContainer}>
      {/* Year/Month Controls */}
      <View style={styles.pickerControls}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onYearChange(year - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
        >
          <Text style={styles.pickerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.pickerYearText}>{year}</Text>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onYearChange(year + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next year"
        >
          <Text style={styles.pickerButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pickerControls}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onMonthChange(month === 0 ? 11 : month - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text style={styles.pickerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.pickerMonthText}>{monthNames[month]}</Text>

        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => onMonthChange(month === 11 ? 0 : month + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text style={styles.pickerButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {/* Day names */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
          <View key={dayName} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{dayName}</Text>
          </View>
        ))}

        {/* Day cells */}
        {days.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day !== null ? (
              <TouchableOpacity
                style={styles.dayButton}
                onPress={() => onDateSelect(year, month, day)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${monthNames[month]} ${day}, ${year}`}
              >
                <Text style={styles.dayButtonText}>{day}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  navButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  dateButton: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  todayButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pageId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
  },
  keyboardView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
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
  errorText: {
    fontSize: 15,
    color: '#FF3B30',
    textAlign: 'center',
    paddingVertical: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  modalHeaderSpacer: {
    width: 60,
  },
  pickerContainer: {
    flex: 1,
    padding: 16,
  },
  pickerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  pickerButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  pickerYearText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  pickerMonthText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayNameCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  dayButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  dayButtonText: {
    fontSize: 15,
    color: '#000000',
  },
});
