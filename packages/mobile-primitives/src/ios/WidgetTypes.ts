/**
 * WidgetTypes.ts - TypeScript types for iOS widgets
 *
 * Provides type definitions for iOS home screen widgets including
 * widget kinds, sizes, configurations, and data structures.
 */

import type { PageId, BlockId } from '@double-bind/types';

/**
 * Supported iOS widget kinds
 */
export enum WidgetKind {
  RecentNotes = 'recentNotes',
  QuickCapture = 'quickCapture',
  DailyNote = 'dailyNote',
}

/**
 * iOS widget size options
 * Maps to iOS WidgetFamily: systemSmall, systemMedium, systemLarge
 */
export enum WidgetSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
}

/**
 * Widget configuration interface
 * Stores user preferences for each widget instance
 */
export interface WidgetConfiguration {
  /**
   * Unique identifier for the widget instance
   */
  widgetId: string;

  /**
   * Type of widget
   */
  kind: WidgetKind;

  /**
   * Display size of the widget
   */
  size: WidgetSize;

  /**
   * Custom configuration options specific to the widget kind
   */
  options: WidgetOptions;

  /**
   * Last update timestamp (milliseconds since epoch)
   */
  lastUpdated: number;
}

/**
 * Widget-specific configuration options
 */
export interface WidgetOptions {
  /**
   * For RecentNotes: maximum number of notes to display (1-10)
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
}

/**
 * Recent notes widget data
 */
export interface RecentNotesData {
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
export interface QuickCaptureData {
  defaultPageId: PageId | null;
  placeholder: string;
  lastUpdated: number;
}

/**
 * Daily note widget data
 */
export interface DailyNoteData {
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
export type WidgetData = RecentNotesData | QuickCaptureData | DailyNoteData;

/**
 * Widget update payload sent to iOS
 */
export interface WidgetUpdatePayload {
  widgetId: string;
  kind: WidgetKind;
  data: WidgetData;
  timestamp: number;
}

/**
 * Widget tap action payload received from iOS
 */
export interface WidgetTapAction {
  widgetId: string;
  kind: WidgetKind;
  action: string;
  payload?: {
    pageId?: PageId;
    blockId?: BlockId;
    content?: string;
  };
}
