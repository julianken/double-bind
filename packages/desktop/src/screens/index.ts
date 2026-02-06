/**
 * Screens - Top-level view components for routing
 *
 * Screens are the main content areas rendered by the Router.
 * Each screen receives props from route matching (e.g., pageId).
 */

export { PageView, PageTitle, BlockNode, type PageViewProps } from './PageView.js';

export { DailyNotesView, formatDailyNoteDate, getTodayISODate } from './DailyNotesView.js';
export type { DailyNotesViewProps } from './DailyNotesView.js';
