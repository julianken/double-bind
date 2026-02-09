/**
 * SafeArea - Wrapper component for safe area handling
 *
 * Provides consistent padding for notches, dynamic island,
 * home indicators, and other device-specific safe areas.
 */

import * as React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

/**
 * Edge configuration options
 */
export type SafeAreaEdges = Edge[];

/**
 * Minimum padding values for edges
 */
export interface MinimumPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Props for SafeArea component
 */
export interface SafeAreaProps {
  /** Child elements to render within safe area */
  children: React.ReactNode;
  /** Edges to apply safe area insets to. Defaults to all edges */
  edges?: SafeAreaEdges;
  /** Background color for the safe area */
  backgroundColor?: string;
  /** Additional style for the container */
  style?: StyleProp<ViewStyle>;
  /** Minimum padding to apply (uses max of safe area inset and minimum) */
  minimumPadding?: MinimumPadding;
  /** Whether to apply insets as padding (default) or margin */
  mode?: 'padding' | 'margin';
  /** Test ID for testing */
  testID?: string;
}

/**
 * SafeArea component that wraps content with proper safe area insets.
 *
 * Handles:
 * - Notch/Dynamic Island on modern iPhones
 * - Home indicator area on Face ID devices
 * - Navigation bar area on Android
 * - Status bar area on all devices
 *
 * @example
 * ```tsx
 * // Basic usage - all edges
 * <SafeArea>
 *   <YourContent />
 * </SafeArea>
 *
 * // Only top and bottom edges (for horizontal scrolling content)
 * <SafeArea edges={['top', 'bottom']}>
 *   <HorizontalList />
 * </SafeArea>
 *
 * // With minimum padding for consistent spacing
 * <SafeArea minimumPadding={{ bottom: 24 }}>
 *   <ContentWithBottomButton />
 * </SafeArea>
 * ```
 */
export function SafeArea({
  children,
  edges = ['top', 'right', 'bottom', 'left'],
  backgroundColor,
  style,
  minimumPadding,
  mode = 'padding',
  testID,
}: SafeAreaProps): React.ReactElement {
  // If no minimum padding needed, use standard SafeAreaView
  if (!minimumPadding) {
    return (
      <SafeAreaView
        edges={edges}
        mode={mode}
        style={[styles.container, backgroundColor ? { backgroundColor } : undefined, style]}
        testID={testID}
      >
        {children}
      </SafeAreaView>
    );
  }

  // For minimum padding, we need to use the hook and calculate ourselves
  return (
    <SafeAreaWithMinimum
      edges={edges}
      backgroundColor={backgroundColor}
      style={style}
      minimumPadding={minimumPadding}
      mode={mode}
      testID={testID}
    >
      {children}
    </SafeAreaWithMinimum>
  );
}

/**
 * Internal component for SafeArea with minimum padding support
 */
function SafeAreaWithMinimum({
  children,
  edges,
  backgroundColor,
  style,
  minimumPadding,
  mode,
  testID,
}: Omit<SafeAreaProps, 'minimumPadding'> & {
  minimumPadding: MinimumPadding;
}): React.ReactElement {
  const insets = useSafeAreaInsets();

  // Calculate padding/margin values using max of inset and minimum
  const computedStyle: ViewStyle = {};
  const styleKey = mode === 'margin' ? 'margin' : 'padding';

  if (edges?.includes('top')) {
    const key = `${styleKey}Top` as keyof ViewStyle;
    computedStyle[key] = Math.max(insets.top, minimumPadding.top ?? 0) as never;
  }
  if (edges?.includes('right')) {
    const key = `${styleKey}Right` as keyof ViewStyle;
    computedStyle[key] = Math.max(insets.right, minimumPadding.right ?? 0) as never;
  }
  if (edges?.includes('bottom')) {
    const key = `${styleKey}Bottom` as keyof ViewStyle;
    computedStyle[key] = Math.max(insets.bottom, minimumPadding.bottom ?? 0) as never;
  }
  if (edges?.includes('left')) {
    const key = `${styleKey}Left` as keyof ViewStyle;
    computedStyle[key] = Math.max(insets.left, minimumPadding.left ?? 0) as never;
  }

  return (
    <View
      style={[
        styles.container,
        computedStyle,
        backgroundColor ? { backgroundColor } : undefined,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/**
 * Hook to access safe area insets with optional minimum values
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const insets = useSafeAreaWithMinimum({ bottom: 24 });
 *   return <View style={{ paddingBottom: insets.bottom }} />;
 * }
 * ```
 */
export function useSafeAreaWithMinimum(minimumPadding: MinimumPadding = {}) {
  const insets = useSafeAreaInsets();

  return {
    top: Math.max(insets.top, minimumPadding.top ?? 0),
    right: Math.max(insets.right, minimumPadding.right ?? 0),
    bottom: Math.max(insets.bottom, minimumPadding.bottom ?? 0),
    left: Math.max(insets.left, minimumPadding.left ?? 0),
    // Original insets for reference
    rawInsets: insets,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
