/**
 * iOS Widget Utilities
 *
 * Provides iOS home screen widget support for Double-Bind mobile app.
 * Includes widget types, data providers, communication bridge, and actions.
 */

// Types
export {
  WidgetKind,
  WidgetSize,
  type WidgetConfiguration,
  type WidgetOptions,
  type RecentNotesData,
  type QuickCaptureData,
  type DailyNoteData,
  type WidgetData,
  type WidgetUpdatePayload,
  type WidgetTapAction,
} from './WidgetTypes';

// Data Provider
export {
  WidgetDataProvider,
  InMemoryWidgetConfigStore,
  type WidgetConfigStore,
} from './WidgetDataProvider';

// Widget Bridge Hook
export {
  useWidgetBridge,
  MockWidgetBridge,
  type WidgetBridge,
  type WidgetTapHandler,
  type UseWidgetBridgeOptions,
  type UseWidgetBridgeResult,
} from './useWidgetBridge';

// Widget Actions
export { WidgetActions, MockWidgetNavigator, type WidgetNavigator } from './WidgetActions';
