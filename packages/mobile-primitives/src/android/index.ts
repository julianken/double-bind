/**
 * Android platform utilities.
 *
 * Provides Android-specific functionality including:
 * - Home screen widgets (Recent Notes, Quick Capture, Daily Note)
 * - Widget configuration and appearance settings
 * - Native bridge for widget communication
 */

// =============================================================================
// WIDGET TYPES
// =============================================================================

export {
  AndroidWidgetKind,
  AndroidWidgetSize,
  getMaxNotesForSize,
  type AndroidWidgetConfiguration,
  type AndroidWidgetOptions,
  type AndroidRecentNotesData,
  type AndroidQuickCaptureData,
  type AndroidDailyNoteData,
  type AndroidWidgetData,
  type AndroidWidgetUpdatePayload,
  type AndroidWidgetTapAction,
} from './WidgetTypes';

// =============================================================================
// WIDGET PROVIDER
// =============================================================================

export { AndroidWidgetProvider } from './WidgetProvider';

// =============================================================================
// WIDGET BRIDGE
// =============================================================================

export {
  useAndroidWidgetBridge,
  MockAndroidWidgetBridge,
  type AndroidWidgetBridge,
  type AndroidWidgetTapHandler,
  type UseAndroidWidgetBridgeOptions,
  type UseAndroidWidgetBridgeResult,
} from './WidgetBridge';

// =============================================================================
// WIDGET CONFIGURATION
// =============================================================================

export {
  InMemoryAndroidWidgetConfigStore,
  AndroidWidgetConfigManager,
  type AndroidWidgetConfigStore,
} from './WidgetConfiguration';
