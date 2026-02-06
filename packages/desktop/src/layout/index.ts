/**
 * Layout - Application layout components
 *
 * Barrel export for all layout components including Sidebar, AppShell, etc.
 */

export { AppShell, type AppShellProps } from './AppShell.js';

export { Sidebar, QuickCapture, PageList, SidebarFooter, type SidebarProps } from './Sidebar.js';

// Re-export SearchBar from components for convenience
export { SearchBar, type SearchBarProps } from '../components/SearchBar.js';
