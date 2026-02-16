/**
 * CodeMirrorEditor - Reusable CodeMirror 6 wrapper component
 *
 * A React component that wraps CodeMirror 6 for code editing in Double-Bind.
 * Designed for raw query/code editing needs.
 *
 * Features:
 * - Syntax highlighting support
 * - Controlled and uncontrolled modes
 * - Customizable theme support
 * - Line numbers (optional)
 * - Read-only mode
 * - Keyboard accessibility
 *
 * @see docs/frontend/code-editor.md for integration guide
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

// ============================================================================
// Types
// ============================================================================

export interface CodeMirrorEditorProps {
  /**
   * Initial value for uncontrolled mode, or current value for controlled mode
   */
  value?: string;

  /**
   * Callback when the editor content changes
   */
  onChange?: (value: string) => void;

  /**
   * Callback when the editor loses focus
   */
  onBlur?: () => void;

  /**
   * Callback when the editor gains focus
   */
  onFocus?: () => void;

  /**
   * Whether the editor is read-only
   * @default false
   */
  readOnly?: boolean;

  /**
   * Whether to show line numbers
   * @default true
   */
  showLineNumbers?: boolean;

  /**
   * Whether to highlight the active line
   * @default true
   */
  highlightActive?: boolean;

  /**
   * Placeholder text when editor is empty
   */
  placeholder?: string;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Minimum height of the editor
   * @default '100px'
   */
  minHeight?: string;

  /**
   * Maximum height of the editor (enables scrolling)
   */
  maxHeight?: string;

  /**
   * Additional CodeMirror extensions
   */
  extensions?: Extension[];

  /**
   * Test ID for testing purposes
   */
  testId?: string;
}

// ============================================================================
// Styles
// ============================================================================

/**
 * CSS class names for styling the CodeMirror editor
 */
export const CODEMIRROR_CSS_CLASSES = {
  container: 'codemirror-editor',
  focused: 'codemirror-editor--focused',
  readOnly: 'codemirror-editor--readonly',
} as const;

/**
 * Default styles for the CodeMirror container.
 * These can be overridden via CSS or the className prop.
 */
export const CODEMIRROR_DEFAULT_STYLES: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  backgroundColor: '#fafafa',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '14px',
  lineHeight: '1.5',
};

// ============================================================================
// Theme Extension
// ============================================================================

/**
 * Base theme for the code editor.
 * Provides sensible defaults that work with both light and dark modes.
 */
const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-content': {
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: '#9ca3af',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  // Syntax highlighting colors
  '.tok-keyword': {
    color: '#7c3aed', // Purple for keywords
    fontWeight: '500',
  },
  '.tok-operator': {
    color: '#0891b2', // Cyan for operators
  },
  '.tok-className': {
    color: '#059669', // Green for relation names
    fontWeight: '500',
  },
  '.tok-variableName': {
    color: '#1d4ed8', // Blue for variables
  },
  '.tok-string': {
    color: '#b45309', // Amber for strings
  },
  '.tok-number': {
    color: '#dc2626', // Red for numbers
  },
  '.tok-comment': {
    color: '#6b7280', // Gray for comments
    fontStyle: 'italic',
  },
  '.tok-function': {
    color: '#7c3aed', // Purple for built-in functions
  },
  '.tok-bracket': {
    color: '#374151', // Dark gray for brackets
  },
  '.tok-punctuation': {
    color: '#6b7280', // Gray for punctuation
  },
});

// ============================================================================
// Component
// ============================================================================

/**
 * CodeMirrorEditor component for code editing.
 *
 * @example
 * ```tsx
 * function QueryEditor() {
 *   const [query, setQuery] = useState('SELECT * FROM pages');
 *
 *   return (
 *     <CodeMirrorEditor
 *       value={query}
 *       onChange={setQuery}
 *       placeholder="Enter SQL query..."
 *     />
 *   );
 * }
 * ```
 */
export function CodeMirrorEditor({
  value = '',
  onChange,
  onBlur,
  onFocus,
  readOnly = false,
  showLineNumbers = true,
  highlightActive = true,
  placeholder,
  className,
  minHeight = '100px',
  maxHeight,
  extensions: additionalExtensions = [],
  testId,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create update listener extension
  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    []
  );

  // Create focus/blur listeners
  const focusListeners = useMemo(
    () =>
      EditorView.domEventHandlers({
        focus: () => {
          onFocus?.();
          return false;
        },
        blur: () => {
          onBlur?.();
          return false;
        },
      }),
    [onFocus, onBlur]
  );

  // Build extensions array
  const extensions = useMemo(() => {
    const ext: Extension[] = [
      // Core editor support
      syntaxHighlighting(defaultHighlightStyle),
      baseTheme,

      // History (undo/redo)
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),

      // Event listeners
      updateListener,
      focusListeners,

      // Additional user extensions
      ...additionalExtensions,
    ];

    // Optional features
    if (showLineNumbers) {
      ext.push(lineNumbers());
    }

    if (highlightActive && !readOnly) {
      ext.push(highlightActiveLine());
    }

    if (readOnly) {
      ext.push(EditorState.readOnly.of(true));
      ext.push(EditorView.editable.of(false));
    }

    if (placeholder) {
      ext.push(
        EditorView.contentAttributes.of({
          'aria-placeholder': placeholder,
        })
      );
    }

    return ext;
  }, [
    showLineNumbers,
    highlightActive,
    readOnly,
    placeholder,
    updateListener,
    focusListeners,
    additionalExtensions,
  ]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Note: We intentionally only run this on mount.
    // The extensions array is memoized and we don't want to recreate the editor
    // when it changes - instead we rely on the view to handle value changes.
  }, []);

  // Update value when controlled
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Note: Extension changes require recreating the editor.
  // For dynamic extension updates, use Compartments.
  // This component recreates on mount, which is sufficient for most use cases.

  // Compute container styles
  const containerStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      ...CODEMIRROR_DEFAULT_STYLES,
      minHeight,
    };

    if (maxHeight) {
      style.maxHeight = maxHeight;
      style.overflow = 'hidden';
    }

    return style;
  }, [minHeight, maxHeight]);

  // Focus the editor programmatically
  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Expose methods via ref (if needed in the future)
  // const getContent = useCallback(() => viewRef.current?.state.doc.toString() ?? '', []);
  // useImperativeHandle(ref, () => ({ focus, getContent }));

  const containerClassName = [
    CODEMIRROR_CSS_CLASSES.container,
    readOnly && CODEMIRROR_CSS_CLASSES.readOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={containerStyle}
      data-testid={testId ?? 'codemirror-editor'}
      role="textbox"
      aria-multiline="true"
      aria-readonly={readOnly}
      aria-label="Code editor"
      onClick={focus}
    />
  );
}

// ============================================================================
// Utility Exports
// ============================================================================

// Note: For advanced operations like getting EditorView instances,
// use React refs with the container div. This component currently
// doesn't expose internal refs to keep the API simple.
