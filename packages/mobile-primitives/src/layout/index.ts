/**
 * Layout components and utilities for mobile layouts
 *
 * Provides:
 * - SafeArea handling for notches and system UI
 * - Responsive containers for adaptive layouts
 * - Screen templates with common patterns
 * - Device orientation hooks
 * - Breakpoint utilities
 */

// Breakpoints and utilities
export {
  BREAKPOINTS,
  type DeviceType,
  type Orientation,
  type LayoutMode,
  type DeviceSize,
  type ResponsiveConfig,
  getDeviceType,
  getOrientation,
  getDeviceSize,
  getLayoutMode,
  getResponsiveConfig,
  getContentPadding,
  getMaxContentWidth,
} from './breakpoints';

// Device orientation hook
export {
  useDeviceOrientation,
  useIsLandscape,
  useIsTablet,
  useIsSplitScreen,
  type DeviceOrientationResult,
} from './useDeviceOrientation';

// SafeArea components
export {
  SafeArea,
  useSafeAreaWithMinimum,
  type SafeAreaProps,
  type SafeAreaEdges,
  type MinimumPadding,
} from './SafeArea';

// Responsive containers
export {
  ResponsiveContainer,
  ResponsiveRow,
  ResponsiveColumn,
  useResponsive,
  type ResponsiveContainerProps,
  type ResponsiveRowProps,
  type ResponsiveColumnProps,
} from './ResponsiveContainer';

// Screen layout templates
export {
  ScreenLayout,
  TabletLayout,
  type ScreenLayoutProps,
  type TabletLayoutProps,
} from './ScreenLayout';
