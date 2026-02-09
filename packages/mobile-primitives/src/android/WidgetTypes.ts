/**
 * WidgetTypes.ts - TypeScript types for Android widgets
 *
 * Provides type definitions for Android home screen widgets including
 * widget kinds, sizes, configurations, and data structures.
 */

import type { PageId, BlockId } from '@double-bind/types';

/**
 * Supported Android widget kinds
 */
export enum AndroidWidgetKind {
  RecentNotes = 'recentNotes',
  QuickCapture = 'quickCapture',
  DailyNote = 'dailyNote',
}

/**
 * Android widget size options
 * Maps to Android AppWidget size classes
 */
export enum AndroidWidgetSize {
  Small = 'small', // 2x2 grid cells (shows 3 notes)
  Medium = 'medium', // 4x2 grid cells (shows 5 notes)
  Large = 'large', // 4x4 grid cells (shows 10 notes)
}

/**
 * Widget configuration interface
 * Stores user preferences for each widget instance
 */
export interface AndroidWidgetConfiguration {
  /**
   * Unique identifier for the widget instance
   */
  widgetId: string;

  /**
   * Type of widget
   */
  kind: AndroidWidgetKind;

  /**
   * Display size of the widget
   */
  size: AndroidWidgetSize;

  /**
   * Custom configuration options specific to the widget kind
   */
  options: AndroidWidgetOptions;

  /**
   * Last update timestamp (milliseconds since epoch)
   */
  lastUpdated: number;
}

/**
 * Widget-specific configuration options
 */
export interface AndroidWidgetOptions {
  /**
   * For RecentNotes: maximum number of notes to display
   * Small: 3, Medium: 5, Large: 10
   */
  maxNotes?: number;

  /**
   * For RecentNotes: whether to show note previews
   */
  showPreviews?: boolean;

  /**
   * For QuickCapture: default page to capture to (null = today's daily note)
   */
  defaultPageId?: PageId | null;

  /**
   * For QuickCapture: placeholder text
   */
  placeholder?: string;

  /**
   * For DailyNote: whether to show upcoming tasks
   */
  showTasks?: boolean;

  /**
   * For DailyNote: whether to show linked pages count
   */
  showLinkedPages?: boolean;

  /**
   * Theme preference: light, dark, or auto (follows system)
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Background transparency (0-100)
   */
  backgroundOpacity?: number;

  /**
   * Custom accent color (hex)
   */
  accentColor?: string;
}

/**
 * Recent notes widget data
 */
export interface AndroidRecentNotesData {
  notes: Array<{
    pageId: PageId;
    title: string;
    preview?: string;
    updatedAt: number;
  }>;
  lastUpdated: number;
}

/**
 * Quick capture widget data
 */
export interface AndroidQuickCaptureData {
  defaultPageId: PageId | null;
  placeholder: string;
  lastUpdated: number;
}

/**
 * Daily note widget data
 */
export interface AndroidDailyNoteData {
  pageId: PageId;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  blockCount: number;
  taskCount?: number;
  linkedPagesCount?: number;
  preview?: string;
  lastUpdated: number;
}

/**
 * Union type for all widget data types
 */
export type AndroidWidgetData =
  | AndroidRecentNotesData
  | AndroidQuickCaptureData
  | AndroidDailyNoteData;

/**
 * Widget update payload sent to Android
 */
export interface AndroidWidgetUpdatePayload {
  widgetId: string;
  kind: AndroidWidgetKind;
  data: AndroidWidgetData;
  timestamp: number;
}

/**
 * Widget tap action payload received from Android
 */
export interface AndroidWidgetTapAction {
  widgetId: string;
  kind: AndroidWidgetKind;
  action: string;
  payload?: {
    pageId?: PageId;
    blockId?: BlockId;
    content?: string;
  };
}

/**
 * Get recommended note count for widget size
 */
export function getMaxNotesForSize(size: AndroidWidgetSize): number {
  switch (size) {
    case AndroidWidgetSize.Small:
      return 3;
    case AndroidWidgetSize.Medium:
      return 5;
    case AndroidWidgetSize.Large:
      return 10;
  }
}
