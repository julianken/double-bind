/**
 * ContentParser - Parse shared content from Android share intents
 *
 * Provides utilities for parsing and transforming content received from Android
 * share intents, including URL detection, HTML to markdown conversion, and
 * wiki link extraction.
 */

import type { SharedContent, ShareContentType, ParseOptions, ValidationResult } from './types';
import { ShareMimeType } from './types';

/**
 * URL regex pattern for detecting URLs in text
 */
const URL_PATTERN =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/**
 * Maximum content length (100KB)
 */
const MAX_CONTENT_LENGTH = 100 * 1024;

/**
 * Parse shared content from Android share intent
 *
 * Extracts structured information from raw shared content,
 * detecting URLs, converting HTML, and preserving wiki links.
 *
 * @param rawContent - The raw content received from share intent
 * @param mimeType - MIME type from the intent
 * @param options - Parsing options
 * @returns Parsed SharedContent object
 *
 * @example
 * ```typescript
 * const shared = parseSharedContent(
 *   'Check out https://example.com',
 *   'text/plain',
 *   { extractUrls: true }
 * );
 * // shared.type = 'url'
 * // shared.url = 'https://example.com'
 * ```
 */
export function parseSharedContent(
  rawContent: string,
  mimeType: string = ShareMimeType.TEXT_PLAIN,
  options: ParseOptions = {}
): SharedContent {
  const { extractUrls = true, convertHtml = true, maxLength } = options;

  // Trim and truncate if necessary
  let content = rawContent.trim();
  if (maxLength && content.length > maxLength) {
    content = content.slice(0, maxLength) + '...';
  }

  // Convert HTML to plain text/markdown if needed
  if (mimeType === ShareMimeType.TEXT_HTML && convertHtml) {
    content = htmlToMarkdown(content);
  }

  // Determine content type and extract URLs if enabled
  let url: string | undefined;
  let type: ShareContentType = 'text' as ShareContentType;

  if (extractUrls) {
    const urlMatches = content.match(URL_PATTERN);
    if (urlMatches && urlMatches.length > 0) {
      url = urlMatches[0];
      type = 'url' as ShareContentType;
    }
  }

  // Determine type from MIME type
  if (mimeType === ShareMimeType.TEXT_HTML) {
    type = 'html' as ShareContentType;
  } else if (mimeType.startsWith('image/')) {
    type = 'image' as ShareContentType;
  }

  // Extract potential title (first line if multiline content)
  let title: string | undefined;
  const lines = content.split('\n');
  if (lines.length > 1 && lines[0].length > 0 && lines[0].length < 100) {
    title = lines[0].trim();
  }

  return {
    type,
    content,
    title,
    url,
    mimeType,
    receivedAt: Date.now(),
  };
}

/**
 * Validate shared content for security and format
 *
 * Ensures content is safe to store and does not exceed size limits.
 * Sanitizes content by removing potentially harmful patterns.
 *
 * @param content - The SharedContent to validate
 * @returns ValidationResult with sanitized content if valid
 *
 * @example
 * ```typescript
 * const validation = validateShareContent({
 *   type: 'text',
 *   content: 'Valid content',
 *   receivedAt: Date.now()
 * });
 * // validation.valid = true
 * // validation.sanitized = 'Valid content'
 * ```
 */
export function validateShareContent(content: SharedContent): ValidationResult {
  // Check if content is a string
  if (typeof content.content !== 'string') {
    return {
      valid: false,
      error: 'Content is required and must be a string',
    };
  }

  // Check content length
  const trimmedContent = content.content.trim();
  if (trimmedContent.length === 0) {
    return {
      valid: false,
      error: 'Content cannot be empty',
    };
  }

  if (content.content.length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} bytes`,
    };
  }

  // Sanitize content
  let sanitized = content.content;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove excessive whitespace while preserving intentional formatting
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
  sanitized = sanitized.replace(/[ \t]{10,}/g, '        '); // Max 8 spaces/tabs

  // Validate URL if type is URL
  if (content.type === 'url' && content.url) {
    try {
      new URL(content.url);
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Extract wiki links from content
 *
 * Finds all wiki-style links [[Page Name]] in the content.
 *
 * @param content - The content to parse
 * @returns Array of page titles found in wiki links
 *
 * @example
 * ```typescript
 * const links = extractWikiLinks('Link to [[My Page]] and [[Another Page]]');
 * // links = ['My Page', 'Another Page']
 * ```
 */
export function extractWikiLinks(content: string): string[] {
  const wikiLinkPattern = /(?<!#)\[\[((?:[^\]\n]|\](?!\]))+)\]\]/g;
  const links: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = wikiLinkPattern.exec(content)) !== null) {
    const title = match[1];
    if (title && title.trim().length > 0) {
      links.push(title.trim());
    }
  }

  return links;
}

/**
 * Convert HTML to markdown
 *
 * Basic HTML to markdown conversion that preserves wiki links
 * and handles common HTML elements.
 *
 * @param html - HTML content to convert
 * @returns Markdown-formatted content
 *
 * @example
 * ```typescript
 * const md = htmlToMarkdown('<p>Hello <strong>world</strong></p>');
 * // md = 'Hello **world**'
 * ```
 */
export function htmlToMarkdown(html: string): string {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Convert common HTML tags to markdown
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');

  // Bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Lists
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  markdown = markdown.replace(/<ul[^>]*>/gi, '\n');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<ol[^>]*>/gi, '\n');
  markdown = markdown.replace(/<\/ol>/gi, '\n');

  // Paragraphs and breaks
  markdown = markdown.replace(/<p[^>]*>/gi, '\n');
  markdown = markdown.replace(/<\/p>/gi, '\n');
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = decodeHtmlEntities(markdown);

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();

  return markdown;
}

/**
 * Decode common HTML entities
 *
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Convert content to markdown format
 *
 * Preserves wiki links and converts URLs to markdown links.
 *
 * @param content - The content to convert
 * @param options - Conversion options
 * @returns Markdown-formatted content
 *
 * @example
 * ```typescript
 * const md = convertToMarkdown('Check out https://example.com');
 * // md = 'Check out [https://example.com](https://example.com)'
 * ```
 */
export function convertToMarkdown(content: string, options: { title?: string } = {}): string {
  // Store original content for URL detection
  const originalContent = content;
  let markdown = content;

  // Convert plain URLs to markdown links (but preserve wiki links)
  markdown = markdown.replace(URL_PATTERN, (url) => {
    // Do not convert if already in a link format
    const beforeUrl = originalContent.slice(0, originalContent.indexOf(url));
    if (beforeUrl.endsWith('[') || beforeUrl.endsWith('[[')) {
      return url;
    }
    return `[${url}](${url})`;
  });

  // Add title after URL conversion to avoid title URLs being converted
  if (options.title) {
    markdown = `# ${options.title}\n\n${markdown}`;
  }

  return markdown;
}

/**
 * Detect content type from text content
 *
 * @param content - Content to analyze
 * @returns Detected content type
 */
export function detectContentType(content: string): ShareContentType {
  // Check if content is primarily a URL
  const urlMatches = content.match(URL_PATTERN);
  if (urlMatches && urlMatches.length === 1 && urlMatches[0].length / content.length > 0.8) {
    return 'url' as ShareContentType;
  }

  // Check if content contains HTML tags
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return 'html' as ShareContentType;
  }

  return 'text' as ShareContentType;
}
