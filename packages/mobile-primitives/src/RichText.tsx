/**
 * RichText - Parse and render text content with wiki links
 *
 * Takes raw block content and renders it with:
 * - Plain text segments
 * - Interactive WikiLink components for [[Page Name]] syntax
 *
 * Uses @double-bind/core parseContent for consistent parsing.
 */

import * as React from 'react';
import { Text } from 'react-native';
import type { TextStyle } from 'react-native';
import { parseContent } from '@double-bind/core';
import { WikiLink } from './WikiLink';

export interface RichTextProps {
  /**
   * Raw text content that may contain wiki links
   */
  content: string;

  /**
   * Function to check if a page exists by title
   */
  checkPageExists: (pageTitle: string) => boolean | Promise<boolean>;

  /**
   * Callback when a wiki link is pressed
   */
  onWikiLinkPress: (pageTitle: string) => void;

  /**
   * Optional text style to apply to plain text segments
   */
  textStyle?: TextStyle;

  /**
   * Optional test ID prefix
   */
  testID?: string;
}

/**
 * Segment of rendered content - either plain text or a wiki link
 */
interface ContentSegment {
  type: 'text' | 'link';
  content: string;
  /** For link segments, the clean page title without brackets */
  title?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse content into segments of text and wiki links.
 */
function parseIntoSegments(content: string): ContentSegment[] {
  const parsed = parseContent(content);
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // Sort page links by start index to process in order
  const sortedLinks = [...parsed.pageLinks].sort((a, b) => a.startIndex - b.startIndex);

  for (const link of sortedLinks) {
    // Add text segment before the link if there is any
    if (link.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, link.startIndex),
        startIndex: lastIndex,
        endIndex: link.startIndex,
      });
    }

    // Add link segment - include brackets in display text
    // Note: parseContent returns indices of the title only, so we adjust to include [[ and ]]
    segments.push({
      type: 'link',
      content: `[[${link.title}]]`, // "[[Page Name]]" for display
      title: link.title, // "Page Name" for callbacks
      startIndex: link.startIndex,
      endIndex: link.endIndex,
    });

    lastIndex = link.endIndex;
  }

  // Add remaining text after the last link
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
      startIndex: lastIndex,
      endIndex: content.length,
    });
  }

  return segments;
}

/**
 * Render text content with wiki links parsed and made interactive.
 *
 * Handles [[Page Name]] syntax, rendering links as WikiLink components
 * and plain text as Text components.
 *
 * @example
 * ```tsx
 * <RichText
 *   content="Check out [[My Project]] and [[Ideas]]"
 *   checkPageExists={(title) => existingPages.includes(title)}
 *   onWikiLinkPress={(title) => navigate('Page', { pageTitle: title })}
 *   textStyle={styles.blockText}
 * />
 * ```
 */
export function RichText({
  content,
  checkPageExists,
  onWikiLinkPress,
  textStyle,
  testID,
}: RichTextProps): React.ReactElement {
  const [pageExistsMap, setPageExistsMap] = React.useState<Map<string, boolean>>(new Map());

  // Parse content into segments
  const segments = React.useMemo(() => parseIntoSegments(content), [content]);

  // Check page existence for all links
  React.useEffect(() => {
    const checkPages = async () => {
      const newMap = new Map<string, boolean>();

      for (const segment of segments) {
        if (segment.type === 'link' && segment.title) {
          const exists = await Promise.resolve(checkPageExists(segment.title));
          newMap.set(segment.title, exists);
        }
      }

      setPageExistsMap(newMap);
    };

    checkPages();
  }, [segments, checkPageExists]);

  // If no links, just render plain text
  if (segments.length === 0) {
    return <Text style={textStyle}>{content}</Text>;
  }

  // Render segments
  return (
    <Text style={textStyle}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={index}>{segment.content}</Text>;
        } else {
          const title = segment.title ?? segment.content;
          const pageExists = pageExistsMap.get(title) ?? false;
          return (
            <WikiLink
              key={index}
              pageTitle={title}
              displayText={segment.content}
              pageExists={pageExists}
              onPress={onWikiLinkPress}
              testID={testID ? `${testID}-link-${index}` : undefined}
            />
          );
        }
      })}
    </Text>
  );
}

export default RichText;
