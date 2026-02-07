/**
 * App - Root application component
 *
 * Sets up the application shell with:
 * - Global keyboard shortcuts for navigation
 * - Router for screen rendering based on navigation state
 * - AppShell layout with sidebar and main content area
 *
 * The sidebar persists while content swaps based on navigation.
 */

import { useContext } from 'react';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js';
import { Router, type Route } from './components/Router.js';
import { CommandPalette } from './components/CommandPalette.js';
import { useAppStore } from './stores/ui-store.js';
import { useServicesOptional, ServiceContext } from './providers/ServiceProvider.js';
import { PageView as RealPageView } from './screens/PageView.js';
import { GraphViewScreen } from './screens/GraphViewScreen.js';
import { SearchResultsView as RealSearchResultsView } from './screens/SearchResultsView.js';
import { Sidebar as FullSidebar } from './layout/Sidebar.js';
import { invalidateQueries } from './hooks/useCozoQuery.js';

// ============================================================================
// Sidebar Component - Uses full Sidebar when ServiceProvider is available,
// otherwise renders a placeholder for unit testing without services.
// ============================================================================

function PlaceholderSidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const navigateToPage = useAppStore((s) => s.navigateToPage);

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      className="sidebar"
      data-testid="sidebar"
      style={{ width: sidebarWidth }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <h2>Double Bind</h2>
      </div>
      <nav className="sidebar-nav">
        <button onClick={() => navigateToPage('')} aria-label="Daily Notes">
          Daily Notes
        </button>
        <button onClick={() => navigateToPage('graph')} aria-label="Graph View">
          Graph
        </button>
        <button onClick={() => navigateToPage('query')} aria-label="Query Editor">
          Query
        </button>
      </nav>
      <div className="sidebar-pages">
        <h3>Pages</h3>
        <p>Page list will appear here.</p>
      </div>
    </aside>
  );
}

function Sidebar() {
  const services = useContext(ServiceContext);
  const navigateToPage = useAppStore((s) => s.navigateToPage);

  // When ServiceProvider is present, use the full-featured Sidebar
  if (services) {
    const handleNewPage = async () => {
      try {
        const page = await services.pageService.createPage('Untitled');
        // Invalidate the pages query so the PageList refreshes with the new page
        invalidateQueries(['pages']);
        navigateToPage('page/' + page.pageId);
      } catch (error) {
        console.error('Failed to create page:', error);
      }
    };

    return <FullSidebar onNewPage={handleNewPage} />;
  }

  // Placeholder for unit tests without ServiceProvider
  return <PlaceholderSidebar />;
}

// ============================================================================
// Placeholder View Components
// These will be replaced with actual implementations in future issues
// ============================================================================

function DailyNotesView() {
  return (
    <div className="view daily-notes-view" data-testid="daily-notes-view">
      <h1>Daily Notes</h1>
      <p>Today&apos;s notes will appear here.</p>
    </div>
  );
}

/**
 * Placeholder PageView for unit tests (when ServiceProvider is not available)
 */
function PlaceholderPageView({ params }: { params: Record<string, string> }) {
  return (
    <div className="view page-view" data-testid="page-view">
      <h1>Page View</h1>
      <p data-testid="page-id">Page ID: {params.id || 'unknown'}</p>
    </div>
  );
}

/**
 * PageView - Uses real PageView when ServiceProvider is available, otherwise placeholder.
 * This allows unit tests to work without ServiceProvider while E2E tests use the real implementation.
 */
function PageView({ params }: { params: Record<string, string> }) {
  const services = useServicesOptional();
  const pageId = params.id || '';

  // If ServiceProvider is not available (unit tests), use placeholder
  if (!services) {
    return <PlaceholderPageView params={params} />;
  }

  // If no page ID provided, show error
  if (!pageId) {
    return (
      <div className="view page-view" data-testid="page-view">
        <h1>Page Not Found</h1>
        <p>No page ID provided.</p>
      </div>
    );
  }

  // Use real PageView with ServiceProvider available
  return <RealPageView pageId={pageId} />;
}

/**
 * SearchView - Uses real SearchResultsView when ServiceProvider is available,
 * otherwise renders a placeholder for unit testing without ServiceProvider.
 */
function SearchView({ params }: { params: Record<string, string> }) {
  const services = useContext(ServiceContext);

  // When ServiceProvider is present, use the real SearchResultsView
  if (services) {
    return <RealSearchResultsView params={params} />;
  }

  // Placeholder for unit tests without ServiceProvider
  return (
    <div className="view search-view" data-testid="search-view">
      <h1>Search Results</h1>
      <p data-testid="search-query">Query: {params.query || 'none'}</p>
    </div>
  );
}

function QueryView() {
  return (
    <div className="view query-view" data-testid="query-view">
      <h1>Datalog Query Editor</h1>
      <p>Query editor will appear here.</p>
    </div>
  );
}

/**
 * GraphView - Renders real GraphViewScreen when services are available,
 * otherwise renders a placeholder for unit testing without ServiceProvider.
 */
function GraphView() {
  const services = useContext(ServiceContext);

  // When ServiceProvider is present, use the real GraphViewScreen
  if (services) {
    return <GraphViewScreen params={{}} />;
  }

  // Placeholder for unit tests without ServiceProvider
  return (
    <div className="view graph-view" data-testid="graph-view">
      <h1>Graph View</h1>
      <p>Graph visualization will appear here.</p>
    </div>
  );
}

// ============================================================================
// Routes Configuration
// ============================================================================

const routes: Route[] = [
  { id: 'page', path: '/page/:id', component: PageView },
  { id: 'graph', path: '/graph', component: GraphView },
  { id: 'search', path: '/search', component: SearchView },
  { id: 'query', path: '/query', component: QueryView },
];

// ============================================================================
// Navigation Bar Component
// ============================================================================

function NavigationBar() {
  const goBack = useAppStore((s) => s.goBack);
  const goForward = useAppStore((s) => s.goForward);
  const historyIndex = useAppStore((s) => s.historyIndex);
  const pageHistory = useAppStore((s) => s.pageHistory);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < pageHistory.length - 1;

  return (
    <nav className="navigation-bar" data-testid="navigation-bar" aria-label="History navigation">
      <button onClick={goBack} disabled={!canGoBack} aria-label="Go back" title="Go back (Ctrl+[)">
        Back
      </button>
      <button
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Go forward"
        title="Go forward (Ctrl+])"
      >
        Forward
      </button>
    </nav>
  );
}

// ============================================================================
// AppShell Component
// ============================================================================

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <Sidebar />
      <main className="main-content" role="main">
        <NavigationBar />
        <div className="content-area">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// App Component
// ============================================================================

export function App() {
  // Register global keyboard shortcuts
  useGlobalShortcuts();

  return (
    <>
      <AppShell>
        <Router routes={routes} defaultComponent={DailyNotesView} />
      </AppShell>
      <CommandPalette />
    </>
  );
}
