import { describe, it, expect } from 'vitest';
import {
  findUnlinkedMentions,
  escapeRegex,
  type MatchRange,
} from '../../src/parsers/unlinked-mentions.js';

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('C++')).toBe('C\\+\\+');
    expect(escapeRegex('foo.bar')).toBe('foo\\.bar');
    expect(escapeRegex('cost: $50')).toBe('cost: \\$50');
    expect(escapeRegex('func(x)')).toBe('func\\(x\\)');
    expect(escapeRegex('[a-z]*')).toBe('\\[a\\-z\\]\\*');
    expect(escapeRegex('x^2')).toBe('x\\^2');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('Graph Algorithms')).toBe('Graph Algorithms');
    expect(escapeRegex('Hello World')).toBe('Hello World');
  });

  it('escapes backslashes', () => {
    expect(escapeRegex('path\\to\\file')).toBe('path\\\\to\\\\file');
  });
});

describe('findUnlinkedMentions', () => {
  describe('basic matching', () => {
    it('finds single mention', () => {
      const result = findUnlinkedMentions('I study Graph theory', 'Graph', []);
      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 8, endIndex: 13 }]);
    });

    it('finds multiple mentions', () => {
      const result = findUnlinkedMentions('Graph is cool. I love Graph.', 'Graph', []);
      expect(result).toEqual([
        { matchedText: 'Graph', startIndex: 0, endIndex: 5 },
        { matchedText: 'Graph', startIndex: 22, endIndex: 27 },
      ]);
    });

    it('returns empty array when no matches', () => {
      const result = findUnlinkedMentions('I study algorithms', 'Graph', []);
      expect(result).toEqual([]);
    });

    it('finds mention at start of content', () => {
      const result = findUnlinkedMentions('Graph is great', 'Graph', []);
      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 0, endIndex: 5 }]);
    });

    it('finds mention at end of content', () => {
      const result = findUnlinkedMentions('I study Graph', 'Graph', []);
      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 8, endIndex: 13 }]);
    });
  });

  describe('case sensitivity', () => {
    it('matches case-insensitively', () => {
      const result = findUnlinkedMentions('graph GRAPH GrApH', 'Graph', []);
      expect(result).toHaveLength(3);
      expect(result[0]?.matchedText).toBe('graph');
      expect(result[1]?.matchedText).toBe('GRAPH');
      expect(result[2]?.matchedText).toBe('GrApH');
    });

    it('preserves original case in matchedText', () => {
      const result = findUnlinkedMentions('I love GRAPH theory', 'graph', []);
      expect(result[0]?.matchedText).toBe('GRAPH');
    });
  });

  describe('word boundaries', () => {
    it('does not match inside larger words', () => {
      const result = findUnlinkedMentions('GraphQL and photography', 'Graph', []);
      expect(result).toEqual([]);
    });

    it('does not match partial substrings', () => {
      const result = findUnlinkedMentions('photograph', 'graph', []);
      expect(result).toEqual([]);
    });

    it('matches at word boundaries with punctuation', () => {
      const result = findUnlinkedMentions('about Graph. More Graph!', 'Graph', []);
      expect(result).toHaveLength(2);
      expect(result[0]?.startIndex).toBe(6);
      expect(result[1]?.startIndex).toBe(18);
    });

    it('matches with parentheses boundaries', () => {
      const result = findUnlinkedMentions('See (Graph) theory', 'Graph', []);
      expect(result).toHaveLength(1);
    });

    it('matches with bracket boundaries', () => {
      const result = findUnlinkedMentions('Topics: [Graph, Algorithms]', 'Graph', []);
      expect(result).toHaveLength(1);
    });

    it('matches with comma boundaries', () => {
      const result = findUnlinkedMentions('Graph,Algorithms,Trees', 'Graph', []);
      expect(result).toHaveLength(1);
    });
  });

  describe('link exclusion', () => {
    it('excludes matches inside link ranges', () => {
      const content = 'See [[Graph Algorithms]] for Graph info';
      const linkRanges: MatchRange[] = [{ startIndex: 4, endIndex: 24 }]; // [[Graph Algorithms]]
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);

      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 29, endIndex: 34 }]);
    });

    it('excludes matches across multiple links', () => {
      const content = '[[Graph A]] and [[Graph B]] mention Graph';
      const linkRanges: MatchRange[] = [
        { startIndex: 0, endIndex: 11 },
        { startIndex: 16, endIndex: 27 },
      ];
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);

      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 36, endIndex: 41 }]);
    });

    it('handles adjacent links correctly', () => {
      const content = '[[Link A]]Graph[[Link B]]';
      const linkRanges: MatchRange[] = [
        { startIndex: 0, endIndex: 10 },
        { startIndex: 15, endIndex: 25 },
      ];
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);

      expect(result).toEqual([{ matchedText: 'Graph', startIndex: 10, endIndex: 15 }]);
    });

    it('excludes match at exact link boundaries', () => {
      const content = '[[Graph]]';
      const linkRanges: MatchRange[] = [{ startIndex: 0, endIndex: 9 }];
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);

      expect(result).toEqual([]);
    });

    it('handles empty link ranges array', () => {
      const result = findUnlinkedMentions('Graph theory', 'Graph', []);
      expect(result).toHaveLength(1);
    });
  });

  describe('special characters in titles', () => {
    it('handles C++ correctly', () => {
      const result = findUnlinkedMentions('I love C++ programming', 'C++', []);
      expect(result).toEqual([{ matchedText: 'C++', startIndex: 7, endIndex: 10 }]);
    });

    it('handles multiple C++ mentions', () => {
      const result = findUnlinkedMentions('C++ vs C++17', 'C++', []);
      expect(result).toHaveLength(1); // "C++" matches, but "C++17" doesn't (no word boundary)
    });

    it('handles dots in titles', () => {
      const result = findUnlinkedMentions('Import foo.bar module', 'foo.bar', []);
      expect(result).toEqual([{ matchedText: 'foo.bar', startIndex: 7, endIndex: 14 }]);
    });

    it('does not match partial dots', () => {
      const result = findUnlinkedMentions('Import fooXbar module', 'foo.bar', []);
      expect(result).toEqual([]);
    });

    it('handles parentheses in titles', () => {
      const result = findUnlinkedMentions('Call func(x) now', 'func(x)', []);
      expect(result).toEqual([{ matchedText: 'func(x)', startIndex: 5, endIndex: 12 }]);
    });

    it('handles dollar signs', () => {
      const result = findUnlinkedMentions('Use $variable here', '$variable', []);
      expect(result).toEqual([{ matchedText: '$variable', startIndex: 4, endIndex: 13 }]);
    });

    it('handles square brackets in titles', () => {
      const result = findUnlinkedMentions('Array [n] access', '[n]', []);
      expect(result).toEqual([{ matchedText: '[n]', startIndex: 6, endIndex: 9 }]);
    });

    it('handles asterisks in titles', () => {
      const result = findUnlinkedMentions('Pointer *ptr usage', '*ptr', []);
      expect(result).toEqual([{ matchedText: '*ptr', startIndex: 8, endIndex: 12 }]);
    });
  });

  describe('unicode handling', () => {
    it('handles emoji boundaries', () => {
      const result = findUnlinkedMentions('I love 🎉 Graph 🎉 theory', 'Graph', []);
      expect(result).toHaveLength(1);
      expect(result[0]?.matchedText).toBe('Graph');
    });

    it('handles CJK characters', () => {
      const result = findUnlinkedMentions('学习Graph算法', 'Graph', []);
      expect(result).toHaveLength(1);
    });

    it('handles Arabic text', () => {
      const result = findUnlinkedMentions('مرحبا Graph العالم', 'Graph', []);
      expect(result).toHaveLength(1);
    });

    it('handles combining diacriticals', () => {
      const result = findUnlinkedMentions('café Graph résumé', 'Graph', []);
      expect(result).toHaveLength(1);
    });

    it('handles mixed Unicode categories', () => {
      const result = findUnlinkedMentions('English 中文 Graph العربية', 'Graph', []);
      expect(result).toHaveLength(1);
    });
  });

  describe('multi-word titles', () => {
    it('matches multi-word titles exactly', () => {
      const result = findUnlinkedMentions('Study Graph Algorithms here', 'Graph Algorithms', []);
      expect(result).toEqual([
        { matchedText: 'Graph Algorithms', startIndex: 6, endIndex: 22 },
      ]);
    });

    it('does not match partial multi-word titles', () => {
      const result = findUnlinkedMentions('Study Graph theory here', 'Graph Algorithms', []);
      expect(result).toEqual([]);
    });

    it('matches multi-word title case-insensitively', () => {
      const result = findUnlinkedMentions('graph algorithms', 'Graph Algorithms', []);
      expect(result).toHaveLength(1);
    });

    it('handles three-word titles', () => {
      const result = findUnlinkedMentions(
        'Advanced Graph Theory Algorithms',
        'Graph Theory Algorithms',
        []
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty content', () => {
      const result = findUnlinkedMentions('', 'Graph', []);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty title', () => {
      const result = findUnlinkedMentions('Some content', '', []);
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace-only content', () => {
      const result = findUnlinkedMentions('   \n\t  ', 'Graph', []);
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace-only title', () => {
      const result = findUnlinkedMentions('Some content', '   ', []);
      expect(result).toEqual([]);
    });

    it('handles very long content', () => {
      const longContent = 'a'.repeat(10000) + ' Graph ' + 'b'.repeat(10000);
      const result = findUnlinkedMentions(longContent, 'Graph', []);
      expect(result).toHaveLength(1);
      expect(result[0]?.startIndex).toBe(10001);
    });

    it('handles many matches', () => {
      const content = Array(100).fill('Graph').join(' ');
      const result = findUnlinkedMentions(content, 'Graph', []);
      expect(result).toHaveLength(100);
    });

    it('handles single character titles', () => {
      const result = findUnlinkedMentions('X marks the spot, X', 'X', []);
      expect(result).toHaveLength(2);
    });

    it('handles newlines in content', () => {
      const result = findUnlinkedMentions('Line 1\nGraph\nLine 3', 'Graph', []);
      expect(result).toHaveLength(1);
      expect(result[0]?.startIndex).toBe(7);
    });
  });

  describe('complex scenarios', () => {
    it('handles realistic block content', () => {
      const content =
        'Today I learned about Graph theory. ' +
        'See [[Graph Algorithms]] for more. ' +
        'Graph databases are also cool!';
      const linkRanges: MatchRange[] = [{ startIndex: 42, endIndex: 62 }];
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);

      expect(result).toHaveLength(2);
      expect(result[0]?.startIndex).toBe(22); // "Graph theory"
      expect(result[1]?.startIndex).toBe(71); // "Graph databases"
    });

    it('handles overlapping potential matches', () => {
      const content = 'GraphGraph';
      const result = findUnlinkedMentions(content, 'Graph', []);
      expect(result).toEqual([]); // No word boundaries, so no matches
    });

    it('handles title as substring of another word', () => {
      const content = 'Subgraph and Graph';
      const result = findUnlinkedMentions(content, 'Graph', []);
      expect(result).toHaveLength(1);
      expect(result[0]?.startIndex).toBe(13); // Only the standalone "Graph"
    });
  });

  describe('performance characteristics', () => {
    it('handles dense patterns efficiently', () => {
      const content = Array(1000)
        .fill('Graph')
        .join(' ');
      const start = Date.now();
      const result = findUnlinkedMentions(content, 'Graph', []);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(elapsed).toBeLessThan(50); // Should complete in <50ms
    });

    it('handles many link exclusions efficiently', () => {
      const content = Array(100)
        .fill('Graph')
        .join(' ');
      const linkRanges: MatchRange[] = Array(50)
        .fill(null)
        .map((_, i) => ({
          startIndex: i * 12,
          endIndex: i * 12 + 5,
        }));

      const start = Date.now();
      const result = findUnlinkedMentions(content, 'Graph', linkRanges);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50); // Should still be fast
    });
  });
});
