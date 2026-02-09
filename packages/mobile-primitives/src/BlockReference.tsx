/**
 * BlockReference - Inline block reference component for mobile
 *
 * Displays a reference to another block using ((block-id)) syntax.
 * Features:
 * - Visually distinct styling with border and background
 * - Tap to expand/collapse full content
 * - Long press to navigate to source page
 * - Loading and error states
 * - Minimum 44pt touch target per iOS HIG
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/components/menus-and-actions/buttons
 */

import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Block, BlockId } from '@double-bind/types';

// Minimum touch target size per iOS HIG (44pt)
const MIN_TOUCH_TARGET = 44;

export interface BlockReferenceProps {
  /**
   * The block ID being referenced (26-char ULID)
   */
  blockId: BlockId;

  /**
   * Function to fetch the referenced block
   * Should return the block data or null if not found
   */
  fetchBlock: (blockId: BlockId) => Promise<Block | null>;

  /**
   * Whether the reference is currently expanded to show full content
   */
  isExpanded?: boolean;

  /**
   * Callback when the reference is tapped (to toggle expansion)
   */
  onPress?: (blockId: BlockId) => void;

  /**
   * Callback when the reference is long-pressed (to navigate to source)
   */
  onLongPress?: (blockId: BlockId) => void;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

/**
 * Block reference component for displaying inline references.
 *
 * Shows a preview of referenced block content with:
 * - Distinct visual styling (bordered, light background)
 * - Expandable/collapsible on tap
 * - Navigation to source on long press
 * - Loading states while fetching
 * - Error states for missing blocks
 *
 * @example
 * ```tsx
 * <BlockReference
 *   blockId="01HXQ123..."
 *   fetchBlock={blockService.getById}
 *   onPress={handleToggleExpand}
 *   onLongPress={handleNavigateToSource}
 * />
 * ```
 */
export function BlockReference({
  blockId,
  fetchBlock,
  isExpanded = false,
  onPress,
  onLongPress,
  testID,
}: BlockReferenceProps): React.ReactElement {
  const [block, setBlock] = React.useState<Block | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch the referenced block on mount or when blockId changes
  React.useEffect(() => {
    let cancelled = false;

    const loadBlock = async () => {
      setLoading(true);
      setError(null);

      try {
        const fetchedBlock = await fetchBlock(blockId);
        if (!cancelled) {
          if (fetchedBlock) {
            setBlock(fetchedBlock);
          } else {
            setError('Block not found');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load block');
          setLoading(false);
        }
      }
    };

    loadBlock();

    return () => {
      cancelled = true;
    };
  }, [blockId, fetchBlock]);

  // Gesture handlers
  const handlePress = React.useCallback(() => {
    onPress?.(blockId);
  }, [blockId, onPress]);

  const handleLongPress = React.useCallback(() => {
    onLongPress?.(blockId);
  }, [blockId, onLongPress]);

  const tapGesture = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd(handlePress);

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(10)
    .onEnd(handleLongPress);

  // Ensure single tap waits for long press check
  tapGesture.requireExternalGestureToFail(longPressGesture);

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color="#007AFF" testID={`${testID}-loading`} />
          <Text style={styles.stateText}>Loading...</Text>
        </View>
      );
    }

    if (error || !block) {
      return (
        <View style={styles.stateContainer} testID={`${testID}-error`}>
          <Text style={styles.errorText}>⚠️ {error || 'Block not found'}</Text>
          <Text style={styles.blockIdText}>(({blockId.slice(0, 8)}...))</Text>
        </View>
      );
    }

    // Show preview (first 60 chars) or full content when expanded
    const contentToShow = isExpanded
      ? block.content
      : block.content.slice(0, 60) + (block.content.length > 60 ? '...' : '');

    return (
      <View style={styles.contentWrapper}>
        <Text style={styles.contentText} numberOfLines={isExpanded ? undefined : 2}>
          {contentToShow}
        </Text>
        {!isExpanded && block.content.length > 60 && (
          <Text style={styles.expandHint}>Tap to expand</Text>
        )}
      </View>
    );
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={[styles.container, isExpanded && styles.containerExpanded]}
        testID={testID}
        accessible={true}
        accessibilityLabel={
          block
            ? `Block reference: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`
            : 'Block reference loading'
        }
        accessibilityHint="Tap to expand. Long press to navigate to source page."
        accessibilityRole="button"
        accessibilityState={{
          expanded: isExpanded,
          disabled: loading || !!error,
        }}
      >
        {renderContent()}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#F5F5F7',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
  } as ViewStyle,

  containerExpanded: {
    backgroundColor: '#E8F4FD',
  } as ViewStyle,

  contentWrapper: {
    flex: 1,
  } as ViewStyle,

  contentText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#1C1C1E',
  } as TextStyle,

  expandHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  } as TextStyle,

  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET - 16,
  } as ViewStyle,

  stateText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  } as TextStyle,

  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    flex: 1,
  } as TextStyle,

  blockIdText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8E8E93',
    marginLeft: 8,
  } as TextStyle,
});

export default BlockReference;
