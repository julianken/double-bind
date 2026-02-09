/**
 * ShareExtension - Types and utilities for iOS share extension
 *
 * Provides utilities for handling content received from iOS share extension,
 * including content parsing, validation, and sanitization.
 */

import type { SharedContent, ShareContentType, ParseOptions, ValidationResult } from './types';

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
 * Parse shared content from iOS share extension
 *
 * Extracts structured information from raw shared content,
 * detecting URLs and preserving wiki links.
 *
 * @param rawContent - The raw content received from share extension
 * @param options - Parsing options
 * @returns Parsed SharedContent object
 *
 * @example
 * ```typescript
 * const shared = parseSharedContent('Check out https://example.com', {
 *   extractUrls: true
 * });
 * // shared.type = ShareContentType.URL
 * // shared.url = 'https://example.com'
 * ```
 */
export function parseSharedContent(rawContent: string, options: ParseOptions = {}): SharedContent {
  const { extractUrls = true, maxLength } = options;

  // Trim and truncate if necessary
  let content = rawContent.trim();
  if (maxLength && content.length > maxLength) {
    content = content.slice(0, maxLength) + '...';
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

  // Preserve wiki links if enabled
  // Wiki links are already in the correct format [[Page Name]]
  // No transformation needed, they're preserved in the content by default

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
 *   type: ShareContentType.Text,
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
