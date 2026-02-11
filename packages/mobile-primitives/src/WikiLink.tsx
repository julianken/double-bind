/**
 * WikiLink - Interactive wiki link component for mobile
 *
 * Renders [[Page Name]] style links with:
 * - Distinct visual styling (blue, underlined)
 * - Tap navigation to linked pages
 * - Different appearance for non-existent pages (red, dashed)
 * - Accessibility support
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/components/menus-and-actions/buttons
 */

import * as React from 'react';
import { Text, StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';

export interface WikiLinkProps {
  /**
   * The page title being linked to (without brackets)
   */
  pageTitle: string;

  /**
   * Whether the linked page exists
   */
  pageExists: boolean;

  /**
   * Callback when the link is tapped
   * Should navigate to the page (creating it if necessary)
   */
  onPress: (pageTitle: string) => void;

  /**
   * Optional test ID for testing
   */
  testID?: string;
}

/**
 * Interactive wiki link component.
 *
 * Displays a clickable link to a page with visual distinction:
 * - Existing pages: blue text with solid underline
 * - Non-existent pages: red text with dashed underline
 *
 * @example
 * ```tsx
 * <WikiLink
 *   pageTitle="Project Ideas"
 *   pageExists={true}
 *   onPress={(title) => navigation.navigate('Page', { pageTitle: title })}
 * />
 * ```
 */
export function WikiLink({
  pageTitle,
  pageExists,
  onPress,
  testID,
}: WikiLinkProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress(pageTitle);
  }, [pageTitle, onPress]);

  const textStyle: TextStyle[] = [
    styles.baseText,
    pageExists ? styles.existingLink : styles.missingLink,
  ];

  return (
    <Text
      onPress={handlePress}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`Link to ${pageTitle}${!pageExists ? ' (page does not exist)' : ''}`}
      accessibilityHint={pageExists ? 'Navigate to page' : 'Create and navigate to page'}
      suppressHighlighting={false}
      style={textStyle}
    >
      {pageTitle}
    </Text>
  );
}

const styles = StyleSheet.create({
  baseText: {
    fontSize: 17,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },

  existingLink: {
    color: '#007AFF', // iOS blue
    textDecorationStyle: 'solid',
  },

  missingLink: {
    color: '#FF3B30', // iOS red
    textDecorationStyle: 'dashed',
  },
});

export default WikiLink;
