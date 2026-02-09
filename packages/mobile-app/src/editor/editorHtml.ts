/**
 * editorHtml - HTML template for the ProseMirror WebView editor.
 *
 * This module generates the HTML/CSS/JS bundle that runs inside the WebView.
 * It includes a simplified ProseMirror setup optimized for mobile editing.
 *
 * The editor communicates with React Native via postMessage/onMessage.
 *
 * Security: Content is sanitized using textContent for plain text display
 * and DOM APIs for structured content creation.
 */

/**
 * Generates the HTML content for the editor WebView.
 *
 * @param blockId - The block ID being edited
 * @param initialContent - Initial text content
 * @param placeholder - Placeholder text when empty
 * @param readOnly - Whether editor is read-only
 * @returns HTML string for WebView
 */
export function generateEditorHtml(
  blockId: string,
  initialContent: string,
  placeholder: string = 'Start typing...',
  readOnly: boolean = false
): string {
  // Escape content for safe embedding in JSON
  const escapedContent = JSON.stringify(initialContent);
  const escapedPlaceholder = escapeHtml(placeholder);
  const escapedBlockId = escapeHtml(blockId);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Editor</title>
  <style>
    ${getEditorStyles()}
  </style>
</head>
<body>
  <div id="editor"
       data-block-id="${escapedBlockId}"
       data-placeholder="${escapedPlaceholder}"
       ${readOnly ? 'data-readonly="true"' : ''}>
  </div>
  <script>
    ${getEditorScript(escapedContent)}
  </script>
</body>
</html>
`;
}

/**
 * Escapes HTML special characters for safe attribute embedding.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns the CSS styles for the editor.
 */
function getEditorStyles(): string {
  return `
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #1a1a1a;
      background: transparent;
      -webkit-text-size-adjust: 100%;
    }

    #editor {
      min-height: 100%;
      padding: 12px 16px;
      outline: none;
    }

    #editor:empty::before {
      content: attr(data-placeholder);
      color: #8e8e93;
      pointer-events: none;
    }

    /* ProseMirror styles */
    .ProseMirror {
      outline: none;
      min-height: 24px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .ProseMirror p {
      margin: 0;
    }

    .ProseMirror-focused {
      outline: none;
    }

    /* Formatting marks */
    .ProseMirror strong { font-weight: 600; }
    .ProseMirror em { font-style: italic; }
    .ProseMirror code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.9em;
      background: #f0f0f0;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .ProseMirror mark {
      background: #fff3a3;
      padding: 1px 2px;
      border-radius: 2px;
    }
    .ProseMirror s { text-decoration: line-through; }

    /* Reference styles */
    .page-link {
      color: #1a73e8;
      text-decoration: none;
      background: rgba(26, 115, 232, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .block-ref {
      color: #7b1fa2;
      text-decoration: none;
      background: rgba(123, 31, 162, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .tag {
      color: #0d904f;
      text-decoration: none;
      background: rgba(13, 144, 79, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
    }

    /* Selection styles */
    .ProseMirror ::selection {
      background: rgba(26, 115, 232, 0.3);
    }

    /* Headings */
    .ProseMirror h1 { font-size: 1.5em; font-weight: 600; margin: 0; }
    .ProseMirror h2 { font-size: 1.25em; font-weight: 600; margin: 0; }
    .ProseMirror h3 { font-size: 1.1em; font-weight: 600; margin: 0; }

    /* Code blocks */
    .ProseMirror pre {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.9em;
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0;
    }

    /* Todo items */
    .todo-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .todo-item input[type="checkbox"] {
      margin-top: 4px;
    }

    .todo-item.checked .todo-content {
      text-decoration: line-through;
      color: #8e8e93;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      html, body {
        color: #e5e5e5;
        background: transparent;
      }

      .ProseMirror code { background: #2d2d2d; }
      .ProseMirror mark { background: #665c00; }
      .ProseMirror pre { background: #1e1e1e; }

      .page-link {
        color: #8ab4f8;
        background: rgba(138, 180, 248, 0.15);
      }
      .block-ref {
        color: #ce93d8;
        background: rgba(206, 147, 216, 0.15);
      }
      .tag {
        color: #81c784;
        background: rgba(129, 199, 132, 0.15);
      }
    }
  `;
}

/**
 * Returns the JavaScript for the editor.
 * This is a simplified implementation - in production, you'd bundle ProseMirror.
 * Uses safe DOM APIs instead of innerHTML for content manipulation.
 */
function getEditorScript(escapedContent: string): string {
  return `
    (function() {
      'use strict';

      // ========================================================================
      // State
      // ========================================================================

      let editorContent = ${escapedContent};
      let activeMarks = [];
      let autocompleteState = { active: false, trigger: null, query: '' };

      // ========================================================================
      // DOM Elements
      // ========================================================================

      const editorEl = document.getElementById('editor');
      const isReadOnly = editorEl.hasAttribute('data-readonly');

      // ========================================================================
      // Safe DOM Content Creation
      // ========================================================================

      /**
       * Creates a text node with the given content.
       * Safe: textContent automatically escapes HTML.
       */
      function createTextNode(text) {
        return document.createTextNode(text);
      }

      /**
       * Creates a styled span element for references.
       * Safe: Uses DOM APIs, not innerHTML.
       */
      function createReferenceElement(type, attrs, displayText) {
        const el = document.createElement('a');
        el.className = type;
        el.href = '#';
        el.setAttribute('data-type', type);

        for (const [key, value] of Object.entries(attrs)) {
          el.setAttribute('data-' + key, value);
        }

        el.appendChild(createTextNode(displayText));
        return el;
      }

      /**
       * Parses text and creates DOM nodes for references.
       * Returns an array of DOM nodes (text nodes and reference elements).
       */
      function parseTextToNodes(text) {
        const nodes = [];
        let remaining = text;
        let match;

        // Combined regex for all reference types
        const patterns = [
          { regex: /\\[\\[([^\\]]+)\\]\\]/, type: 'page-link', createEl: (m) =>
            createReferenceElement('page-link', { title: m[1] }, m[1]) },
          { regex: /\\(\\(([a-zA-Z0-9]+)\\)\\)/, type: 'block-ref', createEl: (m) =>
            createReferenceElement('block-ref', { 'block-id': m[1] }, '((' + m[1] + '))') },
          { regex: /#\\[\\[([^\\]]+)\\]\\]/, type: 'tag', createEl: (m) =>
            createReferenceElement('tag', { tag: m[1] }, '#' + m[1]) },
          { regex: /#([a-zA-Z][a-zA-Z0-9_-]*)/, type: 'tag', createEl: (m) =>
            createReferenceElement('tag', { tag: m[1] }, '#' + m[1]) },
        ];

        while (remaining.length > 0) {
          let earliestMatch = null;
          let earliestPattern = null;
          let earliestIndex = remaining.length;

          // Find the earliest matching pattern
          for (const pattern of patterns) {
            match = remaining.match(pattern.regex);
            if (match && match.index < earliestIndex) {
              earliestMatch = match;
              earliestPattern = pattern;
              earliestIndex = match.index;
            }
          }

          if (earliestMatch && earliestPattern) {
            // Add text before the match
            if (earliestIndex > 0) {
              nodes.push(createTextNode(remaining.slice(0, earliestIndex)));
            }
            // Add the reference element
            nodes.push(earliestPattern.createEl(earliestMatch));
            // Continue with remaining text
            remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
          } else {
            // No more matches, add remaining text
            if (remaining.length > 0) {
              nodes.push(createTextNode(remaining));
            }
            break;
          }
        }

        return nodes;
      }

      /**
       * Renders content to the editor using safe DOM APIs.
       */
      function renderContent(text) {
        // Clear existing content
        while (editorEl.firstChild) {
          editorEl.removeChild(editorEl.firstChild);
        }

        if (!text) return;

        // Create paragraph wrapper
        const p = document.createElement('p');

        // Parse and add nodes
        const nodes = parseTextToNodes(text);
        for (const node of nodes) {
          p.appendChild(node);
        }

        editorEl.appendChild(p);
      }

      // ========================================================================
      // Simple ContentEditable Editor
      // (In production, this would be a full ProseMirror setup)
      // ========================================================================

      // Initialize content
      editorEl.contentEditable = isReadOnly ? 'false' : 'true';
      renderContent(editorContent);

      function getPlainText() {
        return editorEl.innerText || '';
      }

      function getSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          return { hasSelection: false, from: 0, to: 0, activeMarks: [] };
        }
        const range = sel.getRangeAt(0);
        return {
          hasSelection: !range.collapsed,
          from: range.startOffset,
          to: range.endOffset,
          activeMarks: getActiveMarks()
        };
      }

      function getActiveMarks() {
        const marks = [];
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return marks;

        let node = sel.anchorNode;
        while (node && node !== editorEl) {
          const tag = node.nodeName.toLowerCase();
          if (tag === 'strong' || tag === 'b') marks.push('bold');
          if (tag === 'em' || tag === 'i') marks.push('italic');
          if (tag === 'code') marks.push('code');
          if (tag === 'mark') marks.push('highlight');
          if (tag === 's' || tag === 'strike' || tag === 'del') marks.push('strikethrough');
          node = node.parentNode;
        }
        return [...new Set(marks)];
      }

      // ========================================================================
      // Autocomplete Detection
      // ========================================================================

      function checkAutocomplete() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const text = getPlainText();
        const cursorPos = getCursorPosition();
        const beforeCursor = text.slice(0, cursorPos);

        // Check for [[ trigger
        const pageLinkMatch = beforeCursor.match(/\\[\\[([^\\]]*)$/);
        if (pageLinkMatch) {
          const query = pageLinkMatch[1];
          if (!autocompleteState.active || autocompleteState.trigger !== 'page' || autocompleteState.query !== query) {
            autocompleteState = { active: true, trigger: 'page', query };
            postMessage({ type: 'AUTOCOMPLETE_TRIGGERED', trigger: 'page', query });
          }
          return;
        }

        // Check for (( trigger
        const blockRefMatch = beforeCursor.match(/\\(\\(([^)]*)$/);
        if (blockRefMatch) {
          const query = blockRefMatch[1];
          if (!autocompleteState.active || autocompleteState.trigger !== 'block' || autocompleteState.query !== query) {
            autocompleteState = { active: true, trigger: 'block', query };
            postMessage({ type: 'AUTOCOMPLETE_TRIGGERED', trigger: 'block', query });
          }
          return;
        }

        // Check for # trigger
        const tagMatch = beforeCursor.match(/#([a-zA-Z0-9_-]*)$/);
        if (tagMatch) {
          const query = tagMatch[1];
          if (!autocompleteState.active || autocompleteState.trigger !== 'tag' || autocompleteState.query !== query) {
            autocompleteState = { active: true, trigger: 'tag', query };
            postMessage({ type: 'AUTOCOMPLETE_TRIGGERED', trigger: 'tag', query });
          }
          return;
        }

        // No autocomplete trigger
        if (autocompleteState.active) {
          autocompleteState = { active: false, trigger: null, query: '' };
          postMessage({ type: 'AUTOCOMPLETE_DISMISSED' });
        }
      }

      function getCursorPosition() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return 0;

        const range = sel.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(editorEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        return preRange.toString().length;
      }

      // ========================================================================
      // Event Handlers
      // ========================================================================

      editorEl.addEventListener('input', function(e) {
        editorContent = getPlainText();
        postMessage({ type: 'CONTENT_CHANGED', content: editorContent });
        checkAutocomplete();
      });

      editorEl.addEventListener('focus', function() {
        postMessage({ type: 'FOCUS_RECEIVED' });
      });

      editorEl.addEventListener('blur', function() {
        postMessage({ type: 'BLUR_RECEIVED' });
      });

      editorEl.addEventListener('keydown', function(e) {
        // Handle special keys
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const pos = getCursorPosition();
          postMessage({ type: 'SPLIT_BLOCK', cursorPosition: pos });
          return;
        }

        if (e.key === 'Backspace') {
          const pos = getCursorPosition();
          if (pos === 0) {
            e.preventDefault();
            postMessage({ type: 'MERGE_WITH_PREVIOUS' });
            return;
          }
        }

        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            postMessage({ type: 'OUTDENT' });
          } else {
            postMessage({ type: 'INDENT' });
          }
          return;
        }

        // Autocomplete navigation
        if (autocompleteState.active) {
          if (e.key === 'Escape') {
            e.preventDefault();
            autocompleteState = { active: false, trigger: null, query: '' };
            postMessage({ type: 'AUTOCOMPLETE_DISMISSED' });
            return;
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            // Let React Native handle navigation
            return;
          }
        }
      });

      document.addEventListener('selectionchange', function() {
        const selection = getSelection();
        activeMarks = selection.activeMarks;
        postMessage({ type: 'SELECTION_CHANGED', selection });
      });

      // Prevent link clicks
      editorEl.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
          e.preventDefault();
        }
      });

      // ========================================================================
      // Message Handling (from React Native)
      // ========================================================================

      function handleMessage(event) {
        let data;
        try {
          data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (e) {
          return;
        }

        switch (data.type) {
          case 'FOCUS':
            editorEl.focus();
            break;

          case 'BLUR':
            editorEl.blur();
            break;

          case 'SET_CONTENT':
            editorContent = data.content;
            renderContent(data.content);
            break;

          case 'TOGGLE_MARK':
            toggleMark(data.mark);
            break;

          case 'INSERT_PAGE_LINK':
            insertPageLink(data.pageId, data.title);
            break;

          case 'INSERT_BLOCK_REF':
            insertBlockRef(data.blockId);
            break;

          case 'INSERT_TAG':
            insertTag(data.tag);
            break;

          case 'DISMISS_AUTOCOMPLETE':
            autocompleteState = { active: false, trigger: null, query: '' };
            break;
        }
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage); // Android

      // ========================================================================
      // Formatting Functions
      // ========================================================================

      function toggleMark(mark) {
        // Use execCommand for basic formatting
        const commandMap = {
          bold: 'bold',
          italic: 'italic',
          strikethrough: 'strikeThrough'
        };

        if (commandMap[mark]) {
          document.execCommand(commandMap[mark], false, null);
        } else if (mark === 'code' || mark === 'highlight') {
          // For code and highlight, wrap selection manually
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

          const range = sel.getRangeAt(0);
          const selectedText = range.toString();
          const wrapper = document.createElement(mark === 'code' ? 'code' : 'mark');
          wrapper.appendChild(createTextNode(selectedText));
          range.deleteContents();
          range.insertNode(wrapper);
        }

        postMessage({ type: 'SELECTION_CHANGED', selection: getSelection() });
      }

      function insertPageLink(pageId, title) {
        replaceAutocomplete('[[' + title + ']]');
      }

      function insertBlockRef(blockId) {
        replaceAutocomplete('((' + blockId + '))');
      }

      function insertTag(tag) {
        replaceAutocomplete('#' + tag);
      }

      function replaceAutocomplete(replacement) {
        const text = getPlainText();
        const cursorPos = getCursorPosition();

        // Find the trigger position
        const beforeCursor = text.slice(0, cursorPos);
        let triggerPos = cursorPos;

        // Check for different triggers
        const pageTrigger = beforeCursor.lastIndexOf('[[');
        const blockTrigger = beforeCursor.lastIndexOf('((');
        const tagTrigger = beforeCursor.lastIndexOf('#');

        if (autocompleteState.trigger === 'page' && pageTrigger !== -1) {
          triggerPos = pageTrigger;
        } else if (autocompleteState.trigger === 'block' && blockTrigger !== -1) {
          triggerPos = blockTrigger;
        } else if (autocompleteState.trigger === 'tag' && tagTrigger !== -1) {
          triggerPos = tagTrigger;
        }

        // Replace the autocomplete text
        const before = text.slice(0, triggerPos);
        const after = text.slice(cursorPos);
        const newContent = before + replacement + after;

        editorContent = newContent;
        renderContent(newContent);

        // Reset autocomplete state
        autocompleteState = { active: false, trigger: null, query: '' };

        postMessage({ type: 'CONTENT_CHANGED', content: newContent });
      }

      // ========================================================================
      // Bridge to React Native
      // ========================================================================

      function postMessage(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      // Signal ready
      postMessage({ type: 'READY' });

    })();
  `;
}
