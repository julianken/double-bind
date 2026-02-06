// @double-bind/query-lang - Template definitions
//
// This module defines all the built-in query templates for Level 1 queries.
// Each template is a parameterized query that users can fill in via form fields.

import type { QueryTemplate, TemplateCategory } from '../types.js';

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

/**
 * Template: Pages modified in last N days
 *
 * Finds all pages that have been updated within the specified number of days.
 * Uses the updated_at timestamp field for comparison.
 */
export const pagesModifiedInLastNDays: QueryTemplate = {
  id: 'pages-modified-in-last-n-days',
  name: 'Pages modified in last N days',
  description:
    'Find all pages that have been updated within the specified number of days from today.',
  category: 'pages' as TemplateCategory,
  parameters: [
    {
      name: 'days',
      label: 'Number of days',
      type: 'number',
      placeholder: '7',
      defaultValue: 7,
      required: true,
      helpText: 'Pages modified within this many days will be returned',
    },
  ],
  preview: '?[page_id, title, updated_at] := *pages{ ... }, updated_at > $cutoff',
  icon: 'clock',
  tags: ['recent', 'modified', 'time'],
};

/**
 * Template: Pages linking to X
 *
 * Finds all pages that contain a link to the specified target page.
 * Uses the links relation to find connections.
 */
export const pagesLinkingTo: QueryTemplate = {
  id: 'pages-linking-to',
  name: 'Pages linking to X',
  description:
    'Find all pages that contain a link to a specific page. Enter the page title to find all pages that reference it.',
  category: 'graph' as TemplateCategory,
  parameters: [
    {
      name: 'targetTitle',
      label: 'Target page title',
      type: 'page',
      placeholder: 'Project Alpha',
      required: true,
      helpText: 'The title of the page you want to find backlinks for',
    },
  ],
  preview: '?[page_id, title] := *links{ source_id: page_id, target_id }, *pages{ ... }',
  icon: 'link',
  tags: ['backlinks', 'references', 'connections'],
};

/**
 * Template: Orphan pages
 *
 * Finds all pages that have no incoming links from other pages.
 * These are "lonely" pages that aren't referenced anywhere.
 */
export const orphanPages: QueryTemplate = {
  id: 'orphan-pages',
  name: 'Orphan pages',
  description:
    'Find all pages with no incoming links. These are pages that are not referenced by any other page in your knowledge base.',
  category: 'graph' as TemplateCategory,
  parameters: [],
  preview: '?[page_id, title] := *pages{ ... }, not *links{ target_id: page_id }',
  icon: 'unlink',
  tags: ['orphan', 'disconnected', 'cleanup'],
};

/**
 * Template: Blocks with tag Y
 *
 * Finds all blocks that have been tagged with a specific tag.
 * Tags are commonly used to mark importance, status, or categories.
 */
export const blocksWithTag: QueryTemplate = {
  id: 'blocks-with-tag',
  name: 'Blocks with tag Y',
  description:
    'Find all blocks that have been tagged with a specific tag. Useful for finding TODOs, important items, or any categorized content.',
  category: 'tags' as TemplateCategory,
  parameters: [
    {
      name: 'tag',
      label: 'Tag name',
      type: 'tag',
      placeholder: 'important',
      required: true,
      helpText: 'The tag to search for (without the # symbol)',
    },
  ],
  preview: '?[block_id, content] := *tags{ entity_id: block_id, tag: $tag }, *blocks{ ... }',
  icon: 'tag',
  tags: ['tag', 'search', 'filter'],
};

/**
 * Template: Pages with tag
 *
 * Finds all pages that have been tagged with a specific tag.
 */
export const pagesWithTag: QueryTemplate = {
  id: 'pages-with-tag',
  name: 'Pages with tag',
  description: 'Find all pages that have been tagged with a specific tag.',
  category: 'tags' as TemplateCategory,
  parameters: [
    {
      name: 'tag',
      label: 'Tag name',
      type: 'tag',
      placeholder: 'project',
      required: true,
      helpText: 'The tag to search for (without the # symbol)',
    },
  ],
  preview: '?[page_id, title] := *tags{ entity_id: page_id, tag: $tag }, *pages{ ... }',
  icon: 'tag',
  tags: ['tag', 'search', 'filter'],
};

/**
 * Template: Recent pages
 *
 * Finds pages created in the last N days.
 */
export const recentPages: QueryTemplate = {
  id: 'recent-pages',
  name: 'Recently created pages',
  description: 'Find all pages created within the specified number of days from today.',
  category: 'pages' as TemplateCategory,
  parameters: [
    {
      name: 'days',
      label: 'Number of days',
      type: 'number',
      placeholder: '7',
      defaultValue: 7,
      required: true,
      helpText: 'Pages created within this many days will be returned',
    },
  ],
  preview: '?[page_id, title, created_at] := *pages{ ... }, created_at > $cutoff',
  icon: 'plus',
  tags: ['recent', 'created', 'time'],
};

/**
 * Template: Pages linked from X
 *
 * Finds all pages that a specific page links to (outgoing links).
 */
export const pagesLinkedFrom: QueryTemplate = {
  id: 'pages-linked-from',
  name: 'Pages linked from X',
  description:
    'Find all pages that a specific page links to. Enter the source page title to see its outgoing links.',
  category: 'graph' as TemplateCategory,
  parameters: [
    {
      name: 'sourceTitle',
      label: 'Source page title',
      type: 'page',
      placeholder: 'Project Alpha',
      required: true,
      helpText: 'The title of the page whose outgoing links you want to find',
    },
  ],
  preview: '?[page_id, title] := *links{ source_id, target_id: page_id }, *pages{ ... }',
  icon: 'arrow-right',
  tags: ['outlinks', 'references', 'connections'],
};

/**
 * Template: Search pages by title
 *
 * Finds pages whose title contains the search term.
 */
export const searchPagesByTitle: QueryTemplate = {
  id: 'search-pages-by-title',
  name: 'Search pages by title',
  description: 'Find pages whose title contains the specified search term.',
  category: 'search' as TemplateCategory,
  parameters: [
    {
      name: 'searchTerm',
      label: 'Search term',
      type: 'string',
      placeholder: 'meeting',
      required: true,
      helpText: 'Text to search for in page titles',
    },
  ],
  preview: '?[page_id, title] := *pages{ ... }, contains(title, $searchTerm)',
  icon: 'search',
  tags: ['search', 'title', 'find'],
};

/**
 * Template: Blocks containing text
 *
 * Finds blocks whose content contains the search term.
 */
export const blocksContainingText: QueryTemplate = {
  id: 'blocks-containing-text',
  name: 'Blocks containing text',
  description: 'Find blocks whose content contains the specified search term.',
  category: 'search' as TemplateCategory,
  parameters: [
    {
      name: 'searchTerm',
      label: 'Search term',
      type: 'string',
      placeholder: 'TODO',
      required: true,
      helpText: 'Text to search for in block content',
    },
  ],
  preview: '?[block_id, content] := *blocks{ ... }, contains(content, $searchTerm)',
  icon: 'search',
  tags: ['search', 'content', 'find'],
};

/**
 * Template: Daily notes in date range
 *
 * Finds daily notes within a specified date range.
 */
export const dailyNotesInRange: QueryTemplate = {
  id: 'daily-notes-in-range',
  name: 'Daily notes in date range',
  description: 'Find daily notes between two dates (inclusive).',
  category: 'pages' as TemplateCategory,
  parameters: [
    {
      name: 'startDate',
      label: 'Start date',
      type: 'date',
      placeholder: '2024-01-01',
      required: true,
      helpText: 'Start date in YYYY-MM-DD format',
    },
    {
      name: 'endDate',
      label: 'End date',
      type: 'date',
      placeholder: '2024-12-31',
      required: true,
      helpText: 'End date in YYYY-MM-DD format',
    },
  ],
  preview: '?[date, page_id] := *daily_notes{ ... }, date >= $startDate, date <= $endDate',
  icon: 'calendar',
  tags: ['daily', 'date', 'range'],
};

// ============================================================================
// ALL TEMPLATES
// ============================================================================

/**
 * All built-in templates in registration order
 */
export const ALL_TEMPLATES: QueryTemplate[] = [
  // Primary templates (required by DBB-224)
  pagesModifiedInLastNDays,
  pagesLinkingTo,
  orphanPages,
  blocksWithTag,
  // Additional useful templates
  pagesWithTag,
  recentPages,
  pagesLinkedFrom,
  searchPagesByTitle,
  blocksContainingText,
  dailyNotesInRange,
];

/**
 * Get template by ID from the built-in templates
 */
export function getBuiltInTemplate(templateId: string): QueryTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === templateId);
}
