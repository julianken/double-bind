/**
 * RootNavigator - Top-level navigation structure
 *
 * Combines:
 * - MainTabs: Bottom tab navigation for main app screens
 * - Modal screens: PageDetail and BlockDetail presented as modals
 *
 * This structure allows detail screens to be presented as
 * full-screen modals from anywhere in the app.
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { PageDetailScreen } from '../screens/PageDetailScreen';
import { BlockDetailScreen } from '../screens/BlockDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Main tab navigation */}
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{
          headerShown: false,
        }}
      />

      {/* Modal screens - presented over tabs */}
      <Stack.Group
        screenOptions={{
          presentation: 'modal',
          headerShown: true,
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen
          name="PageDetail"
          component={PageDetailScreen}
          options={{
            title: 'Page',
            // Allow swipe to dismiss on iOS
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="BlockDetail"
          component={BlockDetailScreen}
          options={{
            title: 'Block',
            gestureEnabled: true,
          }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}
