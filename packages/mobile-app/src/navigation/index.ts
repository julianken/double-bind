/**
 * Navigation Module Exports
 *
 * Central export point for all navigation-related components and types.
 */

// Root navigator
export { RootNavigator } from './RootNavigator';

// Tab navigator
export { MainTabs } from './MainTabs';

// Stack navigators
export { HomeStack } from './HomeStack';
export { PagesStack } from './PagesStack';
export { SearchStack } from './SearchStack';
export { GraphStack } from './GraphStack';
export { SettingsStack } from './SettingsStack';

// Deep linking
export { linking, getPageDeepLink, getBlockDeepLink, getSearchDeepLink } from './linking';

// Types
export type {
  // Root stack
  RootStackParamList,
  RootStackScreenProps,
  // Main tabs
  MainTabParamList,
  MainTabScreenProps,
  // Home stack
  HomeStackParamList,
  HomeStackScreenProps,
  // Pages stack
  PagesStackParamList,
  PagesStackScreenProps,
  // Search stack
  SearchStackParamList,
  SearchStackScreenProps,
  // Graph stack
  GraphStackParamList,
  GraphStackScreenProps,
  // Settings stack
  SettingsStackParamList,
  SettingsStackScreenProps,
} from './types';
