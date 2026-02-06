// Tests for query template library (DBB-224)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Template functions
  getTemplates,
  getTemplate,
  applyTemplate,
  registerTemplate,
  unregisterTemplate,
  getTemplatesByCategory,
  searchTemplates,
  validateTemplateParams,
  getTemplateCount,
  resetTemplates,
  // Template definitions
  ALL_TEMPLATES,
  pagesModifiedInLastNDays,
  pagesLinkingTo,
  orphanPages,
  blocksWithTag,
} from '../src/index.js';

describe('Query Template Library', () => {
  // Reset templates before each test to ensure clean state
  beforeEach(() => {
    resetTemplates();
  });

  describe('Template Registry', () => {
    it('provides built-in templates', () => {
      const templates = getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(10);
    });

    it('includes all required templates', () => {
      // Required by DBB-224
      expect(getTemplate('pages-modified-in-last-n-days')).toBeDefined();
      expect(getTemplate('pages-linking-to')).toBeDefined();
      expect(getTemplate('orphan-pages')).toBeDefined();
      expect(getTemplate('blocks-with-tag')).toBeDefined();
    });

    it('ALL_TEMPLATES contains the expected templates', () => {
      expect(ALL_TEMPLATES).toContain(pagesModifiedInLastNDays);
      expect(ALL_TEMPLATES).toContain(pagesLinkingTo);
      expect(ALL_TEMPLATES).toContain(orphanPages);
      expect(ALL_TEMPLATES).toContain(blocksWithTag);
      expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    });

    it('returns undefined for unknown template', () => {
      expect(getTemplate('non-existent-template')).toBeUndefined();
    });

    it('registers new templates', () => {
      const customTemplate = {
        id: 'custom-test-template',
        name: 'Custom Test',
        description: 'A custom test template',
        parameters: [],
        preview: '?[test] := *test{ test }',
      };

      registerTemplate(customTemplate);
      const retrieved = getTemplate('custom-test-template');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom Test');
    });

    it('unregisters templates', () => {
      registerTemplate({
        id: 'to-be-removed',
        name: 'Temp',
        description: 'Temp',
        parameters: [],
        preview: '?[]',
      });

      expect(getTemplate('to-be-removed')).toBeDefined();
      const removed = unregisterTemplate('to-be-removed');
      expect(removed).toBe(true);
      expect(getTemplate('to-be-removed')).toBeUndefined();
    });

    it('unregisterTemplate returns false for non-existent template', () => {
      const removed = unregisterTemplate('does-not-exist');
      expect(removed).toBe(false);
    });

    it('getTemplateCount returns correct count', () => {
      const count = getTemplateCount();
      expect(count).toBe(ALL_TEMPLATES.length);
    });

    it('resetTemplates restores built-in templates', () => {
      // Add a custom template
      registerTemplate({
        id: 'custom',
        name: 'Custom',
        description: 'Custom',
        parameters: [],
        preview: '?[]',
      });

      expect(getTemplateCount()).toBe(ALL_TEMPLATES.length + 1);

      // Reset
      resetTemplates();

      expect(getTemplateCount()).toBe(ALL_TEMPLATES.length);
      expect(getTemplate('custom')).toBeUndefined();
    });
  });

  describe('Template Definitions', () => {
    describe('pagesModifiedInLastNDays', () => {
      it('has correct id', () => {
        expect(pagesModifiedInLastNDays.id).toBe('pages-modified-in-last-n-days');
      });

      it('has required days parameter', () => {
        expect(pagesModifiedInLastNDays.parameters).toHaveLength(1);
        expect(pagesModifiedInLastNDays.parameters[0].name).toBe('days');
        expect(pagesModifiedInLastNDays.parameters[0].type).toBe('number');
        expect(pagesModifiedInLastNDays.parameters[0].required).toBe(true);
      });

      it('has default value for days', () => {
        expect(pagesModifiedInLastNDays.parameters[0].defaultValue).toBe(7);
      });

      it('has pages category', () => {
        expect(pagesModifiedInLastNDays.category).toBe('pages');
      });
    });

    describe('pagesLinkingTo', () => {
      it('has correct id', () => {
        expect(pagesLinkingTo.id).toBe('pages-linking-to');
      });

      it('has required targetTitle parameter', () => {
        expect(pagesLinkingTo.parameters).toHaveLength(1);
        expect(pagesLinkingTo.parameters[0].name).toBe('targetTitle');
        expect(pagesLinkingTo.parameters[0].type).toBe('page');
        expect(pagesLinkingTo.parameters[0].required).toBe(true);
      });

      it('has graph category', () => {
        expect(pagesLinkingTo.category).toBe('graph');
      });
    });

    describe('orphanPages', () => {
      it('has correct id', () => {
        expect(orphanPages.id).toBe('orphan-pages');
      });

      it('has no parameters', () => {
        expect(orphanPages.parameters).toHaveLength(0);
      });

      it('has graph category', () => {
        expect(orphanPages.category).toBe('graph');
      });
    });

    describe('blocksWithTag', () => {
      it('has correct id', () => {
        expect(blocksWithTag.id).toBe('blocks-with-tag');
      });

      it('has required tag parameter', () => {
        expect(blocksWithTag.parameters).toHaveLength(1);
        expect(blocksWithTag.parameters[0].name).toBe('tag');
        expect(blocksWithTag.parameters[0].type).toBe('tag');
        expect(blocksWithTag.parameters[0].required).toBe(true);
      });

      it('has tags category', () => {
        expect(blocksWithTag.category).toBe('tags');
      });
    });
  });

  describe('Template Application', () => {
    describe('pages-modified-in-last-n-days', () => {
      it('generates valid CozoScript with days parameter', () => {
        const result = applyTemplate('pages-modified-in-last-n-days', { days: 7 });

        expect(result.script).toContain('?[page_id, title, updated_at]');
        expect(result.script).toContain('*pages{');
        expect(result.script).toContain('is_deleted: false');
        expect(result.script).toContain('updated_at > $cutoff');
        expect(result.params).toHaveProperty('cutoff');
        expect(typeof result.params.cutoff).toBe('number');
      });

      it('uses default value when days not provided', () => {
        const result = applyTemplate('pages-modified-in-last-n-days', {});

        expect(result.script).toContain('updated_at > $cutoff');
        expect(result.params).toHaveProperty('cutoff');
      });

      it('calculates correct cutoff timestamp', () => {
        const before = Date.now();
        const result = applyTemplate('pages-modified-in-last-n-days', { days: 1 });
        const after = Date.now();

        const expectedCutoff = before - 1 * 24 * 60 * 60 * 1000;
        const cutoff = result.params.cutoff as number;

        // Allow for small timing differences
        expect(cutoff).toBeGreaterThanOrEqual(expectedCutoff - 1000);
        expect(cutoff).toBeLessThanOrEqual(after - 1 * 24 * 60 * 60 * 1000 + 1000);
      });

      it('throws on invalid days parameter type', () => {
        expect(() =>
          applyTemplate('pages-modified-in-last-n-days', { days: 'seven' })
        ).toThrow("Parameter 'days' must be a valid number");
      });

      it('throws on NaN days parameter', () => {
        expect(() =>
          applyTemplate('pages-modified-in-last-n-days', { days: NaN })
        ).toThrow("Parameter 'days' must be a valid number");
      });
    });

    describe('pages-linking-to', () => {
      it('generates valid CozoScript with targetTitle parameter', () => {
        const result = applyTemplate('pages-linking-to', {
          targetTitle: 'Project Alpha',
        });

        expect(result.script).toContain('?[source_page_id, source_title]');
        expect(result.script).toContain('*links{');
        expect(result.script).toContain('*pages{');
        expect(result.script).toContain('$target_title');
        expect(result.params).toEqual({ target_title: 'Project Alpha' });
      });

      it('throws when targetTitle is missing', () => {
        expect(() => applyTemplate('pages-linking-to', {})).toThrow(
          'Missing required parameter(s): targetTitle'
        );
      });

      it('throws when targetTitle is empty', () => {
        expect(() =>
          applyTemplate('pages-linking-to', { targetTitle: '' })
        ).toThrow("Parameter 'targetTitle' cannot be empty");
      });

      it('throws when targetTitle is wrong type', () => {
        expect(() =>
          applyTemplate('pages-linking-to', { targetTitle: 123 })
        ).toThrow("Parameter 'targetTitle' must be a string");
      });
    });

    describe('orphan-pages', () => {
      it('generates valid CozoScript with no parameters', () => {
        const result = applyTemplate('orphan-pages', {});

        expect(result.script).toContain('?[page_id, title]');
        expect(result.script).toContain('*pages{');
        expect(result.script).toContain('is_deleted: false');
        expect(result.script).toContain('not *links{ target_id: page_id }');
        expect(result.params).toEqual({});
      });

      it('ignores extra parameters', () => {
        const result = applyTemplate('orphan-pages', { extra: 'ignored' });
        expect(result.script).toContain('not *links{ target_id: page_id }');
      });
    });

    describe('blocks-with-tag', () => {
      it('generates valid CozoScript with tag parameter', () => {
        const result = applyTemplate('blocks-with-tag', { tag: 'important' });

        expect(result.script).toContain('?[block_id, content, page_id]');
        expect(result.script).toContain('*tags{');
        expect(result.script).toContain('tag: $tag');
        expect(result.script).toContain('*blocks{');
        expect(result.params).toEqual({ tag: 'important' });
      });

      it('throws when tag is missing', () => {
        expect(() => applyTemplate('blocks-with-tag', {})).toThrow(
          'Missing required parameter(s): tag'
        );
      });
    });

    describe('other templates', () => {
      it('pages-with-tag generates valid CozoScript', () => {
        const result = applyTemplate('pages-with-tag', { tag: 'project' });

        expect(result.script).toContain('?[page_id, title]');
        expect(result.script).toContain('*tags{');
        expect(result.script).toContain('*pages{');
        expect(result.params).toEqual({ tag: 'project' });
      });

      it('recent-pages generates valid CozoScript', () => {
        const result = applyTemplate('recent-pages', { days: 14 });

        expect(result.script).toContain('?[page_id, title, created_at]');
        expect(result.script).toContain('created_at > $cutoff');
        expect(result.params).toHaveProperty('cutoff');
      });

      it('pages-linked-from generates valid CozoScript', () => {
        const result = applyTemplate('pages-linked-from', {
          sourceTitle: 'My Notes',
        });

        expect(result.script).toContain('?[target_page_id, target_title]');
        expect(result.script).toContain('*links{');
        expect(result.params).toEqual({ source_title: 'My Notes' });
      });

      it('search-pages-by-title generates valid CozoScript', () => {
        const result = applyTemplate('search-pages-by-title', {
          searchTerm: 'meeting',
        });

        expect(result.script).toContain('?[page_id, title]');
        expect(result.script).toContain('contains(title, $search_term)');
        expect(result.params).toEqual({ search_term: 'meeting' });
      });

      it('blocks-containing-text generates valid CozoScript', () => {
        const result = applyTemplate('blocks-containing-text', {
          searchTerm: 'TODO',
        });

        expect(result.script).toContain('?[block_id, content, page_id]');
        expect(result.script).toContain('contains(content, $search_term)');
        expect(result.params).toEqual({ search_term: 'TODO' });
      });

      it('daily-notes-in-range generates valid CozoScript', () => {
        const result = applyTemplate('daily-notes-in-range', {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });

        expect(result.script).toContain('?[date, page_id, title]');
        expect(result.script).toContain('*daily_notes{');
        expect(result.script).toContain('date >= $start_date');
        expect(result.script).toContain('date <= $end_date');
        expect(result.params).toEqual({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        });
      });

      it('daily-notes-in-range throws on invalid date format', () => {
        expect(() =>
          applyTemplate('daily-notes-in-range', {
            startDate: '01/01/2024',
            endDate: '2024-12-31',
          })
        ).toThrow("Parameter 'startDate' must be in YYYY-MM-DD format");
      });
    });
  });

  describe('Template Categories', () => {
    it('getTemplatesByCategory returns pages templates', () => {
      const pageTemplates = getTemplatesByCategory('pages');
      expect(pageTemplates.length).toBeGreaterThan(0);
      expect(pageTemplates.every((t) => t.category === 'pages')).toBe(true);
    });

    it('getTemplatesByCategory returns graph templates', () => {
      const graphTemplates = getTemplatesByCategory('graph');
      expect(graphTemplates.length).toBeGreaterThan(0);
      expect(graphTemplates.every((t) => t.category === 'graph')).toBe(true);
    });

    it('getTemplatesByCategory returns tags templates', () => {
      const tagTemplates = getTemplatesByCategory('tags');
      expect(tagTemplates.length).toBeGreaterThan(0);
      expect(tagTemplates.every((t) => t.category === 'tags')).toBe(true);
    });

    it('getTemplatesByCategory returns search templates', () => {
      const searchTemplates = getTemplatesByCategory('search');
      expect(searchTemplates.length).toBeGreaterThan(0);
      expect(searchTemplates.every((t) => t.category === 'search')).toBe(true);
    });

    it('getTemplatesByCategory returns empty for unused category', () => {
      const analyticsTemplates = getTemplatesByCategory('analytics');
      expect(analyticsTemplates).toEqual([]);
    });
  });

  describe('Template Search', () => {
    it('finds templates by name', () => {
      const results = searchTemplates('orphan');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.id === 'orphan-pages')).toBe(true);
    });

    it('finds templates by description', () => {
      const results = searchTemplates('backlinks');
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds templates by tag', () => {
      const results = searchTemplates('recent');
      expect(results.length).toBeGreaterThan(0);
    });

    it('search is case-insensitive', () => {
      const results1 = searchTemplates('ORPHAN');
      const results2 = searchTemplates('orphan');
      expect(results1.length).toBe(results2.length);
    });

    it('returns empty array for no matches', () => {
      const results = searchTemplates('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('Template Validation', () => {
    it('validateTemplateParams throws for unknown template', () => {
      expect(() => validateTemplateParams('unknown', {})).toThrow(
        'Template not found: unknown'
      );
    });

    it('validateTemplateParams throws for missing required param', () => {
      expect(() => validateTemplateParams('pages-linking-to', {})).toThrow(
        'Missing required parameter(s): targetTitle'
      );
    });

    it('validateTemplateParams passes for valid params', () => {
      expect(() =>
        validateTemplateParams('pages-linking-to', { targetTitle: 'Test' })
      ).not.toThrow();
    });

    it('validateTemplateParams passes with default values', () => {
      expect(() =>
        validateTemplateParams('pages-modified-in-last-n-days', {})
      ).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('throws for unknown template ID', () => {
      expect(() => applyTemplate('non-existent', {})).toThrow(
        'Template not found: non-existent'
      );
    });

    it('throws for missing required parameters', () => {
      expect(() => applyTemplate('pages-linking-to', {})).toThrow(
        'Missing required parameter(s): targetTitle'
      );
    });

    it('throws for multiple missing parameters', () => {
      expect(() => applyTemplate('daily-notes-in-range', {})).toThrow(
        /Missing required parameter\(s\)/
      );
    });
  });

  describe('CozoScript Output Validity', () => {
    // These tests verify the generated scripts have valid CozoScript structure

    it('all templates generate scripts starting with ?[', () => {
      const templates = getTemplates();

      for (const template of templates) {
        // Build values for required params
        const values: Record<string, unknown> = {};
        for (const param of template.parameters) {
          if (param.required !== false) {
            switch (param.type) {
              case 'number':
                values[param.name] = param.defaultValue ?? 7;
                break;
              case 'string':
              case 'page':
              case 'tag':
                values[param.name] = 'test';
                break;
              case 'date':
                values[param.name] = '2024-01-01';
                break;
              case 'boolean':
                values[param.name] = true;
                break;
            }
          }
        }

        const result = applyTemplate(template.id, values);
        expect(result.script).toMatch(/^\?\[/);
      }
    });

    it('all templates generate scripts containing :=', () => {
      const templates = getTemplates();

      for (const template of templates) {
        const values: Record<string, unknown> = {};
        for (const param of template.parameters) {
          if (param.required !== false) {
            switch (param.type) {
              case 'number':
                values[param.name] = param.defaultValue ?? 7;
                break;
              case 'string':
              case 'page':
              case 'tag':
                values[param.name] = 'test';
                break;
              case 'date':
                values[param.name] = '2024-01-01';
                break;
              case 'boolean':
                values[param.name] = true;
                break;
            }
          }
        }

        const result = applyTemplate(template.id, values);
        expect(result.script).toContain(':=');
      }
    });

    it('all templates return params as an object', () => {
      const templates = getTemplates();

      for (const template of templates) {
        const values: Record<string, unknown> = {};
        for (const param of template.parameters) {
          if (param.required !== false) {
            switch (param.type) {
              case 'number':
                values[param.name] = param.defaultValue ?? 7;
                break;
              case 'string':
              case 'page':
              case 'tag':
                values[param.name] = 'test';
                break;
              case 'date':
                values[param.name] = '2024-01-01';
                break;
              case 'boolean':
                values[param.name] = true;
                break;
            }
          }
        }

        const result = applyTemplate(template.id, values);
        expect(typeof result.params).toBe('object');
        expect(result.params).not.toBeNull();
      }
    });
  });

  describe('Template Composability', () => {
    it('templates can be combined with custom registered templates', () => {
      // Register a custom template that builds on concepts from built-in ones
      registerTemplate({
        id: 'custom-combined',
        name: 'Custom Combined',
        description: 'A custom template',
        parameters: [
          { name: 'tag', label: 'Tag', type: 'tag', required: true },
        ],
        preview: '?[...]',
      });

      expect(getTemplate('custom-combined')).toBeDefined();
      expect(getTemplate('blocks-with-tag')).toBeDefined();
    });

    it('template definitions can be inspected for building UI', () => {
      const template = getTemplate('pages-modified-in-last-n-days');
      expect(template).toBeDefined();

      // UI can use these properties
      expect(template?.name).toBeDefined();
      expect(template?.description).toBeDefined();
      expect(template?.parameters).toBeInstanceOf(Array);
      expect(template?.preview).toBeDefined();

      // Parameter definitions are complete
      const param = template?.parameters[0];
      expect(param?.name).toBeDefined();
      expect(param?.label).toBeDefined();
      expect(param?.type).toBeDefined();
      expect(param?.helpText).toBeDefined();
    });
  });
});
