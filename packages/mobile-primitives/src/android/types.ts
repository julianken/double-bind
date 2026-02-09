/**
 * Android platform types.
 *
 * Type definitions for Android-specific functionality including
 * widget management and configuration.
 */

// Re-export all widget types
export type {
  AndroidWidgetConfiguration,
  AndroidWidgetOptions,
  AndroidRecentNotesData,
  AndroidQuickCaptureData,
  AndroidDailyNoteData,
  AndroidWidgetData,
  AndroidWidgetUpdatePayload,
  AndroidWidgetTapAction,
} from './WidgetTypes';

export { AndroidWidgetKind, AndroidWidgetSize, getMaxNotesForSize } from './WidgetTypes';

// Re-export widget bridge types
export type {
  AndroidWidgetBridge,
  AndroidWidgetTapHandler,
  UseAndroidWidgetBridgeOptions,
  UseAndroidWidgetBridgeResult,
} from './WidgetBridge';

// Re-export configuration types
export type { AndroidWidgetConfigStore } from './WidgetConfiguration';
