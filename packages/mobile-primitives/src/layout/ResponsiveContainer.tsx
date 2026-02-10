/**
 * ResponsiveContainer - Container that adapts to screen size
 *
 * Provides automatic padding and max-width constraints based on
 * device size for optimal content readability and layout.
 */

import * as React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useDeviceOrientation } from './useDeviceOrientation';
import { getContentPadding, getMaxContentWidth } from './breakpoints';

/**
 * Props for ResponsiveContainer component
 */
export interface ResponsiveContainerProps {
  /** Child elements to render */
  children: React.ReactNode;
  /** Additional style for the container */
  style?: StyleProp<ViewStyle>;
  /** Whether to center content horizontally (useful on tablets) */
  centerContent?: boolean;
  /** Override the automatic padding */
  padding?: number;
  /** Override the automatic max width */
  maxWidth?: number;
  /** Whether to disable automatic padding */
  noPadding?: boolean;
  /** Whether to disable max width constraint */
  noMaxWidth?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Test ID for testing */
  testID?: string;
}

/**
 * ResponsiveContainer adapts its layout based on device size.
 *
 * Features:
 * - Automatic horizontal padding based on device size
 * - Max-width constraints on large screens for readability
 * - Optional content centering for tablet layouts
 *
 * @example
 * ```tsx
 * // Basic responsive container
 * <ResponsiveContainer>
 *   <Text>Content with responsive padding</Text>
 * </ResponsiveContainer>
 *
 * // Centered content on tablets
 * <ResponsiveContainer centerContent>
 *   <Card>Centered card on tablets</Card>
 * </ResponsiveContainer>
 *
 * // Custom padding override
 * <ResponsiveContainer padding={24}>
 *   <List />
 * </ResponsiveContainer>
 * ```
 */
export function ResponsiveContainer({
  children,
  style,
  centerContent = false,
  padding,
  maxWidth,
  noPadding = false,
  noMaxWidth = false,
  backgroundColor,
  testID,
}: ResponsiveContainerProps): React.ReactElement {
  const { config } = useDeviceOrientation();

  const computedPadding = noPadding ? 0 : (padding ?? getContentPadding(config.deviceSize));

  const computedMaxWidth = noMaxWidth
    ? undefined
    : (maxWidth ?? getMaxContentWidth(config.deviceSize));

  const containerStyle: ViewStyle = {
    paddingHorizontal: computedPadding,
    ...(computedMaxWidth && { maxWidth: computedMaxWidth }),
    ...(centerContent && computedMaxWidth && { alignSelf: 'center' }),
    ...(backgroundColor && { backgroundColor }),
  };

  return (
    <View style={[styles.container, containerStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * Props for ResponsiveRow component
 */
export interface ResponsiveRowProps {
  /** Child elements to render */
  children: React.ReactNode;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Gap between children */
  gap?: number;
  /** Whether to wrap children on small screens */
  wrap?: boolean;
  /** Justify content value */
  justifyContent?: ViewStyle['justifyContent'];
  /** Align items value */
  alignItems?: ViewStyle['alignItems'];
  /** Test ID for testing */
  testID?: string;
}

/**
 * ResponsiveRow - A row container that can adapt to screen size
 *
 * @example
 * ```tsx
 * <ResponsiveRow gap={16} wrap>
 *   <Card flex={1} />
 *   <Card flex={1} />
 * </ResponsiveRow>
 * ```
 */
export function ResponsiveRow({
  children,
  style,
  gap = 0,
  wrap = false,
  justifyContent = 'flex-start',
  alignItems = 'stretch',
  testID,
}: ResponsiveRowProps): React.ReactElement {
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    justifyContent,
    alignItems,
    gap,
  };

  return (
    <View style={[rowStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * Props for ResponsiveColumn component
 */
export interface ResponsiveColumnProps {
  /** Child elements to render */
  children: React.ReactNode;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Gap between children */
  gap?: number;
  /** Justify content value */
  justifyContent?: ViewStyle['justifyContent'];
  /** Align items value */
  alignItems?: ViewStyle['alignItems'];
  /** Test ID for testing */
  testID?: string;
}

/**
 * ResponsiveColumn - A column container for vertical layouts
 *
 * @example
 * ```tsx
 * <ResponsiveColumn gap={12}>
 *   <Heading />
 *   <Content />
 *   <Footer />
 * </ResponsiveColumn>
 * ```
 */
export function ResponsiveColumn({
  children,
  style,
  gap = 0,
  justifyContent = 'flex-start',
  alignItems = 'stretch',
  testID,
}: ResponsiveColumnProps): React.ReactElement {
  const columnStyle: ViewStyle = {
    flexDirection: 'column',
    justifyContent,
    alignItems,
    gap,
  };

  return (
    <View style={[columnStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * Hook to get responsive values based on device size
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { padding, maxWidth, deviceSize, isTablet } = useResponsive();
 *   return (
 *     <View style={{ paddingHorizontal: padding }}>
 *       <Text>{isTablet ? 'Tablet view' : 'Phone view'}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useResponsive() {
  const { config, isTablet, isLandscape, isSplitScreen } = useDeviceOrientation();

  return {
    /** Current device size category */
    deviceSize: config.deviceSize,
    /** Recommended content padding */
    padding: getContentPadding(config.deviceSize),
    /** Recommended max content width */
    maxWidth: getMaxContentWidth(config.deviceSize),
    /** Whether device is a tablet */
    isTablet,
    /** Whether in landscape orientation */
    isLandscape,
    /** Whether in split-screen mode */
    isSplitScreen,
    /** Full responsive config */
    config,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
