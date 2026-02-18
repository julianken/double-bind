/**
 * routeUtils - Route parsing and label helpers
 *
 * Utilities for extracting page IDs from route params and mapping
 * route types to human-readable labels.
 */

// ============================================================================
// Constants
// ============================================================================

const NON_PAGE_ROUTES = ['graph', 'search', 'daily-notes', 'query'] as const;

// ============================================================================
// Functions
// ============================================================================

/**
 * Returns the page ID if the given route segment refers to a page,
 * or null if it refers to a non-page route (graph, search, daily-notes, query).
 *
 * @param pageId - The route segment to evaluate
 * @returns The page ID, or null for non-page routes
 *
 * @example
 * extractPageIdFromRoute('abc-123') // => 'abc-123'
 * extractPageIdFromRoute('graph')   // => null
 */
export function extractPageIdFromRoute(pageId: string): string | null {
  const nonPageRoutes = NON_PAGE_ROUTES as readonly string[];
  if (nonPageRoutes.includes(pageId)) return null;
  return pageId;
}

/**
 * Returns the human-readable label for a given route type.
 *
 * @param routeType - The route type string (or null)
 * @returns A display label, or empty string for unknown/null types
 *
 * @example
 * getRouteLabel('graph')       // => 'Graph View'
 * getRouteLabel('daily-notes') // => 'Daily Notes'
 * getRouteLabel(null)          // => ''
 */
export function getRouteLabel(routeType: string | null): string {
  switch (routeType) {
    case 'graph':
      return 'Graph View';
    case 'search':
      return 'Search';
    case 'daily-notes':
      return 'Daily Notes';
    case 'query':
      return 'Query';
    default:
      return '';
  }
}
