/**
 * GraphDetailPanel - Bottom sheet showing details for selected graph node
 *
 * Displays:
 * - Page title
 * - Connection counts (incoming/outgoing links)
 * - "Open Page" navigation button
 *
 * Uses Animated API for smooth slide-in/out transitions.
 */

import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PageId } from '@double-bind/types';
import type { MobileGraphEdge } from './types';

/**
 * Props for GraphDetailPanel component.
 */
export interface GraphDetailPanelProps {
  /** Selected page ID */
  pageId: PageId;
  /** Page title */
  pageTitle: string;
  /** All graph edges for counting connections */
  edges: MobileGraphEdge[];
  /** Whether panel is visible */
  visible: boolean;
  /** Callback when "Open Page" is pressed */
  onOpenPage: (pageId: PageId) => void;
  /** Callback when panel is dismissed */
  onDismiss: () => void;
  /** Test ID for accessibility */
  testID?: string;
}

const PANEL_HEIGHT = 200;
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
};

/**
 * GraphDetailPanel displays information about a selected graph node.
 *
 * Features:
 * - Animated slide-in from bottom
 * - Swipe down to dismiss
 * - Connection count (in/out links)
 * - "Open Page" button for navigation
 */
export const GraphDetailPanel = memo(function GraphDetailPanel({
  pageId,
  pageTitle,
  edges,
  visible,
  onOpenPage,
  onDismiss,
  testID,
}: GraphDetailPanelProps) {
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(PANEL_HEIGHT);

  // Calculate connection counts
  const { incomingCount, outgoingCount } = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;

    for (const edge of edges) {
      if (edge.source === pageId) outgoing++;
      if (edge.target === pageId) incoming++;
    }

    return { incomingCount: incoming, outgoingCount: outgoing };
  }, [pageId, edges]);

  // Animate in/out based on visibility
  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : PANEL_HEIGHT, SPRING_CONFIG);
  }, [visible, translateY]);

  // Swipe down gesture to dismiss
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          // Only allow downward swipes
          if (event.translationY > 0) {
            translateY.value = event.translationY;
          }
        })
        .onEnd((event) => {
          // Dismiss if swiped down more than 50px or with high velocity
          if (event.translationY > 50 || event.velocityY > 500) {
            translateY.value = withSpring(PANEL_HEIGHT, SPRING_CONFIG, () => {
              runOnJS(onDismiss)();
            });
          } else {
            // Snap back
            translateY.value = withSpring(0, SPRING_CONFIG);
          }
        }),
    [translateY, onDismiss]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleOpenPage = useCallback(() => {
    onOpenPage(pageId);
  }, [pageId, onOpenPage]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={[styles.backdrop, { height: screenHeight }]}
        activeOpacity={1}
        onPress={onDismiss}
        testID={testID ? `${testID}-backdrop` : undefined}
      />

      {/* Panel */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.panel, animatedStyle]}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`Details for ${pageTitle}`}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Content */}
          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {pageTitle}
            </Text>

            {/* Connection counts */}
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{incomingCount}</Text>
                <Text style={styles.statLabel}>Incoming</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{outgoingCount}</Text>
                <Text style={styles.statLabel}>Outgoing</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{incomingCount + outgoingCount}</Text>
                <Text style={styles.statLabel}>Total Links</Text>
              </View>
            </View>

            {/* Open Page button */}
            <TouchableOpacity
              style={styles.openButton}
              onPress={handleOpenPage}
              testID={testID ? `${testID}-open-button` : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Open ${pageTitle}`}
            >
              <Text style={styles.openButtonText}>Open Page</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#C7C7CC',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#C7C7CC',
    marginHorizontal: 8,
  },
  openButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    // Minimum 44pt touch target per WCAG
    minHeight: 44,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
