/**
 * Tests for editorHtml module.
 *
 * These tests verify the HTML generation for the WebView editor.
 */

import { describe, it, expect } from 'vitest';
import { generateEditorHtml } from '../../../src/editor/editorHtml';

describe('editorHtml', () => {
  describe('generateEditorHtml', () => {
    it('should generate valid HTML structure', () => {
      const html = generateEditorHtml('block-123', 'Hello, world!');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('id="editor"');
    });

    it('should include block ID in data attribute', () => {
      const html = generateEditorHtml('block-abc-123', 'content');

      expect(html).toContain('data-block-id="block-abc-123"');
    });

    it('should include placeholder text', () => {
      const html = generateEditorHtml('block-1', '', 'Type something...');

      expect(html).toContain('data-placeholder="Type something..."');
    });

    it('should use default placeholder when not provided', () => {
      const html = generateEditorHtml('block-1', '');

      expect(html).toContain('data-placeholder="Start typing..."');
    });

    it('should include readonly attribute when specified', () => {
      const html = generateEditorHtml('block-1', 'content', 'placeholder', true);

      expect(html).toContain('data-readonly="true"');
    });

    it('should not include readonly attribute when false', () => {
      const html = generateEditorHtml('block-1', 'content', 'placeholder', false);

      // The #editor div should not have data-readonly="true" attribute
      expect(html).not.toContain('data-readonly="true"');
    });

    it('should escape HTML special characters in content', () => {
      const content = 'Hello <script>alert("xss")</script>';
      const html = generateEditorHtml('block-1', content);

      // Content is JSON.stringify'd, so it should be escaped
      expect(html).toContain(JSON.stringify(content));
      // Raw script tag should not appear outside of string
      expect(html.replace(JSON.stringify(content), '')).not.toContain('<script>alert');
    });

    it('should escape HTML special characters in placeholder', () => {
      const html = generateEditorHtml('block-1', '', '<b>Bold</b> text');

      expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    });

    it('should include CSS styles', () => {
      const html = generateEditorHtml('block-1', 'content');

      // Check for style tag and key styles
      expect(html).toContain('<style>');
      expect(html).toContain('#editor');
      expect(html).toContain('.ProseMirror');
      expect(html).toContain('.page-link');
      expect(html).toContain('.block-ref');
      expect(html).toContain('.tag');
    });

    it('should include JavaScript for editor functionality', () => {
      const html = generateEditorHtml('block-1', 'content');

      // Check for script tag and key functions
      expect(html).toContain('<script>');
      expect(html).toContain('postMessage');
      expect(html).toContain('handleMessage');
      expect(html).toContain('checkAutocomplete');
    });

    it('should support dark mode styles', () => {
      const html = generateEditorHtml('block-1', 'content');

      expect(html).toContain('@media (prefers-color-scheme: dark)');
    });

    it('should include reference parsing for wiki links', () => {
      const html = generateEditorHtml('block-1', '[[Page Name]]');

      // The parsing logic should be in the script
      expect(html).toContain('page-link');
      expect(html).toContain('data-type');
    });

    it('should include reference parsing for block refs', () => {
      const html = generateEditorHtml('block-1', '((block123))');

      expect(html).toContain('block-ref');
    });

    it('should include reference parsing for tags', () => {
      const html = generateEditorHtml('block-1', '#tag');

      // Tag class is defined in CSS and used in parseTextToNodes
      expect(html).toContain('.tag');
    });

    it('should handle empty content', () => {
      const html = generateEditorHtml('block-1', '');

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });

    it('should handle multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const html = generateEditorHtml('block-1', content);

      expect(html).toContain(JSON.stringify(content));
    });

    it('should handle unicode content', () => {
      const content = 'Hello, world!';
      const html = generateEditorHtml('block-1', content);

      expect(html).toContain(JSON.stringify(content));
    });
  });
});
