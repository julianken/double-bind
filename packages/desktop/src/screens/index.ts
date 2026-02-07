/**
 * Screens - Top-level view components for routing
 *
 * Screens are the main content areas rendered by the Router.
 * Each screen receives props from route matching (e.g., pageId).
 */

export { PageView, PageTitle, type PageViewProps } from './PageView.js';
// BlockNode is exported from components, not screens
export { BlockNode } from '../components/BlockNode.js';

export { DailyNotesView, formatDailyNoteDate, getTodayISODate } from './DailyNotesView.js';
export type { DailyNotesViewProps } from './DailyNotesView.js';

export { GraphViewScreen } from './GraphViewScreen.js';
export type { GraphViewScreenProps } from './GraphViewScreen.js';

export { SearchResultsView, HighlightedText } from './SearchResultsView.js';
export type { SearchResultsViewProps, HighlightedTextProps } from './SearchResultsView.js';
