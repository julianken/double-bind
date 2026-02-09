/**
 * SearchStack - Search navigation stack
 *
 * Handles navigation for the search tab including:
 * - Search input screen
 * - Search results view
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SearchStackParamList } from './types';
import { SearchScreen } from '../screens/SearchScreen';
import { SearchResultsScreen } from '../screens/SearchResultsScreen';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Search"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={({ route }) => ({
          title: `Results: ${route.params.query}`,
        })}
      />
    </Stack.Navigator>
  );
}
