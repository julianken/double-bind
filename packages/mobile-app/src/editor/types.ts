/**
 * Type definitions for the mobile editor components.
 *
 * These types define the interface between the React Native shell
 * and the ProseMirror editor running in the WebView.
 */

import type { BlockId, PageId } from '@double-bind/types';

// ============================================================================
// Editor State Types
// ============================================================================

/**
 * Format marks supported by the editor.
 * Matches the desktop schema marks.
 */
export type FormatMark = 'bold' | 'italic' | 'code' | 'highlight' | 'strikethrough';

/**
 * Current selection state in the editor.
 */
export interface SelectionState {
  /** Whether any text is selected */
  hasSelection: boolean;
  /** Start position of selection */
  from: number;
  /** End position of selection */
  to: number;
  /** Active marks at cursor position */
  activeMarks: FormatMark[];
}

/**
 * Editor content state.
 */
export interface ContentState {
  /** Plain text content */
  text: string;
  /** Whether content has been modified */
  isDirty: boolean;
}

// ============================================================================
// Autocomplete Types
// ============================================================================

/**
 * Autocomplete trigger types.
 */
export type AutocompleteTrigger = 'page' | 'block' | 'tag';

/**
 * Page suggestion for autocomplete.
 */
export interface PageSuggestion {
  pageId: PageId;
  title: string;
  isCreateNew?: boolean;
}

/**
 * Block reference suggestion for autocomplete.
 */
export interface BlockSuggestion {
  blockId: BlockId;
  content: string;
  pageTitle: string;
}

/**
 * Tag suggestion for autocomplete.
 */
export interface TagSuggestion {
  tag: string;
  count: number;
}

/**
 * Combined autocomplete suggestion type.
 */
export type AutocompleteSuggestion =
  | { type: 'page'; data: PageSuggestion }
  | { type: 'block'; data: BlockSuggestion }
  | { type: 'tag'; data: TagSuggestion };

/**
 * Autocomplete state.
 */
export interface AutocompleteState {
  /** Whether autocomplete is active */
  isActive: boolean;
  /** Type of autocomplete trigger */
  trigger: AutocompleteTrigger | null;
  /** Current search query */
  query: string;
  /** Available suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Currently selected index */
  selectedIndex: number;
}

// ============================================================================
// WebView Bridge Types
// ============================================================================

/**
 * Messages sent from React Native to WebView.
 */
export type RNToWebViewMessage =
  | { type: 'INIT'; blockId: BlockId; content: string }
  | { type: 'SET_CONTENT'; content: string }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'TOGGLE_MARK'; mark: FormatMark }
  | { type: 'INSERT_PAGE_LINK'; pageId: PageId; title: string }
  | { type: 'INSERT_BLOCK_REF'; blockId: BlockId }
  | { type: 'INSERT_TAG'; tag: string }
  | { type: 'SET_AUTOCOMPLETE_SUGGESTIONS'; suggestions: AutocompleteSuggestion[] }
  | { type: 'SELECT_AUTOCOMPLETE'; index: number }
  | { type: 'DISMISS_AUTOCOMPLETE' };

/**
 * Messages sent from WebView to React Native.
 */
export type WebViewToRNMessage =
  | { type: 'READY' }
  | { type: 'CONTENT_CHANGED'; content: string }
  | { type: 'SELECTION_CHANGED'; selection: SelectionState }
  | { type: 'FOCUS_RECEIVED' }
  | { type: 'BLUR_RECEIVED' }
  | { type: 'AUTOCOMPLETE_TRIGGERED'; trigger: AutocompleteTrigger; query: string }
  | { type: 'AUTOCOMPLETE_QUERY_CHANGED'; query: string }
  | { type: 'AUTOCOMPLETE_SELECTED'; index: number }
  | { type: 'AUTOCOMPLETE_DISMISSED' }
  | { type: 'SPLIT_BLOCK'; cursorPosition: number }
  | { type: 'MERGE_WITH_PREVIOUS' }
  | { type: 'INDENT' }
  | { type: 'OUTDENT' }
  | { type: 'KEYBOARD_HEIGHT_CHANGED'; height: number };

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for the MobileEditor component.
 */
export interface MobileEditorProps {
  /** Block ID being edited */
  blockId: BlockId;
  /** Initial content */
  initialContent: string;
  /** Page ID containing this block */
  pageId?: PageId;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;

  // Callbacks
  onContentChange?: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSplitBlock?: (cursorPosition: number) => void;
  onMergeWithPrevious?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;

  // Autocomplete
  onAutocompleteRequest?: (trigger: AutocompleteTrigger, query: string) => void;
  autocompleteSuggestions?: AutocompleteSuggestion[];
  onAutocompleteSelect?: (suggestion: AutocompleteSuggestion) => void;
}

/**
 * Props for the MobileToolbar component.
 */
export interface MobileToolbarProps {
  /** Current selection state */
  selection: SelectionState;
  /** Whether toolbar is visible */
  isVisible: boolean;
  /** Keyboard height for positioning */
  keyboardHeight: number;

  // Format callbacks
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleCode: () => void;
  onToggleHighlight: () => void;
  onToggleStrikethrough: () => void;

  // Reference callbacks
  onInsertPageLink: () => void;
  onInsertBlockRef: () => void;
  onInsertTag: () => void;

  // Actions
  onDismissKeyboard: () => void;
}

/**
 * Props for the WikiLinkSuggestions component.
 */
export interface WikiLinkSuggestionsProps {
  /** Whether the suggestions popup is visible */
  isVisible: boolean;
  /** Autocomplete type */
  type: AutocompleteTrigger | null;
  /** Search query */
  query: string;
  /** Available suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Currently selected index */
  selectedIndex: number;
  /** Position from bottom (above keyboard) */
  bottomOffset: number;

  // Callbacks
  onSelect: (suggestion: AutocompleteSuggestion, index: number) => void;
  onClose: () => void;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Keyboard state from useKeyboard hook.
 */
export interface KeyboardState {
  /** Whether keyboard is visible */
  isVisible: boolean;
  /** Keyboard height in pixels */
  height: number;
}

/**
 * Editor imperative handle.
 */
export interface MobileEditorHandle {
  /** Focus the editor */
  focus: () => void;
  /** Blur the editor */
  blur: () => void;
  /** Get current content */
  getContent: () => string;
  /** Set content */
  setContent: (content: string) => void;
  /** Toggle a format mark */
  toggleMark: (mark: FormatMark) => void;
}
