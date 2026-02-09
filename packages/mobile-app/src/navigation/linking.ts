/**
 * Deep Linking Configuration
 *
 * Configures URL handling for the app, enabling:
 * - Deep links from external sources (doublebind://page/123)
 * - Universal links (https://doublebind.app/page/123)
 * - Back/forward navigation in development
 */

import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * URL prefixes that the app responds to.
 * - doublebind:// - Custom URL scheme for deep links
 * - https://doublebind.app - Universal links (future)
 */
const prefixes = ['doublebind://', 'https://doublebind.app'];

/**
 * Screen path configuration mapping URLs to screens.
 *
 * Example URLs:
 * - doublebind://page/abc123 -> PageDetail screen with pageId="abc123"
 * - doublebind://block/def456?pageId=abc123 -> BlockDetail screen
 * - doublebind://home -> HomeTab > Home screen
 * - doublebind://pages -> PagesTab > PageList screen
 * - doublebind://search?query=foo -> SearchTab > Search screen with query
 * - doublebind://graph -> GraphTab > Graph screen
 * - doublebind://settings -> SettingsTab > Settings screen
 */
const config: LinkingOptions<RootStackParamList>['config'] = {
  screens: {
    MainTabs: {
      screens: {
        HomeTab: {
          screens: {
            Home: 'home',
            DailyNote: 'daily/:date',
          },
        },
        PagesTab: {
          screens: {
            PageList: 'pages',
            Page: 'pages/:pageId',
          },
        },
        SearchTab: {
          screens: {
            Search: 'search',
            SearchResults: 'search/results/:query',
          },
        },
        GraphTab: {
          screens: {
            Graph: 'graph',
            GraphNode: 'graph/:nodeId',
          },
        },
        SettingsTab: {
          screens: {
            Settings: 'settings',
            ThemeSettings: 'settings/theme',
            DatabaseSettings: 'settings/database',
            About: 'settings/about',
          },
        },
      },
    },
    // Modal screens accessible from any context
    PageDetail: {
      path: 'page/:pageId',
      parse: {
        pageId: (pageId: string) => pageId,
      },
    },
    BlockDetail: {
      path: 'block/:blockId',
      parse: {
        blockId: (blockId: string) => blockId,
        pageId: (pageId: string) => pageId,
      },
    },
  },
};

/**
 * Complete linking configuration for NavigationContainer.
 *
 * Usage:
 * ```tsx
 * import { linking } from './navigation/linking';
 *
 * <NavigationContainer linking={linking}>
 *   <RootNavigator />
 * </NavigationContainer>
 * ```
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes,
  config,
};

/**
 * Get deep link URL for a page.
 * Useful for sharing pages or creating links.
 *
 * @param pageId - The page ID to create a link for
 * @returns Deep link URL string
 */
export function getPageDeepLink(pageId: string): string {
  return `doublebind://page/${encodeURIComponent(pageId)}`;
}

/**
 * Get deep link URL for a block.
 *
 * @param blockId - The block ID to create a link for
 * @param pageId - The page ID containing the block
 * @returns Deep link URL string
 */
export function getBlockDeepLink(blockId: string, pageId: string): string {
  return `doublebind://block/${encodeURIComponent(blockId)}?pageId=${encodeURIComponent(pageId)}`;
}

/**
 * Get deep link URL for search.
 *
 * @param query - The search query
 * @returns Deep link URL string
 */
export function getSearchDeepLink(query: string): string {
  return `doublebind://search?query=${encodeURIComponent(query)}`;
}
