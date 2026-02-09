/**
 * MobileEditor - WebView-based ProseMirror wrapper for mobile.
 *
 * This component renders a WebView containing a ProseMirror-style editor,
 * with proper mobile keyboard integration and React Native bridge communication.
 *
 * Design Decision: WebView vs Native TextInput
 * - WebView: Preserves full ProseMirror compatibility, wiki links, formatting
 * - Native: Would be faster but requires re-implementing all editor features
 * - Chosen: WebView for feature parity with desktop editor
 *
 * @see packages/desktop/src/editor/BlockEditor.tsx for desktop reference
 */

import * as React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { generateEditorHtml } from './editorHtml';
import { useKeyboard } from './useKeyboard';
import type {
  MobileEditorProps,
  MobileEditorHandle,
  WebViewToRNMessage,
  RNToWebViewMessage,
  SelectionState,
  FormatMark,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SELECTION: SelectionState = {
  hasSelection: false,
  from: 0,
  to: 0,
  activeMarks: [],
};

// ============================================================================
// Component
// ============================================================================

/**
 * MobileEditor component - A React Native wrapper for the ProseMirror editor.
 *
 * Uses a WebView to render a ContentEditable-based editor that mimics
 * the desktop ProseMirror behavior, with proper mobile keyboard handling.
 *
 * @example
 * ```tsx
 * const editorRef = useRef<MobileEditorHandle>(null);
 *
 * <MobileEditor
 *   ref={editorRef}
 *   blockId="block-123"
 *   initialContent="Hello, world!"
 *   onContentChange={(content) => saveBlock(content)}
 *   autoFocus
 * />
 *
 * // Later, toggle bold:
 * editorRef.current?.toggleMark('bold');
 * ```
 */
export const MobileEditor = forwardRef<MobileEditorHandle, MobileEditorProps>(
  function MobileEditor(props, ref) {
    const {
      blockId,
      initialContent,
      pageId: _pageId,
      readOnly = false,
      placeholder = 'Start typing...',
      autoFocus = false,
      onContentChange,
      onFocus,
      onBlur,
      onSplitBlock,
      onMergeWithPrevious,
      onIndent,
      onOutdent,
      onAutocompleteRequest,
      autocompleteSuggestions,
      onAutocompleteSelect: _onAutocompleteSelect,
    } = props;

    // ========================================================================
    // Refs & State
    // ========================================================================

    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const [_selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
    const [currentContent, setCurrentContent] = useState(initialContent);
    const _keyboard = useKeyboard();

    // ========================================================================
    // WebView Communication
    // ========================================================================

    /**
     * Sends a message to the WebView.
     */
    const postMessage = useCallback(
      (message: RNToWebViewMessage) => {
        if (webViewRef.current && isReady) {
          webViewRef.current.postMessage(JSON.stringify(message));
        }
      },
      [isReady]
    );

    /**
     * Handles messages from the WebView.
     */
    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as WebViewToRNMessage;

          switch (message.type) {
            case 'READY':
              setIsReady(true);
              if (autoFocus) {
                // Small delay to ensure WebView is fully ready
                setTimeout(() => {
                  postMessage({ type: 'FOCUS' });
                }, 100);
              }
              break;

            case 'CONTENT_CHANGED':
              setCurrentContent(message.content);
              onContentChange?.(message.content);
              break;

            case 'SELECTION_CHANGED':
              setSelection(message.selection);
              break;

            case 'FOCUS_RECEIVED':
              onFocus?.();
              break;

            case 'BLUR_RECEIVED':
              onBlur?.();
              break;

            case 'AUTOCOMPLETE_TRIGGERED':
              onAutocompleteRequest?.(message.trigger, message.query);
              break;

            case 'AUTOCOMPLETE_DISMISSED':
              // Clear suggestions in parent
              break;

            case 'SPLIT_BLOCK':
              onSplitBlock?.(message.cursorPosition);
              break;

            case 'MERGE_WITH_PREVIOUS':
              onMergeWithPrevious?.();
              break;

            case 'INDENT':
              onIndent?.();
              break;

            case 'OUTDENT':
              onOutdent?.();
              break;
          }
        } catch {
          // Ignore parse errors
        }
      },
      [
        autoFocus,
        postMessage,
        onContentChange,
        onFocus,
        onBlur,
        onAutocompleteRequest,
        onSplitBlock,
        onMergeWithPrevious,
        onIndent,
        onOutdent,
      ]
    );

    // ========================================================================
    // Imperative Handle
    // ========================================================================

    useImperativeHandle(
      ref,
      () => ({
        focus: () => postMessage({ type: 'FOCUS' }),
        blur: () => postMessage({ type: 'BLUR' }),
        getContent: () => currentContent,
        setContent: (content: string) => postMessage({ type: 'SET_CONTENT', content }),
        toggleMark: (mark: FormatMark) => postMessage({ type: 'TOGGLE_MARK', mark }),
      }),
      [postMessage, currentContent]
    );

    // ========================================================================
    // Effects
    // ========================================================================

    // Update WebView when autocomplete suggestions change
    useEffect(() => {
      if (autocompleteSuggestions && isReady) {
        postMessage({
          type: 'SET_AUTOCOMPLETE_SUGGESTIONS',
          suggestions: autocompleteSuggestions,
        });
      }
    }, [autocompleteSuggestions, isReady, postMessage]);

    // ========================================================================
    // Render
    // ========================================================================

    const html = generateEditorHtml(blockId, initialContent, placeholder, readOnly);

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webView}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView={false}
          onMessage={handleMessage}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          textInteractionEnabled
          // Accessibility
          accessible
          accessibilityLabel={`Block editor for ${blockId}`}
          accessibilityHint="Double tap to edit text"
        />
      </View>
    );
  }
);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 48,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

// ============================================================================
// Exports
// ============================================================================

export type { MobileEditorProps, MobileEditorHandle };
