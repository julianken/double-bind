/**
 * useDeviceOrientation - Hook for tracking device orientation changes
 *
 * Provides real-time orientation updates and responsive configuration
 * for building adaptive mobile layouts.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import {
  type ResponsiveConfig,
  type Orientation,
  type DeviceType,
  getResponsiveConfig,
} from './breakpoints';

/**
 * Result returned by useDeviceOrientation hook
 */
export interface DeviceOrientationResult {
  /** Full responsive configuration */
  config: ResponsiveConfig;
  /** Current orientation */
  orientation: Orientation;
  /** Current device type */
  deviceType: DeviceType;
  /** Whether in portrait mode */
  isPortrait: boolean;
  /** Whether in landscape mode */
  isLandscape: boolean;
  /** Whether device is a tablet */
  isTablet: boolean;
  /** Whether in split-screen mode */
  isSplitScreen: boolean;
  /** Screen width */
  width: number;
  /** Screen height */
  height: number;
}

/**
 * Get initial dimensions from the Dimensions API
 */
function getInitialDimensions(): ScaledSize {
  return Dimensions.get('window');
}

/**
 * Hook to track device orientation and provide responsive configuration
 *
 * @example
 * ```tsx
 * function MyScreen() {
 *   const { isLandscape, isTablet, config } = useDeviceOrientation();
 *
 *   return (
 *     <View style={[styles.container, isLandscape && styles.landscape]}>
 *       {isTablet && <Sidebar />}
 *       <Content padding={getContentPadding(config.deviceSize)} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useDeviceOrientation(): DeviceOrientationResult {
  const [dimensions, setDimensions] = useState<ScaledSize>(getInitialDimensions);

  const handleDimensionChange = useCallback(
    ({ window }: { window: ScaledSize; screen: ScaledSize }) => {
      setDimensions(window);
    },
    []
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', handleDimensionChange);

    return () => {
      subscription.remove();
    };
  }, [handleDimensionChange]);

  const result = useMemo<DeviceOrientationResult>(() => {
    const { width, height } = dimensions;
    const config = getResponsiveConfig(width, height);

    return {
      config,
      orientation: config.orientation,
      deviceType: config.deviceType,
      isPortrait: config.orientation === 'portrait',
      isLandscape: config.isLandscape,
      isTablet: config.isTablet,
      isSplitScreen: config.isSplitScreen,
      width,
      height,
    };
  }, [dimensions]);

  return result;
}

/**
 * Hook to detect specific orientation
 * Useful for conditional rendering based on orientation
 */
export function useIsLandscape(): boolean {
  const { isLandscape } = useDeviceOrientation();
  return isLandscape;
}

/**
 * Hook to detect tablet device
 * Useful for showing/hiding tablet-specific UI elements
 */
export function useIsTablet(): boolean {
  const { isTablet } = useDeviceOrientation();
  return isTablet;
}

/**
 * Hook to detect split-screen mode
 * Useful for adjusting layouts in multitasking scenarios
 */
export function useIsSplitScreen(): boolean {
  const { isSplitScreen } = useDeviceOrientation();
  return isSplitScreen;
}
