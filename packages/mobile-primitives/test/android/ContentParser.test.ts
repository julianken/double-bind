/**
 * ContentParser Tests
 *
 * Tests for Android content parsing utilities including URL detection,
 * HTML to markdown conversion, and wiki link extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSharedContent,
  validateShareContent,
  extractWikiLinks,
  convertToMarkdown,
  htmlToMarkdown,
  detectContentType,
} from '../../src/android/ContentParser';
import { ShareContentType, ShareMimeType } from '../../src/android/types';

describe('ContentParser', () => {
  describe('parseSharedContent', () => {
    it('should parse plain text content', () => {
      const result = parseSharedContent('Hello, world!', ShareMimeType.TEXT_PLAIN);

      expect(result.type).toBe(ShareContentType.Text);
      expect(result.content).toBe('Hello, world!');
      expect(result.url).toBeUndefined();
    });

    it('should detect URLs in content', () => {
      const result = parseSharedContent('Check out https://example.com', ShareMimeType.TEXT_PLAIN);

      expect(result.type).toBe(ShareContentType.URL);
      expect(result.content).toBe('Check out https://example.com');
      expect(result.url).toBe('https://example.com');
    });

    it('should extract title from multiline content', () => {
      const content = 'My Title\nSome content here\nMore content';
      const result = parseSharedContent(content, ShareMimeType.TEXT_PLAIN);

      expect(result.title).toBe('My Title');
      expect(result.content).toBe(content);
    });

    it('should not extract title if first line is too long', () => {
      const longLine = 'A'.repeat(120);
      const result = parseSharedContent(`${longLine}\nSecond line`, ShareMimeType.TEXT_PLAIN);

      expect(result.title).toBeUndefined();
    });

    it('should preserve wiki links', () => {
      const content = 'Link to [[My Page]] and [[Another Page]]';
      const result = parseSharedContent(content, ShareMimeType.TEXT_PLAIN, {
        preserveWikiLinks: true,
      });

      expect(result.content).toContain('[[My Page]]');
      expect(result.content).toContain('[[Another Page]]');
    });

    it('should truncate content if maxLength is specified', () => {
      const longContent = 'A'.repeat(200);
      const result = parseSharedContent(longContent, ShareMimeType.TEXT_PLAIN, {
        maxLength: 100,
      });

      expect(result.content.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result.content).toMatch(/\.\.\.$/);
    });

    it('should trim whitespace from content', () => {
      const result = parseSharedContent('  content with spaces  ', ShareMimeType.TEXT_PLAIN);

      expect(result.content).toBe('content with spaces');
    });

    it('should include receivedAt timestamp', () => {
      const before = Date.now();
      const result = parseSharedContent('test', ShareMimeType.TEXT_PLAIN);
      const after = Date.now();

      expect(result.receivedAt).toBeGreaterThanOrEqual(before);
      expect(result.receivedAt).toBeLessThanOrEqual(after);
    });

    it('should handle HTTP and HTTPS URLs', () => {
      const result1 = parseSharedContent('http://example.com', ShareMimeType.TEXT_PLAIN);
      const result2 = parseSharedContent('https://example.com', ShareMimeType.TEXT_PLAIN);

      expect(result1.type).toBe(ShareContentType.URL);
      expect(result1.url).toBe('http://example.com');
      expect(result2.type).toBe(ShareContentType.URL);
      expect(result2.url).toBe('https://example.com');
    });

    it('should convert HTML to markdown when HTML MIME type', () => {
      const html = '<p>Hello <strong>world</strong></p>';
      const result = parseSharedContent(html, ShareMimeType.TEXT_HTML);

      expect(result.type).toBe(ShareContentType.HTML);
      expect(result.content).toContain('Hello');
      expect(result.content).toContain('**world**');
    });

    it('should handle image MIME types', () => {
      const result = parseSharedContent('Image content', ShareMimeType.IMAGE_PNG);

      expect(result.type).toBe(ShareContentType.Image);
    });

    it('should store MIME type in result', () => {
      const result = parseSharedContent('test', ShareMimeType.TEXT_PLAIN);

      expect(result.mimeType).toBe(ShareMimeType.TEXT_PLAIN);
    });
  });

  describe('validateShareContent', () => {
    it('should validate valid content', () => {
      const content = {
        type: ShareContentType.Text,
        content: 'Valid content',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Valid content');
      expect(result.error).toBeUndefined();
    });

    it('should reject empty content', () => {
      const content = {
        type: ShareContentType.Text,
        content: '',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject missing content', () => {
      const content = {
        type: ShareContentType.Text,
        content: null as unknown as string,
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content is required and must be a string');
    });

    it('should reject non-string content', () => {
      const content = {
        type: ShareContentType.Text,
        content: 123 as unknown as string,
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content is required and must be a string');
    });

    it('should reject content exceeding max length', () => {
      const longContent = 'A'.repeat(100 * 1024 + 1);
      const content = {
        type: ShareContentType.Text,
        content: longContent,
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should remove null bytes from content', () => {
      const content = {
        type: ShareContentType.Text,
        content: 'Hello\0World',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('HelloWorld');
    });

    it('should limit excessive newlines', () => {
      const content = {
        type: ShareContentType.Text,
        content: 'Line1\n\n\n\n\n\nLine2',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Line1\n\n\nLine2');
    });

    it('should limit excessive spaces', () => {
      const content = {
        type: ShareContentType.Text,
        content: 'Word1          Word2', // 10+ spaces
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toContain('Word1');
      expect(result.sanitized).toContain('Word2');
      expect(result.sanitized?.match(/\s{10,}/)).toBeNull(); // No 10+ spaces
    });

    it('should validate URL format for URL type content', () => {
      const content = {
        type: ShareContentType.URL,
        content: 'Check this out',
        url: 'not a valid url',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should accept valid URL for URL type content', () => {
      const content = {
        type: ShareContentType.URL,
        content: 'Check this out',
        url: 'https://example.com',
        receivedAt: Date.now(),
      };

      const result = validateShareContent(content);

      expect(result.valid).toBe(true);
    });
  });

  describe('extractWikiLinks', () => {
    it('should extract single wiki link', () => {
      const links = extractWikiLinks('Link to [[My Page]]');

      expect(links).toEqual(['My Page']);
    });

    it('should extract multiple wiki links', () => {
      const links = extractWikiLinks('Links: [[Page 1]] and [[Page 2]] and [[Page 3]]');

      expect(links).toEqual(['Page 1', 'Page 2', 'Page 3']);
    });

    it('should trim whitespace from wiki links', () => {
      const links = extractWikiLinks('[[ Page With Spaces ]]');

      expect(links).toEqual(['Page With Spaces']);
    });

    it('should return empty array when no wiki links', () => {
      const links = extractWikiLinks('Just plain text');

      expect(links).toEqual([]);
    });

    it('should not extract tag links', () => {
      const links = extractWikiLinks('#[[tag name]] and [[page name]]');

      // Should only get the page link, not the tag link
      expect(links).toEqual(['page name']);
    });

    it('should handle empty wiki links', () => {
      const links = extractWikiLinks('Empty: [[]]');

      expect(links).toEqual([]);
    });

    it('should handle wiki links with newlines', () => {
      const links = extractWikiLinks('[[Page\nWith\nNewlines]]');

      // Wiki links cannot contain newlines
      expect(links).toEqual([]);
    });

    it('should handle nested brackets', () => {
      const links = extractWikiLinks('[[Page [with brackets]]]');

      expect(links).toEqual(['Page [with brackets']);
    });
  });

  describe('htmlToMarkdown', () => {
    it('should convert basic HTML to markdown', () => {
      const markdown = htmlToMarkdown('<p>Hello world</p>');

      expect(markdown).toBe('Hello world');
    });

    it('should convert headings', () => {
      const markdown = htmlToMarkdown('<h1>Title</h1>');

      expect(markdown).toContain('# Title');
    });

    it('should convert bold and italic', () => {
      const markdown = htmlToMarkdown('<strong>bold</strong> and <em>italic</em>');

      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('*italic*');
    });

    it('should convert links', () => {
      const markdown = htmlToMarkdown('<a href="https://example.com">Link</a>');

      expect(markdown).toBe('[Link](https://example.com)');
    });

    it('should convert lists', () => {
      const markdown = htmlToMarkdown('<ul><li>Item 1</li><li>Item 2</li></ul>');

      expect(markdown).toContain('- Item 1');
      expect(markdown).toContain('- Item 2');
    });

    it('should remove script tags', () => {
      const markdown = htmlToMarkdown('<p>Content</p><script>alert("xss")</script>');

      expect(markdown).toBe('Content');
      expect(markdown).not.toContain('script');
      expect(markdown).not.toContain('alert');
    });

    it('should remove style tags', () => {
      const markdown = htmlToMarkdown('<p>Content</p><style>.class{}</style>');

      expect(markdown).toBe('Content');
      expect(markdown).not.toContain('style');
    });

    it('should decode HTML entities', () => {
      const markdown = htmlToMarkdown('&lt;p&gt;&amp;nbsp;&lt;/p&gt;');

      expect(markdown).toContain('<');
      expect(markdown).toContain('>');
      expect(markdown).toContain('&');
    });

    it('should clean up excessive newlines', () => {
      const markdown = htmlToMarkdown('<p>Line1</p><p>Line2</p><p>Line3</p>');

      expect(markdown).not.toMatch(/\n{3,}/);
    });
  });

  describe('convertToMarkdown', () => {
    it('should convert plain URLs to markdown links', () => {
      const markdown = convertToMarkdown('Check out https://example.com');

      expect(markdown).toBe('Check out [https://example.com](https://example.com)');
    });

    it('should preserve wiki links', () => {
      const markdown = convertToMarkdown('Link to [[My Page]]');

      expect(markdown).toContain('[[My Page]]');
    });

    it('should add title if provided', () => {
      const markdown = convertToMarkdown('Content here', {
        title: 'My Title',
      });

      expect(markdown).toBe('# My Title\n\nContent here');
    });

    it('should handle multiple URLs', () => {
      const content = 'Visit https://example.com and https://other.com';
      const markdown = convertToMarkdown(content);

      expect(markdown).toContain('[https://example.com](https://example.com)');
      expect(markdown).toContain('[https://other.com](https://other.com)');
    });

    it('should not convert URLs in wiki links', () => {
      const content = '[[https://example.com]]';
      const markdown = convertToMarkdown(content);

      expect(markdown).toBe(content);
    });

    it('should handle mixed content', () => {
      const content = 'See [[My Page]] or visit https://example.com';
      const markdown = convertToMarkdown(content);

      expect(markdown).toContain('[[My Page]]');
      expect(markdown).toContain('[https://example.com](https://example.com)');
    });

    it('should handle HTTP and HTTPS URLs', () => {
      const content = 'HTTP: http://example.com HTTPS: https://secure.com';
      const markdown = convertToMarkdown(content);

      expect(markdown).toContain('[http://example.com](http://example.com)');
      expect(markdown).toContain('[https://secure.com](https://secure.com)');
    });
  });

  describe('detectContentType', () => {
    it('should detect URL content', () => {
      const type = detectContentType('https://example.com');

      expect(type).toBe(ShareContentType.URL);
    });

    it('should detect HTML content', () => {
      const type = detectContentType('<p>Hello world</p>');

      expect(type).toBe(ShareContentType.HTML);
    });

    it('should detect plain text', () => {
      const type = detectContentType('Just plain text');

      expect(type).toBe(ShareContentType.Text);
    });

    it('should not detect URL if text is longer', () => {
      const type = detectContentType('Check out this link https://example.com with more text');

      expect(type).toBe(ShareContentType.Text);
    });
  });
});
