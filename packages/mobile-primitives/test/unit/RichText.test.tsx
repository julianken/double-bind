/**
 * Unit tests for RichText component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react-native';
import { RichText } from '../../src/RichText';

describe('RichText', () => {
  describe('Plain Text Rendering', () => {
    it('should render plain text without wiki links', () => {
      const { getByText } = render(
        <RichText
          content="This is plain text without any links"
          checkPageExists={vi.fn()}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('This is plain text without any links')).toBeDefined();
    });

    it('should render empty content', () => {
      const { container } = render(
        <RichText
          content=""
          checkPageExists={vi.fn()}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(container).toBeDefined();
    });
  });

  describe('Wiki Link Parsing', () => {
    it('should parse single wiki link', async () => {
      const checkPageExists = vi.fn().mockReturnValue(true);

      const { getByText } = render(
        <RichText
          content="Check out [[My Project]]"
          checkPageExists={checkPageExists}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Check out ')).toBeDefined();
      expect(getByText('My Project')).toBeDefined();

      await waitFor(() => {
        expect(checkPageExists).toHaveBeenCalledWith('My Project');
      });
    });

    it('should parse multiple wiki links', async () => {
      const checkPageExists = vi.fn().mockReturnValue(true);

      const { getByText } = render(
        <RichText
          content="See [[Project A]] and [[Project B]] for details"
          checkPageExists={checkPageExists}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('See ')).toBeDefined();
      expect(getByText('Project A')).toBeDefined();
      expect(getByText(' and ')).toBeDefined();
      expect(getByText('Project B')).toBeDefined();
      expect(getByText(' for details')).toBeDefined();

      await waitFor(() => {
        expect(checkPageExists).toHaveBeenCalledWith('Project A');
        expect(checkPageExists).toHaveBeenCalledWith('Project B');
      });
    });

    it('should parse consecutive wiki links', async () => {
      const checkPageExists = vi.fn().mockReturnValue(true);

      const { getByText } = render(
        <RichText
          content="[[First]][[Second]][[Third]]"
          checkPageExists={checkPageExists}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('First')).toBeDefined();
      expect(getByText('Second')).toBeDefined();
      expect(getByText('Third')).toBeDefined();
    });

    it('should parse wiki link at start of content', async () => {
      const { getByText } = render(
        <RichText
          content="[[Start Link]] followed by text"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Start Link')).toBeDefined();
      expect(getByText(' followed by text')).toBeDefined();
    });

    it('should parse wiki link at end of content', async () => {
      const { getByText } = render(
        <RichText
          content="Text followed by [[End Link]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Text followed by ')).toBeDefined();
      expect(getByText('End Link')).toBeDefined();
    });

    it('should handle multi-word wiki links', async () => {
      const { getByText } = render(
        <RichText
          content="Link to [[Project Management System]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Project Management System')).toBeDefined();
    });
  });

  describe('Page Existence Checking', () => {
    it('should check page existence for links', async () => {
      const checkPageExists = vi.fn((title: string) => title === 'Existing');

      render(
        <RichText
          content="See [[Existing]] and [[Missing]]"
          checkPageExists={checkPageExists}
          onWikiLinkPress={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(checkPageExists).toHaveBeenCalledWith('Existing');
        expect(checkPageExists).toHaveBeenCalledWith('Missing');
      });
    });

    it('should handle async page existence checks', async () => {
      const checkPageExists = vi.fn(
        (title: string) => Promise.resolve(title === 'Existing')
      );

      render(
        <RichText
          content="Link to [[Existing]]"
          checkPageExists={checkPageExists}
          onWikiLinkPress={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(checkPageExists).toHaveBeenCalledWith('Existing');
      });
    });
  });

  describe('Text Styling', () => {
    it('should apply textStyle to plain text', () => {
      const customStyle = { color: '#FF0000', fontSize: 20 };
      const { getByText } = render(
        <RichText
          content="Styled text"
          checkPageExists={vi.fn()}
          onWikiLinkPress={vi.fn()}
          textStyle={customStyle}
        />
      );

      const text = getByText('Styled text');
      expect(text.props.style).toContainEqual(customStyle);
    });

    it('should apply textStyle to segments with links', () => {
      const customStyle = { fontSize: 18 };
      const { getByText } = render(
        <RichText
          content="Text with [[Link]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
          textStyle={customStyle}
        />
      );

      const text = getByText('Text with ');
      expect(text.props.style).toContainEqual(customStyle);
    });
  });

  describe('Test IDs', () => {
    it('should apply testID prefix to links', async () => {
      const { getByTestId } = render(
        <RichText
          content="Link to [[Page]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
          testID="rich-text"
        />
      );

      await waitFor(() => {
        expect(getByTestId('rich-text-link-1')).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty wiki links', async () => {
      const { container } = render(
        <RichText
          content="Empty [[]] link"
          checkPageExists={vi.fn()}
          onWikiLinkPress={vi.fn()}
        />
      );

      // Empty links should be filtered out by parseContent
      expect(container).toBeDefined();
    });

    it('should handle nested brackets', async () => {
      const { getByText } = render(
        <RichText
          content="[[Outer [[nested]] link]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      // Parser should handle this gracefully
      expect(getByText('Outer [[nested]] link')).toBeDefined();
    });

    it('should handle content with only links', async () => {
      const { getByText } = render(
        <RichText
          content="[[Link1]][[Link2]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Link1')).toBeDefined();
      expect(getByText('Link2')).toBeDefined();
    });

    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(1000) + ' [[Link]] ' + 'B'.repeat(1000);

      const { getByText } = render(
        <RichText
          content={longContent}
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      expect(getByText('Link')).toBeDefined();
    });

    it('should not parse tags as links', async () => {
      const { getByText } = render(
        <RichText
          content="Use #[[tag]] not [[link]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={vi.fn()}
        />
      );

      // #[[tag]] should not be parsed as a link (parseContent handles this)
      expect(getByText('Use #[[tag]] not ')).toBeDefined();
      expect(getByText('link')).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should integrate with WikiLink for navigation', async () => {
      const onWikiLinkPress = vi.fn();

      const { getByText } = render(
        <RichText
          content="Go to [[Target Page]]"
          checkPageExists={vi.fn().mockReturnValue(true)}
          onWikiLinkPress={onWikiLinkPress}
        />
      );

      const link = getByText('Target Page');
      // WikiLink component will handle the press event
      expect(link).toBeDefined();
    });
  });
});
