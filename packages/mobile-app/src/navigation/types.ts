/**
 * Navigation Type Definitions
 *
 * Centralized type definitions for React Navigation.
 * These types provide type-safety for navigation throughout the app.
 */

import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ============================================================================
// Root Stack Navigator Types
// ============================================================================

/**
 * Root stack param list - top-level navigation structure.
 * Contains the main tabs and modal screens.
 */
export type RootStackParamList = {
  /** Main tab navigator */
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** Page detail screen (modal presentation) */
  PageDetail: { pageId: string };
  /** Block detail screen (modal presentation) */
  BlockDetail: { blockId: string; pageId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// ============================================================================
// Main Tab Navigator Types
// ============================================================================

/**
 * Main tab param list - bottom tab navigation.
 * Each tab has its own stack navigator for nested navigation.
 */
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  PagesTab: NavigatorScreenParams<PagesStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  GraphTab: NavigatorScreenParams<GraphStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// ============================================================================
// Home Stack Navigator Types
// ============================================================================

/**
 * Home stack param list - daily notes and quick access.
 */
export type HomeStackParamList = {
  /** Daily notes / home screen */
  Home: undefined;
  /** Today's daily note */
  DailyNote: { date?: string };
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  MainTabScreenProps<'HomeTab'>
>;

// ============================================================================
// Pages Stack Navigator Types
// ============================================================================

/**
 * Pages stack param list - page list and page viewing.
 */
export type PagesStackParamList = {
  /** List of all pages */
  PageList: undefined;
  /** Single page view */
  Page: { pageId: string };
};

export type PagesStackScreenProps<T extends keyof PagesStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<PagesStackParamList, T>,
  MainTabScreenProps<'PagesTab'>
>;

// ============================================================================
// Search Stack Navigator Types
// ============================================================================

/**
 * Search stack param list - search functionality.
 */
export type SearchStackParamList = {
  /** Search screen with input */
  Search: { query?: string };
  /** Search results detail */
  SearchResults: { query: string };
};

export type SearchStackScreenProps<T extends keyof SearchStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SearchStackParamList, T>,
  MainTabScreenProps<'SearchTab'>
>;

// ============================================================================
// Graph Stack Navigator Types
// ============================================================================

/**
 * Graph stack param list - graph visualization.
 */
export type GraphStackParamList = {
  /** Full graph view */
  Graph: undefined;
  /** Node detail within graph context */
  GraphNode: { nodeId: string };
};

export type GraphStackScreenProps<T extends keyof GraphStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<GraphStackParamList, T>,
  MainTabScreenProps<'GraphTab'>
>;

// ============================================================================
// Settings Stack Navigator Types
// ============================================================================

/**
 * Settings stack param list - app settings and configuration.
 */
export type SettingsStackParamList = {
  /** Main settings screen */
  Settings: undefined;
  /** Theme settings */
  ThemeSettings: undefined;
  /** Database settings */
  DatabaseSettings: undefined;
  /** About screen */
  About: undefined;
};

export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SettingsStackParamList, T>,
  MainTabScreenProps<'SettingsTab'>
>;

// ============================================================================
// Augment React Navigation Types
// ============================================================================

/**
 * Augment the global namespace to provide type-safety for useNavigation hook.
 * This allows TypeScript to infer navigation types throughout the app.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
