/**
 * Content Parser for Double-Bind
 *
 * Extracts structured elements from block content:
 * - Page links: [[Page Name]]
 * - Block references: ((ULID))
 * - Tags: #tag or #[[multi word tag]]
 * - Properties: key:: value (at line start)
 *
 * Returns position information for ProseMirror highlighting.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A page link extracted from content.
 * Position indices are for the entire match including brackets.
 */
export interface PageLink {
  /** The page title (without brackets) */
  title: string;
  /** Start index of the match (inclusive) */
  startIndex: number;
  /** End index of the match (exclusive) */
  endIndex: number;
}

/**
 * A block reference extracted from content.
 * Position indices are for the entire match including parentheses.
 */
export interface BlockReference {
  /** The block ID (26-char ULID) */
  blockId: string;
  /** Start index of the match (inclusive) */
  startIndex: number;
  /** End index of the match (exclusive) */
  endIndex: number;
}

/**
 * A tag reference extracted from content.
 * Position indices are for the entire match including the # prefix.
 */
export interface TagReference {
  /** The tag name (without # prefix) */
  tag: string;
  /** Start index of the match (inclusive, includes #) */
  startIndex: number;
  /** End index of the match (exclusive) */
  endIndex: number;
}

/**
 * A property extracted from content.
 * Properties must appear at the start of a line.
 */
export interface ParsedProperty {
  /** The property key */
  key: string;
  /** The property value (trimmed) */
  value: string;
}

/**
 * Result of parsing block content.
 */
export interface ParsedContent {
  /** Page links found in content: [[Page Name]] */
  pageLinks: PageLink[];
  /** Block references found in content: ((ULID)) */
  blockRefs: BlockReference[];
  /** Tags found in content: #tag or #[[multi word tag]] */
  tags: TagReference[];
  /** Properties found in content: key:: value */
  properties: ParsedProperty[];
}

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * ULID character set: Crockford's Base32 (excludes I, L, O, U)
 * ULIDs are exactly 26 characters.
 */
const ULID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}';

/**
 * Patterns for content parsing.
 *
 * Note: Page link pattern handles nested brackets by using a non-greedy
 * match that stops at the first ]]. For deeply nested brackets like
 * [[Page [[Nested]]]], the outer link is matched.
 */
const PATTERNS = {
  /**
   * Page links: [[Page Name]]
   * - Negative lookbehind (?<!#) ensures we don't match #[[tags]]
   * - Matches [[ followed by characters (no newlines, no ]]) followed by ]]
   * - Allows single ] but not ]]
   * - Group 1: The page title
   */
  pageLink: /(?<!#)\[\[((?:[^\]\n]|\](?!\]))+)\]\]/g,

  /**
   * Block references: ((ULID))
   * - Matches (( followed by exactly 26 ULID characters followed by ))
   * - Group 1: The block ID
   */
  blockRef: new RegExp(`\\(\\((${ULID_PATTERN})\\)\\)`, 'g'),

  /**
   * Tags: #tag or #[[multi word tag]]
   * - Simple tags: # followed by word characters and hyphens
   * - Multi-word tags: #[[ followed by any chars (non-greedy) followed by ]]
   * - Group 1: Multi-word tag content (if present)
   * - Group 2: Simple tag content (if present)
   */
  tag: /#(?:\[\[([^\]]+)\]\]|([\w][\w-]*))/g,

  /**
   * Properties: key:: value
   * - Must be at start of line (or start of content)
   * - Key: word characters and hyphens (no spaces allowed in key to avoid cross-line matching)
   * - Value: everything after ::, trimmed
   * - Group 1: The key
   * - Group 2: The value
   */
  property: /^([\w][\w-]*):: (.+)$/gm,
};

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse block content for structured elements.
 *
 * @param content - The raw block content to parse
 * @returns Parsed elements with position information
 *
 * @example
 * ```typescript
 * const result = parseContent("Link to [[My Page]] and ((01HXQ...))");
 * // result.pageLinks = [{ title: "My Page", startIndex: 8, endIndex: 19 }]
 * // result.blockRefs = [{ blockId: "01HXQ...", startIndex: 24, endIndex: 36 }]
 * ```
 *
 * @example
 * ```typescript
 * const result = parseContent("#project #[[multi word]]");
 * // result.tags = ["project", "multi word"]
 * ```
 *
 * @example
 * ```typescript
 * const result = parseContent("status:: active");
 * // result.properties = [{ key: "status", value: "active" }]
 * ```
 */
export function parseContent(content: string): ParsedContent {
  const pageLinks = parsePageLinks(content);
  const blockRefs = parseBlockRefs(content);
  const tags = parseTags(content);
  const properties = parseProperties(content);

  return {
    pageLinks,
    blockRefs,
    tags,
    properties,
  };
}

/**
 * Extract page links from content.
 * Returns array of links with position information.
 */
function parsePageLinks(content: string): PageLink[] {
  const links: PageLink[] = [];
  const regex = new RegExp(PATTERNS.pageLink.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const title = match[1];
    // Skip empty titles
    if (title && title.trim().length > 0) {
      links.push({
        title: title.trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  return links;
}

/**
 * Extract block references from content.
 * Returns array of references with position information.
 */
function parseBlockRefs(content: string): BlockReference[] {
  const refs: BlockReference[] = [];
  const regex = new RegExp(PATTERNS.blockRef.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const blockId = match[1];
    if (blockId) {
      refs.push({
        blockId,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  return refs;
}

/**
 * Extract tags from content.
 * Returns deduplicated array of tag references with position information.
 */
function parseTags(content: string): TagReference[] {
  const seen = new Set<string>();
  const tags: TagReference[] = [];
  const regex = new RegExp(PATTERNS.tag.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    // Group 1 is multi-word tag, Group 2 is simple tag
    const tag = match[1] || match[2];
    if (tag && tag.trim().length > 0) {
      const trimmedTag = tag.trim();
      if (!seen.has(trimmedTag)) {
        seen.add(trimmedTag);
        tags.push({
          tag: trimmedTag,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
  }

  return tags;
}

/**
 * Extract properties from content.
 * Returns array of key-value pairs.
 */
function parseProperties(content: string): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const regex = new RegExp(PATTERNS.property.source, 'gm');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const rawKey = match[1];
    const rawValue = match[2];
    if (rawKey && rawValue) {
      const key = rawKey.trim();
      const value = rawValue.trim();
      if (key.length > 0 && value.length > 0) {
        properties.push({ key, value });
      }
    }
  }

  return properties;
}
