/**
 * Mobile Editor Module
 *
 * Provides a WebView-based ProseMirror editor for mobile with:
 * - MobileEditor: Main editor component with WebView wrapper
 * - MobileToolbar: Floating formatting toolbar above keyboard
 * - WikiLinkSuggestions: Autocomplete popup for [[pages]], ((blocks)), and #tags
 * - useKeyboard: Hook for keyboard visibility and height
 *
 * @example
 * ```tsx
 * import {
 *   MobileEditor,
 *   MobileToolbar,
 *   WikiLinkSuggestions,
 *   useKeyboard,
 * } from './editor';
 *
 * function EditorScreen() {
 *   const keyboard = useKeyboard();
 *   const editorRef = useRef<MobileEditorHandle>(null);
 *
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <MobileEditor
 *         ref={editorRef}
 *         blockId="block-123"
 *         initialContent="Hello, world!"
 *       />
 *       <MobileToolbar
 *         isVisible={keyboard.isVisible}
 *         keyboardHeight={keyboard.height}
 *         selection={selection}
 *         onToggleBold={() => editorRef.current?.toggleMark('bold')}
 *         // ...
 *       />
 *     </View>
 *   );
 * }
 * ```
 */

// Components
export { MobileEditor } from './MobileEditor';
export { MobileToolbar } from './MobileToolbar';
export { WikiLinkSuggestions } from './WikiLinkSuggestions';

// Hooks
export { useKeyboard, useKeyboardDismiss, useDismissKeyboardOnTap } from './useKeyboard';

// Utilities
export { generateEditorHtml } from './editorHtml';

// Types
export type {
  // Core types
  FormatMark,
  SelectionState,
  ContentState,
  KeyboardState,
  // Autocomplete types
  AutocompleteTrigger,
  AutocompleteSuggestion,
  AutocompleteState,
  PageSuggestion,
  BlockSuggestion,
  TagSuggestion,
  // Component props
  MobileEditorProps,
  MobileEditorHandle,
  MobileToolbarProps,
  WikiLinkSuggestionsProps,
  // Bridge types
  RNToWebViewMessage,
  WebViewToRNMessage,
} from './types';
