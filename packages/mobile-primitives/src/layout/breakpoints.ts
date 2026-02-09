/**
 * Device breakpoints and responsive utilities for mobile layouts
 *
 * Supports various device form factors:
 * - Phone: Portrait and landscape
 * - Tablet (iPad/Android tablets): Portrait and landscape
 * - Split-screen modes on tablets
 */

/**
 * Device breakpoints in pixels
 * Based on common device dimensions
 */
export const BREAKPOINTS = {
  /** Small phones (iPhone SE, small Androids) */
  phoneSmall: 320,
  /** Standard phones (iPhone 14, Pixel) */
  phone: 375,
  /** Large phones (iPhone Pro Max, large Androids) */
  phoneLarge: 428,
  /** Small tablets / large phones in landscape */
  tabletSmall: 600,
  /** Standard tablets (iPad mini, 9.7" iPads) */
  tablet: 768,
  /** Large tablets (iPad Pro 11") */
  tabletLarge: 1024,
  /** Extra large tablets (iPad Pro 12.9") */
  tabletXL: 1366,
} as const;

/**
 * Device type categories
 */
export type DeviceType = 'phone' | 'tablet';

/**
 * Orientation types
 */
export type Orientation = 'portrait' | 'landscape';

/**
 * Layout mode for split-screen scenarios
 */
export type LayoutMode = 'full' | 'half' | 'third' | 'compact';

/**
 * Device size categories based on width
 */
export type DeviceSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Responsive configuration for layout components
 */
export interface ResponsiveConfig {
  /** Current device type */
  deviceType: DeviceType;
  /** Current orientation */
  orientation: Orientation;
  /** Current device size category */
  deviceSize: DeviceSize;
  /** Current layout mode (for split-screen) */
  layoutMode: LayoutMode;
  /** Whether device is a tablet */
  isTablet: boolean;
  /** Whether device is in landscape mode */
  isLandscape: boolean;
  /** Whether in split-screen mode */
  isSplitScreen: boolean;
  /** Screen width in pixels */
  width: number;
  /** Screen height in pixels */
  height: number;
}

/**
 * Determine device type based on width
 */
export function getDeviceType(width: number): DeviceType {
  return width >= BREAKPOINTS.tabletSmall ? 'tablet' : 'phone';
}

/**
 * Determine orientation based on dimensions
 */
export function getOrientation(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Determine device size category based on width
 */
export function getDeviceSize(width: number): DeviceSize {
  if (width >= BREAKPOINTS.tabletLarge) return 'xlarge';
  if (width >= BREAKPOINTS.tablet) return 'large';
  if (width >= BREAKPOINTS.tabletSmall) return 'medium';
  return 'small';
}

/**
 * Determine layout mode based on aspect ratio and width
 * Used to detect split-screen scenarios on tablets
 */
export function getLayoutMode(width: number, height: number): LayoutMode {
  const aspectRatio = width / height;

  // Split-screen detection for tablets
  if (width >= BREAKPOINTS.tabletSmall) {
    // Very narrow aspect ratio suggests half-screen or third-screen mode
    if (aspectRatio < 0.5) return 'third';
    if (aspectRatio < 0.75) return 'half';
  }

  // Very compact width suggests slide-over mode on iPad
  if (width < BREAKPOINTS.phoneSmall) return 'compact';

  return 'full';
}

/**
 * Build complete responsive configuration from dimensions
 */
export function getResponsiveConfig(width: number, height: number): ResponsiveConfig {
  const deviceType = getDeviceType(width);
  const orientation = getOrientation(width, height);
  const deviceSize = getDeviceSize(width);
  const layoutMode = getLayoutMode(width, height);

  return {
    deviceType,
    orientation,
    deviceSize,
    layoutMode,
    isTablet: deviceType === 'tablet',
    isLandscape: orientation === 'landscape',
    isSplitScreen: layoutMode !== 'full',
    width,
    height,
  };
}

/**
 * Standard content padding based on device size
 */
export function getContentPadding(deviceSize: DeviceSize): number {
  switch (deviceSize) {
    case 'xlarge':
      return 32;
    case 'large':
      return 24;
    case 'medium':
      return 20;
    case 'small':
    default:
      return 16;
  }
}

/**
 * Maximum content width for readability on large screens
 */
export function getMaxContentWidth(deviceSize: DeviceSize): number | undefined {
  switch (deviceSize) {
    case 'xlarge':
      return 1200;
    case 'large':
      return 900;
    default:
      return undefined; // Full width for smaller devices
  }
}
