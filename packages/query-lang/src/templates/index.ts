// @double-bind/query-lang - Template registry

import type { QueryTemplate, CompiledQuery } from '../types.js';

/**
 * Registry of all available query templates
 */
const templates: Map<string, QueryTemplate> = new Map();

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
 */
export function applyTemplate(templateId: string, values: Record<string, unknown>): CompiledQuery {
  // TODO: Implement template application (DBB-221)
  const template = templates.get(templateId);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Validate required parameters
  for (const param of template.parameters) {
    if (values[param.name] === undefined) {
      throw new Error(`Missing required parameter: ${param.name}`);
    }
  }

  // Stub: return a placeholder query
  // Real implementation will substitute parameters into template
  return {
    script: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }`,
    params: values,
  };
}

/**
 * Register a new query template
 *
 * @param template - The template to register
 */
export function registerTemplate(template: QueryTemplate): void {
  templates.set(template.id, template);
}
