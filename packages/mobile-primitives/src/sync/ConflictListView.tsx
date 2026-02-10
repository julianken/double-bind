/**
 * ConflictListView Component
 *
 * Displays a list of sync conflicts with preview information.
 * Follows iOS HIG with 44pt touch targets and proper accessibility.
 */

import * as React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import type { ConflictMetadata } from '@double-bind/types';
import { formatConflictForList, type ConflictListViewProps } from './ConflictTypes';

const MIN_TOUCH_TARGET = 44;
const ITEM_PADDING = 16;

/**
 * Renders a list of conflicts with touch-optimized interaction.
 */
export function ConflictListView({
  conflicts,
  onConflictPress,
  onRefresh,
  refreshing = false,
  testID = 'conflict-list-view',
}: ConflictListViewProps): JSX.Element {
  const renderItem = React.useCallback(
    ({ item }: { item: ConflictMetadata }) => {
      const listItem = formatConflictForList(item);

      return (
        <TouchableOpacity
          style={styles.conflictItem}
          onPress={() => onConflictPress(item)}
          accessibilityRole="button"
          accessibilityLabel={`Conflict: ${listItem.title}. ${listItem.subtitle}. Tap to view details.`}
          testID={`${testID}-item-${item.conflictId}`}
        >
          <View style={styles.conflictIcon}>
            <Text style={styles.iconText} accessibilityLabel={`${listItem.icon} icon`}>
              {getIconEmoji(listItem.icon)}
            </Text>
          </View>
          <View style={styles.conflictContent}>
            <Text style={styles.conflictTitle} numberOfLines={2}>
              {listItem.title}
            </Text>
            <Text style={styles.conflictSubtitle} numberOfLines={1}>
              {listItem.subtitle}
            </Text>
            <View style={styles.conflictBadge}>
              <Text style={styles.badgeText}>
                {item.state === 'detected' ? 'New' : 'Pending'}
              </Text>
            </View>
          </View>
          <View style={styles.chevron}>
            <Text style={styles.chevronText}>›</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [onConflictPress, testID]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>✓</Text>
      <Text style={styles.emptyTitle}>No Conflicts</Text>
      <Text style={styles.emptySubtitle}>All changes are synchronized</Text>
    </View>
  );

  return (
    <FlatList
      data={conflicts}
      renderItem={renderItem}
      keyExtractor={(item) => item.conflictId}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={
        conflicts.length === 0 ? styles.emptyContentContainer : styles.contentContainer
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        ) : undefined
      }
      testID={testID}
      accessibilityLabel="Conflict list"
      accessibilityHint="Shows all synchronization conflicts that need resolution"
    />
  );
}

/**
 * Get emoji representation for icon name.
 */
function getIconEmoji(icon: string): string {
  const emojis: Record<string, string> = {
    edit: '✏️',
    move: '↔️',
    trash: '🗑️',
    folder: '📁',
    reorder: '↕️',
    warning: '⚠️',
    'alert-circle': '⚠️',
  };

  return emojis[icon] || '⚠️';
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 8,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  conflictItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ITEM_PADDING,
    paddingVertical: 12,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  conflictIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  conflictContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  conflictSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 6,
  },
  conflictBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  chevron: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 24,
    color: '#C7C7CC',
    fontWeight: '300',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
