/**
 * PagesStack - Pages navigation stack
 *
 * Handles navigation for the pages tab including:
 * - Page list view
 * - Individual page view
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PagesStackParamList } from './types';
import { PageListScreen } from '../screens/PageListScreen';
import { PageScreen } from '../screens/PageScreen';

const Stack = createNativeStackNavigator<PagesStackParamList>();

export function PagesStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="PageList"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="PageList"
        component={PageListScreen}
        options={{
          title: 'Pages',
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="Page"
        component={PageScreen}
        options={{
          // Title will be set dynamically based on page name
          title: 'Page',
        }}
      />
    </Stack.Navigator>
  );
}
