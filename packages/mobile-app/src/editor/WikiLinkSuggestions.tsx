/**
 * WikiLinkSuggestions - Autocomplete popup for wiki links, block refs, and tags.
 *
 * Displays a floating list of suggestions when the user types [[, ((, or #.
 * Positioned above the keyboard with smooth animations.
 *
 * @see packages/desktop/src/editor/AutocompleteDropdown.tsx for desktop reference
 */

import * as React from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  type ListRenderItem,
  Platform,
} from 'react-native';

import type {
  WikiLinkSuggestionsProps,
  AutocompleteSuggestion,
  AutocompleteTrigger,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface SuggestionItemProps {
  suggestion: AutocompleteSuggestion;
  index: number;
  isSelected: boolean;
  onPress: (suggestion: AutocompleteSuggestion, index: number) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Individual suggestion item.
 */
const SuggestionItem = memo(function SuggestionItem({
  suggestion,
  index,
  isSelected,
  onPress,
}: SuggestionItemProps) {
  const handlePress = useCallback(() => {
    onPress(suggestion, index);
  }, [suggestion, index, onPress]);

  // Render based on suggestion type
  const renderContent = () => {
    switch (suggestion.type) {
      case 'page':
        return (
          <>
            {suggestion.data.isCreateNew && <Text style={styles.createLabel}>Create: </Text>}
            <Text style={styles.pageTitle}>{suggestion.data.title}</Text>
          </>
        );

      case 'block':
        return (
          <>
            <Text style={styles.blockContent} numberOfLines={1}>
              {suggestion.data.content}
            </Text>
            <Text style={styles.blockPage}>{suggestion.data.pageTitle}</Text>
          </>
        );

      case 'tag':
        return (
          <>
            <Text style={styles.tagName}>#{suggestion.data.tag}</Text>
            <Text style={styles.tagCount}>{suggestion.data.count} uses</Text>
          </>
        );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      testID={`suggestion-item-${index}`}
    >
      <View style={styles.itemContent}>{renderContent()}</View>
    </TouchableOpacity>
  );
});

/**
 * Empty state when no suggestions are found.
 */
const EmptyState = memo(function EmptyState({ type }: { type: AutocompleteTrigger | null }) {
  const getMessage = () => {
    switch (type) {
      case 'page':
        return 'No pages found';
      case 'block':
        return 'No blocks found';
      case 'tag':
        return 'No tags found';
      default:
        return 'No suggestions';
    }
  };

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{getMessage()}</Text>
    </View>
  );
});

/**
 * Header showing the current autocomplete type.
 */
const SuggestionHeader = memo(function SuggestionHeader({
  type,
  query,
}: {
  type: AutocompleteTrigger | null;
  query: string;
}) {
  const getTitle = () => {
    switch (type) {
      case 'page':
        return 'Pages';
      case 'block':
        return 'Blocks';
      case 'tag':
        return 'Tags';
      default:
        return 'Suggestions';
    }
  };

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{getTitle()}</Text>
      {query.length > 0 && (
        <Text style={styles.headerQuery} numberOfLines={1}>
          "{query}"
        </Text>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * WikiLinkSuggestions - Autocomplete popup component.
 *
 * Shows suggestions for wiki links, block references, and tags.
 * Animates in/out with a slide + fade effect.
 *
 * @example
 * ```tsx
 * <WikiLinkSuggestions
 *   isVisible={autocomplete.isActive}
 *   type={autocomplete.trigger}
 *   query={autocomplete.query}
 *   suggestions={autocomplete.suggestions}
 *   selectedIndex={autocomplete.selectedIndex}
 *   bottomOffset={keyboardHeight}
 *   onSelect={(suggestion) => insertSuggestion(suggestion)}
 *   onClose={() => dismissAutocomplete()}
 * />
 * ```
 */
export const WikiLinkSuggestions = memo(function WikiLinkSuggestions({
  isVisible,
  type,
  query,
  suggestions,
  selectedIndex,
  bottomOffset,
  onSelect,
  onClose,
}: WikiLinkSuggestionsProps) {
  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  // Animate in/out
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, opacity, translateY]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: AutocompleteSuggestion, index: number) => {
    switch (item.type) {
      case 'page':
        return item.data.pageId || `create-${item.data.title}`;
      case 'block':
        return item.data.blockId;
      case 'tag':
        return item.data.tag;
      default:
        return `item-${index}`;
    }
  }, []);

  // Render item
  const renderItem: ListRenderItem<AutocompleteSuggestion> = useCallback(
    ({ item, index }) => (
      <SuggestionItem
        suggestion={item}
        index={index}
        isSelected={index === selectedIndex}
        onPress={onSelect}
      />
    ),
    [selectedIndex, onSelect]
  );

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="menu"
      accessibilityLabel="Autocomplete suggestions"
    >
      <View style={styles.popup}>
        <SuggestionHeader type={type} query={query} />

        {suggestions.length === 0 ? (
          <EmptyState type={type} />
        ) : (
          <FlatList
            data={suggestions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={true}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Close suggestions"
          accessibilityRole="button"
          testID="suggestions-close"
        >
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1001,
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 300,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerQuery: {
    fontSize: 13,
    color: '#8E8E93',
    maxWidth: '50%',
  },
  list: {
    maxHeight: 200,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemSelected: {
    backgroundColor: '#F2F2F7',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
  pageTitle: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },
  blockContent: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },
  blockPage: {
    fontSize: 12,
    color: '#8E8E93',
  },
  tagName: {
    fontSize: 15,
    color: '#34C759',
    fontWeight: '500',
  },
  tagCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  closeButtonText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
});

// ============================================================================
// Exports
// ============================================================================

export type { WikiLinkSuggestionsProps };
