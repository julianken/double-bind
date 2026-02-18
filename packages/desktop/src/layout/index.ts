/**
 * Layout - Application layout components
 *
 * Barrel export for all layout components including Sidebar, AppShell, etc.
 */

export { AppShell, type AppShellProps } from './AppShell.js';
export { AppToolbar, type AppToolbarProps } from './AppToolbar.js';
export { Breadcrumb, type BreadcrumbProps } from './Breadcrumb.js';

export { Sidebar, QuickCapture, SidebarFooter, type SidebarProps } from './Sidebar.js';
export { PageList, type PageListProps } from '../components/PageList.js';

// Re-export SearchBar from components for convenience
export { SearchBar, type SearchBarProps } from '../components/SearchBar.js';
