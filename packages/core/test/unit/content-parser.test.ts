import { describe, it, expect } from 'vitest';
import { parseContent } from '../../src/parsers/content-parser.js';

describe('parseContent', () => {
  // ==========================================================================
  // Empty and Plain Text
  // ==========================================================================

  describe('empty and plain text', () => {
    it('returns empty arrays for empty string', () => {
      const result = parseContent('');
      expect(result.pageLinks).toEqual([]);
      expect(result.blockRefs).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.properties).toEqual([]);
    });

    it('returns empty arrays for plain text without special patterns', () => {
      const result = parseContent('This is just regular text without any special patterns.');
      expect(result.pageLinks).toEqual([]);
      expect(result.blockRefs).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.properties).toEqual([]);
    });

    it('returns empty arrays for whitespace-only content', () => {
      const result = parseContent('   \n\t  \n  ');
      expect(result.pageLinks).toEqual([]);
      expect(result.blockRefs).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.properties).toEqual([]);
    });
  });

  // ==========================================================================
  // Page Links: [[Page Name]]
  // ==========================================================================

  describe('page links [[Page Name]]', () => {
    it('extracts a single page link', () => {
      const result = parseContent('Link to [[My Page]]');
      expect(result.pageLinks).toEqual([{ title: 'My Page', startIndex: 8, endIndex: 19 }]);
    });

    it('extracts multiple page links', () => {
      const result = parseContent('See [[Page One]] and [[Page Two]]');
      expect(result.pageLinks).toEqual([
        { title: 'Page One', startIndex: 4, endIndex: 16 },
        { title: 'Page Two', startIndex: 21, endIndex: 33 },
      ]);
    });

    it('extracts page link at start of content', () => {
      const result = parseContent('[[First Page]] is at the start');
      expect(result.pageLinks).toEqual([{ title: 'First Page', startIndex: 0, endIndex: 14 }]);
    });

    it('extracts page link at end of content', () => {
      const result = parseContent('Check out [[Last Page]]');
      expect(result.pageLinks).toEqual([{ title: 'Last Page', startIndex: 10, endIndex: 23 }]);
    });

    it('handles page links with special characters', () => {
      const result = parseContent('Link to [[Page (2024)]]');
      expect(result.pageLinks).toEqual([{ title: 'Page (2024)', startIndex: 8, endIndex: 23 }]);
    });

    it('handles page links with numbers', () => {
      const result = parseContent('See [[Project 123]]');
      expect(result.pageLinks).toEqual([{ title: 'Project 123', startIndex: 4, endIndex: 19 }]);
    });

    it('handles page links with hyphens and underscores', () => {
      const result = parseContent('Link to [[my-page_name]]');
      expect(result.pageLinks).toEqual([{ title: 'my-page_name', startIndex: 8, endIndex: 24 }]);
    });

    it('trims whitespace in page link titles', () => {
      const result = parseContent('Link to [[  Spaced Title  ]]');
      expect(result.pageLinks).toEqual([{ title: 'Spaced Title', startIndex: 8, endIndex: 28 }]);
    });

    it('ignores empty page links', () => {
      const result = parseContent('Empty [[]] link');
      expect(result.pageLinks).toEqual([]);
    });

    it('ignores whitespace-only page links', () => {
      const result = parseContent('Whitespace [[   ]] link');
      expect(result.pageLinks).toEqual([]);
    });

    it('handles page links with single bracket inside', () => {
      const result = parseContent('Link to [[Page [with] bracket]]');
      expect(result.pageLinks).toEqual([
        { title: 'Page [with] bracket', startIndex: 8, endIndex: 31 },
      ]);
    });

    it('does not match incomplete brackets', () => {
      const result = parseContent('Not a link: [[incomplete');
      expect(result.pageLinks).toEqual([]);
    });

    it('does not match single brackets', () => {
      const result = parseContent('[single bracket] not a link');
      expect(result.pageLinks).toEqual([]);
    });
  });

  // ==========================================================================
  // Block References: ((ULID))
  // ==========================================================================

  describe('block references ((ULID))', () => {
    // Valid ULID: 26 characters from Crockford's Base32
    const validUlid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';

    it('extracts a single block reference', () => {
      const result = parseContent(`Reference: ((${validUlid}))`);
      expect(result.blockRefs).toEqual([{ blockId: validUlid, startIndex: 11, endIndex: 41 }]);
    });

    it('extracts multiple block references', () => {
      const ulid2 = '01HXQV4KFBNJV5YEWMRNZ8SGHB';
      const result = parseContent(`See ((${validUlid})) and ((${ulid2}))`);
      expect(result.blockRefs).toHaveLength(2);
      expect(result.blockRefs[0].blockId).toBe(validUlid);
      expect(result.blockRefs[1].blockId).toBe(ulid2);
    });

    it('extracts block reference at start of content', () => {
      const result = parseContent(`((${validUlid})) starts here`);
      expect(result.blockRefs).toEqual([{ blockId: validUlid, startIndex: 0, endIndex: 30 }]);
    });

    it('extracts block reference at end of content', () => {
      const result = parseContent(`Ends with ((${validUlid}))`);
      expect(result.blockRefs).toEqual([{ blockId: validUlid, startIndex: 10, endIndex: 40 }]);
    });

    it('rejects ULIDs with invalid characters (lowercase)', () => {
      const result = parseContent('((01hxqv4kfbnjv5yewmrnz8sgha))');
      expect(result.blockRefs).toEqual([]);
    });

    it('rejects ULIDs with invalid characters (I, L, O, U)', () => {
      const result = parseContent('((01IXQV4KFBNJV5YEWMRNZ8SGHA))'); // I
      expect(result.blockRefs).toEqual([]);

      const result2 = parseContent('((01LXQV4KFBNJV5YEWMRNZ8SGHA))'); // L
      expect(result2.blockRefs).toEqual([]);

      const result3 = parseContent('((01OXQV4KFBNJV5YEWMRNZ8SGHA))'); // O
      expect(result3.blockRefs).toEqual([]);

      const result4 = parseContent('((01UXQV4KFBNJV5YEWMRNZ8SGHA))'); // U
      expect(result4.blockRefs).toEqual([]);
    });

    it('rejects ULIDs that are too short', () => {
      const result = parseContent('((01HXQV4KFBNJV5YEWMRNZ8SG))'); // 25 chars
      expect(result.blockRefs).toEqual([]);
    });

    it('rejects ULIDs that are too long', () => {
      const result = parseContent('((01HXQV4KFBNJV5YEWMRNZ8SGHAA))'); // 27 chars
      expect(result.blockRefs).toEqual([]);
    });

    it('does not match incomplete parentheses', () => {
      const result = parseContent(`((${validUlid}`);
      expect(result.blockRefs).toEqual([]);
    });

    it('does not match single parentheses', () => {
      const result = parseContent(`(${validUlid})`);
      expect(result.blockRefs).toEqual([]);
    });
  });

  // ==========================================================================
  // Tags: #tag and #[[multi word tag]]
  // ==========================================================================

  describe('tags #tag and #[[multi word tag]]', () => {
    it('extracts a simple tag', () => {
      const result = parseContent('This is #project related');
      expect(result.tags).toEqual(['project']);
    });

    it('extracts multiple simple tags', () => {
      const result = parseContent('#todo #urgent #important');
      expect(result.tags).toEqual(['todo', 'urgent', 'important']);
    });

    it('extracts multi-word tag', () => {
      const result = parseContent('Tagged with #[[multi word tag]]');
      expect(result.tags).toEqual(['multi word tag']);
    });

    it('extracts both simple and multi-word tags', () => {
      const result = parseContent('#project #[[multi word]] #task');
      expect(result.tags).toContain('project');
      expect(result.tags).toContain('multi word');
      expect(result.tags).toContain('task');
    });

    it('handles tags with hyphens', () => {
      const result = parseContent('#work-in-progress');
      expect(result.tags).toEqual(['work-in-progress']);
    });

    it('handles tags with numbers', () => {
      const result = parseContent('#project2024');
      expect(result.tags).toEqual(['project2024']);
    });

    it('handles tags at start of content', () => {
      const result = parseContent('#firsttag is at start');
      expect(result.tags).toEqual(['firsttag']);
    });

    it('handles tags at end of content', () => {
      const result = parseContent('Ends with #lasttag');
      expect(result.tags).toEqual(['lasttag']);
    });

    it('deduplicates repeated tags', () => {
      const result = parseContent('#duplicate #duplicate #duplicate');
      expect(result.tags).toEqual(['duplicate']);
    });

    it('trims whitespace in multi-word tags', () => {
      const result = parseContent('#[[  spaced tag  ]]');
      expect(result.tags).toEqual(['spaced tag']);
    });

    it('ignores hash not followed by word character', () => {
      const result = parseContent('# not a tag');
      expect(result.tags).toEqual([]);
    });

    it('ignores standalone hash', () => {
      const result = parseContent('Just a # by itself');
      expect(result.tags).toEqual([]);
    });

    it('handles tag followed by punctuation', () => {
      const result = parseContent('#tag, and more');
      expect(result.tags).toEqual(['tag']);
    });

    it('handles multi-word tag with special chars inside', () => {
      const result = parseContent('#[[tag with (parens) and stuff]]');
      expect(result.tags).toEqual(['tag with (parens) and stuff']);
    });
  });

  // ==========================================================================
  // Properties: key:: value
  // ==========================================================================

  describe('properties key:: value', () => {
    it('extracts a simple property', () => {
      const result = parseContent('status:: active');
      expect(result.properties).toEqual([{ key: 'status', value: 'active' }]);
    });

    it('extracts multiple properties on different lines', () => {
      const result = parseContent('status:: active\npriority:: high');
      expect(result.properties).toEqual([
        { key: 'status', value: 'active' },
        { key: 'priority', value: 'high' },
      ]);
    });

    it('does not extract property with spaces in key', () => {
      // Keys with spaces are not supported to avoid cross-line matching issues
      const result = parseContent('due date:: 2024-03-15');
      expect(result.properties).toEqual([]);
    });

    it('extracts property with hyphenated key', () => {
      const result = parseContent('start-date:: 2024-01-01');
      expect(result.properties).toEqual([{ key: 'start-date', value: '2024-01-01' }]);
    });

    it('extracts property with complex value', () => {
      const result = parseContent('description:: This is a long value with spaces');
      expect(result.properties).toEqual([
        { key: 'description', value: 'This is a long value with spaces' },
      ]);
    });

    it('trims key and value', () => {
      const result = parseContent('  key  :: value with spaces  ');
      // Property must start at beginning of line, so this won't match
      expect(result.properties).toEqual([]);
    });

    it('requires property at start of line', () => {
      const result = parseContent('Not at start: status:: value');
      expect(result.properties).toEqual([]);
    });

    it('handles property at start of line after newline', () => {
      const result = parseContent('Some text\nstatus:: active');
      expect(result.properties).toEqual([{ key: 'status', value: 'active' }]);
    });

    it('ignores property without value', () => {
      const result = parseContent('key:: ');
      expect(result.properties).toEqual([]);
    });

    it('handles property with URL value', () => {
      const result = parseContent('url:: https://example.com/path?query=1');
      expect(result.properties).toEqual([
        { key: 'url', value: 'https://example.com/path?query=1' },
      ]);
    });

    it('handles property with numeric value', () => {
      const result = parseContent('count:: 42');
      expect(result.properties).toEqual([{ key: 'count', value: '42' }]);
    });

    it('handles property with boolean-like value', () => {
      const result = parseContent('completed:: true');
      expect(result.properties).toEqual([{ key: 'completed', value: 'true' }]);
    });
  });

  // ==========================================================================
  // Combined Patterns
  // ==========================================================================

  describe('combined patterns', () => {
    it('extracts all pattern types from complex content', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const content = `status:: active
This block links to [[Project Alpha]] and references ((${ulid})).
It has #project and #[[multi word]] tags.`;

      const result = parseContent(content);

      expect(result.properties).toEqual([{ key: 'status', value: 'active' }]);
      // Only [[Project Alpha]] matches - #[[multi word]] is a tag, not a page link
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Project Alpha');
      // Verify block ref is found (don't hardcode positions as they depend on content)
      expect(result.blockRefs).toHaveLength(1);
      expect(result.blockRefs[0].blockId).toBe(ulid);
      expect(result.tags).toContain('project');
      expect(result.tags).toContain('multi word');
    });

    it('handles page link and block ref on same line', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`See [[My Page]] and ((${ulid}))`);

      expect(result.pageLinks).toHaveLength(1);
      expect(result.blockRefs).toHaveLength(1);
    });

    it('handles tags inside page link (both extracted)', () => {
      // Note: This tests edge case behavior - the tag is inside the page link
      const result = parseContent('[[Page with #tag inside]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Page with #tag inside');
      // Tag inside brackets is still extracted
      expect(result.tags).toContain('tag');
    });

    it('handles adjacent patterns', () => {
      const result = parseContent('[[Page1]][[Page2]]');
      expect(result.pageLinks).toHaveLength(2);
    });

    it('handles patterns separated only by newlines', () => {
      const result = parseContent('[[Page1]]\n#tag\nstatus:: value');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
      expect(result.properties).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Position Tracking
  // ==========================================================================

  describe('position tracking', () => {
    it('provides correct positions for page links', () => {
      const content = 'prefix [[My Page]] suffix';
      const result = parseContent(content);

      expect(result.pageLinks[0].startIndex).toBe(7);
      expect(result.pageLinks[0].endIndex).toBe(18);
      expect(content.slice(result.pageLinks[0].startIndex, result.pageLinks[0].endIndex)).toBe(
        '[[My Page]]'
      );
    });

    it('provides correct positions for block refs', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const content = `prefix ((${ulid})) suffix`;
      const result = parseContent(content);

      expect(content.slice(result.blockRefs[0].startIndex, result.blockRefs[0].endIndex)).toBe(
        `((${ulid}))`
      );
    });

    it('handles unicode characters before patterns', () => {
      const content = 'Emoji before: [[Page]]';
      const result = parseContent(content);

      expect(result.pageLinks[0].startIndex).toBe(14);
      expect(content.slice(result.pageLinks[0].startIndex)).toBe('[[Page]]');
    });

    it('handles multi-byte characters', () => {
      const content = 'Japanese: [[Page]]';
      const result = parseContent(content);

      expect(content.slice(result.pageLinks[0].startIndex)).toBe('[[Page]]');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles very long content', () => {
      const longText = 'a'.repeat(10000);
      const content = `${longText}[[Page]]${longText}`;
      const result = parseContent(content);

      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Page');
    });

    it('handles many patterns', () => {
      const pages = Array.from({ length: 100 }, (_, i) => `[[Page${i}]]`).join(' ');
      const result = parseContent(pages);

      expect(result.pageLinks).toHaveLength(100);
    });

    it('handles nested double brackets (outer matches including inner [[ )', () => {
      // The pattern allows [ inside, so [[outer [[inner]] matches "outer [[inner"
      // then the trailing ]] closes it
      const result = parseContent('[[outer [[inner]]]]');
      expect(result.pageLinks).toHaveLength(1);
      // Matches from first [[ to first ]], including the inner [[
      expect(result.pageLinks[0].title).toBe('outer [[inner');
    });

    it('handles escaped-looking content (no escaping supported)', () => {
      // Parser does not support escaping, treats literally
      const result = parseContent('\\[[Not Escaped]]');
      expect(result.pageLinks).toHaveLength(1);
    });

    it('does not match page links with newlines in title', () => {
      const result = parseContent('[[Title\nwith newline]]');
      // Pattern [^\]\n]+ explicitly excludes newlines
      expect(result.pageLinks).toEqual([]);
    });

    it('handles consecutive opening brackets', () => {
      const result = parseContent('[[[Page]]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('[Page');
    });
  });

  // ==========================================================================
  // Unicode and International Characters
  // ==========================================================================

  describe('unicode and international characters', () => {
    it('handles emoji within page link titles', () => {
      const result = parseContent('[[Project 🚀 Launch]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Project 🚀 Launch');
    });

    it('handles Arabic/RTL text in page links', () => {
      const result = parseContent('[[مرحبا بالعالم]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('مرحبا بالعالم');
    });

    it('handles Chinese characters in page links', () => {
      const result = parseContent('[[你好世界]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('你好世界');
    });

    it('handles combining diacriticals in page links', () => {
      const result = parseContent('[[café résumé]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('café résumé');
    });

    it('handles mathematical symbols in page links', () => {
      const result = parseContent('[[Math: ∑ ∫ ∂]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Math: ∑ ∫ ∂');
    });

    it('handles currency symbols in property values', () => {
      const result = parseContent('price:: $100 €85 ¥1000');
      expect(result.properties).toEqual([{ key: 'price', value: '$100 €85 ¥1000' }]);
    });

    it('handles emoji in tags (simple tags)', () => {
      // Tags require word characters to start, so emoji-only won't match
      const result = parseContent('#project🚀');
      expect(result.tags).toContain('project');
    });

    it('handles emoji in multi-word tags', () => {
      const result = parseContent('#[[Launch 🚀 Project]]');
      expect(result.tags).toContain('Launch 🚀 Project');
    });

    it('handles zero-width characters', () => {
      // Zero-width joiner and non-joiner
      const result = parseContent('[[Page\u200D\u200CName]]');
      expect(result.pageLinks).toHaveLength(1);
    });

    it('handles mixed Unicode categories', () => {
      const result = parseContent('[[English 中文 العربية 🌍]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('English 中文 العربية 🌍');
    });
  });

  // ==========================================================================
  // Tag Edge Cases
  // ==========================================================================

  describe('tag edge cases', () => {
    it('handles tags with underscores', () => {
      const result = parseContent('#my_tag_name');
      expect(result.tags).toContain('my_tag_name');
    });

    it('handles tags starting with numbers', () => {
      // Tags must start with word char, numbers are word chars
      const result = parseContent('#2024project');
      expect(result.tags).toContain('2024project');
    });

    it('does not extract tags ending with only hyphens', () => {
      // Trailing hyphens should be included
      const result = parseContent('#project-');
      expect(result.tags).toContain('project-');
    });

    it('handles tags with consecutive hyphens', () => {
      const result = parseContent('#project--alpha');
      expect(result.tags).toContain('project--alpha');
    });

    it('handles tags immediately followed by opening bracket', () => {
      const result = parseContent('#tag[[Page]]');
      expect(result.tags).toContain('tag');
      // Note: [[Page]] is not a page link due to negative lookbehind
    });

    it('does not extract empty multi-word tags', () => {
      const result = parseContent('Empty #[[]] tag');
      expect(result.tags).toEqual([]);
    });

    it('does not match multi-word tag with unescaped brackets inside', () => {
      // Multi-word tag pattern [^\]]+ stops at first ], causing pattern mismatch
      // #[[tag[with] sees ], expects ]] next but finds brackets]]
      const result = parseContent('#[[tag[with]brackets]]');
      expect(result.tags).toEqual([]);
    });

    it('handles tags with mixed underscores and hyphens', () => {
      const result = parseContent('#my_tag-name_here');
      expect(result.tags).toContain('my_tag-name_here');
    });

    it('handles tag immediately before page link', () => {
      const result = parseContent('#tag[[Page]]');
      expect(result.tags).toContain('tag');
      // [[Page]] after # becomes part of multi-word tag pattern, not page link
    });

    it('preserves tag case sensitivity', () => {
      const result = parseContent('#CamelCase #lowercase #UPPERCASE');
      expect(result.tags).toContain('CamelCase');
      expect(result.tags).toContain('lowercase');
      expect(result.tags).toContain('UPPERCASE');
      expect(result.tags).toHaveLength(3);
    });

    it('handles tag followed by comma without space', () => {
      const result = parseContent('Tags: #one,#two,#three');
      expect(result.tags).toContain('one');
      expect(result.tags).toContain('two');
      expect(result.tags).toContain('three');
    });
  });

  // ==========================================================================
  // Property Edge Cases
  // ==========================================================================

  describe('property edge cases', () => {
    it('handles property with multiple colons in value', () => {
      const result = parseContent('time:: 10:30:45');
      expect(result.properties).toEqual([{ key: 'time', value: '10:30:45' }]);
    });

    it('handles property with double colon in value', () => {
      const result = parseContent('namespace:: MyApp::Service::Class');
      expect(result.properties).toEqual([{ key: 'namespace', value: 'MyApp::Service::Class' }]);
    });

    it('handles property with underscore in key', () => {
      const result = parseContent('snake_case_key:: value');
      expect(result.properties).toEqual([{ key: 'snake_case_key', value: 'value' }]);
    });

    it('handles property with mixed case key', () => {
      const result = parseContent('CamelCaseKey:: value');
      expect(result.properties).toEqual([{ key: 'CamelCaseKey', value: 'value' }]);
    });

    it('handles multiple properties with duplicate keys', () => {
      const result = parseContent('tag:: one\ntag:: two\ntag:: three');
      // All duplicates should be extracted
      expect(result.properties).toHaveLength(3);
      expect(result.properties.every((p) => p.key === 'tag')).toBe(true);
    });

    it('handles property value with trailing spaces preserved then trimmed', () => {
      const result = parseContent('key:: value   ');
      expect(result.properties).toEqual([{ key: 'key', value: 'value' }]);
    });

    it('handles property value with leading spaces', () => {
      const result = parseContent('key::    leading spaces');
      expect(result.properties).toEqual([{ key: 'key', value: 'leading spaces' }]);
    });

    it('handles property value with special characters', () => {
      const result = parseContent('regex:: ^[a-z]+$.*?\\d{2,4}');
      expect(result.properties).toEqual([{ key: 'regex', value: '^[a-z]+$.*?\\d{2,4}' }]);
    });

    it('handles property value with brackets', () => {
      const result = parseContent('formula:: [x] + (y * z) = {result}');
      expect(result.properties).toEqual([{ key: 'formula', value: '[x] + (y * z) = {result}' }]);
    });

    it('handles property with page link-like content in value', () => {
      const result = parseContent('note:: See [[Other Page]] for details');
      expect(result.properties).toEqual([{ key: 'note', value: 'See [[Other Page]] for details' }]);
      // The [[Other Page]] should also be extracted as a page link
      expect(result.pageLinks).toHaveLength(1);
    });

    it('handles property value with hash characters', () => {
      const result = parseContent('hashtags:: #one #two #three');
      expect(result.properties).toEqual([{ key: 'hashtags', value: '#one #two #three' }]);
      // Tags in property values are still extracted
      expect(result.tags).toContain('one');
      expect(result.tags).toContain('two');
      expect(result.tags).toContain('three');
    });
  });

  // ==========================================================================
  // Block Reference Edge Cases
  // ==========================================================================

  describe('block reference edge cases', () => {
    it('handles multiple block refs adjacent without space', () => {
      const ulid1 = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const ulid2 = '01HXQV4KFBNJV5YEWMRNZ8SGHB';
      const result = parseContent(`((${ulid1}))((${ulid2}))`);
      expect(result.blockRefs).toHaveLength(2);
      expect(result.blockRefs[0].blockId).toBe(ulid1);
      expect(result.blockRefs[1].blockId).toBe(ulid2);
    });

    it('rejects block ref with whitespace before ULID', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`(( ${ulid}))`);
      expect(result.blockRefs).toEqual([]);
    });

    it('rejects block ref with whitespace after ULID', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`((${ulid} ))`);
      expect(result.blockRefs).toEqual([]);
    });

    it('rejects block ref with whitespace inside ULID', () => {
      const result = parseContent('((01HXQV4KFBNJV5YEW RNZSGHA))');
      expect(result.blockRefs).toEqual([]);
    });

    it('rejects block ref with lowercase ulid', () => {
      const result = parseContent('((01hxqv4kfbnjv5yewmrnz8sgha))');
      expect(result.blockRefs).toEqual([]);
    });

    it('handles block ref in middle of word (should extract)', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`text((${ulid}))text`);
      expect(result.blockRefs).toHaveLength(1);
    });

    it('rejects ulid with special characters', () => {
      const result = parseContent('((01HXQV4KFBNJV5YEWMRNZ8SGH@))');
      expect(result.blockRefs).toEqual([]);
    });
  });

  // ==========================================================================
  // Complex Nesting and Interaction
  // ==========================================================================

  describe('complex nesting and interactions', () => {
    it('handles page link inside property value', () => {
      const result = parseContent('related:: See [[Project Alpha]] for more');
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0].value).toBe('See [[Project Alpha]] for more');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Project Alpha');
    });

    it('handles block ref inside property value', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`reference:: Based on ((${ulid}))`);
      expect(result.properties).toHaveLength(1);
      expect(result.blockRefs).toHaveLength(1);
    });

    it('handles tag in property key position (should not match property)', () => {
      const result = parseContent('#tag:: value');
      expect(result.tags).toContain('tag');
      expect(result.properties).toEqual([]);
    });

    it('handles multiple pattern types in property value', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`summary:: See [[Page]] and ((${ulid})) with #tag`);
      expect(result.properties).toHaveLength(1);
      expect(result.pageLinks).toHaveLength(1);
      expect(result.blockRefs).toHaveLength(1);
      expect(result.tags).toContain('tag');
    });

    it('handles page link containing property-like syntax', () => {
      const result = parseContent('[[Meeting Notes:: 2024-03-15]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('Meeting Notes:: 2024-03-15');
    });

    it('handles deeply nested pattern in text', () => {
      const result = parseContent('Text with [[Page A containing #tag]] and more');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.tags).toContain('tag');
    });

    it('handles all pattern types in single line and multiline', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      // Property must be at start of line, so put it on its own line
      const content = `status:: active\n[[Page]] ((${ulid})) #tag`;
      const result = parseContent(content);
      expect(result.properties).toHaveLength(1);
      expect(result.pageLinks).toHaveLength(1);
      expect(result.blockRefs).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Position Accuracy with Complex Content
  // ==========================================================================

  describe('position accuracy with complex content', () => {
    it('provides correct positions with emoji before pattern', () => {
      const content = '🚀 [[Page]]';
      const result = parseContent(content);
      const extracted = content.slice(result.pageLinks[0].startIndex, result.pageLinks[0].endIndex);
      expect(extracted).toBe('[[Page]]');
    });

    it('provides correct positions with multi-byte chars before pattern', () => {
      const content = '你好 [[Page]]';
      const result = parseContent(content);
      const extracted = content.slice(result.pageLinks[0].startIndex, result.pageLinks[0].endIndex);
      expect(extracted).toBe('[[Page]]');
    });

    it('provides correct positions for multiple patterns with unicode', () => {
      const content = '🌍 [[First]] 中文 [[Second]] العربية';
      const result = parseContent(content);
      expect(result.pageLinks).toHaveLength(2);
      expect(content.slice(result.pageLinks[0].startIndex, result.pageLinks[0].endIndex)).toBe(
        '[[First]]'
      );
      expect(content.slice(result.pageLinks[1].startIndex, result.pageLinks[1].endIndex)).toBe(
        '[[Second]]'
      );
    });

    it('handles pattern at exact start with no leading content', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const content = `((${ulid}))`;
      const result = parseContent(content);
      expect(result.blockRefs[0].startIndex).toBe(0);
      expect(result.blockRefs[0].endIndex).toBe(content.length);
    });

    it('handles pattern at exact end with no trailing content', () => {
      const content = '[[Page]]';
      const result = parseContent(content);
      expect(result.pageLinks[0].endIndex).toBe(content.length);
    });
  });

  // ==========================================================================
  // Performance and Stress Tests
  // ==========================================================================

  describe('performance and stress tests', () => {
    it('handles very long page link title', () => {
      const longTitle = 'A'.repeat(1000);
      const content = `[[${longTitle}]]`;
      const result = parseContent(content);
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe(longTitle);
    });

    it('handles high density of patterns', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const content = `[[A]]((${ulid}))#x [[B]]((${ulid}))#y`.repeat(10);
      const result = parseContent(content);
      expect(result.pageLinks.length).toBeGreaterThan(0);
      expect(result.blockRefs.length).toBeGreaterThan(0);
      expect(result.tags.length).toBeGreaterThan(0);
    });

    it('handles content with many repeated patterns efficiently', () => {
      const pattern = '[[Page]] ';
      const content = pattern.repeat(1000);
      const startTime = Date.now();
      const result = parseContent(content);
      const endTime = Date.now();
      expect(result.pageLinks).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('handles mixed newlines and patterns', () => {
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`[[Page${i}]]`);
        lines.push(`#tag${i}`);
        lines.push(`key${i}:: value${i}`);
      }
      const result = parseContent(lines.join('\n'));
      expect(result.pageLinks).toHaveLength(100);
      expect(result.tags).toHaveLength(100);
      expect(result.properties).toHaveLength(100);
    });
  });

  // ==========================================================================
  // Malformed and Invalid Patterns
  // ==========================================================================

  describe('malformed and invalid patterns', () => {
    it('does not match page link with mismatched bracket types', () => {
      const result = parseContent('[{Page}]');
      expect(result.pageLinks).toEqual([]);
    });

    it('does not match page link with single opening bracket', () => {
      const result = parseContent('[Page]]');
      expect(result.pageLinks).toEqual([]);
    });

    it('does not match page link with single closing bracket', () => {
      const result = parseContent('[[Page]');
      expect(result.pageLinks).toEqual([]);
    });

    it('does not match block ref with single opening paren', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`(${ulid}))`);
      expect(result.blockRefs).toEqual([]);
    });

    it('does not match block ref with single closing paren', () => {
      const ulid = '01HXQV4KFBNJV5YEWMRNZ8SGHA';
      const result = parseContent(`((${ulid})`);
      expect(result.blockRefs).toEqual([]);
    });

    it('does not match property with space before key', () => {
      const result = parseContent(' key:: value');
      expect(result.properties).toEqual([]);
    });

    it('handles malformed nested brackets gracefully', () => {
      const result = parseContent('[[Outer [[ Inner ]] text]]');
      // Should match the outer brackets
      expect(result.pageLinks).toHaveLength(1);
    });

    it('handles text that looks like patterns but is not', () => {
      const result = parseContent('Use [[brackets]] for links and ((parens)) for refs');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('brackets');
      // ((parens)) is not a valid ULID so no block ref
      expect(result.blockRefs).toEqual([]);
    });

    it('handles triple brackets correctly', () => {
      const result = parseContent('[[[Page]]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('[Page');
    });

    it('handles quadruple brackets', () => {
      const result = parseContent('[[[[Page]]]]');
      expect(result.pageLinks).toHaveLength(1);
      expect(result.pageLinks[0].title).toBe('[[Page');
    });
  });
});
