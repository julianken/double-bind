/**
 * Router - Client-side routing for the desktop app
 *
 * Simple Zustand-based router that reads currentPageId from AppStore
 * and renders the appropriate screen component.
 *
 * No URL routing needed for a desktop app - navigation is managed
 * through the AppStore state (currentPageId, pageHistory, etc.)
 *
 * See docs/packages/desktop.md for architecture details.
 */

import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Types
// ============================================================================

export interface Route {
  /**
   * Unique identifier for the route
   */
  id: string;

  /**
   * Path pattern for matching (e.g., '/page/:id', '/daily', '/search')
   * Not used for URL matching in desktop app, but kept for potential
   * future extensibility (e.g., deep linking)
   */
  path: string;

  /**
   * Component to render when route matches
   */
  component: React.ComponentType<RouteComponentProps>;
}

export interface RouteComponentProps {
  /**
   * URL parameters extracted from the path
   * For example, path '/page/:id' with currentPageId 'abc-123'
   * would produce params: { id: 'abc-123' }
   */
  params: Record<string, string>;
}

export interface RouterProps {
  /**
   * Route definitions
   */
  routes: Route[];

  /**
   * Component to render when no route matches (404)
   * Defaults to simple "Page not found" message
   */
  notFoundComponent?: React.ComponentType;

  /**
   * Component to render when no page is selected (empty state)
   * Defaults to DailyNotesView in actual app
   */
  defaultComponent?: React.ComponentType;
}

// ============================================================================
// Default Components
// ============================================================================

function DefaultNotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Page Not Found</h1>
      <p>The requested page could not be found.</p>
    </div>
  );
}

function DefaultEmpty() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>No Page Selected</h1>
      <p>Select a page from the sidebar to get started.</p>
    </div>
  );
}

// ============================================================================
// Route Matching
// ============================================================================

/**
 * Match a path pattern against a page ID
 * Simple pattern matching with :param syntax
 *
 * Examples:
 * - matchPath('/page/:id', 'page-123') => { id: 'page-123' }
 * - matchPath('/daily', null) => {}
 * - matchPath('/search', 'page-123') => null (no match)
 */
function matchPath(pattern: string, pageId: string | null): Record<string, string> | null {
  // Handle empty/null pageId
  if (!pageId) {
    // Only match if pattern has no params
    return pattern.indexOf(':') === -1 ? {} : null;
  }

  // Normalize by removing leading/trailing slashes and splitting
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pageId.split('/').filter(Boolean);

  // Must have same number of parts to match
  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // TypeScript safety - should never happen due to length check above
    if (!patternPart || !pathPart) {
      return null;
    }

    if (patternPart.startsWith(':')) {
      // Param - extract name and value
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // Literal must match exactly
      return null;
    }
  }

  return params;
}

/**
 * Find the first route that matches the current page ID
 */
function findMatchingRoute(
  routes: Route[],
  pageId: string | null
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchPath(route.path, pageId);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}

// ============================================================================
// Router Component
// ============================================================================

/**
 * Router - Renders the appropriate screen based on AppStore state
 *
 * This is a simple, Zustand-based router for the desktop app.
 * No URL management needed - navigation state is in AppStore.
 *
 * Example usage:
 * ```tsx
 * <Router
 *   routes={[
 *     { id: 'page', path: '/page/:id', component: PageView },
 *     { id: 'daily', path: '/daily', component: DailyNotesView },
 *     { id: 'search', path: '/search', component: SearchView },
 *   ]}
 *   defaultComponent={DailyNotesView}
 * />
 * ```
 */
export function Router({
  routes,
  notFoundComponent: NotFound = DefaultNotFound,
  defaultComponent: DefaultComponent = DefaultEmpty,
}: RouterProps) {
  const currentPageId = useAppStore((state) => state.currentPageId);
  const commandPaletteOpen = useAppStore((state) => state.commandPaletteOpen);

  // Command palette takes precedence over all routes
  if (commandPaletteOpen) {
    // Find command palette route if defined
    const commandPaletteRoute = routes.find((r) => r.id === 'command-palette');
    if (commandPaletteRoute) {
      const Component = commandPaletteRoute.component;
      return <Component params={{}} />;
    }
  }

  // No page selected - render default component
  if (!currentPageId) {
    return <DefaultComponent />;
  }

  // Find matching route
  const match = findMatchingRoute(routes, currentPageId);

  if (match) {
    const Component = match.route.component;
    return <Component params={match.params} />;
  }

  // No route matched - render 404
  return <NotFound />;
}
