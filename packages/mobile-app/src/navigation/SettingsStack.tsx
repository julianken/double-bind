/**
 * SettingsStack - Settings navigation stack
 *
 * Handles navigation for the settings tab including:
 * - Main settings screen
 * - Theme settings
 * - Database settings
 * - About screen
 */

import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemeSettingsScreen } from '../screens/ThemeSettingsScreen';
import { DatabaseSettingsScreen } from '../screens/DatabaseSettingsScreen';
import { AboutScreen } from '../screens/AboutScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{
          title: 'Theme',
        }}
      />
      <Stack.Screen
        name="DatabaseSettings"
        component={DatabaseSettingsScreen}
        options={{
          title: 'Database',
        }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: 'About',
        }}
      />
    </Stack.Navigator>
  );
}
