// @double-bind/query-lang - Template application logic
//
// This module handles applying user-provided values to template parameters
// and generating valid CozoScript queries.

import type { QueryTemplate, CompiledQuery } from '../types.js';

// ============================================================================
// COZOSCRIPT GENERATION
// ============================================================================

/**
 * Generate CozoScript for "pages modified in last N days" template
 */
function generatePagesModifiedInLastNDays(values: Record<string, unknown>): CompiledQuery {
  const days = values.days as number;
  // Calculate cutoff timestamp (milliseconds since epoch)
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  return {
    script: `?[page_id, title, updated_at] := *pages{ page_id, title, updated_at, is_deleted: false }, updated_at > $cutoff :order -updated_at`,
    params: { cutoff: cutoffMs },
  };
}

/**
 * Generate CozoScript for "pages linking to X" template
 */
function generatePagesLinkingTo(values: Record<string, unknown>): CompiledQuery {
  const targetTitle = values.targetTitle as string;

  return {
    script: `?[source_page_id, source_title] := *pages{ page_id: target_id, title: $target_title, is_deleted: false }, *links{ source_id: source_page_id, target_id }, *pages{ page_id: source_page_id, title: source_title, is_deleted: false }`,
    params: { target_title: targetTitle },
  };
}

/**
 * Generate CozoScript for "orphan pages" template
 */
function generateOrphanPages(): CompiledQuery {
  return {
    script: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, not *links{ target_id: page_id }`,
    params: {},
  };
}

/**
 * Generate CozoScript for "blocks with tag Y" template
 */
function generateBlocksWithTag(values: Record<string, unknown>): CompiledQuery {
  const tag = values.tag as string;

  return {
    script: `?[block_id, content, page_id] := *tags{ entity_id: block_id, tag: $tag }, *blocks{ block_id, content, page_id, is_deleted: false }`,
    params: { tag },
  };
}

/**
 * Generate CozoScript for "pages with tag" template
 */
function generatePagesWithTag(values: Record<string, unknown>): CompiledQuery {
  const tag = values.tag as string;

  return {
    script: `?[page_id, title] := *tags{ entity_id: page_id, tag: $tag }, *pages{ page_id, title, is_deleted: false }`,
    params: { tag },
  };
}

/**
 * Generate CozoScript for "recent pages" template
 */
function generateRecentPages(values: Record<string, unknown>): CompiledQuery {
  const days = values.days as number;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  return {
    script: `?[page_id, title, created_at] := *pages{ page_id, title, created_at, is_deleted: false }, created_at > $cutoff :order -created_at`,
    params: { cutoff: cutoffMs },
  };
}

/**
 * Generate CozoScript for "pages linked from X" template
 */
function generatePagesLinkedFrom(values: Record<string, unknown>): CompiledQuery {
  const sourceTitle = values.sourceTitle as string;

  return {
    script: `?[target_page_id, target_title] := *pages{ page_id: source_id, title: $source_title, is_deleted: false }, *links{ source_id, target_id: target_page_id }, *pages{ page_id: target_page_id, title: target_title, is_deleted: false }`,
    params: { source_title: sourceTitle },
  };
}

/**
 * Generate CozoScript for "search pages by title" template
 */
function generateSearchPagesByTitle(values: Record<string, unknown>): CompiledQuery {
  const searchTerm = values.searchTerm as string;

  return {
    script: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, contains(title, $search_term)`,
    params: { search_term: searchTerm },
  };
}

/**
 * Generate CozoScript for "blocks containing text" template
 */
function generateBlocksContainingText(values: Record<string, unknown>): CompiledQuery {
  const searchTerm = values.searchTerm as string;

  return {
    script: `?[block_id, content, page_id] := *blocks{ block_id, content, page_id, is_deleted: false }, contains(content, $search_term)`,
    params: { search_term: searchTerm },
  };
}

/**
 * Generate CozoScript for "daily notes in range" template
 */
function generateDailyNotesInRange(values: Record<string, unknown>): CompiledQuery {
  const startDate = values.startDate as string;
  const endDate = values.endDate as string;

  return {
    script: `?[date, page_id, title] := *daily_notes{ date, page_id }, *pages{ page_id, title, is_deleted: false }, date >= $start_date, date <= $end_date :order date`,
    params: { start_date: startDate, end_date: endDate },
  };
}

// ============================================================================
// TEMPLATE APPLICATION
// ============================================================================

/**
 * Registry of template generators by template ID
 */
const TEMPLATE_GENERATORS: Record<
  string,
  (values: Record<string, unknown>) => CompiledQuery
> = {
  'pages-modified-in-last-n-days': generatePagesModifiedInLastNDays,
  'pages-linking-to': generatePagesLinkingTo,
  'orphan-pages': generateOrphanPages,
  'blocks-with-tag': generateBlocksWithTag,
  'pages-with-tag': generatePagesWithTag,
  'recent-pages': generateRecentPages,
  'pages-linked-from': generatePagesLinkedFrom,
  'search-pages-by-title': generateSearchPagesByTitle,
  'blocks-containing-text': generateBlocksContainingText,
  'daily-notes-in-range': generateDailyNotesInRange,
};

/**
 * Validate that all required parameters are provided
 *
 * @param template - The template definition
 * @param values - The user-provided values
 * @throws Error if required parameters are missing
 */
export function validateTemplateValues(
  template: QueryTemplate,
  values: Record<string, unknown>
): void {
  const missing: string[] = [];

  for (const param of template.parameters) {
    const isRequired = param.required !== false;
    const value = values[param.name];

    if (isRequired && value === undefined) {
      // Check if there's a default value
      if (param.defaultValue === undefined) {
        missing.push(param.name);
      }
    }

    // Type validation for provided values
    if (value !== undefined) {
      switch (param.type) {
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(
              `Parameter '${param.name}' must be a valid number, got: ${typeof value}`
            );
          }
          break;
        case 'string':
        case 'page':
        case 'tag':
          if (typeof value !== 'string') {
            throw new Error(
              `Parameter '${param.name}' must be a string, got: ${typeof value}`
            );
          }
          if (value.length === 0) {
            throw new Error(`Parameter '${param.name}' cannot be empty`);
          }
          break;
        case 'date':
          if (typeof value !== 'string') {
            throw new Error(
              `Parameter '${param.name}' must be a date string, got: ${typeof value}`
            );
          }
          // Validate date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(
              `Parameter '${param.name}' must be in YYYY-MM-DD format, got: ${value}`
            );
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw new Error(
              `Parameter '${param.name}' must be a boolean, got: ${typeof value}`
            );
          }
          break;
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required parameter(s): ${missing.join(', ')}`);
  }
}

/**
 * Apply default values to the values object
 *
 * @param template - The template definition
 * @param values - The user-provided values
 * @returns Values with defaults applied
 */
export function applyDefaults(
  template: QueryTemplate,
  values: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...values };

  for (const param of template.parameters) {
    if (result[param.name] === undefined && param.defaultValue !== undefined) {
      result[param.name] = param.defaultValue;
    }
  }

  return result;
}

/**
 * Apply a template with the given values to generate CozoScript
 *
 * @param template - The template definition
 * @param values - The user-provided parameter values
 * @returns The compiled CozoScript query
 * @throws Error if template not supported or parameters invalid
 */
export function applyTemplateValues(
  template: QueryTemplate,
  values: Record<string, unknown>
): CompiledQuery {
  // Apply defaults
  const valuesWithDefaults = applyDefaults(template, values);

  // Validate parameters
  validateTemplateValues(template, valuesWithDefaults);

  // Get the generator for this template
  const generator = TEMPLATE_GENERATORS[template.id];

  if (!generator) {
    throw new Error(`No generator found for template: ${template.id}`);
  }

  return generator(valuesWithDefaults);
}

/**
 * Check if a template ID has a registered generator
 */
export function hasGenerator(templateId: string): boolean {
  return templateId in TEMPLATE_GENERATORS;
}

/**
 * Get all supported template IDs
 */
export function getSupportedTemplateIds(): string[] {
  return Object.keys(TEMPLATE_GENERATORS);
}
