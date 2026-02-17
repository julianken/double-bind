/**
 * PageCardSkeleton - Placeholder skeleton for loading states.
 *
 * Displays a shimmer animation while pages are loading.
 * Matches PageCard dimensions for seamless transition.
 */

import React, { useEffect, memo, type ReactElement } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

/** iOS system gray background */
const BACKGROUND_COLOR = '#F2F2F7';

/** Minimum touch target per iOS HIG */
const MIN_TOUCH_TARGET = 44;

/**
 * Animated skeleton bar component.
 */
const SkeletonBar = memo(function SkeletonBar({
  width,
  height = 14,
  style,
}: {
  width: number | string;
  height?: number;
  style?: object;
}) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeletonBar, { width, height, opacity }, style]} />;
});

/**
 * Single skeleton card matching PageCard layout.
 */
export const PageCardSkeleton = memo(function PageCardSkeleton(): ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <SkeletonBar width="70%" height={17} />
        <View style={styles.cardMeta}>
          <SkeletonBar width={50} height={12} />
        </View>
      </View>
      <SkeletonBar width={10} height={22} />
    </View>
  );
});

/**
 * List of skeleton cards for loading state.
 */
interface PageListSkeletonProps {
  count?: number;
}

export function PageListSkeleton({ count = 5 }: PageListSkeletonProps): ReactElement {
  return (
    <View style={styles.container}>
      <SkeletonBar width={80} height={13} style={styles.header} />
      {Array.from({ length: count }).map((_, index) => (
        <PageCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  skeletonBar: {
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
});
