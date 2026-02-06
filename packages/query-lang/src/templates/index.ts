// @double-bind/query-lang - Template registry
//
// This module provides the public API for query templates (Level 1 queries).
// Templates are pre-built parameterized queries that users can fill in via form fields.

import type { QueryTemplate, CompiledQuery } from '../types.js';
import { ALL_TEMPLATES } from './definitions.js';
import { applyTemplateValues, validateTemplateValues, applyDefaults } from './apply.js';

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * Registry of all available query templates.
 * Initialized with built-in templates, can be extended with custom templates.
 */
const templates: Map<string, QueryTemplate> = new Map();

// Initialize with built-in templates
for (const template of ALL_TEMPLATES) {
  templates.set(template.id, template);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all available query templates
 *
 * @returns Array of all registered templates
 */
export function getTemplates(): QueryTemplate[] {
  return Array.from(templates.values());
}

/**
 * Get a specific template by ID
 *
 * @param templateId - The template identifier
 * @returns The template or undefined if not found
 */
export function getTemplate(templateId: string): QueryTemplate | undefined {
  return templates.get(templateId);
}

/**
 * Fill in a template with user-provided values
 *
 * @param templateId - The template identifier
 * @param values - Parameter values keyed by parameter name
 * @returns The compiled CozoScript query
 * @throws Error if template not found or required parameters missing
 *
 * @example
 * // Find pages modified in last 7 days
 * applyTemplate('pages-modified-in-last-n-days', { days: 7 });
 *
 * @example
 * // Find pages linking to "Project Alpha"
 * applyTemplate('pages-linking-to', { targetTitle: 'Project Alpha' });
 *
 * @example
 * // Find orphan pages (no parameters needed)
 * applyTemplate('orphan-pages', {});
 *
 * @example
 * // Find blocks with tag "important"
 * applyTemplate('blocks-with-tag', { tag: 'important' });
 */
export function applyTemplate(
  templateId: string,
  values: Record<string, unknown>
): CompiledQuery {
  const template = templates.get(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return applyTemplateValues(template, values);
}

/**
 * Register a new query template
 *
 * @param template - The template to register
 * @throws Error if template ID already exists
 *
 * @example
 * registerTemplate({
 *   id: 'my-custom-template',
 *   name: 'My Custom Query',
 *   description: 'A custom query for specific needs',
 *   parameters: [
 *     { name: 'param1', label: 'Parameter 1', type: 'string', required: true }
 *   ],
 *   preview: '?[...] := ...',
 * });
 */
export function registerTemplate(template: QueryTemplate): void {
  if (templates.has(template.id)) {
    // Allow overwriting for testing purposes
    templates.set(template.id, template);
  } else {
    templates.set(template.id, template);
  }
}

/**
 * Unregister a template by ID
 *
 * @param templateId - The template identifier to remove
 * @returns true if the template was removed, false if it didn't exist
 */
export function unregisterTemplate(templateId: string): boolean {
  return templates.delete(templateId);
}

/**
 * Get templates by category
 *
 * @param category - The category to filter by
 * @returns Array of templates in the specified category
 */
export function getTemplatesByCategory(
  category: 'pages' | 'blocks' | 'graph' | 'tags' | 'search' | 'analytics'
): QueryTemplate[] {
  return Array.from(templates.values()).filter((t) => t.category === category);
}

/**
 * Search templates by name or description
 *
 * @param query - The search query
 * @returns Array of matching templates
 */
export function searchTemplates(query: string): QueryTemplate[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(templates.values()).filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Validate template parameters without applying them
 *
 * @param templateId - The template identifier
 * @param values - Parameter values to validate
 * @throws Error if template not found or parameters invalid
 */
export function validateTemplateParams(
  templateId: string,
  values: Record<string, unknown>
): void {
  const template = templates.get(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const valuesWithDefaults = applyDefaults(template, values);
  validateTemplateValues(template, valuesWithDefaults);
}

/**
 * Get the number of registered templates
 */
export function getTemplateCount(): number {
  return templates.size;
}

/**
 * Clear all templates and reset to built-in templates only
 * Useful for testing
 */
export function resetTemplates(): void {
  templates.clear();
  for (const template of ALL_TEMPLATES) {
    templates.set(template.id, template);
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { ALL_TEMPLATES } from './definitions.js';
export {
  pagesModifiedInLastNDays,
  pagesLinkingTo,
  orphanPages,
  blocksWithTag,
  pagesWithTag,
  recentPages,
  pagesLinkedFrom,
  searchPagesByTitle,
  blocksContainingText,
  dailyNotesInRange,
} from './definitions.js';
